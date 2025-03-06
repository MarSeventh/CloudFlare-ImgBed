import { errorHandling, telemetryData } from "./utils/middleware";
import { fetchUploadConfig, fetchSecurityConfig } from "./utils/sysConfig";
import { purgeCFCache } from "./utils/purgeCache";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

let uploadConfig = {};
let securityConfig = {};
let rightAuthCode = null;
let moderateContentApiKey = null;

function UnauthorizedException(reason) {
    return new Response(reason, {
        status: 401,
        statusText: "Unauthorized",
        headers: {
            "Content-Type": "text/plain;charset=UTF-8",
            // Disables caching by default.
            "Cache-Control": "no-store",
            // Returns the "Content-Length" header for HTTP HEAD requests.
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

export async function onRequestPost(context) {  // Contents of context object
    const { request, env, params, waitUntil, next, data } = context;

    const url = new URL(request.url);
    const clonedRequest = await request.clone();

    // 读取安全配置
    securityConfig = await fetchSecurityConfig(env);
    rightAuthCode = securityConfig.auth.user.authCode;
    moderateContentApiKey = securityConfig.upload.moderate.apiKey;
    
    // 鉴权
    if (!authCheck(env, url, request)) {
        return UnauthorizedException('Unauthorized');
    }

    // 获得上传IP
    const uploadIp = request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for") || request.headers.get("x-client-ip") || request.headers.get("x-host") || request.headers.get("x-originating-ip") || request.headers.get("x-cluster-client-ip") || request.headers.get("forwarded-for") || request.headers.get("forwarded") || request.headers.get("via") || request.headers.get("requester") || request.headers.get("true-client-ip") || request.headers.get("client-ip") || request.headers.get("x-remote-ip") || request.headers.get("x-originating-ip") || request.headers.get("fastly-client-ip") || request.headers.get("akamai-origin-hop") || request.headers.get("x-remote-ip") || request.headers.get("x-remote-addr") || request.headers.get("x-remote-host") || request.headers.get("x-client-ip") || request.headers.get("x-client-ips") || request.headers.get("x-client-ip")
    // 判断上传ip是否被封禁
    const isBlockedIp = await isBlockedUploadIp(env, uploadIp);
    if (isBlockedIp) {
        return new Response('Error: Your IP is blocked', { status: 403 });
    }

    // 读取上传配置
    uploadConfig = await fetchUploadConfig(env);

    // 获得上传渠道
    const urlParamUploadChannel = url.searchParams.get('uploadChannel');
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
    
    // 错误处理和遥测
    if (env.dev_mode === undefined || env.dev_mode === null || env.dev_mode !== 'true') {
        await errorHandling(context);
        telemetryData(context);
    }

    // img_url 未定义或为空的处理逻辑
    if (typeof env.img_url == "undefined" || env.img_url == null || env.img_url == "") {
        return new Response('Error: Please configure KV database', { status: 500 });
    } 

    // 获取文件信息
    const time = new Date().getTime();
    const formdata = await clonedRequest.formData();
    const fileType = formdata.get('file').type;
    const fileName = formdata.get('file').name;
    const fileSize = (formdata.get('file').size / 1024 / 1024).toFixed(2); // 文件大小，单位MB
    const metadata = {
        FileName: fileName,
        FileType: fileType,
        FileSize: fileSize,
        UploadIP: uploadIp,
        ListType: "None",
        TimeStamp: time,
        Label: "None",
    }


    // 检查fileType和fileName是否存在
    if (fileType === null || fileType === undefined || fileName === null || fileName === undefined) {
        return new Response('Error: fileType or fileName is wrong, check the integrity of this file!', { status: 400 });
    }

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
    const unique_index = time + Math.floor(Math.random() * 10000);
    let fullId = '';
    if (nameType === 'index') {
        // 仅前缀
        fullId = unique_index + '.' + fileExt;
    } else if (nameType === 'origin') {
        // 仅文件名
        fullId = fileName? fileName : unique_index + '.' + fileExt;
    } else if (nameType === 'short') {
        // 短链接，8位大小写字母+数字的随机字符
        while (true) {
            const shortId = generateShortId(8);
            const testFullId = shortId + '.' + fileExt;
            if (await env.img_url.get(testFullId) === null) {
                fullId = shortId + '.' + fileExt;
                break;
            }
        }
    } else {
        // 默认方式：前缀+文件名
        fullId = fileName? unique_index + '_' + fileName : unique_index + '.' + fileExt;
    }

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
    await purgeCDNCache(env, cdnUrl, url);
   

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
        // -------------S3 渠道---------------
        const res = await uploadFileToS3(env, formdata, fullId, metadata, returnLink, url);
        if (res.status === 200 || !autoRetry) {
            return res;
        } else {
            err = await res.text();
        }
    } else if (uploadChannel === 'External') {
        // -------------外链渠道---------------
        const res = await uploadFileToExternal(env, formdata, fullId, metadata, returnLink, url);
        return res;
    } else {
        // ----------------Telegram New 渠道-------------------
        const res = await uploadFileToTelegram(env, formdata, fullId, metadata, fileExt, fileName, fileType, url, clonedRequest, returnLink);
        if (res.status === 200 || !autoRetry) {
            return res;
        } else {
            err = await res.text();
        }
    }

    // 上传失败，开始自动切换渠道重试
    const res = await tryRetry(err, env, uploadChannel, formdata, fullId, metadata, fileExt, fileName, fileType, url, clonedRequest, returnLink);
    return res;
}


// 自动切换渠道重试
async function tryRetry(err, env, uploadChannel, formdata, fullId, metadata, fileExt, fileName, fileType, url, clonedRequest, returnLink) {
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
                res = await uploadFileToTelegram(env, formdata, fullId, metadata, fileExt, fileName, fileType, url, clonedRequest, returnLink);
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

    return new Response(JSON.stringify(errMessages), { status: 500 });
}


// 上传到Cloudflare R2
async function uploadFileToCloudflareR2(env, formdata, fullId, metadata, returnLink, originUrl) {
    // 检查R2数据库是否配置
    if (typeof env.img_r2 == "undefined" || env.img_r2 == null || env.img_r2 == "") {
        return new Response('Error: Please configure R2 database', { status: 500 });
    }
    // 检查 R2 渠道是否启用
    const r2Settings = uploadConfig.cfr2;
    if (!r2Settings.channels || r2Settings.channels.length === 0) {
        return new Response('Error: No R2 channel provided', { status: 400 });
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
        return new Response('Error: Failed to write to KV database', { status: 500 });
    }


    // 成功上传，将文件ID返回给客户端
    return new Response(
        JSON.stringify([{ 'src': `${returnLink}` }]), 
        {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
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
        return new Response('Error: No S3 channel provided', { status: 400 });
    }

    const { endpoint, accessKeyId, secretAccessKey, bucketName, region } = s3Channel;

    // 创建 S3 客户端
    const s3Client = new S3Client({
        region: region || "auto", // R2 可用 "auto"
        endpoint, // 自定义 S3 端点
        credentials: {
            accessKeyId,
            secretAccessKey
        }
    });

    // 获取文件
    const file = formdata.get("file");
    if (!file) return new Response("Error: No file provided", { status: 400 });

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
        metadata.S3Location = `https://${bucketName}.${s3ServerDomain}/${s3FileName}`; // 采用虚拟主机风格的 URL
        metadata.S3Endpoint = endpoint;
        metadata.S3AccessKeyId = accessKeyId;
        metadata.S3SecretAccessKey = secretAccessKey;
        metadata.S3Region = region || "auto";
        metadata.S3BucketName = bucketName;
        metadata.S3FileKey = s3FileName;

        // 图像审查
        if (moderateContentApiKey) {
            try {
                await env.img_url.put(fullId, "", { metadata });
            } catch {
                return new Response("Error: Failed to write to KV database", { status: 500 });
            }

            const moderateUrl = `https://${originUrl.hostname}/file/${fullId}`;
            metadata = await moderateContent(env, moderateUrl, metadata);
            await purgeCDNCache(env, moderateUrl, originUrl);
        }

        // 写入 KV 数据库
        try {
            await env.img_url.put(fullId, "", { metadata });
        } catch {
            return new Response("Error: Failed to write to KV database", { status: 500 });
        }

        return new Response(JSON.stringify([{ src: returnLink }]), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    } catch (error) {
        return new Response(`Error: Failed to upload to S3 - ${error.message}`, { status: 500 });
    }
}

// 上传到Telegram
async function uploadFileToTelegram(env, formdata, fullId, metadata, fileExt, fileName, fileType, url, clonedRequest, returnLink) {
    // 选择一个 Telegram 渠道上传，若负载均衡开启，则随机选择一个；否则选择第一个
    const tgSettings = uploadConfig.telegram;
    const tgChannels = tgSettings.channels;
    const tgChannel = tgSettings.loadBalance.enabled? tgChannels[Math.floor(Math.random() * tgChannels.length)] : tgChannels[0];
    if (!tgChannel) {
        return new Response('Error: No Telegram channel provided', { status: 400 });
    }

    const tgBotToken = tgChannel.botToken;
    const tgChatId = tgChannel.chatId;

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
    // 复制请求头并剔除 authCode
    const headers = new Headers(clonedRequest.headers);
    headers.delete('authCode');


    // 向目标 URL 发送请求
    let res = new Response('upload error, check your environment params about telegram channel!', { status: 400 });
    try {
        const response = await fetch(targetUrl.href, {
            method: clonedRequest.method,
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
            res = new Response(
                JSON.stringify([{ 'src': `${returnLink}` }]),
                {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
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
            res = new Response('Error: Failed to write to KV database', { status: 500 });
        }
    } catch (error) {
        res = new Response('upload error, check your environment params about telegram channel!', { status: 400 });
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
        return new Response('Error: No url provided', { status: 400 });
    }
    metadata.ExternalLink = extUrl;
    // 写入KV数据库
    try {
        await env.img_url.put(fullId, "", {
            metadata: metadata,
        });
    } catch (error) {
        return new Response('Error: Failed to write to KV database', { status: 500 });
    }

    // 返回结果
    return new Response(
        JSON.stringify([{ 'src': `${returnLink}` }]), 
        {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        }
    );
}

// 图像审查
async function moderateContent(env, url, metadata) {
    const apikey = moderateContentApiKey;
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
        } finally {
            console.log('Moderate Done');
        }
    }
    return metadata;
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

async function purgeCDNCache(env, cdnUrl, url) {
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
        await cache.put(`${url.origin}/api/randomFileList`, nullResponse);
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