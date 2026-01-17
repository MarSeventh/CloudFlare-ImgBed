import { userAuthCheck, UnauthorizedResponse } from "../utils/userAuth";
import { fetchUploadConfig, fetchSecurityConfig } from "../utils/sysConfig";
import {
    createResponse, getUploadIp, getIPAddress, isExtValid,
    moderateContent, purgeCDNCache, isBlockedUploadIp, buildUniqueFileId, endUpload
} from "./uploadTools";
import { initializeChunkedUpload, handleChunkUpload, uploadLargeFileToTelegram, handleCleanupRequest } from "./chunkUpload";
import { handleChunkMerge } from "./chunkMerge";
import { TelegramAPI } from "../utils/telegramAPI";
import { DiscordAPI } from "../utils/discordAPI";
import { HuggingFaceAPI } from "../utils/huggingfaceAPI";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getDatabase } from '../utils/databaseAdapter.js';


export async function onRequest(context) {  // Contents of context object
    const { request, env, params, waitUntil, next, data } = context;

    // 解析请求的URL，存入 context
    const url = new URL(request.url);
    context.url = url;

    // 读取各项配置，存入 context
    const securityConfig = await fetchSecurityConfig(env);
    const uploadConfig = await fetchUploadConfig(env, context);

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

    // 获得上传渠道类型
    const urlParamUploadChannel = url.searchParams.get('uploadChannel');
    // 获得指定的渠道名称（可选）
    const urlParamChannelName = url.searchParams.get('channelName');

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
        case 'discord':
            uploadChannel = 'Discord';
            break;
        case 'huggingface':
            uploadChannel = 'HuggingFace';
            break;
        case 'external':
            uploadChannel = 'External';
            break;
        default:
            uploadChannel = 'TelegramNew';
            break;
    }

    // 将指定的渠道名称存入 context，供后续上传函数使用
    context.specifiedChannelName = urlParamChannelName || null;

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
        Tags: []
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
    } else if (uploadChannel === 'Discord') {
        // ---------------------Discord 渠道------------------
        const res = await uploadFileToDiscord(context, fullId, metadata, returnLink);
        if (res.status === 200 || !autoRetry) {
            return res;
        } else {
            err = await res.text();
        }
    } else if (uploadChannel === 'HuggingFace') {
        // ---------------------HuggingFace 渠道------------------
        const res = await uploadFileToHuggingFace(context, fullId, metadata, returnLink);
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
    const { env, waitUntil, uploadConfig, formdata, specifiedChannelName } = context;
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

    // 选择渠道：优先使用指定的渠道名称
    let r2Channel;
    if (specifiedChannelName) {
        r2Channel = r2Settings.channels.find(ch => ch.name === specifiedChannelName);
    }
    if (!r2Channel) {
        r2Channel = r2Settings.channels[0];
    }

    const R2DataBase = env.img_r2;

    // 写入R2数据库，获取实际存储大小
    const r2Object = await R2DataBase.put(fullId, formdata.get('file'));

    // 更新metadata
    metadata.Channel = "CloudflareR2";
    metadata.ChannelName = r2Channel.name || "R2_env";
    // 使用 R2 返回的实际文件大小
    if (r2Object && r2Object.size) {
        metadata.FileSize = (r2Object.size / 1024 / 1024).toFixed(2);
    }

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
    const { env, waitUntil, uploadConfig, securityConfig, url, formdata, specifiedChannelName } = context;
    const db = getDatabase(env);

    const uploadModerate = securityConfig.upload.moderate;

    const s3Settings = uploadConfig.s3;
    const s3Channels = s3Settings.channels;
    
    // 选择渠道：优先使用指定的渠道名称
    let s3Channel;
    if (specifiedChannelName) {
        s3Channel = s3Channels.find(ch => ch.name === specifiedChannelName);
    }
    if (!s3Channel) {
        s3Channel = s3Settings.loadBalance.enabled
            ? s3Channels[Math.floor(Math.random() * s3Channels.length)]
            : s3Channels[0];
    }

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
    const { env, waitUntil, uploadConfig, url, formdata, specifiedChannelName } = context;
    const db = getDatabase(env);

    // 选择一个 Telegram 渠道上传
    const tgSettings = uploadConfig.telegram;
    const tgChannels = tgSettings.channels;
    
    let tgChannel;
    // 如果指定了渠道名称，优先使用指定的渠道
    if (specifiedChannelName) {
        tgChannel = tgChannels.find(ch => ch.name === specifiedChannelName);
    }
    // 未指定或未找到指定渠道，使用负载均衡或第一个
    if (!tgChannel) {
        tgChannel = tgSettings.loadBalance.enabled ? tgChannels[Math.floor(Math.random() * tgChannels.length)] : tgChannels[0];
    }
    if (!tgChannel) {
        return createResponse('Error: No Telegram channel provided', { status: 400 });
    }

    const tgBotToken = tgChannel.botToken;
    const tgChatId = tgChannel.chatId;
    const tgProxyUrl = tgChannel.proxyUrl || '';
    const file = formdata.get('file');
    const fileSize = file.size;

    const telegramAPI = new TelegramAPI(tgBotToken, tgProxyUrl);

    // 16MB 分片阈值 (TG Bot getFile download limit: 20MB, leave 4MB safety margin)
    const CHUNK_SIZE = 16 * 1024 * 1024; // 16MB

    if (fileSize > CHUNK_SIZE) {
        // 大文件分片上传
        return await uploadLargeFileToTelegram(context, file, fullId, metadata, fileName, fileType, returnLink, tgBotToken, tgChatId, tgChannel);
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
        'image/': { 'url': 'sendPhoto', 'type': 'photo' },
        'video/': { 'url': 'sendVideo', 'type': 'video' },
        'audio/': { 'url': 'sendAudio', 'type': 'audio' },
        'application/pdf': { 'url': 'sendDocument', 'type': 'document' },
    };

    const defaultType = { 'url': 'sendDocument', 'type': 'document' };

    let sendFunction = Object.keys(fileTypeMap).find(key => fileType.startsWith(key))
        ? fileTypeMap[Object.keys(fileTypeMap).find(key => fileType.startsWith(key))]
        : defaultType;

    // GIF ICO 等发送接口特殊处理
    if (fileType === 'image/gif' || fileType === 'image/webp' || fileExt === 'gif' || fileExt === 'webp') {
        sendFunction = { 'url': 'sendAnimation', 'type': 'animation' };
    } else if (fileType === 'image/svg+xml' || fileType === 'image/x-icon') {
        sendFunction = { 'url': 'sendDocument', 'type': 'document' };
    }

    // 根据服务端压缩设置处理接口：从参数中获取serverCompress，如果为false，则使用sendDocument接口
    if (url.searchParams.get('serverCompress') === 'false') {
        sendFunction = { 'url': 'sendDocument', 'type': 'document' };
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


        // 图像审查（使用代理域名或官方域名）
        const moderateDomain = tgProxyUrl ? `https://${tgProxyUrl}` : 'https://api.telegram.org';
        const moderateUrl = `${moderateDomain}/file/bot${tgBotToken}/${filePath}`;
        metadata.Label = await moderateContent(env, moderateUrl);

        // 更新metadata，写入KV数据库
        try {
            metadata.Channel = "TelegramNew";
            metadata.ChannelName = tgChannel.name;

            metadata.TgFileId = id;
            metadata.TgChatId = tgChatId;
            metadata.TgBotToken = tgBotToken;
            // 保存代理域名配置
            if (tgProxyUrl) {
                metadata.TgProxyUrl = tgProxyUrl;
            }
            await db.put(fullId, "", {
                metadata: metadata,
            });
        } catch (error) {
            res = createResponse('Error: Failed to write to KV database', { status: 500 });
        }

        // 结束上传
        waitUntil(endUpload(context, fullId, metadata));

    } catch (error) {
        console.log('Telegram upload error:', error.message);
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


// 上传到 Discord
async function uploadFileToDiscord(context, fullId, metadata, returnLink) {
    const { env, waitUntil, uploadConfig, formdata, specifiedChannelName } = context;
    const db = getDatabase(env);

    // 获取 Discord 渠道配置
    const discordSettings = uploadConfig.discord;
    if (!discordSettings || !discordSettings.channels || discordSettings.channels.length === 0) {
        return createResponse('Error: No Discord channel configured', { status: 400 });
    }

    // 选择渠道：优先使用指定的渠道名称
    const discordChannels = discordSettings.channels;
    let discordChannel;
    if (specifiedChannelName) {
        discordChannel = discordChannels.find(ch => ch.name === specifiedChannelName);
    }
    if (!discordChannel) {
        discordChannel = discordSettings.loadBalance?.enabled
            ? discordChannels[Math.floor(Math.random() * discordChannels.length)]
            : discordChannels[0];
    }

    if (!discordChannel || !discordChannel.botToken || !discordChannel.channelId) {
        return createResponse('Error: Discord channel not properly configured', { status: 400 });
    }

    const file = formdata.get('file');
    const fileSize = file.size;
    const fileName = metadata.FileName;

    // Discord 文件大小限制：Nitro 会员 25MB，免费用户 10MB
    const isNitro = discordChannel.isNitro || false;
    const DISCORD_MAX_SIZE = isNitro ? 25 * 1024 * 1024 : 10 * 1024 * 1024;
    if (fileSize > DISCORD_MAX_SIZE) {
        const limitMB = isNitro ? 25 : 10;
        return createResponse(`Error: File size exceeds Discord limit (${limitMB}MB), please use another channel`, { status: 413 });
    }

    const discordAPI = new DiscordAPI(discordChannel.botToken);

    try {
        // 上传文件到 Discord
        const response = await discordAPI.sendFile(file, discordChannel.channelId, fileName);
        const fileInfo = discordAPI.getFileInfo(response);

        if (!fileInfo) {
            throw new Error('Failed to get file info from Discord response');
        }

        // 更新 metadata
        metadata.Channel = "Discord";
        metadata.ChannelName = discordChannel.name || "Discord_env";
        metadata.FileSize = (fileInfo.file_size / 1024 / 1024).toFixed(2);
        metadata.DiscordMessageId = fileInfo.message_id;
        metadata.DiscordChannelId = discordChannel.channelId;
        metadata.DiscordBotToken = discordChannel.botToken;
        // 注意：不存储 DiscordAttachmentUrl，因为 Discord 附件 URL 会在约24小时后过期
        // 读取时会通过 API 获取新的 URL

        // 如果配置了代理 URL，保存代理信息
        if (discordChannel.proxyUrl) {
            metadata.DiscordProxyUrl = discordChannel.proxyUrl;
        }

        // 图像审查（使用 Discord CDN URL 或代理 URL）
        let moderateUrl = fileInfo.url;
        if (discordChannel.proxyUrl) {
            moderateUrl = fileInfo.url.replace('https://cdn.discordapp.com', `https://${discordChannel.proxyUrl}`);
        }
        metadata.Label = await moderateContent(env, moderateUrl);

        // 写入 KV 数据库
        try {
            await db.put(fullId, "", { metadata });
        } catch (error) {
            return createResponse('Error: Failed to write to KV database', { status: 500 });
        }

        // 结束上传
        waitUntil(endUpload(context, fullId, metadata));

        // 返回成功响应
        return createResponse(
            JSON.stringify([{ 'src': returnLink }]),
            {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            }
        );

    } catch (error) {
        console.error('Discord upload error:', error.message);
        return createResponse(`Error: Discord upload failed - ${error.message}`, { status: 500 });
    }
}


// 上传到 HuggingFace
async function uploadFileToHuggingFace(context, fullId, metadata, returnLink) {
    const { env, waitUntil, uploadConfig, formdata, specifiedChannelName } = context;
    const db = getDatabase(env);

    console.log('=== HuggingFace Upload Start ===');

    // 获取 HuggingFace 渠道配置
    const hfSettings = uploadConfig.huggingface;
    console.log('HuggingFace settings:', hfSettings ? 'found' : 'not found');

    if (!hfSettings || !hfSettings.channels || hfSettings.channels.length === 0) {
        console.log('Error: No HuggingFace channel configured');
        return createResponse('Error: No HuggingFace channel configured', { status: 400 });
    }

    // 选择渠道：优先使用指定的渠道名称
    const hfChannels = hfSettings.channels;
    console.log('HuggingFace channels count:', hfChannels.length);

    let hfChannel;
    if (specifiedChannelName) {
        hfChannel = hfChannels.find(ch => ch.name === specifiedChannelName);
    }
    if (!hfChannel) {
        hfChannel = hfSettings.loadBalance?.enabled
            ? hfChannels[Math.floor(Math.random() * hfChannels.length)]
            : hfChannels[0];
    }

    console.log('Selected channel:', hfChannel?.name, 'repo:', hfChannel?.repo);

    if (!hfChannel || !hfChannel.token || !hfChannel.repo) {
        console.log('Error: HuggingFace channel not properly configured', {
            hasChannel: !!hfChannel,
            hasToken: !!hfChannel?.token,
            hasRepo: !!hfChannel?.repo
        });
        return createResponse('Error: HuggingFace channel not properly configured', { status: 400 });
    }

    const file = formdata.get('file');
    const fileName = metadata.FileName;
    // 获取前端预计算的 SHA256（如果有）
    const precomputedSha256 = formdata.get('sha256') || null;
    console.log('File to upload:', fileName, 'size:', file?.size, 'precomputed SHA256:', precomputedSha256 ? 'yes' : 'no');

    // 构建文件路径：直接使用 fullId（与其他渠道保持一致）
    const hfFilePath = fullId;
    console.log('HuggingFace file path:', hfFilePath);

    const huggingfaceAPI = new HuggingFaceAPI(hfChannel.token, hfChannel.repo, hfChannel.isPrivate || false);

    try {
        // 上传文件到 HuggingFace（传入预计算的 SHA256）
        console.log('Starting HuggingFace upload...');
        const result = await huggingfaceAPI.uploadFile(file, hfFilePath, `Upload ${fileName}`, precomputedSha256);
        console.log('HuggingFace upload result:', result);

        if (!result.success) {
            throw new Error('Failed to upload file to HuggingFace');
        }

        // 更新 metadata
        metadata.Channel = "HuggingFace";
        metadata.ChannelName = hfChannel.name || "HuggingFace_env";
        metadata.FileSize = (file.size / 1024 / 1024).toFixed(2);
        metadata.HfRepo = hfChannel.repo;
        metadata.HfFilePath = hfFilePath;
        metadata.HfToken = hfChannel.token;
        metadata.HfIsPrivate = hfChannel.isPrivate || false;
        metadata.HfFileUrl = result.fileUrl;

        // 图像审查
        const securityConfig = context.securityConfig;
        const uploadModerate = securityConfig.upload?.moderate;
        
        if (uploadModerate && uploadModerate.enabled) {
            if (!hfChannel.isPrivate) {
                // 公开仓库：直接通过公开URL访问进行审查，只写入1次KV
                metadata.Label = await moderateContent(env, result.fileUrl);
            } else {
                // 私有仓库：先写入KV，再通过自己的域名访问进行审查
                try {
                    await db.put(fullId, "", { metadata });
                } catch (error) {
                    return createResponse('Error: Failed to write to KV database', { status: 500 });
                }
                
                const moderateUrl = `https://${context.url.hostname}/file/${fullId}`;
                await purgeCDNCache(env, moderateUrl, context.url);
                metadata.Label = await moderateContent(env, moderateUrl);
            }
        }

        // 写入 KV 数据库
        try {
            await db.put(fullId, "", { metadata });
        } catch (error) {
            return createResponse('Error: Failed to write to KV database', { status: 500 });
        }

        // 结束上传
        waitUntil(endUpload(context, fullId, metadata));

        // 返回成功响应
        return createResponse(
            JSON.stringify([{ 'src': returnLink }]),
            {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            }
        );

    } catch (error) {
        console.error('HuggingFace upload error:', error.message);
        return createResponse(`Error: HuggingFace upload failed - ${error.message}`, { status: 500 });
    }
}


// 自动切换渠道重试
async function tryRetry(err, context, uploadChannel, fullId, metadata, fileExt, fileName, fileType, returnLink) {
    const { env, url, formdata } = context;

    // 渠道列表（Discord 因为有 10MB 限制，放在最后尝试）
    const channelList = ['CloudflareR2', 'TelegramNew', 'S3', 'HuggingFace', 'Discord'];
    const errMessages = {};
    errMessages[uploadChannel] = 'Error: ' + uploadChannel + err;

    // 先用原渠道再试一次（关闭服务端压缩）
    url.searchParams.set('serverCompress', 'false');
    let retryRes = null;
    if (uploadChannel === 'CloudflareR2') {
        retryRes = await uploadFileToCloudflareR2(context, fullId, metadata, returnLink);
    } else if (uploadChannel === 'TelegramNew') {
        retryRes = await uploadFileToTelegram(context, fullId, metadata, fileExt, fileName, fileType, returnLink);
    } else if (uploadChannel === 'S3') {
        retryRes = await uploadFileToS3(context, fullId, metadata, returnLink);
    } else if (uploadChannel === 'HuggingFace') {
        retryRes = await uploadFileToHuggingFace(context, fullId, metadata, returnLink);
    } else if (uploadChannel === 'Discord') {
        retryRes = await uploadFileToDiscord(context, fullId, metadata, returnLink);
    }

    // 原渠道重试成功，直接返回
    if (retryRes && retryRes.status === 200) {
        return retryRes;
    } else if (retryRes) {
        errMessages[uploadChannel + '_retry'] = 'Error: ' + uploadChannel + ' retry - ' + await retryRes.text();
    }

    // 原渠道重试失败，切换到其他渠道
    for (let i = 0; i < channelList.length; i++) {
        if (channelList[i] !== uploadChannel) {
            let res = null;
            if (channelList[i] === 'CloudflareR2') {
                res = await uploadFileToCloudflareR2(context, fullId, metadata, returnLink);
            } else if (channelList[i] === 'TelegramNew') {
                res = await uploadFileToTelegram(context, fullId, metadata, fileExt, fileName, fileType, returnLink);
            } else if (channelList[i] === 'S3') {
                res = await uploadFileToS3(context, fullId, metadata, returnLink);
            } else if (channelList[i] === 'HuggingFace') {
                res = await uploadFileToHuggingFace(context, fullId, metadata, returnLink);
            } else if (channelList[i] === 'Discord') {
                res = await uploadFileToDiscord(context, fullId, metadata, returnLink);
            }

            if (res && res.status === 200) {
                return res;
            } else if (res) {
                errMessages[channelList[i]] = 'Error: ' + channelList[i] + await res.text();
            }
        }
    }

    return createResponse(JSON.stringify(errMessages), { status: 500 });
}
