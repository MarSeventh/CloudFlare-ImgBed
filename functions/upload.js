import { errorHandling, telemetryData } from "./utils/middleware";

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
    if (isAuthCodeDefined(env.AUTH_CODE) && !isValidAuthCode(env.AUTH_CODE, authCode)) {
        return false;
    }
    return true;
}

export async function onRequestPost(context) {  // Contents of context object
    const { request, env, params, waitUntil, next, data } = context;

    const url = new URL(request.url);
    const clonedRequest = await request.clone();

    // 鉴权
    if (!authCheck(env, url, request)) {
        return UnauthorizedException('Unauthorized');
    }

    // 获得上传IP
    const uploadIp = request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for") || request.headers.get("x-client-ip") || request.headers.get("x-host") || request.headers.get("x-originating-ip") || request.headers.get("x-cluster-client-ip") || request.headers.get("forwarded-for") || request.headers.get("forwarded") || request.headers.get("via") || request.headers.get("requester") || request.headers.get("true-client-ip") || request.headers.get("client-ip") || request.headers.get("x-remote-ip") || request.headers.get("x-originating-ip") || request.headers.get("fastly-client-ip") || request.headers.get("akamai-origin-hop") || request.headers.get("x-remote-ip") || request.headers.get("x-remote-addr") || request.headers.get("x-remote-host") || request.headers.get("x-client-ip") || request.headers.get("x-client-ips") || request.headers.get("x-client-ip")
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
        default:
            uploadChannel = 'TelegramNew';
            break;
    }

    await errorHandling(context);
    telemetryData(context);

    if (typeof env.img_url == "undefined" || env.img_url == null || env.img_url == "") {
        // img_url 未定义或为空的处理逻辑
        return new Response('Error: Please configure KV database', { status: 500 });
    } 

    const formdata = await clonedRequest.formData();
    const fileType = formdata.get('file').type;
    const fileName = formdata.get('file').name;
    let fileExt = fileName.split('.').pop(); // 文件扩展名
    if (!isExtValid(fileExt)) {
        // 如果文件名中没有扩展名，尝试从文件类型中获取
        fileExt = fileType.split('/').pop();
        if (!isExtValid(fileExt)) {
            // Type中无法获取扩展名
            fileExt = 'unknown' // 默认扩展名
        }
    }

    // CloudFlare R2 渠道
    if (uploadChannel === 'CloudflareR2') {
        // 检查R2数据库是否配置
        if (typeof env.img_r2 == "undefined" || env.img_r2 == null || env.img_r2 == "") {
            return new Response('Error: Please configure R2 database', { status: 500 });
        }
        
        const R2DataBase = env.img_r2;

        // 构建文件ID
        const time = new Date().getTime();
        const unique_index = time + Math.floor(Math.random() * 10000);
        const fullId = fileName? unique_index + '_' + fileName : unique_index + '.' + fileExt;

        // 写入R2数据库
        await R2DataBase.put(fullId, formdata.get('file'));

        // 图像审查
        const apikey = env.ModerateContentApiKey;
        if (apikey == undefined || apikey == null || apikey == "") {
            await env.img_url.put(fullId, "", {
                metadata: { FileName: fileName, FileType: fileType, ListType: "None", Label: "None", TimeStamp: time, Channel: "CloudflareR2", UploadIP: uploadIp },
            });
        } else {
            try {
                // 检查R2公网链接是否配置
                if (typeof env.R2PublicUrl == "undefined" || env.R2PublicUrl == null || env.R2PublicUrl == "") {
                    return new Response('Error: Please configure R2 public url', { status: 500 });
                }
                const R2PublicUrl = env.R2PublicUrl;
                const fetchResponse = await fetch(`https://api.moderatecontent.com/moderate/?key=${apikey}&url=${R2PublicUrl}/${fullId}`);
                if (!fetchResponse.ok) {
                    throw new Error(`HTTP error! status: ${fetchResponse.status}`);
                }
                const moderate_data = await fetchResponse.json();
                await env.img_url.put(fullId, "", {
                    metadata: { FileName: fileName, FileType: fileType, ListType: "None", Label: moderate_data.rating_label, TimeStamp: time, Channel: "CloudflareR2", UploadIP: uploadIp },
                });
            } catch (error) {
                console.error('Moderate Error:', error);
            } finally {
                console.log('Moderate Done');
            }
        }


        // 成功上传，将文件ID返回给客户端
        return new Response(
            JSON.stringify([{ 'src': `/file/${fullId}` }]), 
            {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            }
        );
    } else {
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

        // GIF 特殊处理
        if (fileType === 'image/gif' || fileType === 'image/webp' || fileExt === 'gif' || fileExt === 'webp') {
            sendFunction = {'url': 'sendAnimation', 'type': 'animation'};
        }

        // 从参数中获取serverCompress，如果为false，则使用sendDocument接口
        if (url.searchParams.get('serverCompress') === 'false') {
            sendFunction = {'url': 'sendDocument', 'type': 'document'};
        }

        // 构建目标 URL 时剔除 authCode 参数
        // const targetUrl = new URL(url.pathname, 'https://telegra.ph'); // telegraph接口，已失效，缅怀
        const targetUrl = new URL(`https://api.telegram.org/bot${env.TG_BOT_TOKEN}/${sendFunction.url}`); // telegram接口
        let newFormdata = new FormData();
        newFormdata.append('chat_id', env.TG_CHAT_ID);
        newFormdata.append(sendFunction.type, formdata.get('file'));


        url.searchParams.forEach((value, key) => {
            if (key !== 'authCode') {
                targetUrl.searchParams.append(key, value);
            }
        });
        // 复制请求头并剔除 authCode
        const headers = new Headers(clonedRequest.headers);
        headers.delete('authCode');

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
            const filePath = await getFilePath(env, fileInfo.file_id);

            const time = new Date().getTime();
            const id = fileInfo.file_id;
            //const fullId = id + '.' + fileExt;
            // 构建独一无二的 ID
            const unique_index = time + Math.floor(Math.random() * 10000);
            const fullId = fileName? unique_index + '_' + fileName : unique_index + '.' + fileExt;
            // 若上传成功，将响应返回给客户端
            if (response.ok) {
                res = new Response(
                    JSON.stringify([{ 'src': `/file/${fullId}` }]), 
                    {
                        status: 200,
                        headers: { 'Content-Type': 'application/json' }
                    }
                );
            }
            const apikey = env.ModerateContentApiKey;
        
            if (apikey == undefined || apikey == null || apikey == "") {
                await env.img_url.put(fullId, "", {
                    metadata: { FileName: fileName, FileType: fileType, ListType: "None", Label: "None", TimeStamp: time, Channel: "TelegramNew", TgFileId: id, UploadIP: uploadIp },
                });
            } else {
                try {
                    const fetchResponse = await fetch(`https://api.moderatecontent.com/moderate/?key=${apikey}&url=https://api.telegram.org/file/bot${env.TG_BOT_TOKEN}/${filePath}`);
                    if (!fetchResponse.ok) {
                        throw new Error(`HTTP error! status: ${fetchResponse.status}`);
                    }
                    const moderate_data = await fetchResponse.json();
                    await env.img_url.put(fullId, "", {
                        metadata: { FileName: fileName, FileType: fileType, ListType: "None", Label: moderate_data.rating_label, TimeStamp: time, Channel: "TelegramNew", TgFileId: id, UploadIP: uploadIp },
                    });
                } catch (error) {
                    console.error('Moderate Error:', error);
                } finally {
                    console.log('Moderate Done');
                }
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            return res;
        }
    }
}

function getFile(response) {
    try {
		if (!response.ok) {
			return null;
		}

		const getFileDetails = (file) => ({
			file_id: file.file_id,
			file_name: file.file_name || file.file_unique_id
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

async function getFilePath(env, file_id) {
    try {
        const url = `https://api.telegram.org/bot${env.TG_BOT_TOKEN}/getFile?file_id=${file_id}`;
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

function isExtValid(fileExt) {
    return ['jpeg', 'jpg', 'png', 'gif', 'webp', 
    'mp4', 'mp3', 'ogg',
    'mp3', 'wav', 'flac', 'aac', 'opus',
    'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'pdf', 
    'txt', 'md', 'json', 'xml', 'html', 'css', 'js', 'ts', 'go', 'java', 'php', 'py', 'rb', 'sh', 'bat', 'cmd', 'ps1', 'psm1', 'psd', 'ai', 'sketch', 'fig', 'svg', 'eps', 'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'apk', 'exe', 'msi', 'dmg', 'iso', 'torrent', 'webp', 'ico', 'svg', 'ttf', 'otf', 'woff', 'woff2', 'eot', 'apk', 'crx', 'xpi', 'deb', 'rpm', 'jar', 'war', 'ear', 'img', 'iso', 'vdi', 'ova', 'ovf', 'qcow2', 'vmdk', 'vhd', 'vhdx', 'pvm', 'dsk', 'hdd', 'bin', 'cue', 'mds', 'mdf', 'nrg', 'ccd', 'cif', 'c2d', 'daa', 'b6t', 'b5t', 'bwt', 'isz', 'isz', 'cdi', 'flp', 'uif', 'xdi', 'sdi'
    ].includes(fileExt);
}