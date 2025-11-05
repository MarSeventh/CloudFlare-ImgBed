import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { fetchSecurityConfig } from "../utils/sysConfig";
import { TelegramAPI } from "../utils/telegramAPI";
import { setCommonHeaders, setRangeHeaders, handleHeadRequest, getFileContent, isTgChannel,
            returnWithCheck, return404, isDomainAllowed } from './fileTools';
import { getDatabase } from '../utils/databaseAdapter.js';


export async function onRequest(context) {  // Contents of context object
    const {
        request, // same as existing Worker API
        env, // same as existing Worker API
        params, // if filename includes [id] or [[path]]
        waitUntil, // same as ctx.waitUntil in existing Worker API
        next, // used for middleware or to fetch assets
        data, // arbitrary space for passing data between middlewares
    } = context;

    // 解码文件ID
    let fileId = '';
    try {
        params.path = decodeURIComponent(params.path);
        fileId = params.path.split(',').join('/');
    } catch (e) {
        return new Response('Error: Decode Image ID Failed', { status: 400 });
    }

    // 读取安全配置，解析必要参数
    const securityConfig = await fetchSecurityConfig(env);
    context.securityConfig = securityConfig;
    
    const url = new URL(request.url);
    context.url = url;

    const Referer = request.headers.get('Referer')
    context.Referer = Referer;

    // 检查引用域名是否被允许
    if (!isDomainAllowed(context)) {
        return await returnBlockImg(url);
    }
    
    // 从数据库中获取图片记录
    const db = getDatabase(env);
    const imgRecord = await db.getWithMetadata(fileId);
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
    
    /* Cloudflare R2渠道 */
    if (imgRecord.metadata?.Channel === 'CloudflareR2') {
        return await handleR2File(context, fileId, encodedFileName, fileType);
    }

    /* S3渠道 */
    if (imgRecord.metadata?.Channel === "S3") {
        return await handleS3File(context, imgRecord.metadata, encodedFileName, fileType);
    }

    /* 外链渠道 */
    if (imgRecord.metadata?.Channel === 'External') {
        // 直接重定向到外链
        return Response.redirect(imgRecord.metadata?.ExternalLink, 302);
    }

    /* Telegram及Telegraph渠道 */

    // 构建目标 URL
    let targetUrl = '';

    if (isTgChannel(imgRecord)) {
        let TgFileID = ''; // Tg的file_id

        if (imgRecord.metadata?.Channel === 'Telegram') {
            TgFileID = fileId.split('.')[0]; // id为file_id + ext
        } else if (imgRecord.metadata?.Channel === 'TelegramNew') {
            // 检查是否为分片文件
            if (imgRecord.metadata?.IsChunked === true) {
                return await handleTelegramChunkedFile(context, imgRecord, encodedFileName, fileType);
            }
            
            TgFileID = imgRecord.metadata?.TgFileId;

            if (TgFileID === null) {
                return new Response('Error: Failed to fetch image', { status: 500 });
            }
        }

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
    
    try {
        const response = await getFileContent(request, targetUrl);
    
        if (response === null) {
            return new Response('Error: Failed to fetch image', { status: 500 });
        } else if (response.status === 404) {
            return await return404(url);
        }

        const headers = new Headers(response.headers);
        setCommonHeaders(headers, encodedFileName, fileType, Referer, url);

        const newRes =  new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers,
        });

        return newRes;
    } catch (error) {
        return new Response('Error: ' + error, { status: 500 });
    }
}


// 处理 Telegram 渠道分片文件读取
async function handleTelegramChunkedFile(context, imgRecord, encodedFileName, fileType) {
    const { env, request, url, Referer } = context;

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
    
    // 计算文件总大小
    const totalSize = chunks.reduce((total, chunk) => total + (chunk.size || 0), 0);
    
    // 构建响应头
    const headers = new Headers();
    setCommonHeaders(headers, encodedFileName, fileType, Referer, url);
    headers.set('Content-Length', totalSize.toString());
    
    // 添加ETag支持
    const etag = `"${metadata.TimeStamp || Date.now()}-${totalSize}"`;
    headers.set('ETag', etag);
    
    // 检查If-None-Match头（304缓存）
    const ifNoneMatch = request.headers.get('If-None-Match');
    if (ifNoneMatch && ifNoneMatch === etag) {
        return new Response(null, {
            status: 304,
            headers: {
                'ETag': etag,
                'Cache-Control': headers.get('Cache-Control'),
                'Accept-Ranges': 'bytes'
            }
        });
    }
    
    // 检查Range请求头
    const range = request.headers.get('Range');
    let rangeStart = 0;
    let rangeEnd = totalSize - 1;
    let isRangeRequest = false;
    
    if (range) {
        const matches = range.match(/bytes=(\d+)-(\d*)/);
        if (matches) {
            rangeStart = parseInt(matches[1]);
            rangeEnd = matches[2] ? parseInt(matches[2]) : totalSize - 1;
            isRangeRequest = true;
            
            // 验证范围有效性
            if (rangeStart >= totalSize || rangeEnd >= totalSize || rangeStart > rangeEnd) {
                return new Response('Range Not Satisfiable', { status: 416 });
            }
        }
    }
    
    // 处理HEAD请求
    if (request.method === 'HEAD') {
        return handleHeadRequest(headers, etag);
    }
    
    try {
        // 创建支持Range请求的流
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    let currentPosition = 0;
                    
                    for (let i = 0; i < chunks.length; i++) {
                        const chunk = chunks[i];
                        const chunkSize = chunk.size || 0;
                        
                        // 如果当前分片完全在请求范围之前，跳过
                        if (currentPosition + chunkSize <= rangeStart) {
                            currentPosition += chunkSize;
                            continue;
                        }
                        
                        // 如果当前分片完全在请求范围之后，结束
                        if (currentPosition > rangeEnd) {
                            break;
                        }
                        
                        // 获取分片数据
                        const chunkData = await fetchTelegramChunkWithRetry(TgBotToken, chunk, 3);
                        if (!chunkData) {
                            throw new Error(`Failed to fetch chunk ${chunk.index} after retries`);
                        }
                        
                        // 计算在当前分片中的起始和结束位置
                        const chunkStart = Math.max(0, rangeStart - currentPosition);
                        const chunkEnd = Math.min(chunkSize, rangeEnd - currentPosition + 1);
                        
                        // 如果需要部分分片数据
                        if (chunkStart > 0 || chunkEnd < chunkSize) {
                            const partialData = chunkData.slice(chunkStart, chunkEnd);
                            controller.enqueue(partialData);
                        } else {
                            controller.enqueue(chunkData);
                        }
                        
                        currentPosition += chunkSize;
                    }
                    
                    controller.close();
                } catch (error) {
                    controller.error(error);
                }
            }
        });
        
        // 设置Range相关头部
        if (isRangeRequest) {
            setRangeHeaders(headers, rangeStart, rangeEnd, totalSize);
            
            return new Response(stream, {
                status: 206, // Partial Content
                headers,
            });
        } else {
            headers.set('Cache-Control', 'private, max-age=86400'); // CDN 不缓存完整文件，避免 CDN 不支持 Range 请求
            
            return new Response(stream, {
                status: 200,
                headers,
            });
        }
        
    } catch (error) {
        return new Response(`Error: Failed to reconstruct chunked file - ${error.message}`, { status: 500 });
    }
}

// 带重试机制的Telegram分片获取函数
async function fetchTelegramChunkWithRetry(botToken, chunk, maxRetries = 3) {
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
async function handleR2File(context, fileId, encodedFileName, fileType) {
    const { env, request, url, Referer } = context;

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
            // 处理Range请求
            const matches = range.match(/bytes=(\d+)-(\d*)/);
            if (matches) {
                const start = parseInt(matches[1]);
                const end = matches[2] ? parseInt(matches[2]) : undefined;

                const rangeOptions = { 
                    range: {
                        offset: start
                    }
                };
                if (end !== undefined) {
                    rangeOptions.range.length = end - start + 1;
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
        setCommonHeaders(headers, encodedFileName, fileType, Referer, url);
        
        // 处理HEAD请求
        if (request.method === 'HEAD') {
            return handleHeadRequest(headers);
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
async function handleS3File(context, metadata, encodedFileName, fileType) {
    const { Referer, url, request } = context;

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
        setCommonHeaders(headers, encodedFileName, fileType, Referer, url);

        // 设置Content-Length和Content-Range头
        if (response.ContentLength) {
            headers.set('Content-Length', response.ContentLength.toString());
        }
        
        if (response.ContentRange) {
            headers.set('Content-Range', response.ContentRange);
        }
        
        // 处理HEAD请求
        if (request.method === 'HEAD') {
            return handleHeadRequest(headers);
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
