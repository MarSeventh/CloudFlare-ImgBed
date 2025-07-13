import { errorHandling, telemetryData } from "./utils/middleware";
import { fetchUploadConfig, fetchSecurityConfig } from "./utils/sysConfig";
import { purgeCFCache } from "./utils/purgeCache";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

let uploadConfig = {};
let securityConfig = {};
let rightAuthCode = null;
let uploadModerate = null;
let uploadIp = null;

// 统一的响应创建函数
function createResponse(body, options = {}) {
    const defaultHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, authCode',
    };
    
    return new Response(body, {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers
        }
    });
}

function UnauthorizedException(reason) {
    return createResponse(reason, {
        status: 401,
        statusText: "Unauthorized",
        headers: {
            "Content-Type": "text/plain;charset=UTF-8",
            "Cache-Control": "no-store",
            "Content-Length": reason.length,
        },
    });
}

function isValidAuthCode(envAuthCode, authCode) {
    return authCode === envAuthCode;
}

function isAuthCodeDefined(authCode) {
    return authCode !== undefined && authCode !== null && authCode.trim() !== '';
}


function getCookieValue(cookies, name) {
    const match = cookies.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
}

function authCheck(env, url, request) {
    // 优先从请求 URL 获取 authCode
    let authCode = url.searchParams.get('authCode');
    // 如果 URL 中没有 authCode，从 Referer 中获取
    if (!authCode) {
        const referer = request.headers.get('Referer');
        if (referer) {
            try {
                const refererUrl = new URL(referer);
                authCode = new URLSearchParams(refererUrl.search).get('authCode');
            } catch (e) {
                console.error('Invalid referer URL:', e);
            }
        }
    }
    // 如果 Referer 中没有 authCode，从请求头中获取
    if (!authCode) {
        authCode = request.headers.get('authCode');
    }
    // 如果请求头中没有 authCode，从 Cookie 中获取
    if (!authCode) {
        const cookies = request.headers.get('Cookie');
        if (cookies) {
            authCode = getCookieValue(cookies, 'authCode');
        }
    }
    if (isAuthCodeDefined(rightAuthCode) && !isValidAuthCode(rightAuthCode, authCode)) {
        return false;
    }
    return true;
}

export async function onRequest(context) {  // Contents of context object
    const { request, env, params, waitUntil, next, data } = context;

    const url = new URL(request.url);
    const clonedRequest = await request.clone();

    // 读取安全配置
    securityConfig = await fetchSecurityConfig(env);
    rightAuthCode = securityConfig.auth.user.authCode;
    uploadModerate = securityConfig.upload.moderate;
    
    // 鉴权
    if (!authCheck(env, url, request)) {
        return UnauthorizedException('Unauthorized');
    }

    // 获得上传IP
    uploadIp = request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for") || request.headers.get("x-client-ip") || request.headers.get("x-host") || request.headers.get("x-originating-ip") || request.headers.get("x-cluster-client-ip") || request.headers.get("forwarded-for") || request.headers.get("forwarded") || request.headers.get("via") || request.headers.get("requester") || request.headers.get("true-client-ip") || request.headers.get("client-ip") || request.headers.get("x-remote-ip") || request.headers.get("x-originating-ip") || request.headers.get("fastly-client-ip") || request.headers.get("akamai-origin-hop") || request.headers.get("x-remote-ip") || request.headers.get("x-remote-addr") || request.headers.get("x-remote-host") || request.headers.get("x-client-ip") || request.headers.get("x-client-ips") || request.headers.get("x-client-ip")
    // 判断上传ip是否被封禁
    const isBlockedIp = await isBlockedUploadIp(env, uploadIp);
    if (isBlockedIp) {
        return createResponse('Error: Your IP is blocked', { status: 403 });
    }

    // 读取上传配置
    uploadConfig = await fetchUploadConfig(env);
    
    // 错误处理和遥测
    if (env.dev_mode === undefined || env.dev_mode === null || env.dev_mode !== 'true') {
        await errorHandling(context);
        telemetryData(context);
    }

    // KV 未定义或为空的处理逻辑
    if (typeof env.img_url == "undefined" || env.img_url == null || env.img_url == "") {
        return createResponse('Error: Please configure KV database', { status: 500 });
    } 

    // 检查是否为状态查询请求
    const statusCheck = url.searchParams.get('statusCheck') === 'true';
    if (statusCheck) {
        const uploadId = url.searchParams.get('uploadId');
        return await checkMergeStatus(env, uploadId);
    }

    // 检查是否为分块上传
    const isChunked = url.searchParams.get('chunked') === 'true';
    const isMerge = url.searchParams.get('merge') === 'true';
    
    if (isChunked) {
        if (isMerge) {
            return await handleChunkMerge(context, env, url, clonedRequest);
        } else {
            return await handleChunkUpload(context, env, url, clonedRequest);
        }
    }

    // 处理正常上传
    const formdata = await clonedRequest.formData();
    return await processFileUpload(env, url, formdata);
}


// 通用文件上传处理函数
async function processFileUpload(env, url, formdata) {
    // 获得上传渠道
    const urlParamUploadChannel = url.searchParams.get('uploadChannel');

    // 获取IP地址
    const ipAddress = await getIPAddress(uploadIp);

    // 获取上传文件夹路径
    let uploadFolder = url.searchParams.get('uploadFolder') || '';

    let uploadChannel = 'TelegramNew';
    switch (urlParamUploadChannel) {
        case 'telegram':
            uploadChannel = 'TelegramNew';
            break;
        case 'cfr2':
            uploadChannel = 'CloudflareR2';
            break;
        case 's3':
            uploadChannel = 'S3';
            break;
        case 'external':
            uploadChannel = 'External';
            break;
        default:
            uploadChannel = 'TelegramNew';
            break;
    }

    // 获取文件信息
    const time = new Date().getTime();
    const fileType = formdata.get('file').type;
    let fileName = formdata.get('file').name;
    const fileSize = (formdata.get('file').size / 1024 / 1024).toFixed(2); // 文件大小，单位MB
    
    // 检查fileType和fileName是否存在
    if (fileType === null || fileType === undefined || fileName === null || fileName === undefined) {
        return createResponse('Error: fileType or fileName is wrong, check the integrity of this file!', { status: 400 });
    }

    // 处理文件名，移除特殊字符
    fileName = sanitizeFileName(fileName);
    
    // 如果上传文件夹路径为空，尝试从文件名中获取
    if (uploadFolder === '' || uploadFolder === null || uploadFolder === undefined) {
        uploadFolder = fileName.split('/').slice(0, -1).join('/');
    }
    // 处理文件夹路径格式，确保没有开头的/
    const normalizedFolder = uploadFolder 
        ? uploadFolder.replace(/^\/+/, '') // 移除开头的/
            .replace(/\/{2,}/g, '/') // 替换多个连续的/为单个/
            .replace(/\/$/, '') // 移除末尾的/
        : '';

    const metadata = {
        FileName: fileName,
        FileType: fileType,
        FileSize: fileSize,
        UploadIP: uploadIp,
        UploadAddress: ipAddress,
        ListType: "None",
        TimeStamp: time,
        Label: "None",
        Folder: normalizedFolder || 'root',
    };

    let fileExt = fileName.split('.').pop(); // 文件扩展名
    if (!isExtValid(fileExt)) {
        // 如果文件名中没有扩展名，尝试从文件类型中获取
        fileExt = fileType.split('/').pop();
        if (fileExt === fileType || fileExt === '' || fileExt === null || fileExt === undefined) {
            // Type中无法获取扩展名
            fileExt = 'unknown' // 默认扩展名
        }
    }

    // 构建文件ID
    const nameType = url.searchParams.get('uploadNameType') || 'default'; // 获取命名方式
    const fullId = await buildUniqueFileId(env, nameType, normalizedFolder, fileName, fileExt, time);

    // 获得返回链接格式, default为返回/file/id, full为返回完整链接
    const returnFormat = url.searchParams.get('returnFormat') || 'default';
    let returnLink = '';
    if (returnFormat === 'full') {
        returnLink = `${url.origin}/file/${fullId}`;
    } else {
        returnLink = `/file/${fullId}`;
    }

    // 清除CDN缓存
    const cdnUrl = `https://${url.hostname}/file/${fullId}`;
    await purgeCDNCache(env, cdnUrl, url, normalizedFolder);

    // ====================================不同渠道上传=======================================
    // 出错是否切换渠道自动重试，默认开启
    const autoRetry = url.searchParams.get('autoRetry') === 'false' ? false : true;

    let err = '';
    // 上传到不同渠道
    if (uploadChannel === 'CloudflareR2') {
        // -------------CloudFlare R2 渠道---------------
        const res = await uploadFileToCloudflareR2(env, formdata, fullId, metadata, returnLink, url);
        if (res.status === 200 || !autoRetry) {
            return res;
        } else {
            err = await res.text();
        }
    } else if (uploadChannel === 'S3') {
        // ---------------------S3 渠道------------------
        const res = await uploadFileToS3(env, formdata, fullId, metadata, returnLink, url);
        if (res.status === 200 || !autoRetry) {
            return res;
        } else {
            err = await res.text();
        }
    } else if (uploadChannel === 'External') {
        // --------------------外链渠道----------------------
        const res = await uploadFileToExternal(env, formdata, fullId, metadata, returnLink, url);
        return res;
    } else {
        // ----------------Telegram New 渠道-------------------
        const res = await uploadFileToTelegram(env, formdata, fullId, metadata, fileExt, fileName, fileType, url, returnLink);
        if (res.status === 200 || !autoRetry) {
            return res;
        } else {
            err = await res.text();
        }
    }

    // 上传失败，开始自动切换渠道重试
    const res = await tryRetry(err, env, uploadChannel, formdata, fullId, metadata, fileExt, fileName, fileType, url, returnLink);
    return res;
}


// 自动切换渠道重试
async function tryRetry(err, env, uploadChannel, formdata, fullId, metadata, fileExt, fileName, fileType, url, returnLink) {
    // 渠道列表
    const channelList = ['CloudflareR2', 'TelegramNew', 'S3'];
    const errMessages = {};
    errMessages[uploadChannel] = 'Error: ' + uploadChannel + err;
    for (let i = 0; i < channelList.length; i++) {
        if (channelList[i] !== uploadChannel) {
            let res = null;
            if (channelList[i] === 'CloudflareR2') {
                res = await uploadFileToCloudflareR2(env, formdata, fullId, metadata, returnLink, url);
            } else if (channelList[i] === 'TelegramNew') {
                res = await uploadFileToTelegram(env, formdata, fullId, metadata, fileExt, fileName, fileType, url, returnLink);
            } else if (channelList[i] === 'S3') {
                res = await uploadFileToS3(env, formdata, fullId, metadata, returnLink, url);
            }

            if (res.status === 200) {
                return res;
            } else {
                errMessages[channelList[i]] = 'Error: ' + channelList[i] + await res.text();
            }
        }
    }

    return createResponse(JSON.stringify(errMessages), { status: 500 });
}


// 上传到Cloudflare R2
async function uploadFileToCloudflareR2(env, formdata, fullId, metadata, returnLink, originUrl) {
    // 检查R2数据库是否配置
    if (typeof env.img_r2 == "undefined" || env.img_r2 == null || env.img_r2 == "") {
        return createResponse('Error: Please configure R2 database', { status: 500 });
    }
    // 检查 R2 渠道是否启用
    const r2Settings = uploadConfig.cfr2;
    if (!r2Settings.channels || r2Settings.channels.length === 0) {
        return createResponse('Error: No R2 channel provided', { status: 400 });
    }

    const r2Channel = r2Settings.channels[0];
    
    const R2DataBase = env.img_r2;

    // 写入R2数据库
    await R2DataBase.put(fullId, formdata.get('file'));

    // 更新metadata
    metadata.Channel = "CloudflareR2";
    metadata.ChannelName = "R2_env";

    // 图像审查，采用R2的publicUrl
    const R2PublicUrl = r2Channel.publicUrl;
    let moderateUrl = `${R2PublicUrl}/${fullId}`;
    metadata = await moderateContent(env, moderateUrl, metadata);

    // 写入KV数据库
    try {
        await env.img_url.put(fullId, "", {
            metadata: metadata,
        });
    } catch (error) {
        return createResponse('Error: Failed to write to KV database', { status: 500 });
    }


    // 成功上传，将文件ID返回给客户端
    return createResponse(
        JSON.stringify([{ 'src': `${returnLink}` }]), 
        {
            status: 200,
            headers: { 
                'Content-Type': 'application/json',
            }
        }
    );
}



// 上传到 S3（支持自定义端点）
async function uploadFileToS3(env, formdata, fullId, metadata, returnLink, originUrl) {
    const s3Settings = uploadConfig.s3;
    const s3Channels = s3Settings.channels;
    const s3Channel = s3Settings.loadBalance.enabled
        ? s3Channels[Math.floor(Math.random() * s3Channels.length)]
        : s3Channels[0];

    if (!s3Channel) {
        return createResponse('Error: No S3 channel provided', { status: 400 });
    }

    const { endpoint, pathStyle, accessKeyId, secretAccessKey, bucketName, region } = s3Channel;

    // 创建 S3 客户端
    const s3Client = new S3Client({
        region: region || "auto", // R2 可用 "auto"
        endpoint, // 自定义 S3 端点
        credentials: {
            accessKeyId,
            secretAccessKey
        },
        forcePathStyle: pathStyle // 是否启用路径风格
    });

    // 获取文件
    const file = formdata.get("file");
    if (!file) return createResponse("Error: No file provided", { status: 400 });

    // 转换 Blob 为 Uint8Array
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    const s3FileName = fullId;

    try {
        // S3 上传参数
        const putObjectParams = {
            Bucket: bucketName,
            Key: s3FileName,
            Body: uint8Array, // 直接使用 Blob
            ContentType: file.type
        };

        // 执行上传
        await s3Client.send(new PutObjectCommand(putObjectParams));

        // 更新 metadata
        metadata.Channel = "S3";
        metadata.ChannelName = s3Channel.name;

        const s3ServerDomain = endpoint.replace(/https?:\/\//, "");
        if (pathStyle) {
            metadata.S3Location = `https://${s3ServerDomain}/${bucketName}/${s3FileName}`; // 采用路径风格的 URL
        } else {
            metadata.S3Location = `https://${bucketName}.${s3ServerDomain}/${s3FileName}`; // 采用虚拟主机风格的 URL
        }
        metadata.S3Endpoint = endpoint;
        metadata.S3PathStyle = pathStyle;
        metadata.S3AccessKeyId = accessKeyId;
        metadata.S3SecretAccessKey = secretAccessKey;
        metadata.S3Region = region || "auto";
        metadata.S3BucketName = bucketName;
        metadata.S3FileKey = s3FileName;

        // 图像审查
        if (uploadModerate && uploadModerate.enabled) {
            try {
                await env.img_url.put(fullId, "", { metadata });
            } catch {
                return createResponse("Error: Failed to write to KV database", { status: 500 });
            }

            const moderateUrl = `https://${originUrl.hostname}/file/${fullId}`;
            metadata = await moderateContent(env, moderateUrl, metadata);
            await purgeCDNCache(env, moderateUrl, originUrl);
        }

        // 写入 KV 数据库
        try {
            await env.img_url.put(fullId, "", { metadata });
        } catch {
            return createResponse("Error: Failed to write to KV database", { status: 500 });
        }

        return createResponse(JSON.stringify([{ src: returnLink }]), {
            status: 200,
            headers: { 
                "Content-Type": "application/json",
            },
        });
    } catch (error) {
        return createResponse(`Error: Failed to upload to S3 - ${error.message}`, { status: 500 });
    }
}

// 上传到Telegram
async function uploadFileToTelegram(env, formdata, fullId, metadata, fileExt, fileName, fileType, url, returnLink) {
    // 选择一个 Telegram 渠道上传，若负载均衡开启，则随机选择一个；否则选择第一个
    const tgSettings = uploadConfig.telegram;
    const tgChannels = tgSettings.channels;
    const tgChannel = tgSettings.loadBalance.enabled? tgChannels[Math.floor(Math.random() * tgChannels.length)] : tgChannels[0];
    if (!tgChannel) {
        return createResponse('Error: No Telegram channel provided', { status: 400 });
    }

    const tgBotToken = tgChannel.botToken;
    const tgChatId = tgChannel.chatId;
    const file = formdata.get('file');
    const fileSize = file.size;
    
    // 20MB 分片阈值
    const CHUNK_SIZE = 20 * 1024 * 1024; // 20MB
    
    if (fileSize > CHUNK_SIZE) {
        // 大文件分片上传
        return await uploadLargeFileToTelegram(env, file, fullId, metadata, fileName, fileType, url, returnLink, tgBotToken, tgChatId, tgChannel);
    }

    // 由于TG会把gif后缀的文件转为视频，所以需要修改后缀名绕过限制
    if (fileExt === 'gif') {
        const newFileName = fileName.replace(/\.gif$/, '.jpeg');
        const newFile = new File([formdata.get('file')], newFileName, { type: fileType });
        formdata.set('file', newFile);
    } else if (fileExt === 'webp') {
        const newFileName = fileName.replace(/\.webp$/, '.jpeg');
        const newFile = new File([formdata.get('file')], newFileName, { type: fileType });
        formdata.set('file', newFile);
    }

    // 选择对应的发送接口
    const fileTypeMap = {
        'image/': {'url': 'sendPhoto', 'type': 'photo'},
        'video/': {'url': 'sendVideo', 'type': 'video'},
        'audio/': {'url': 'sendAudio', 'type': 'audio'},
        'application/pdf': {'url': 'sendDocument', 'type': 'document'},
    };

    const defaultType = {'url': 'sendDocument', 'type': 'document'};

    let sendFunction = Object.keys(fileTypeMap).find(key => fileType.startsWith(key)) 
        ? fileTypeMap[Object.keys(fileTypeMap).find(key => fileType.startsWith(key))] 
        : defaultType;

    // GIF 发送接口特殊处理
    if (fileType === 'image/gif' || fileType === 'image/webp' || fileExt === 'gif' || fileExt === 'webp') {
        sendFunction = {'url': 'sendAnimation', 'type': 'animation'};
    }

    // 根据服务端压缩设置处理接口：从参数中获取serverCompress，如果为false，则使用sendDocument接口
    if (url.searchParams.get('serverCompress') === 'false') {
        sendFunction = {'url': 'sendDocument', 'type': 'document'};
    }

    // 根据发送接口向表单嵌入chat_id
    let newFormdata = new FormData();
    newFormdata.append('chat_id', tgChatId);
    newFormdata.append(sendFunction.type, formdata.get('file'));

    
    // 构建目标 URL 
    // const targetUrl = new URL(url.pathname, 'https://telegra.ph'); // telegraph接口，已失效，缅怀
    const targetUrl = new URL(`https://api.telegram.org/bot${tgBotToken}/${sendFunction.url}`); // telegram接口
    // 目标 URL 剔除 authCode 参数
    url.searchParams.forEach((value, key) => {
        if (key !== 'authCode') {
            targetUrl.searchParams.append(key, value);
        }
    });

    // 向目标 URL 发送请求
    let res = createResponse('upload error, check your environment params about telegram channel!', { status: 400 });
    try {
        const response = await fetch(targetUrl.href, {
            method: 'POST',
            headers: {
                "User-Agent": " Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0"
            },
            body: newFormdata,
        });
        const clonedRes = await response.clone().json(); // 等待响应克隆和解析完成
        const fileInfo = getFile(clonedRes);
        const filePath = await getFilePath(tgBotToken, fileInfo.file_id);
        const id = fileInfo.file_id;
        // 更新FileSize
        metadata.FileSize = (fileInfo.file_size / 1024 / 1024).toFixed(2);

        // 若上传成功，将响应返回给客户端
        if (response.ok) {
            res = createResponse(
                JSON.stringify([{ 'src': `${returnLink}` }]),
                {
                    status: 200,
                    headers: { 
                        'Content-Type': 'application/json',
                    }
                }
            );
        }


        // 图像审查
        const moderateUrl = `https://api.telegram.org/file/bot${tgBotToken}/${filePath}`;
        metadata = await moderateContent(env, moderateUrl, metadata);

        // 更新metadata，写入KV数据库
        try {
            metadata.Channel = "TelegramNew";
            metadata.ChannelName = tgChannel.name;

            metadata.TgFileId = id;
            metadata.TgChatId = tgChatId;
            metadata.TgBotToken = tgBotToken;
            await env.img_url.put(fullId, "", {
                metadata: metadata,
            });
        } catch (error) {
            res = createResponse('Error: Failed to write to KV database', { status: 500 });
        }
    } catch (error) {
        res = createResponse('upload error, check your environment params about telegram channel!', { status: 400 });
    } finally {
        return res;
    }
}


// 外链渠道
async function uploadFileToExternal(env, formdata, fullId, metadata, returnLink, originUrl) {
    // 直接将外链写入metadata
    metadata.Channel = "External";
    metadata.ChannelName = "External";
    // 从 formdata 中获取外链
    const extUrl = formdata.get('url');
    if (extUrl === null || extUrl === undefined) {
        return createResponse('Error: No url provided', { status: 400 });
    }
    metadata.ExternalLink = extUrl;
    // 写入KV数据库
    try {
        await env.img_url.put(fullId, "", {
            metadata: metadata,
        });
    } catch (error) {
        return createResponse('Error: Failed to write to KV database', { status: 500 });
    }

    // 返回结果
    return createResponse(
        JSON.stringify([{ 'src': `${returnLink}` }]), 
        {
            status: 200,
            headers: { 
                'Content-Type': 'application/json',
            }
        }
    );
}

// 大文件分片上传到Telegram
async function uploadLargeFileToTelegram(env, file, fullId, metadata, fileName, fileType, url, returnLink, tgBotToken, tgChatId, tgChannel) {
    const CHUNK_SIZE = 20 * 1024 * 1024; // 20MB
    const fileSize = file.size;
    const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);
    
    // 为了避免CPU超时，限制最大分片数（考虑Cloudflare Worker的CPU时间限制）
    if (totalChunks > 50) {
        return createResponse('Error: File too large (exceeds 1GB limit)', { status: 413 });
    }
    
    const chunks = [];
    const uploadedChunks = [];
    
    try {
        // 分片上传，每10个分片做一次微小延迟以避免CPU超时
        for (let i = 0; i < totalChunks; i++) {
            const start = i * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, fileSize);
            const chunkBlob = file.slice(start, end);
            
            // 生成分片文件名
            const chunkFileName = `${fileName}.part${i.toString().padStart(3, '0')}`;
            
            // 上传分片（带重试机制）
            const chunkInfo = await uploadChunkToTelegramWithRetry(
                tgBotToken, 
                tgChatId, 
                chunkBlob, 
                chunkFileName, 
                i, 
                totalChunks
            );
            
            if (!chunkInfo) {
                throw new Error(`Failed to upload chunk ${i + 1}/${totalChunks} after retries`);
            }
            
            // 验证分片信息完整性
            if (!chunkInfo.file_id || !chunkInfo.file_size) {
                throw new Error(`Invalid chunk info for chunk ${i + 1}/${totalChunks}`);
            }
            
            chunks.push({
                index: i,
                fileId: chunkInfo.file_id,
                size: chunkInfo.file_size,
                fileName: chunkFileName
            });
            
            uploadedChunks.push(chunkInfo.file_id);
            
            // 每10个分片检查一下，添加微小延迟避免CPU限制
            if (i > 0 && i % 10 === 0) {
                await new Promise(resolve => setTimeout(resolve, 50)); // 50ms延迟
            }
        }
        
        // 所有分片上传成功，更新metadata
        metadata.Channel = "TelegramNew";
        metadata.ChannelName = tgChannel.name;
        metadata.TgChatId = tgChatId;
        metadata.TgBotToken = tgBotToken;
        metadata.IsChunked = true;
        metadata.TotalChunks = totalChunks;
        metadata.FileSize = (fileSize / 1024 / 1024).toFixed(2);

        
        // 将分片信息存储到value中
        const chunksData = JSON.stringify(chunks);
        
        // 验证分片完整性
        if (chunks.length !== totalChunks) {
            throw new Error(`Chunk count mismatch: expected ${totalChunks}, got ${chunks.length}`);
        }
        
        // 写入最终的KV记录，分片信息作为value
        await env.img_url.put(fullId, chunksData, { metadata });
        
        return createResponse(
            JSON.stringify([{ 'src': returnLink }]),
            {
                status: 200,
                headers: { 
                    'Content-Type': 'application/json',
                }
            }
        );
        
    } catch (error) {
        return createResponse(`Telegram Channel Error: Large file upload failed - ${error.message}`, { status: 500 });
    }
}

// 带重试机制的分片上传
async function uploadChunkToTelegramWithRetry(tgBotToken, tgChatId, chunkBlob, chunkFileName, chunkIndex, totalChunks, maxRetries = 2) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const formData = new FormData();
            formData.append('chat_id', tgChatId);
            formData.append('document', chunkBlob, chunkFileName);
            formData.append('caption', `Part ${chunkIndex + 1}/${totalChunks}`);
            
            const response = await fetch(`https://api.telegram.org/bot${tgBotToken}/sendDocument`, {
                method: 'POST',
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
                },
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            if (!result.ok) {
                throw new Error(result.description || 'Telegram API error');
            }
            
            const fileInfo = getFile(result);
            if (!fileInfo) {
                throw new Error('Failed to extract file info from response');
            }
            
            return fileInfo;
            
        } catch (error) {
            console.warn(`Chunk ${chunkIndex} upload attempt ${attempt + 1} failed:`, error.message);
            
            if (attempt === maxRetries - 1) {
                return null; // 最后一次尝试也失败了
            }
            
            // 减少重试等待时间以节省CPU时间
            await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
        }
    }
    
    return null;
}

// 处理分块上传
async function handleChunkUpload(context, env, url, clonedRequest) {
    try {
        const formdata = await clonedRequest.formData();
        const chunk = formdata.get('file');
        const chunkIndex = parseInt(formdata.get('chunkIndex'));
        const totalChunks = parseInt(formdata.get('totalChunks'));
        const uploadId = formdata.get('uploadId');
        const originalFileName = formdata.get('originalFileName');

        if (!chunk || chunkIndex === null || !totalChunks || !uploadId || !originalFileName) {
            return createResponse('Error: Missing chunk upload parameters', { status: 400 });
        }

        // 将分块存储到KV中，使用uploadId作为前缀
        const chunkKey = `chunk_${uploadId}_${chunkIndex.toString().padStart(3, '0')}`;
        const chunkData = await chunk.arrayBuffer();
        
        // 存储分块数据和元信息
        const chunkMetadata = {
            uploadId,
            chunkIndex,
            totalChunks,
            originalFileName,
            chunkSize: chunkData.byteLength,
            uploadTime: Date.now()
        };

        await env.img_url.put(chunkKey, chunkData, { metadata: chunkMetadata });

        return createResponse(JSON.stringify({
            success: true,
            message: `Chunk ${chunkIndex + 1}/${totalChunks} uploaded successfully`,
            uploadId,
            chunkIndex
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        return createResponse(`Error: Failed to upload chunk - ${error.message}`, { status: 500 });
    }
}

// 处理分块合并
async function handleChunkMerge(context, env, url, clonedRequest) {
    let uploadId, totalChunks, originalFileName, originalFileType, originalFileSize;
    try {
        const formdata = await clonedRequest.formData();
        uploadId = formdata.get('uploadId');
        totalChunks = parseInt(formdata.get('totalChunks'));
        originalFileName = formdata.get('originalFileName');
        originalFileType = formdata.get('originalFileType');
        originalFileSize = parseInt(formdata.get('originalFileSize'));

        if (!uploadId || !totalChunks || !originalFileName) {
            return createResponse('Error: Missing merge parameters', { status: 400 });
        }

        // 快速验证前几个分块是否存在
        const maxChecks = Math.min(5, totalChunks); // 最多检查5个分块
        for (let i = 0; i < maxChecks; i++) {
            const chunkKey = `chunk_${uploadId}_${i.toString().padStart(3, '0')}`;
            const chunkRecord = await env.img_url.get(chunkKey);
            if (!chunkRecord) {
                return createResponse(`Error: Missing chunk ${i} (quick check failed)`, { status: 400 });
            }
        }

        // 大文件异步合并
        const ASYNC_THRESHOLD = 40 * 1024 * 1024; // 40MB
        if (originalFileSize > ASYNC_THRESHOLD || totalChunks > 10) {
            return await handleLargeFileMergeAsync(context, env, url, uploadId, totalChunks, originalFileName, originalFileType, originalFileSize);
        }

        // 小文件直接同步处理
        return await handleSmallFileMergeSync(context, env, url, uploadId, totalChunks, originalFileName, originalFileType);

    } catch (error) {
        // 清理临时分块数据
        context.waitUntil(cleanupChunkData(env, uploadId, totalChunks));

        return createResponse(`Error: Failed to merge chunks - ${error.message}`, { status: 500 });
    }
}

// 处理大文件异步合并
async function handleLargeFileMergeAsync(context, env, url, uploadId, totalChunks, originalFileName, originalFileType, totalSize) {
    try {
        // 创建合并任务状态记录
        const mergeStatus = {
            uploadId,
            status: 'processing',
            progress: 0,
            totalChunks,
            originalFileName,
            originalFileType,
            totalSize,
            createdAt: Date.now(),
            message: 'Starting merge process...'
        };

        // 存储合并状态
        const statusKey = `merge_status_${uploadId}`;
        await env.img_url.put(statusKey, JSON.stringify(mergeStatus), {
            expirationTtl: 3600 // 1小时过期
        });

        // 启动异步合并进程
        context.waitUntil(performAsyncMerge(env, url, uploadId, totalChunks, originalFileName, originalFileType));

        // 立即返回处理状态
        return createResponse(JSON.stringify({
            success: true,
            uploadId,
            status: 'processing',
            message: 'File merge started in background. Please check status using statusCheck API.',
            statusCheckUrl: `${url.pathname}?uploadId=${uploadId}&statusCheck=true&chunked=true&merge=true`
        }), {
            status: 202, // Accepted
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        return createResponse(`Error: Failed to start async merge - ${error.message}`, { status: 500 });
    }
}

// 处理小文件同步合并
async function handleSmallFileMergeSync(context, env, url, uploadId, totalChunks, originalFileName, originalFileType) {
    try {
        // 分批获取分块，避免一次性加载过多数据
        const chunks = [];
        const batchSize = 5; // 每批处理5个分块
        
        for (let batch = 0; batch < Math.ceil(totalChunks / batchSize); batch++) {
            const start = batch * batchSize;
            const end = Math.min(start + batchSize, totalChunks);
            
            // 并行获取当前批次的分块
            const batchPromises = [];
            for (let i = start; i < end; i++) {
                const chunkKey = `chunk_${uploadId}_${i.toString().padStart(3, '0')}`;
                batchPromises.push(
                    env.img_url.getWithMetadata(chunkKey, { type: 'arrayBuffer' })
                        .then(chunkRecord => ({
                            index: i,
                            data: chunkRecord.value,
                            metadata: chunkRecord.metadata
                        }))
                );
            }
            
            const batchChunks = await Promise.all(batchPromises);
            chunks.push(...batchChunks);
            
            // 每批处理后添加微小延迟，避免CPU超时
            if (batch < Math.ceil(totalChunks / batchSize) - 1) {
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }

        // 快速计算总大小
        const totalSize = chunks.reduce((sum, chunk) => sum + chunk.data.byteLength, 0);
        
        // 使用更高效的合并方式
        const mergedData = new Uint8Array(totalSize);
        let offset = 0;

        // 确保分块按顺序排列
        chunks.sort((a, b) => a.index - b.index);
        
        // 分批合并数据，减少单次操作的CPU压力
        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];
            mergedData.set(new Uint8Array(chunk.data), offset);
            offset += chunk.data.byteLength;
            
            // 每处理10个分块添加微小延迟
            if (i > 0 && i % 10 === 0) {
                await new Promise(resolve => setTimeout(resolve, 5));
            }
        }

        // 创建合并后的文件对象
        const mergedFile = new File([mergedData], originalFileName, {
            type: originalFileType || 'application/octet-stream'
        });

        // 创建FormData用于上传
        const mergedFormData = new FormData();
        mergedFormData.append('file', mergedFile);

        // 使用通用函数处理文件上传
        const result = await processFileUpload(env, url, mergedFormData);

        // 异步清理临时分块数据
        context.waitUntil(cleanupChunkData(env, uploadId, totalChunks));

        return result;

    } catch (error) {
        // 异步清理临时分块数据
        context.waitUntil(cleanupChunkData(env, uploadId, totalChunks));
        return createResponse(`Error: Failed to merge chunks synchronously - ${error.message}`, { status: 500 });
    }
}

// 异步执行合并操作
async function performAsyncMerge(env, url, uploadId, totalChunks, originalFileName, originalFileType) {
    const statusKey = `merge_status_${uploadId}`;
    
    try {
        // 更新状态：开始合并
        await updateMergeStatus(env, statusKey, {
            status: 'merging',
            progress: 10,
            message: 'Loading chunks...'
        });

        // 分批获取分块，减少内存压力
        const chunks = [];
        const batchSize = 6; // 减少批次大小，降低内存压力
        
        for (let batch = 0; batch < Math.ceil(totalChunks / batchSize); batch++) {
            const start = batch * batchSize;
            const end = Math.min(start + batchSize, totalChunks);
            
            // 并行获取当前批次的分块
            const batchPromises = [];
            for (let i = start; i < end; i++) {
                const chunkKey = `chunk_${uploadId}_${i.toString().padStart(3, '0')}`;
                batchPromises.push(
                    env.img_url.getWithMetadata(chunkKey, { type: 'arrayBuffer' })
                        .then(chunkRecord => {
                            if (!chunkRecord) {
                                throw new Error(`Missing chunk ${i}`);
                            }
                            return {
                                index: i,
                                data: chunkRecord.value,
                                metadata: chunkRecord.metadata
                            };
                        })
                );
            }
            
            const batchChunks = await Promise.all(batchPromises);
            chunks.push(...batchChunks);
            
            // 更新进度
            const progress = 10 + (end / totalChunks) * 30; // 10-40%
            await updateMergeStatus(env, statusKey, {
                progress: Math.round(progress),
                message: `Loading batch ${batch + 1}/${Math.ceil(totalChunks / batchSize)}...`
            });
            
            // 增加延迟，避免CPU超时
            await new Promise(resolve => setTimeout(resolve, 80));
        }

        // 更新状态：开始合并数据
        await updateMergeStatus(env, statusKey, {
            status: 'assembling',
            progress: 45,
            message: 'Assembling file data...'
        });

        // 确保分块按顺序排列
        chunks.sort((a, b) => a.index - b.index);

        // 计算总大小
        const totalSize = chunks.reduce((sum, chunk) => sum + chunk.data.byteLength, 0);

        // 检查文件大小，超大文件使用多段Uint8Array处理
        const LARGE_FILE_THRESHOLD = 100 * 1024 * 1024; // 100MB 降低阈值
        let mergedFile;

        if (totalSize > LARGE_FILE_THRESHOLD) {
            // 超大文件：使用多个Uint8Array分段处理，避免单个Uint8Array长度限制
            await updateMergeStatus(env, statusKey, {
                progress: 50,
                message: 'Processing large file with multiple segments...'
            });

            // 分段处理：每段最大100MB，避免Uint8Array长度限制
            const SEGMENT_SIZE = 100 * 1024 * 1024; // 100MB
            const uint8ArraySegments = [];
            let currentSegmentSize = 0;
            let currentSegmentData = [];

            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                const chunkData = new Uint8Array(chunk.data);
                
                // 检查是否需要开始新的段
                if (currentSegmentSize + chunkData.byteLength > SEGMENT_SIZE && currentSegmentData.length > 0) {
                    // 合并当前段
                    const segmentSize = currentSegmentData.reduce((sum, data) => sum + data.byteLength, 0);
                    const segmentArray = new Uint8Array(segmentSize);
                    let offset = 0;
                    
                    for (const data of currentSegmentData) {
                        segmentArray.set(data, offset);
                        offset += data.byteLength;
                    }
                    
                    uint8ArraySegments.push(segmentArray);
                    
                    // 重置当前段
                    currentSegmentData = [];
                    currentSegmentSize = 0;
                }
                
                // 添加到当前段
                currentSegmentData.push(chunkData);
                currentSegmentSize += chunkData.byteLength;
                
                // 更新进度
                if (i > 0 && i % 10 === 0) {
                    const currentProgress = 50 + (i / chunks.length) * 10; // 50-60%
                    await updateMergeStatus(env, statusKey, {
                        progress: Math.round(currentProgress),
                        message: `Processing segment ${uint8ArraySegments.length + 1}, chunk ${i}/${chunks.length}...`
                    });
                    // 增加延迟避免CPU超时
                    await new Promise(resolve => setTimeout(resolve, 20));
                }
            }

            // 处理最后一个段
            if (currentSegmentData.length > 0) {
                const segmentSize = currentSegmentData.reduce((sum, data) => sum + data.byteLength, 0);
                const segmentArray = new Uint8Array(segmentSize);
                let offset = 0;
                
                for (const data of currentSegmentData) {
                    segmentArray.set(data, offset);
                    offset += data.byteLength;
                }
                
                uint8ArraySegments.push(segmentArray);
            }

            // 使用多个Uint8Array段创建文件
            mergedFile = new File(uint8ArraySegments, originalFileName, {
                type: originalFileType || 'application/octet-stream'
            });

        } else {
            // 中小文件：传统合并方式
            const mergedData = new Uint8Array(totalSize);
            let offset = 0;

            // 分批合并数据，减少CPU压力
            const mergeProgress = 45;
            for (let i = 0; i < chunks.length; i++) {
                const chunk = chunks[i];
                mergedData.set(new Uint8Array(chunk.data), offset);
                offset += chunk.data.byteLength;
                
                // 每处理10个分块更新进度和添加延迟，增加频率
                if (i > 0 && i % 10 === 0) {
                    const currentProgress = mergeProgress + (i / chunks.length) * 15; // 45-60%
                    await updateMergeStatus(env, statusKey, {
                        progress: Math.round(currentProgress),
                        message: `Assembling... ${i}/${chunks.length} chunks`
                    });
                    await new Promise(resolve => setTimeout(resolve, 50));
                }
            }

            mergedFile = new File([mergedData], originalFileName, {
                type: originalFileType || 'application/octet-stream'
            });
        }

        // 更新状态：开始上传
        await updateMergeStatus(env, statusKey, {
            status: 'uploading',
            progress: 65,
            message: 'Uploading to storage...'
        });

        // 创建FormData用于上传
        const mergedFormData = new FormData();
        mergedFormData.append('file', mergedFile);

        // 直接调用通用函数处理文件上传
        const result = await processFileUpload(env, url, mergedFormData);

        if (result.status === 200) {
            const responseData = await result.json();

            // 清理临时分块数据
            await cleanupChunkData(env, uploadId, totalChunks);

            // 最终状态
            await updateMergeStatus(env, statusKey, {
                status: 'success',
                progress: 100,
                message: 'Upload completed successfully!',
                result: responseData
            });

        } else {
            throw new Error(`Upload failed with status ${result.status}`);
        }

    } catch (error) {
        console.error('Async merge failed:', error);
        
        // 清理分块数据
        await cleanupChunkData(env, uploadId, totalChunks);

        // 更新状态：失败
        await updateMergeStatus(env, statusKey, {
            status: 'error',
            progress: 0,
            message: `Merge failed: ${error.message}`,
            error: error.message
        });
    }
}

// 检查合并状态
async function checkMergeStatus(env, uploadId) {
    try {
        const statusKey = `merge_status_${uploadId}`;
        const statusData = await env.img_url.get(statusKey);
        
        if (!statusData) {
            return createResponse(JSON.stringify({
                error: 'Merge task not found or expired'
            }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        }

        const status = JSON.parse(statusData);
        return createResponse(JSON.stringify(status), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        return createResponse(JSON.stringify({
            error: `Failed to check status: ${error.message}`
        }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}

// 更新合并状态
async function updateMergeStatus(env, statusKey, updates) {
    try {
        const currentData = await env.img_url.get(statusKey);
        if (currentData) {
            const status = JSON.parse(currentData);
            const updatedStatus = { ...status, ...updates, updatedAt: Date.now() };
            await env.img_url.put(statusKey, JSON.stringify(updatedStatus), {
                expirationTtl: 3600 // 1小时过期
            });
        }
    } catch (error) {
        console.error('Failed to update merge status:', error);
    }
}

// 清理分块数据
async function cleanupChunkData(env, uploadId, totalChunks) {
    try {
        for (let i = 0; i < totalChunks; i++) {
            const chunkKey = `chunk_${uploadId}_${i.toString().padStart(3, '0')}`;
            await env.img_url.delete(chunkKey);
        }
    } catch (cleanupError) {
        console.warn('Failed to cleanup chunk data:', cleanupError);
    }
}

// 图像审查
async function moderateContent(env, url, metadata) {
    const enableModerate = uploadModerate && uploadModerate.enabled;

    // 如果未启用审查，直接返回metadata
    if (!enableModerate) {
        metadata.Label = "None";
        return metadata;
    }

    // moderatecontent.com 渠道
    if (uploadModerate.channel === 'moderatecontent.com') {
        const apikey = securityConfig.upload.moderate.moderateContentApiKey;
        if (apikey == undefined || apikey == null || apikey == "") {
            metadata.Label = "None";
        } else {
            try {
                const fetchResponse = await fetch(`https://api.moderatecontent.com/moderate/?key=${apikey}&url=${url}`);
                if (!fetchResponse.ok) {
                    throw new Error(`HTTP error! status: ${fetchResponse.status}`);
                }
                const moderate_data = await fetchResponse.json();
                if (moderate_data.rating_label) {
                    metadata.Label = moderate_data.rating_label;
                }
            } catch (error) {
                console.error('Moderate Error:', error);
                // 将不带审查的图片写入数据库
                metadata.Label = "None";
            }
        }
        return metadata;
    }

    // nsfw 渠道 和 默认渠道
    if (uploadModerate.channel === 'nsfwjs' || uploadModerate.channel === 'default') {
        const defaultApiPath = 'https://nsfwjs.1314883.xyz';
        const nsfwApiPath = uploadModerate.channel === 'default' ? defaultApiPath : securityConfig.upload.moderate.nsfwApiPath;

        try {
            const fetchResponse = await fetch(`${nsfwApiPath}?url=${encodeURIComponent(url)}`);
            if (!fetchResponse.ok) {
                throw new Error(`HTTP error! status: ${fetchResponse.status}`);
            }
            const moderate_data = await fetchResponse.json();

            const score = moderate_data.score || 0;
            if (score >= 0.9) {
                metadata.Label = "adult";
            } else if (score >= 0.7) {
                metadata.Label = "teen";
            } else {
                metadata.Label = "everyone";
            }
        } catch (error) {
            console.error('Moderate Error:', error);
            // 将不带审查的图片写入数据库
            metadata.Label = "None";
        } 

        return metadata;
    }

    metadata.Label = "None";
    return metadata; // 如果没有匹配到任何渠道，直接返回metadata
}

function getFile(response) {
    try {
		if (!response.ok) {
			return null;
		}

		const getFileDetails = (file) => ({
			file_id: file.file_id,
			file_name: file.file_name || file.file_unique_id,
            file_size: file.file_size,
		});

		if (response.result.photo) {
			const largestPhoto = response.result.photo.reduce((prev, current) =>
				(prev.file_size > current.file_size) ? prev : current
			);
			return getFileDetails(largestPhoto);
		}

		if (response.result.video) {
			return getFileDetails(response.result.video);
		}

        if (response.result.audio) {
            return getFileDetails(response.result.audio);
        }

		if (response.result.document) {
			return getFileDetails(response.result.document);
		}

		return null;
	} catch (error) {
		console.error('Error getting file id:', error.message);
		return null;
	}
}

async function getFilePath(bot_token, file_id) {
    try {
        const url = `https://api.telegram.org/bot${bot_token}/getFile?file_id=${file_id}`;
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            "User-Agent": " Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome"
          },
        })
    
        let responseData = await res.json();
        if (responseData.ok) {
          const file_path = responseData.result.file_path
          return file_path
        } else {
          return null;
        }
      } catch (error) {
        return null;
      }
}

async function purgeCDNCache(env, cdnUrl, url, normalizedFolder) {
    if (env.dev_mode === 'true') {
        return;
    }

    // 清除CDN缓存
    try {
        await purgeCFCache(env, cdnUrl);
    } catch (error) {
        console.error('Failed to clear CDN cache:', error);
    }

    // 清除api/randomFileList API缓存
    try {
        const cache = caches.default;
        // await cache.delete(`${url.origin}/api/randomFileList`); delete有bug，通过写入一个max-age=0的response来清除缓存
        const nullResponse = new Response(null, {
            headers: { 'Cache-Control': 'max-age=0' },
        });

        await cache.put(`${url.origin}/api/randomFileList?dir=${normalizedFolder}`, nullResponse);
    } catch (error) {
        console.error('Failed to clear cache:', error);
    }
}

function isExtValid(fileExt) {
    return ['jpeg', 'jpg', 'png', 'gif', 'webp', 
    'mp4', 'mp3', 'ogg',
    'mp3', 'wav', 'flac', 'aac', 'opus',
    'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'pdf', 
    'txt', 'md', 'json', 'xml', 'html', 'css', 'js', 'ts', 'go', 'java', 'php', 'py', 'rb', 'sh', 'bat', 'cmd', 'ps1', 'psm1', 'psd', 'ai', 'sketch', 'fig', 'svg', 'eps', 'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'apk', 'exe', 'msi', 'dmg', 'iso', 'torrent', 'webp', 'ico', 'svg', 'ttf', 'otf', 'woff', 'woff2', 'eot', 'apk', 'crx', 'xpi', 'deb', 'rpm', 'jar', 'war', 'ear', 'img', 'iso', 'vdi', 'ova', 'ovf', 'qcow2', 'vmdk', 'vhd', 'vhdx', 'pvm', 'dsk', 'hdd', 'bin', 'cue', 'mds', 'mdf', 'nrg', 'ccd', 'cif', 'c2d', 'daa', 'b6t', 'b5t', 'bwt', 'isz', 'isz', 'cdi', 'flp', 'uif', 'xdi', 'sdi'
    ].includes(fileExt);
}

// 处理文件名中的特殊字符
function sanitizeFileName(fileName) {
    fileName = decodeURIComponent(fileName);
    fileName = fileName.split('/').pop();

    const unsafeCharsRe = /[\\\/:\*\?"'<>\| \(\)\[\]\{\}#%\^`~;@&=\+\$,]/g;
    return fileName.replace(unsafeCharsRe, '_');
}

// 检查上传IP是否被封禁
async function isBlockedUploadIp(env, uploadIp) {
    // 检查是否配置了KV数据库
    if (typeof env.img_url == "undefined" || env.img_url == null || env.img_url == "") {
        return false;
    }

    const kv = env.img_url;
    let list = await kv.get("manage@blockipList");
    if (list == null) {
        list = [];
    } else {
        list = list.split(",");
    }

    return list.includes(uploadIp);
}

// 生成短链接
function generateShortId(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}


// 获取IP地址
async function getIPAddress(ip) {
    let address = '未知';
    try {
        const ipInfo = await fetch(`https://apimobile.meituan.com/locate/v2/ip/loc?rgeo=true&ip=${ip}`);
        const ipData = await ipInfo.json();
        
        if (ipInfo.ok && ipData.data) {
            const lng = ipData.data?.lng || 0;
            const lat = ipData.data?.lat || 0;
            
            // 读取具体地址
            const addressInfo = await fetch(`https://apimobile.meituan.com/group/v1/city/latlng/${lat},${lng}?tag=0`);
            const addressData = await addressInfo.json();

            if (addressInfo.ok && addressData.data) {
                // 根据各字段是否存在，拼接地址
                address = [
                    addressData.data.detail,
                    addressData.data.city,
                    addressData.data.province,
                    addressData.data.country
                ].filter(Boolean).join(', ');
            }
        }
    } catch (error) {
        console.error('Error fetching IP address:', error);
    }
    return address;
}

// 构建唯一文件ID
async function buildUniqueFileId(env, nameType, normalizedFolder, fileName, fileExt, time) {
    const unique_index = time + Math.floor(Math.random() * 10000);
    let baseId = '';
    
    // 根据命名方式构建基础ID
    if (nameType === 'index') {
        baseId = normalizedFolder ? `${normalizedFolder}/${unique_index}.${fileExt}` : `${unique_index}.${fileExt}`;
    } else if (nameType === 'origin') {
        baseId = normalizedFolder ? `${normalizedFolder}/${fileName}` : fileName;
    } else if (nameType === 'short') {
        // 对于短链接，直接在循环中生成不重复的ID
        while (true) {
            const shortId = generateShortId(8);
            const testFullId = normalizedFolder ? `${normalizedFolder}/${shortId}.${fileExt}` : `${shortId}.${fileExt}`;
            if (await env.img_url.get(testFullId) === null) {
                return testFullId;
            }
        }
    } else {
        baseId = normalizedFolder ? `${normalizedFolder}/${unique_index}_${fileName}` : `${unique_index}_${fileName}`;
    }
    
    // 检查基础ID是否已存在
    if (await env.img_url.get(baseId) === null) {
        return baseId;
    }
    
    // 如果已存在，在文件名后面加上递增编号
    let counter = 1;
    while (true) {
        let duplicateId;
        
        if (nameType === 'index') {
            const baseName = unique_index;
            duplicateId = normalizedFolder ? 
                `${normalizedFolder}/${baseName}(${counter}).${fileExt}` : 
                `${baseName}(${counter}).${fileExt}`;
        } else if (nameType === 'origin') {
            const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
            const ext = fileName.substring(fileName.lastIndexOf('.'));
            duplicateId = normalizedFolder ? 
                `${normalizedFolder}/${nameWithoutExt}(${counter})${ext}` : 
                `${nameWithoutExt}(${counter})${ext}`;
        } else {
            const baseName = `${unique_index}_${fileName}`;
            const nameWithoutExt = baseName.substring(0, baseName.lastIndexOf('.'));
            const ext = baseName.substring(baseName.lastIndexOf('.'));
            duplicateId = normalizedFolder ? 
                `${normalizedFolder}/${nameWithoutExt}(${counter})${ext}` : 
                `${nameWithoutExt}(${counter})${ext}`;
        }
        
        // 检查新ID是否已存在
        if (await env.img_url.get(duplicateId) === null) {
            return duplicateId;
        }
        
        counter++;
        
        // 防止无限循环，最多尝试1000次
        if (counter > 1000) {
            throw new Error('无法生成唯一的文件ID');
        }
    }
}