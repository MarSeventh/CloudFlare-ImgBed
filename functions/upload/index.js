import { userAuthCheck, UnauthorizedResponse } from "../utils/auth/userAuth";
import { fetchUploadConfig, fetchSecurityConfig } from "../utils/sysConfig";
import {
    createResponse, getUploadIp, getIPAddress, resolveFileExt,
    moderateContent, purgeCDNCache, isBlockedUploadIp, buildUniqueFileId, endUpload, getImageDimensions,
    sanitizeUploadFolder
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

    // 瑙ｆ瀽璇锋眰鐨刄RL锛屽瓨鍏?context
    const url = new URL(request.url);
    context.url = url;

    // 璇诲彇鍚勯」閰嶇疆锛屽瓨鍏?context
    const securityConfig = await fetchSecurityConfig(env);
    const uploadConfig = await fetchUploadConfig(env, context);

    context.securityConfig = securityConfig;
    context.uploadConfig = uploadConfig;

    // 閴存潈
    const requiredPermission = 'upload';
    if (!await userAuthCheck(env, url, request, requiredPermission)) {
        return UnauthorizedResponse('Unauthorized');
    }

    // 鑾峰緱涓婁紶IP
    const uploadIp = getUploadIp(request);
    const allowedUploadIps = (env.ALLOWED_UPLOAD_IPS || "")
        .split(",")
        .map(ip => ip.trim())
        .filter(Boolean);

    if (allowedUploadIps.length > 0 && !allowedUploadIps.includes(uploadIp)) {
        return createResponse('Error: Upload IP is not allowed', { status: 403 });
    }
    // 鍒ゆ柇涓婁紶ip鏄惁琚皝绂?    const isBlockedIp = await isBlockedUploadIp(env, uploadIp);
    if (isBlockedIp) {
        return createResponse('Error: Your IP is blocked', { status: 403 });
    }

    // 妫€鏌ユ槸鍚︿负娓呯悊璇锋眰
    const cleanupRequest = url.searchParams.get('cleanup') === 'true';
    if (cleanupRequest) {
        const uploadId = url.searchParams.get('uploadId');
        const totalChunks = parseInt(url.searchParams.get('totalChunks')) || 0;
        return await handleCleanupRequest(context, uploadId, totalChunks);
    }

    // 妫€鏌ユ槸鍚︿负鍒濆鍖栧垎鍧椾笂浼犺姹?    const initChunked = url.searchParams.get('initChunked') === 'true';
    if (initChunked) {
        return await initializeChunkedUpload(context);
    }

    // 妫€鏌ユ槸鍚︿负鍒嗗潡涓婁紶
    const isChunked = url.searchParams.get('chunked') === 'true';
    const isMerge = url.searchParams.get('merge') === 'true';

    if (isChunked) {
        if (isMerge) {
            return await handleChunkMerge(context);
        } else {
            return await handleChunkUpload(context);
        }
    }

    // 澶勭悊闈炲垎鍧楁枃浠朵笂浼?    return await processFileUpload(context);
}


// 閫氱敤鏂囦欢涓婁紶澶勭悊鍑芥暟
async function processFileUpload(context, formdata = null) {
    const { request, url } = context;

    // 瑙ｆ瀽琛ㄥ崟鏁版嵁
    formdata = formdata || await request.formData();

    // 灏?formdata 瀛樺偍鍦?context 涓?    context.formdata = formdata;

    // 鑾峰緱涓婁紶娓犻亾绫诲瀷
    const urlParamUploadChannel = url.searchParams.get('uploadChannel');
    // 鑾峰緱鎸囧畾鐨勬笭閬撳悕绉帮紙鍙€夛級
    const urlParamChannelName = url.searchParams.get('channelName');

    // 鑾峰彇IP鍦板潃
    const uploadIp = getUploadIp(request);
    const ipAddress = await getIPAddress(uploadIp);

    // 鑾峰彇涓婁紶鏂囦欢澶硅矾寰?    let uploadFolder = url.searchParams.get('uploadFolder') || '';

    // 璺緞瀹夊叏鎬у鐞嗭細闃叉璺緞绌胯秺鍜岀壒娈婂瓧绗︽敞鍏?    uploadFolder = sanitizeUploadFolder(uploadFolder);

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

    // 灏嗘寚瀹氱殑娓犻亾鍚嶇О瀛樺叆 context锛屼緵鍚庣画涓婁紶鍑芥暟浣跨敤
    context.specifiedChannelName = urlParamChannelName || null;

    // 鑾峰彇鏂囦欢淇℃伅
    const time = new Date().getTime();
    const file = formdata.get('file');
    const fileType = file.type;
    let fileName = file.name;
    const fileSizeBytes = file.size; // 鏂囦欢澶у皬锛屽崟浣嶅瓧鑺?    const fileSize = (fileSizeBytes / 1024 / 1024).toFixed(2); // 鏂囦欢澶у皬锛屽崟浣峂B

    // 妫€鏌ileType鍜宖ileName鏄惁瀛樺湪
    if (fileType === null || fileType === undefined || fileName === null || fileName === undefined) {
        return createResponse('Error: fileType or fileName is wrong, check the integrity of this file!', { status: 400 });
    }

    // 鎻愬彇鍥剧墖灏哄
    let imageDimensions = null;
    if (fileType.startsWith('image/')) {
        try {
            // 缁熶竴璇诲彇 64KB锛岃冻浠ヨ鐩?JPEG 鐨?EXIF 鏁版嵁鍜屽叾浠栨牸寮?            const headerBuffer = await file.slice(0, 65536).arrayBuffer();
            imageDimensions = getImageDimensions(headerBuffer, fileType);
        } catch (error) {
            console.error('Error reading image dimensions:', error);
        }
    }

    // 濡傛灉涓婁紶鏂囦欢澶硅矾寰勪负绌猴紝灏濊瘯浠庢枃浠跺悕涓幏鍙?    if (uploadFolder === '' || uploadFolder === null || uploadFolder === undefined) {
        uploadFolder = fileName.split('/').slice(0, -1).join('/');
        // 瀵逛粠鏂囦欢鍚嶄腑鎻愬彇鐨勮矾寰勪篃杩涜瀹夊叏澶勭悊
        uploadFolder = sanitizeUploadFolder(uploadFolder);
        // 浠庢枃浠跺悕涓幓闄よ矾寰勪俊鎭紝鍙繚鐣欐枃浠跺悕閮ㄥ垎
        fileName = fileName.split('/').pop();
    }
    // uploadFolder 宸茬粡杩?sanitizeUploadFolder 澶勭悊锛岀洿鎺ヤ娇鐢?    const normalizedFolder = uploadFolder;

    const metadata = {
        FileName: fileName,
        FileType: fileType,
        FileSize: fileSize,
        FileSizeBytes: fileSizeBytes,
        UploadIP: uploadIp,
        UploadAddress: ipAddress,
        ListType: "None",
        TimeStamp: time,
        Label: "None",
        Directory: normalizedFolder === '' ? '' : normalizedFolder + '/',
        Tags: []
    };

    // 娣诲姞鍥剧墖灏哄淇℃伅
    if (imageDimensions) {
        metadata.Width = imageDimensions.width;
        metadata.Height = imageDimensions.height;
    }

    const fileExt = resolveFileExt(fileName, fileType);

    // 鏋勫缓鏂囦欢ID
    const fullId = await buildUniqueFileId(context, fileName, fileType);

    // 鑾峰緱杩斿洖閾炬帴鏍煎紡, default涓鸿繑鍥?file/id, full涓鸿繑鍥炲畬鏁撮摼鎺?    const returnFormat = url.searchParams.get('returnFormat') || 'default';
    let returnLink = '';
    if (returnFormat === 'full') {
        returnLink = `${url.origin}/file/${fullId}`;
    } else {
        returnLink = `/file/${fullId}`;
    }

    /* ====================================涓嶅悓娓犻亾涓婁紶======================================= */
    // 鍑洪敊鏄惁鍒囨崲娓犻亾鑷姩閲嶈瘯锛岄粯璁ゅ紑鍚?    const autoRetry = url.searchParams.get('autoRetry') === 'false' ? false : true;

    let err = '';
    // 涓婁紶鍒颁笉鍚屾笭閬?    if (uploadChannel === 'CloudflareR2') {
        // -------------CloudFlare R2 娓犻亾---------------
        const res = await uploadFileToCloudflareR2(context, fullId, metadata, returnLink);
        if (res.status === 200 || !autoRetry) {
            return res;
        } else {
            err = await res.text();
        }
    } else if (uploadChannel === 'S3') {
        // ---------------------S3 娓犻亾------------------
        const res = await uploadFileToS3(context, fullId, metadata, returnLink);
        if (res.status === 200 || !autoRetry) {
            return res;
        } else {
            err = await res.text();
        }
    } else if (uploadChannel === 'Discord') {
        // ---------------------Discord 娓犻亾------------------
        const res = await uploadFileToDiscord(context, fullId, metadata, returnLink);
        if (res.status === 200 || !autoRetry) {
            return res;
        } else {
            err = await res.text();
        }
    } else if (uploadChannel === 'HuggingFace') {
        // ---------------------HuggingFace 娓犻亾------------------
        const res = await uploadFileToHuggingFace(context, fullId, metadata, returnLink);
        if (res.status === 200 || !autoRetry) {
            return res;
        } else {
            err = await res.text();
        }
    } else if (uploadChannel === 'External') {
        // --------------------澶栭摼娓犻亾----------------------
        const res = await uploadFileToExternal(context, fullId, metadata, returnLink);
        return res;
    } else {
        // ----------------Telegram New 娓犻亾-------------------
        const res = await uploadFileToTelegram(context, fullId, metadata, fileExt, fileName, fileType, returnLink);
        if (res.status === 200 || !autoRetry) {
            return res;
        } else {
            err = await res.text();
        }
    }

    // 涓婁紶澶辫触锛屽紑濮嬭嚜鍔ㄥ垏鎹㈡笭閬撻噸璇?    const res = await tryRetry(err, context, uploadChannel, fullId, metadata, fileExt, fileName, fileType, returnLink);
    return res;
}

// 涓婁紶鍒癈loudflare R2
async function uploadFileToCloudflareR2(context, fullId, metadata, returnLink) {
    const { env, waitUntil, uploadConfig, formdata, specifiedChannelName } = context;
    const db = getDatabase(env);

    // 妫€鏌2鏁版嵁搴撴槸鍚﹂厤缃?    if (typeof env.img_r2 == "undefined" || env.img_r2 == null || env.img_r2 == "") {
        return createResponse('Error: Please configure R2 database', { status: 500 });
    }

    // 妫€鏌?R2 娓犻亾鏄惁鍚敤
    const r2Settings = uploadConfig.cfr2;
    if (!r2Settings.channels || r2Settings.channels.length === 0) {
        return createResponse('Error: No R2 channel provided', { status: 400 });
    }

    // 閫夋嫨娓犻亾锛氫紭鍏堜娇鐢ㄦ寚瀹氱殑娓犻亾鍚嶇О
    let r2Channel;
    if (specifiedChannelName) {
        r2Channel = r2Settings.channels.find(ch => ch.name === specifiedChannelName);
    }
    if (!r2Channel) {
        r2Channel = r2Settings.channels[0];
    }

    const R2DataBase = env.img_r2;

    // 鍐欏叆R2鏁版嵁搴?    await R2DataBase.put(fullId, formdata.get('file'));

    // 鏇存柊metadata
    metadata.Channel = "CloudflareR2";
    metadata.ChannelName = r2Channel.name || "R2_env";

    // 鍥惧儚瀹℃煡锛岄噰鐢≧2鐨刾ublicUrl
    const R2PublicUrl = r2Channel.publicUrl;
    let moderateUrl = `${R2PublicUrl}/${fullId}`;
    metadata.Label = await moderateContent(env, moderateUrl);

    // 鍐欏叆鏁版嵁搴?    try {
        await db.put(fullId, "", {
            metadata: metadata,
        });
    } catch (error) {
        return createResponse('Error: Failed to write to database', { status: 500 });
    }

    // 缁撴潫涓婁紶
    waitUntil(endUpload(context, fullId, metadata));

    // 鎴愬姛涓婁紶锛屽皢鏂囦欢ID杩斿洖缁欏鎴风
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


// 涓婁紶鍒?S3锛堟敮鎸佽嚜瀹氫箟绔偣锛?async function uploadFileToS3(context, fullId, metadata, returnLink) {
    const { env, waitUntil, uploadConfig, securityConfig, url, formdata, specifiedChannelName } = context;
    const db = getDatabase(env);

    const uploadModerate = securityConfig.upload.moderate;

    const s3Settings = uploadConfig.s3;
    const s3Channels = s3Settings.channels;
    
    // 閫夋嫨娓犻亾锛氫紭鍏堜娇鐢ㄦ寚瀹氱殑娓犻亾鍚嶇О
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

    const { endpoint, pathStyle, accessKeyId, secretAccessKey, bucketName, region, cdnDomain } = s3Channel;

    // 鍒涘缓 S3 瀹㈡埛绔?    const s3Client = new S3Client({
        region: region || "auto", // R2 鍙敤 "auto"
        endpoint, // 鑷畾涔?S3 绔偣
        credentials: {
            accessKeyId,
            secretAccessKey
        },
        forcePathStyle: pathStyle // 鏄惁鍚敤璺緞椋庢牸
    });

    // 鑾峰彇鏂囦欢
    const file = formdata.get("file");
    if (!file) return createResponse("Error: No file provided", { status: 400 });

    // 杞崲 Blob 涓?Uint8Array
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    const s3FileName = fullId;

    try {
        // S3 涓婁紶鍙傛暟
        const putObjectParams = {
            Bucket: bucketName,
            Key: s3FileName,
            Body: uint8Array, // 鐩存帴浣跨敤 Blob
            ContentType: file.type
        };

        // 鎵ц涓婁紶
        await s3Client.send(new PutObjectCommand(putObjectParams));

        // 鏇存柊 metadata
        metadata.Channel = "S3";
        metadata.ChannelName = s3Channel.name;

        const s3ServerDomain = endpoint.replace(/https?:\/\//, "");
        if (pathStyle) {
            metadata.S3Location = `https://${s3ServerDomain}/${bucketName}/${s3FileName}`; // 閲囩敤璺緞椋庢牸鐨?URL
        } else {
            metadata.S3Location = `https://${bucketName}.${s3ServerDomain}/${s3FileName}`; // 閲囩敤铏氭嫙涓绘満椋庢牸鐨?URL
        }
        metadata.S3Endpoint = endpoint;
        metadata.S3PathStyle = pathStyle;
        metadata.S3AccessKeyId = accessKeyId;
        metadata.S3SecretAccessKey = secretAccessKey;
        metadata.S3Region = region || "auto";
        metadata.S3BucketName = bucketName;
        metadata.S3FileKey = s3FileName;
        // 淇濆瓨 CDN 鏂囦欢瀹屾暣璺緞锛堝鏋滈厤缃簡 CDN 鍩熷悕锛?        if (cdnDomain) {
            // 瀛樺偍瀹屾暣鐨?CDN 鏂囦欢璺緞锛岃€屼笉鏄粎瀛樺偍鍩熷悕
            metadata.S3CdnFileUrl = `${cdnDomain.replace(/\/$/, '')}/${s3FileName}`;
        }

        // 鍥惧儚瀹℃煡
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

        // 鍐欏叆鏁版嵁搴?        try {
            await db.put(fullId, "", { metadata });
        } catch {
            return createResponse("Error: Failed to write to database", { status: 500 });
        }

        // 缁撴潫涓婁紶
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


// 涓婁紶鍒癟elegram
async function uploadFileToTelegram(context, fullId, metadata, fileExt, fileName, fileType, returnLink) {
    const { env, waitUntil, uploadConfig, url, formdata, specifiedChannelName } = context;
    const db = getDatabase(env);

    // 閫夋嫨涓€涓?Telegram 娓犻亾涓婁紶
    const tgSettings = uploadConfig.telegram;
    const tgChannels = tgSettings.channels;
    
    let tgChannel;
    // 濡傛灉鎸囧畾浜嗘笭閬撳悕绉帮紝浼樺厛浣跨敤鎸囧畾鐨勬笭閬?    if (specifiedChannelName) {
        tgChannel = tgChannels.find(ch => ch.name === specifiedChannelName);
    }
    // 鏈寚瀹氭垨鏈壘鍒版寚瀹氭笭閬擄紝浣跨敤璐熻浇鍧囪　鎴栫涓€涓?    if (!tgChannel) {
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

    // 16MB 鍒嗙墖闃堝€?(TG Bot getFile download limit: 20MB, leave 4MB safety margin)
    const CHUNK_SIZE = 16 * 1024 * 1024; // 16MB

    if (fileSize > CHUNK_SIZE) {
        // 澶ф枃浠跺垎鐗囦笂浼?        return await uploadLargeFileToTelegram(context, file, fullId, metadata, fileName, fileType, returnLink, tgBotToken, tgChatId, tgChannel);
    }

    // 鐢变簬TG浼氭妸gif鍚庣紑鐨勬枃浠惰浆涓鸿棰戯紝鎵€浠ラ渶瑕佷慨鏀瑰悗缂€鍚嶇粫杩囬檺鍒?    if (fileExt === 'gif') {
        const newFileName = fileName.replace(/\.gif$/, '.jpeg');
        const newFile = new File([formdata.get('file')], newFileName, { type: fileType });
        formdata.set('file', newFile);
    } else if (fileExt === 'webp') {
        const newFileName = fileName.replace(/\.webp$/, '.jpeg');
        const newFile = new File([formdata.get('file')], newFileName, { type: fileType });
        formdata.set('file', newFile);
    }

    // 閫夋嫨瀵瑰簲鐨勫彂閫佹帴鍙?    const fileTypeMap = {
        'image/': { 'url': 'sendPhoto', 'type': 'photo' },
        'video/': { 'url': 'sendVideo', 'type': 'video' },
        'audio/': { 'url': 'sendAudio', 'type': 'audio' },
        'application/pdf': { 'url': 'sendDocument', 'type': 'document' },
    };

    const defaultType = { 'url': 'sendDocument', 'type': 'document' };

    let sendFunction = Object.keys(fileTypeMap).find(key => fileType.startsWith(key))
        ? fileTypeMap[Object.keys(fileTypeMap).find(key => fileType.startsWith(key))]
        : defaultType;

    // GIF ICO 绛夊彂閫佹帴鍙ｇ壒娈婂鐞?    if (fileType === 'image/gif' || fileType === 'image/webp' || fileExt === 'gif' || fileExt === 'webp') {
        sendFunction = { 'url': 'sendAnimation', 'type': 'animation' };
    } else if (fileType === 'image/svg+xml' || fileType === 'image/x-icon') {
        sendFunction = { 'url': 'sendDocument', 'type': 'document' };
    }

    // 鏍规嵁鏈嶅姟绔帇缂╄缃鐞嗘帴鍙ｏ細浠庡弬鏁颁腑鑾峰彇serverCompress锛屽鏋滀负false锛屽垯浣跨敤sendDocument鎺ュ彛
    if (url.searchParams.get('serverCompress') === 'false') {
        sendFunction = { 'url': 'sendDocument', 'type': 'document' };
    }

    // 涓婁紶鏂囦欢鍒?Telegram
    let res = createResponse('upload error, check your environment params about telegram channel!', { status: 400 });
    try {
        const response = await telegramAPI.sendFile(formdata.get('file'), tgChatId, sendFunction.url, sendFunction.type);
        const fileInfo = telegramAPI.getFileInfo(response);
        const filePath = await telegramAPI.getFilePath(fileInfo.file_id);
        const id = fileInfo.file_id;
        // 鏇存柊FileSize
        metadata.FileSize = (fileInfo.file_size / 1024 / 1024).toFixed(2);

        // 灏嗗搷搴旇繑鍥炵粰瀹㈡埛绔?        res = createResponse(
            JSON.stringify([{ 'src': `${returnLink}` }]),
            {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                }
            }
        );


        // 鍥惧儚瀹℃煡锛堜娇鐢ㄤ唬鐞嗗煙鍚嶆垨瀹樻柟鍩熷悕锛?        const moderateDomain = tgProxyUrl ? `https://${tgProxyUrl}` : 'https://api.telegram.org';
        const moderateUrl = `${moderateDomain}/file/bot${tgBotToken}/${filePath}`;
        metadata.Label = await moderateContent(env, moderateUrl);

        // 鏇存柊metadata锛屽啓鍏V鏁版嵁搴?        try {
            metadata.Channel = "TelegramNew";
            metadata.ChannelName = tgChannel.name;

            metadata.TgFileId = id;
            metadata.TgChatId = tgChatId;
            metadata.TgBotToken = tgBotToken;
            // 淇濆瓨浠ｇ悊鍩熷悕閰嶇疆
            if (tgProxyUrl) {
                metadata.TgProxyUrl = tgProxyUrl;
            }
            await db.put(fullId, "", {
                metadata: metadata,
            });
        } catch (error) {
            res = createResponse('Error: Failed to write to KV database', { status: 500 });
        }

        // 缁撴潫涓婁紶
        waitUntil(endUpload(context, fullId, metadata));

    } catch (error) {
        console.log('Telegram upload error:', error.message);
        res = createResponse('upload error, check your environment params about telegram channel!', { status: 400 });
    } finally {
        return res;
    }
}


// 澶栭摼娓犻亾
async function uploadFileToExternal(context, fullId, metadata, returnLink) {
    const { env, waitUntil, formdata } = context;
    const db = getDatabase(env);

    // 鐩存帴灏嗗閾惧啓鍏etadata
    metadata.Channel = "External";
    metadata.ChannelName = "External";
    // 浠?formdata 涓幏鍙栧閾?    const extUrl = formdata.get('url');
    if (extUrl === null || extUrl === undefined) {
        return createResponse('Error: No url provided', { status: 400 });
    }
    metadata.ExternalLink = extUrl;
    // 鍐欏叆KV鏁版嵁搴?    try {
        await db.put(fullId, "", {
            metadata: metadata,
        });
    } catch (error) {
        return createResponse('Error: Failed to write to KV database', { status: 500 });
    }

    // 缁撴潫涓婁紶
    waitUntil(endUpload(context, fullId, metadata));

    // 杩斿洖缁撴灉
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


// 涓婁紶鍒?Discord
async function uploadFileToDiscord(context, fullId, metadata, returnLink) {
    const { env, waitUntil, uploadConfig, formdata, specifiedChannelName } = context;
    const db = getDatabase(env);

    // 鑾峰彇 Discord 娓犻亾閰嶇疆
    const discordSettings = uploadConfig.discord;
    if (!discordSettings || !discordSettings.channels || discordSettings.channels.length === 0) {
        return createResponse('Error: No Discord channel configured', { status: 400 });
    }

    // 閫夋嫨娓犻亾锛氫紭鍏堜娇鐢ㄦ寚瀹氱殑娓犻亾鍚嶇О
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

    // Discord 鏂囦欢澶у皬闄愬埗锛歂itro 浼氬憳 25MB锛屽厤璐圭敤鎴?10MB
    const isNitro = discordChannel.isNitro || false;
    const DISCORD_MAX_SIZE = isNitro ? 25 * 1024 * 1024 : 10 * 1024 * 1024;
    if (fileSize > DISCORD_MAX_SIZE) {
        const limitMB = isNitro ? 25 : 10;
        return createResponse(`Error: File size exceeds Discord limit (${limitMB}MB), please use another channel`, { status: 413 });
    }

    const discordAPI = new DiscordAPI(discordChannel.botToken);

    try {
        // 涓婁紶鏂囦欢鍒?Discord
        const response = await discordAPI.sendFile(file, discordChannel.channelId, fileName);
        const fileInfo = discordAPI.getFileInfo(response);

        if (!fileInfo) {
            throw new Error('Failed to get file info from Discord response');
        }

        // 鏇存柊 metadata
        metadata.Channel = "Discord";
        metadata.ChannelName = discordChannel.name || "Discord_env";
        metadata.FileSize = (fileInfo.file_size / 1024 / 1024).toFixed(2);
        metadata.DiscordMessageId = fileInfo.message_id;
        metadata.DiscordChannelId = discordChannel.channelId;
        metadata.DiscordBotToken = discordChannel.botToken;
        // 娉ㄦ剰锛氫笉瀛樺偍 DiscordAttachmentUrl锛屽洜涓?Discord 闄勪欢 URL 浼氬湪绾?4灏忔椂鍚庤繃鏈?        // 璇诲彇鏃朵細閫氳繃 API 鑾峰彇鏂扮殑 URL

        // 濡傛灉閰嶇疆浜嗕唬鐞?URL锛屼繚瀛樹唬鐞嗕俊鎭?        if (discordChannel.proxyUrl) {
            metadata.DiscordProxyUrl = discordChannel.proxyUrl;
        }

        // 鍥惧儚瀹℃煡锛堜娇鐢?Discord CDN URL 鎴栦唬鐞?URL锛?        let moderateUrl = fileInfo.url;
        if (discordChannel.proxyUrl) {
            moderateUrl = fileInfo.url.replace('https://cdn.discordapp.com', `https://${discordChannel.proxyUrl}`);
        }
        metadata.Label = await moderateContent(env, moderateUrl);

        // 鍐欏叆 KV 鏁版嵁搴?        try {
            await db.put(fullId, "", { metadata });
        } catch (error) {
            return createResponse('Error: Failed to write to KV database', { status: 500 });
        }

        // 缁撴潫涓婁紶
        waitUntil(endUpload(context, fullId, metadata));

        // 杩斿洖鎴愬姛鍝嶅簲
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


// 涓婁紶鍒?HuggingFace
async function uploadFileToHuggingFace(context, fullId, metadata, returnLink) {
    const { env, waitUntil, uploadConfig, formdata, specifiedChannelName } = context;
    const db = getDatabase(env);

    console.log('=== HuggingFace Upload Start ===');

    // 鑾峰彇 HuggingFace 娓犻亾閰嶇疆
    const hfSettings = uploadConfig.huggingface;
    console.log('HuggingFace settings:', hfSettings ? 'found' : 'not found');

    if (!hfSettings || !hfSettings.channels || hfSettings.channels.length === 0) {
        console.log('Error: No HuggingFace channel configured');
        return createResponse('Error: No HuggingFace channel configured', { status: 400 });
    }

    // 閫夋嫨娓犻亾锛氫紭鍏堜娇鐢ㄦ寚瀹氱殑娓犻亾鍚嶇О
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
    // 鑾峰彇鍓嶇棰勮绠楃殑 SHA256锛堝鏋滄湁锛?    const precomputedSha256 = formdata.get('sha256') || null;
    console.log('File to upload:', fileName, 'size:', file?.size, 'precomputed SHA256:', precomputedSha256 ? 'yes' : 'no');

    // 鐢熸垚鍞竴鏍囪瘑绗﹀墠缂€锛圲UID鏍煎紡锛夛紝鍔犲湪鏂囦欢鍚嶅墠闈?    const uniquePrefix = crypto.randomUUID();
    const lastSlashIndex = fullId.lastIndexOf('/');
    const hfFilePath = lastSlashIndex === -1 
        ? `${uniquePrefix}_${fullId}` 
        : `${fullId.substring(0, lastSlashIndex + 1)}${uniquePrefix}_${fullId.substring(lastSlashIndex + 1)}`;
    console.log('HuggingFace file path:', hfFilePath);

    const huggingfaceAPI = new HuggingFaceAPI(hfChannel.token, hfChannel.repo, hfChannel.isPrivate || false);

    try {
        // 涓婁紶鏂囦欢鍒?HuggingFace锛堜紶鍏ラ璁＄畻鐨?SHA256锛?        console.log('Starting HuggingFace upload...');
        const result = await huggingfaceAPI.uploadFile(file, hfFilePath, `Upload ${fileName}`, precomputedSha256);
        console.log('HuggingFace upload result:', result);

        if (!result.success) {
            throw new Error('Failed to upload file to HuggingFace');
        }

        // 鏇存柊 metadata
        metadata.Channel = "HuggingFace";
        metadata.ChannelName = hfChannel.name || "HuggingFace_env";
        metadata.HfRepo = hfChannel.repo;
        metadata.HfFilePath = hfFilePath;
        metadata.HfToken = hfChannel.token;
        metadata.HfIsPrivate = hfChannel.isPrivate || false;
        metadata.HfFileUrl = result.fileUrl;

        // 鍥惧儚瀹℃煡
        const securityConfig = context.securityConfig;
        const uploadModerate = securityConfig.upload?.moderate;
        
        if (uploadModerate && uploadModerate.enabled) {
            if (!hfChannel.isPrivate) {
                // 鍏紑浠撳簱锛氱洿鎺ラ€氳繃鍏紑URL璁块棶杩涜瀹℃煡锛屽彧鍐欏叆1娆V
                metadata.Label = await moderateContent(env, result.fileUrl);
            } else {
                // 绉佹湁浠撳簱锛氬厛鍐欏叆KV锛屽啀閫氳繃鑷繁鐨勫煙鍚嶈闂繘琛屽鏌?                try {
                    await db.put(fullId, "", { metadata });
                } catch (error) {
                    return createResponse('Error: Failed to write to KV database', { status: 500 });
                }
                
                const moderateUrl = `https://${context.url.hostname}/file/${fullId}`;
                await purgeCDNCache(env, moderateUrl, context.url);
                metadata.Label = await moderateContent(env, moderateUrl);
            }
        }

        // 鍐欏叆 KV 鏁版嵁搴?        try {
            await db.put(fullId, "", { metadata });
        } catch (error) {
            return createResponse('Error: Failed to write to KV database', { status: 500 });
        }

        // 缁撴潫涓婁紶
        waitUntil(endUpload(context, fullId, metadata));

        // 杩斿洖鎴愬姛鍝嶅簲
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


// 鑷姩鍒囨崲娓犻亾閲嶈瘯
async function tryRetry(err, context, uploadChannel, fullId, metadata, fileExt, fileName, fileType, returnLink) {
    const { env, url, formdata } = context;

    // 娓犻亾鍒楄〃锛圖iscord 鍥犱负鏈?10MB 闄愬埗锛屾斁鍦ㄦ渶鍚庡皾璇曪級
    const channelList = ['CloudflareR2', 'TelegramNew', 'S3', 'HuggingFace', 'Discord'];
    const errMessages = {};
    errMessages[uploadChannel] = 'Error: ' + uploadChannel + err;

    // 鍏堢敤鍘熸笭閬撳啀璇曚竴娆★紙鍏抽棴鏈嶅姟绔帇缂╋級
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

    // 鍘熸笭閬撻噸璇曟垚鍔燂紝鐩存帴杩斿洖
    if (retryRes && retryRes.status === 200) {
        return retryRes;
    } else if (retryRes) {
        errMessages[uploadChannel + '_retry'] = 'Error: ' + uploadChannel + ' retry - ' + await retryRes.text();
    }

    // 鍘熸笭閬撻噸璇曞け璐ワ紝鍒囨崲鍒板叾浠栨笭閬?    for (let i = 0; i < channelList.length; i++) {
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

