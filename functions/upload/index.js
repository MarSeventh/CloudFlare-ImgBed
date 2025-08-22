import { userAuthCheck, UnauthorizedResponse } from "../utils/userAuth";
import { fetchUploadConfig, fetchSecurityConfig } from "../utils/sysConfig";
import { createResponse, getUploadIp, getIPAddress, isExtValid,
        moderateContent, purgeCDNCache, isBlockedUploadIp, buildUniqueFileId, endUpload } from "./uploadTools";
import { initializeChunkedUpload, handleChunkUpload, uploadLargeFileToTelegram, handleCleanupRequest} from "./chunkUpload";
import { handleChunkMerge, checkMergeStatus } from "./chunkMerge";
import { TelegramAPI } from "../utils/telegramAPI";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getDatabase } from '../utils/databaseAdapter.js';


export async function onRequest(context) {  // Contents of context object
    const { request, env, params, waitUntil, next, data } = context;

    // 解析请求的URL，存入 context
    const url = new URL(request.url);
    context.url = url;

    // 读取各项配置，存入 context
    const securityConfig = await fetchSecurityConfig(env);
    const uploadConfig = await fetchUploadConfig(env);
    
    context.securityConfig = securityConfig;
    context.uploadConfig = uploadConfig;

    // 鉴权
    const requiredPermission = 'upload';
    if (!await userAuthCheck(env, url, request, requiredPermission)) {
        return UnauthorizedResponse('Unauthorized');
    }

    // 获得上传IP
    const uploadIp = getUploadIp(request);
    // 判断上传ip是否被封禁
    const isBlockedIp = await isBlockedUploadIp(env, uploadIp);
    if (isBlockedIp) {
        return createResponse('Error: Your IP is blocked', { status: 403 });
    }

    // 检查是否为状态查询请求
    const statusCheck = url.searchParams.get('statusCheck') === 'true';
    if (statusCheck) {
        const uploadId = url.searchParams.get('uploadId');
        return await checkMergeStatus(env, uploadId);
    }

    // 检查是否为清理请求
    const cleanupRequest = url.searchParams.get('cleanup') === 'true';
    if (cleanupRequest) {
        const uploadId = url.searchParams.get('uploadId');
        const totalChunks = parseInt(url.searchParams.get('totalChunks')) || 0;
        return await handleCleanupRequest(context, uploadId, totalChunks);
    }

    // 检查是否为初始化分块上传请求
    const initChunked = url.searchParams.get('initChunked') === 'true';
    if (initChunked) {
        return await initializeChunkedUpload(context);
    }

    // 检查是否为分块上传
    const isChunked = url.searchParams.get('chunked') === 'true';
    const isMerge = url.searchParams.get('merge') === 'true';
    
    if (isChunked) {
        if (isMerge) {
            return await handleChunkMerge(context);
        } else {
            return await handleChunkUpload(context);
        }
    }

    // 处理非分块文件上传
    return await processFileUpload(context);
}


// 通用文件上传处理函数
async function processFileUpload(context, formdata = null) {
    const { request, url } = context;

    // 解析表单数据
    formdata = formdata || await request.formData();
    
    // 将 formdata 存储在 context 中
    context.formdata = formdata;

    // 获得上传渠道
    const urlParamUploadChannel = url.searchParams.get('uploadChannel');

    // 获取IP地址
    const uploadIp = getUploadIp(request);
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
        Directory: normalizedFolder === '' ? '' : normalizedFolder + '/',
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
    const fullId = await buildUniqueFileId(context, fileName, fileType);

    // 获得返回链接格式, default为返回/file/id, full为返回完整链接
    const returnFormat = url.searchParams.get('returnFormat') || 'default';
    let returnLink = '';
    if (returnFormat === 'full') {
        returnLink = `${url.origin}/file/${fullId}`;
    } else {
        returnLink = `/file/${fullId}`;
    }

    /* ====================================不同渠道上传======================================= */
    // 出错是否切换渠道自动重试，默认开启
    const autoRetry = url.searchParams.get('autoRetry') === 'false' ? false : true;

    let err = '';
    // 上传到不同渠道
    if (uploadChannel === 'CloudflareR2') {
        // -------------CloudFlare R2 渠道---------------
        const res = await uploadFileToCloudflareR2(context, fullId, metadata, returnLink);
        if (res.status === 200 || !autoRetry) {
            return res;
        } else {
            err = await res.text();
        }
    } else if (uploadChannel === 'S3') {
        // ---------------------S3 渠道------------------
        const res = await uploadFileToS3(context, fullId, metadata, returnLink);
        if (res.status === 200 || !autoRetry) {
            return res;
        } else {
            err = await res.text();
        }
    } else if (uploadChannel === 'External') {
        // --------------------外链渠道----------------------
        const res = await uploadFileToExternal(context, fullId, metadata, returnLink);
        return res;
    } else {
        // ----------------Telegram New 渠道-------------------
        const res = await uploadFileToTelegram(context, fullId, metadata, fileExt, fileName, fileType, returnLink);
        if (res.status === 200 || !autoRetry) {
            return res;
        } else {
            err = await res.text();
        }
    }

    // 上传失败，开始自动切换渠道重试
    const res = await tryRetry(err, context, uploadChannel, fullId, metadata, fileExt, fileName, fileType, returnLink);
    return res;
}

// 上传到Cloudflare R2
async function uploadFileToCloudflareR2(context, fullId, metadata, returnLink) {
    const { env, waitUntil, uploadConfig, formdata } = context;
    const db = getDatabase(env);

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
    metadata.Label = await moderateContent(env, moderateUrl);

    // 写入数据库
    try {
        await db.put(fullId, "", {
            metadata: metadata,
        });
    } catch (error) {
        return createResponse('Error: Failed to write to database', { status: 500 });
    }

    // 结束上传
    waitUntil(endUpload(context, fullId, metadata));

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
async function uploadFileToS3(context, fullId, metadata, returnLink) {
    const { env, waitUntil, uploadConfig, securityConfig, url, formdata } = context;
    const db = getDatabase(env);

    const uploadModerate = securityConfig.upload.moderate;

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
                await db.put(fullId, "", { metadata });
            } catch {
                return createResponse("Error: Failed to write to KV database", { status: 500 });
            }

            const moderateUrl = `https://${url.hostname}/file/${fullId}`;
            await purgeCDNCache(env, moderateUrl, url);
            metadata.Label = await moderateContent(env, moderateUrl);
        }

        // 写入数据库
        try {
            await db.put(fullId, "", { metadata });
        } catch {
            return createResponse("Error: Failed to write to database", { status: 500 });
        }

        // 结束上传
        waitUntil(endUpload(context, fullId, metadata));

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
async function uploadFileToTelegram(context, fullId, metadata, fileExt, fileName, fileType, returnLink) {
    const { env, waitUntil, uploadConfig, url, formdata } = context;
    const db = getDatabase(env);

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

    const telegramAPI = new TelegramAPI(tgBotToken);
    
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
    
    // 上传文件到 Telegram
    let res = createResponse('upload error, check your environment params about telegram channel!', { status: 400 });
    try {
        const response = await telegramAPI.sendFile(formdata.get('file'), tgChatId, sendFunction.url, sendFunction.type);
        const fileInfo = telegramAPI.getFileInfo(response);
        const filePath = await telegramAPI.getFilePath(fileInfo.file_id);
        const id = fileInfo.file_id;
        // 更新FileSize
        metadata.FileSize = (fileInfo.file_size / 1024 / 1024).toFixed(2);

        // 将响应返回给客户端
        res = createResponse(
            JSON.stringify([{ 'src': `${returnLink}` }]),
            {
                status: 200,
                headers: { 
                    'Content-Type': 'application/json',
                }
            }
        );


        // 图像审查
        const moderateUrl = `https://api.telegram.org/file/bot${tgBotToken}/${filePath}`;
        metadata.Label = await moderateContent(env, moderateUrl);

        // 更新metadata，写入KV数据库
        try {
            metadata.Channel = "TelegramNew";
            metadata.ChannelName = tgChannel.name;

            metadata.TgFileId = id;
            metadata.TgChatId = tgChatId;
            metadata.TgBotToken = tgBotToken;
            await db.put(fullId, "", {
                metadata: metadata,
            });
        } catch (error) {
            res = createResponse('Error: Failed to write to KV database', { status: 500 });
        }

        // 结束上传
        waitUntil(endUpload(context, fullId, metadata));

    } catch (error) {
        res = createResponse('upload error, check your environment params about telegram channel!', { status: 400 });
    } finally {
        return res;
    }
}


// 外链渠道
async function uploadFileToExternal(context, fullId, metadata, returnLink) {
    const { env, waitUntil, formdata } = context;
    const db = getDatabase(env);

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
        await db.put(fullId, "", {
            metadata: metadata,
        });
    } catch (error) {
        return createResponse('Error: Failed to write to KV database', { status: 500 });
    }

    // 结束上传
    waitUntil(endUpload(context, fullId, metadata));

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

// 自动切换渠道重试
async function tryRetry(err, context, uploadChannel, fullId, metadata, fileExt, fileName, fileType, returnLink) {
    const { env, url, formdata } = context;

    // 渠道列表
    const channelList = ['CloudflareR2', 'TelegramNew', 'S3'];
    const errMessages = {};
    errMessages[uploadChannel] = 'Error: ' + uploadChannel + err;
    
    for (let i = 0; i < channelList.length; i++) {
        if (channelList[i] !== uploadChannel) {
            let res = null;
            if (channelList[i] === 'CloudflareR2') {
                res = await uploadFileToCloudflareR2(context, fullId, metadata, returnLink);
            } else if (channelList[i] === 'TelegramNew') {
                res = await uploadFileToTelegram(context, fullId, metadata, fileExt, fileName, fileType, returnLink);
            } else if (channelList[i] === 'S3') {
                res = await uploadFileToS3(context, fullId, metadata, returnLink);
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