import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { fetchSecurityConfig } from "../utils/sysConfig";
import { TelegramAPI } from "../utils/telegramAPI";

let targetUrl = '';

export async function onRequest(context) {  // Contents of context object
    const {
        request, // same as existing Worker API
        env, // same as existing Worker API
        params, // if filename includes [id] or [[path]]
        waitUntil, // same as ctx.waitUntil in existing Worker API
        next, // used for middleware or to fetch assets
        data, // arbitrary space for passing data between middlewares
    } = context;

    let fileId = '';
    try {
        // 解码params.path
        params.path = decodeURIComponent(params.path);
        // 从path中提取文件ID
        fileId = params.path.split(',').join('/');

    } catch (e) {
        return new Response('Error: Decode Image ID Failed', { status: 400 });
    }

    // 读取安全配置
    const securityConfig = await fetchSecurityConfig(env);
    context.securityConfig = securityConfig;

    const allowedDomains = securityConfig.access.allowedDomains;
    
    const url = new URL(request.url);
    context.url = url;

    let Referer = request.headers.get('Referer')
    if (Referer) {
        try {
            let refererUrl = new URL(Referer);
            if (allowedDomains && allowedDomains.trim() !== '') {
                const domains = allowedDomains.split(',');
                domains.push(url.hostname);// 把自身域名加入白名单

                let isAllowed = domains.some(domain => {
                    let domainPattern = new RegExp(`(^|\\.)${domain.replace('.', '\\.')}$`); // Escape dot in domain
                    return domainPattern.test(refererUrl.hostname);
                });
                
                if (!isAllowed) {
                    return await returnBlockImg(url);
                }
            }
        } catch (e) {
            return await returnBlockImg(url);
        }
    }

    // 检查是否配置了 KV 数据库
    if (typeof env.img_url == "undefined" || env.img_url == null || env.img_url == "") {
        return new Response('Error: Please configure KV database', { status: 500 });
    }
    
    // 检查是否为临时文件（用于审查）
    if (fileId.startsWith('temp_')) {
        const tempRecord = await env.img_url.getWithMetadata(fileId);
        if (!tempRecord) {
            return new Response('Error: Temp file not found', { status: 404 });
        }
        
        const tempMetadata = tempRecord.metadata;
        if (tempMetadata?.skipModeration) {
            return new Response('Error: Temp file unavailable for moderation', { status: 403 });
        }
        
        const headers = new Headers();
        headers.set('Content-Type', 'application/octet-stream');
        headers.set('Access-Control-Allow-Origin', '*');
        headers.set('Cache-Control', 'private, max-age=0, no-cache');
        
        return new Response(tempRecord.value, {
            status: 200,
            headers,
        });
    }
    
    const imgRecord = await env.img_url.getWithMetadata(fileId);
    if (!imgRecord) {
        return new Response('Error: Image Not Found', { status: 404 });
    }
    // 如果metadata不存在，只可能是之前未设置KV，且存储在Telegraph上的图片
    if (!imgRecord.metadata) {
        imgRecord.metadata = {};
    }
    
    const fileName = imgRecord.metadata?.FileName || fileId;
    const encodedFileName = encodeURIComponent(fileName);
    const fileType = imgRecord.metadata?.FileType || null;
    
    // 检查文件可访问状态
    let accessRes = await returnWithCheck(context, imgRecord);
    if (accessRes.status !== 200) {
        return accessRes; // 如果不可访问，直接返回
    }
    
    // Cloudflare R2渠道
    if (imgRecord.metadata?.Channel === 'CloudflareR2') {
        return await handleR2File(env, fileId, fileName, encodedFileName, fileType, Referer, url, request);
    }

    // S3渠道
    if (imgRecord.metadata?.Channel === "S3") {
        return await handleS3File(imgRecord.metadata, fileName, encodedFileName, fileType, Referer, url, request);
    }

    // 外链渠道
    if (imgRecord.metadata?.Channel === 'External') {
        // 直接重定向到外链
        return Response.redirect(imgRecord.metadata?.ExternalLink, 302);
    }
    
    // Telegram及Telegraph渠道
    let TgFileID = ''; // Tg的file_id
    if (imgRecord.metadata?.Channel === 'Telegram') {
        // id为file_id + ext
        TgFileID = fileId.split('.')[0];
    } else if (imgRecord.metadata?.Channel === 'TelegramNew') {
        // 检查是否为分片文件
        if (imgRecord.metadata?.IsChunked === true) {
            return await handleTelegramChunkedFile(imgRecord, request, env, fileName, encodedFileName, fileType, Referer, url);
        }
        
        // id为unique_id + file_name
        TgFileID = imgRecord.metadata?.TgFileId;
        if (TgFileID === null) {
            return new Response('Error: Failed to fetch image', { status: 500 });
        }
    } else {
        // 旧版telegraph
    }

    // 构建目标 URL
    if (isTgChannel(imgRecord)) {
        // 获取TG图片真实地址
        const TgBotToken = imgRecord.metadata?.TgBotToken || env.TG_BOT_TOKEN;
        const tgApi = new TelegramAPI(TgBotToken);
        const filePath = await tgApi.getFilePath(TgFileID);
        if (filePath === null) {
            return new Response('Error: Failed to fetch image path', { status: 500 });
        }
        targetUrl = `https://api.telegram.org/file/bot${TgBotToken}/${filePath}`;
    } else {
        targetUrl = 'https://telegra.ph/' + url.pathname + url.search;
    }

    const response = await getFileContent(request);
    if (response === null) {
        return new Response('Error: Failed to fetch image', { status: 500 });
    } else if (response.status === 404) {
        return await return404(url);
    }
    
    try {
        const headers = new Headers(response.headers);
        headers.set('Content-Disposition', `inline; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`);
        headers.set('Access-Control-Allow-Origin', '*');
        if (fileType) {
            headers.set('Content-Type', fileType);
        }
        // 根据Referer设置CDN缓存策略，如果是从/或/dashboard等访问，则仅允许浏览器缓存；否则设置为public，缓存时间为7天
        if (Referer && Referer.includes(url.origin)) {
            headers.set('Cache-Control', 'private, max-age=86400');
        } else {
            headers.set('Cache-Control', 'public, max-age=604800');
        }
        const newRes =  new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers,
        });
        if (response.ok) {
            return newRes;
        }
        return newRes;
    } catch (error) {
        return new Response('Error: ' + error, { status: 500 });
    }
}

async function returnWithCheck(context, imgRecord) {
    const { request, env, url, securityConfig } = context;
    const whiteListMode = securityConfig.access.whiteListMode;

    const response = new Response('success', { status: 200 });

    // Referer header equal to the dashboard page or upload page
    if (request.headers.get('Referer') && request.headers.get('Referer').includes(url.origin)) {
        //show the image
        return response;
    }

    if (typeof env.img_url == "undefined" || env.img_url == null || env.img_url == "") {
    } else {
        //check the record from kv
        const record = imgRecord;
        if (record.metadata === null) {
        } else {
            //if the record is not null, redirect to the image
            if (record.metadata.ListType == "White") {
                return response;
            } else if (record.metadata.ListType == "Block") {
                return await returnBlockImg(url);
            } else if (record.metadata.Label == "adult") {
                return await returnBlockImg(url);
            }
            //check if the env variables WhiteList_Mode are set
            if (whiteListMode) {
                //if the env variables WhiteList_Mode are set, redirect to the image
                return await returnWhiteListImg(url);
            } else {
                //if the env variables WhiteList_Mode are not set, redirect to the image
                return response;
            }
        }
    }
    // other cases
    return response;
}

// 处理分片文件读取
async function handleTelegramChunkedFile(imgRecord, request, env, fileName, encodedFileName, fileType, Referer, url) {
    const metadata = imgRecord.metadata;
    const TgBotToken = metadata.TgBotToken || env.TG_BOT_TOKEN;
    
    // 从KV的value中读取分片信息
    let chunks = [];
    try {
        if (imgRecord.value) {
            chunks = JSON.parse(imgRecord.value);
            // 确保分片按索引排序
            chunks.sort((a, b) => a.index - b.index);
        }
    } catch (parseError) {
        console.error('Failed to parse chunks data:', parseError);
        return new Response('Error: Invalid chunks data', { status: 500 });
    }
    
    if (chunks.length === 0) {
        return new Response('Error: No chunks found for this file', { status: 500 });
    }
    
    // 验证分片完整性
    const expectedChunks = metadata.TotalChunks || chunks.length;
    if (chunks.length !== expectedChunks) {
        return new Response(`Error: Missing chunks, expected ${expectedChunks}, got ${chunks.length}`, { status: 500 });
    }
    
    try {
        // 对于大文件，使用流式读取
        if (metadata.FileSize && metadata.FileSize > 100 * 1024 * 1024) { // 大于60MB使用流式
            const stream = new ReadableStream({
                async start(controller) {
                    try {
                        for (let i = 0; i < chunks.length; i++) {
                            const chunk = chunks[i];
                            const chunkData = await fetchChunkWithRetry(TgBotToken, chunk, 3);
                            if (!chunkData) {
                                throw new Error(`Failed to fetch chunk ${chunk.index} after retries`);
                            }
                            controller.enqueue(chunkData);
                        }
                        controller.close();
                    } catch (error) {
                        controller.error(error);
                    }
                }
            });
            
            const headers = new Headers();
            headers.set('Content-Disposition', `inline; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`);
            headers.set('Access-Control-Allow-Origin', '*');
            headers.set('Accept-Ranges', 'bytes');
            if (metadata.FileSize) {
                headers.set('Content-Length', metadata.FileSize.toString());
            }
            
            if (fileType) {
                headers.set('Content-Type', fileType);
            }
            
            // 根据Referer设置CDN缓存策略
            if (Referer && Referer.includes(url.origin)) {
                headers.set('Cache-Control', 'private, max-age=86400');
            } else {
                headers.set('Cache-Control', 'public, max-age=604800');
            }
            
            return new Response(stream, {
                status: 200,
                headers,
            });
        }
        
        // 对于较小文件，预先获取所有分片数据
        const chunkDataArray = [];
        
        for (const chunk of chunks) {
            const chunkData = await fetchChunkWithRetry(TgBotToken, chunk, 3);
            if (!chunkData) {
                throw new Error(`Failed to fetch chunk ${chunk.index} after retries`);
            }
            chunkDataArray.push(chunkData);
        }
        
        // 计算总大小
        const totalSize = chunkDataArray.reduce((sum, chunk) => sum + chunk.length, 0);
        
        // 创建合并后的数组
        const mergedData = new Uint8Array(totalSize);
        let offset = 0;
        
        for (const chunkData of chunkDataArray) {
            mergedData.set(chunkData, offset);
            offset += chunkData.length;
        }
        
        const headers = new Headers();
        headers.set('Content-Disposition', `inline; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`);
        headers.set('Access-Control-Allow-Origin', '*');
        headers.set('Content-Length', totalSize.toString());
        
        if (fileType) {
            headers.set('Content-Type', fileType);
        }
        
        // 根据Referer设置CDN缓存策略
        if (Referer && Referer.includes(url.origin)) {
            headers.set('Cache-Control', 'private, max-age=86400');
        } else {
            headers.set('Cache-Control', 'public, max-age=604800');
        }
        
        // 返回合并后的完整文件
        return new Response(mergedData, {
            status: 200,
            headers,
        });
        
    } catch (error) {
        return new Response(`Error: Failed to reconstruct chunked file - ${error.message}`, { status: 500 });
    }
}

// 带重试机制的分片获取函数
async function fetchChunkWithRetry(botToken, chunk, maxRetries = 3) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const tgApi = new TelegramAPI(botToken);

            const response = await tgApi.getFileContent(chunk.fileId);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            // 验证分片大小是否匹配
            const chunkData = await response.arrayBuffer();
            const actualSize = chunkData.byteLength;
            
            // 如果有期望大小且不匹配，抛出错误
            if (chunk.size && actualSize !== chunk.size) {
                console.warn(`Chunk ${chunk.index} size mismatch: expected ${chunk.size}, got ${actualSize}`);
            }
            
            return new Uint8Array(chunkData);
            
        } catch (error) {
            console.warn(`Chunk ${chunk.index} fetch attempt ${attempt + 1} failed:`, error.message);
            
            if (attempt === maxRetries - 1) {
                return null; // 最后一次尝试也失败了
            }
            
            // 重试前等待一段时间
            await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
        }
    }
    
    return null;
}

// 处理R2文件读取
async function handleR2File(env, fileId, fileName, encodedFileName, fileType, Referer, url, request) {
    try {
        // 检查是否配置了R2
        if (typeof env.img_r2 == "undefined" || env.img_r2 == null || env.img_r2 == "") {
            return new Response('Error: Please configure R2 database', { status: 500 });
        }
        
        const R2DataBase = env.img_r2;
        
        // 检查Range请求头
        const range = request.headers.get('Range');
        let object;
        
        if (range) {
            // 处理Range请求（用于大文件流式传输）
            const matches = range.match(/bytes=(\d+)-(\d*)/);
            if (matches) {
                const start = parseInt(matches[1]);
                const end = matches[2] ? parseInt(matches[2]) : undefined;
                
                const rangeOptions = { offset: start };
                if (end !== undefined) {
                    rangeOptions.length = end - start + 1;
                }
                
                object = await R2DataBase.get(fileId, rangeOptions);
            } else {
                object = await R2DataBase.get(fileId);
            }
        } else {
            object = await R2DataBase.get(fileId);
        }

        if (object === null) {
            return new Response('Error: Failed to fetch file', { status: 500 });
        }

        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('Content-Disposition', `inline; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`);
        headers.set('Access-Control-Allow-Origin', '*');
        headers.set('Accept-Ranges', 'bytes');
        
        if (fileType) {
            headers.set('Content-Type', fileType);
        }
        
        // 根据Referer设置CDN缓存策略
        if (Referer && Referer.includes(url.origin)) {
            headers.set('Cache-Control', 'private, max-age=86400');
        } else {
            headers.set('Cache-Control', 'public, max-age=604800');
        }

        // 如果是Range请求，设置相应的状态码和头
        if (range && object.range) {
            headers.set('Content-Range', `bytes ${object.range.offset}-${object.range.offset + object.range.length - 1}/${object.size}`);
            headers.set('Content-Length', object.range.length.toString());
            
            return new Response(object.body, {
                status: 206, // Partial Content
                headers,
            });
        }

        // 正常请求
        return new Response(object.body, {
            status: 200,
            headers,
        });
    } catch (error) {
        return new Response(`Error: Failed to fetch from R2 - ${error.message}`, { status: 500 });
    }
}

// 处理S3文件读取
async function handleS3File(metadata, fileName, encodedFileName, fileType, Referer, url, request) {
    const s3Client = new S3Client({
        region: metadata?.S3Region || "auto",
        endpoint: metadata?.S3Endpoint,
        credentials: {
            accessKeyId: metadata?.S3AccessKeyId,
            secretAccessKey: metadata?.S3SecretAccessKey
        },
        forcePathStyle: metadata?.S3PathStyle || false
    });

    const bucketName = metadata?.S3BucketName;
    const key = metadata?.S3FileKey;

    try {
        // 检查Range请求头
        const range = request.headers.get('Range');
        const commandParams = {
            Bucket: bucketName,
            Key: key
        };
        
        if (range) {
            // 添加Range参数用于部分内容请求
            commandParams.Range = range;
        }
        
        const command = new GetObjectCommand(commandParams);
        const response = await s3Client.send(command);

        // 设置响应头
        const headers = new Headers();
        headers.set("Content-Disposition", `inline; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`);
        headers.set("Access-Control-Allow-Origin", "*");
        headers.set('Accept-Ranges', 'bytes');

        if (fileType) {
            headers.set("Content-Type", fileType);
        }

        // 根据Referer设置CDN缓存策略
        if (Referer && Referer.includes(url.origin)) {
            headers.set('Cache-Control', 'private, max-age=86400');
        } else {
            headers.set('Cache-Control', 'public, max-age=604800');
        }

        // 设置Content-Length和Content-Range头
        if (response.ContentLength) {
            headers.set('Content-Length', response.ContentLength.toString());
        }
        
        if (response.ContentRange) {
            headers.set('Content-Range', response.ContentRange);
        }

        // 返回响应，支持流式传输
        const statusCode = range ? 206 : 200; // Range请求返回206 Partial Content
        return new Response(response.Body, { 
            status: statusCode, 
            headers 
        });

    } catch (error) {
        return new Response(`Error: Failed to fetch from S3 - ${error.message}`, { status: 500 });
    }
}

async function getFileContent(request, max_retries = 2) {
    let retries = 0;
    while (retries <= max_retries) {
        try {
            const response = await fetch(targetUrl, {
                method: request.method,
                headers: request.headers,
                body: request.body,
            });
            if (response.ok || response.status === 304) {
                return response;
            } else if (response.status === 404) {
                return new Response('Error: Image Not Found', { status: 404 });
            } else {
                retries++;
            }
        } catch (error) {
            retries++;
        }
    }
    return null;
}

function isTgChannel(imgRecord) {
    return imgRecord.metadata?.Channel === 'Telegram' || imgRecord.metadata?.Channel === 'TelegramNew';
}

async function return404(url) {
    const Img404 = await fetch(url.origin + "/static/404.png");
    if (!Img404.ok) {
        return new Response('Error: Image Not Found',
            {
                status: 404,
                headers: {
                    "Cache-Control": "public, max-age=86400"
                }
            }
        );
    } else {
        return new Response(Img404.body, {
            status: 404,
            headers: {
                "Content-Type": "image/png",
                "Content-Disposition": "inline",
                "Cache-Control": "public, max-age=86400",
            },
        });
    }
}

async function returnBlockImg(url) {
    const blockImg = await fetch(url.origin + "/static/BlockImg.png");
    if (!blockImg.ok) {
        return new Response(null, {
            status: 302,
            headers: {
                "Location": url.origin + "/blockimg",
                "Cache-Control": "public, max-age=86400"
            }
        })
    } else {
        return new Response(blockImg.body, {
            status: 403,
            headers: {
                "Content-Type": "image/png",
                "Content-Disposition": "inline",
                "Cache-Control": "public, max-age=86400",
            },
        });
    }
}

async function returnWhiteListImg(url) {
    const WhiteListImg = await fetch(url.origin + "/static/WhiteListOn.png");
    if (!WhiteListImg.ok) {
        return new Response(null, {
            status: 302,
            headers: {
                "Location": url.origin + "/whiteliston",
                "Cache-Control": "public, max-age=86400"
            }
        })
    } else {
        return new Response(WhiteListImg.body, {
            status: 403,
            headers: {
                "Content-Type": "image/png",
                "Content-Disposition": "inline",
                "Cache-Control": "public, max-age=86400",
            },
        });
    }
}
