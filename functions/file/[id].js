import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { fetchSecurityConfig } from "../utils/sysConfig";

let targetUrl = '';
let securityConfig = {};
let allowedDomains = null;
let whiteListMode = false;

export async function onRequest(context) {  // Contents of context object
    const {
        request, // same as existing Worker API
        env, // same as existing Worker API
        params, // if filename includes [id] or [[path]]
        waitUntil, // same as ctx.waitUntil in existing Worker API
        next, // used for middleware or to fetch assets
        data, // arbitrary space for passing data between middlewares
    } = context;

    try {
        // 解码params.id
        params.id = decodeURIComponent(params.id);
    } catch (e) {
        return new Response('Error: Decode Image ID Failed', { status: 400 });
    }

    // 读取安全配置
    securityConfig = await fetchSecurityConfig(env);
    allowedDomains = securityConfig.access.allowedDomains;
    whiteListMode = securityConfig.access.whiteListMode;
    
    const url = new URL(request.url);
    let Referer = request.headers.get('Referer');
    if (Referer) {
        try {
            let refererUrl = new URL(Referer);
            if (allowedDomains && allowedDomains.trim() !== '') {
                let allowedDomainsList = allowedDomains.split(',');
                let isAllowed = allowedDomainsList.some(domain => {
                    let domainPattern = new RegExp(`(^|\\.)${domain.replace('.', '\\.')}$`); // Escape dot in domain
                    return domainPattern.test(refererUrl.hostname);
                });
                if (!isAllowed) {
                    return Response.redirect(new URL("/blockimg", request.url).href, 302); // Ensure URL is correctly formed
                }
            }
        } catch (e) {
            return Response.redirect(new URL("/blockimg", request.url).href, 302); // Ensure URL is correctly formed
        }
    }
    // 检查是否配置了 KV 数据库
    if (typeof env.img_url == "undefined" || env.img_url == null || env.img_url == "") {
        return new Response('Error: Please configure KV database', { status: 500 });
    }
    const imgRecord = await env.img_url.getWithMetadata(params.id);
    // 如果meatdata不存在，只可能是之前未设置KV，且存储在Telegraph上的图片，那么在后面获取时会返回404错误，此处不用处理
    
    const fileName = imgRecord.metadata?.FileName || params.id;
    const encodedFileName = encodeURIComponent(fileName);
    const fileType = imgRecord.metadata?.FileType || null;
    
    // 检查文件可访问状态
    let accessRes = await returnWithCheck(request, env, url, imgRecord);
    if (accessRes.status !== 200) {
        return accessRes; // 如果不可访问，直接返回
    }



    // Cloudflare R2渠道
    if (imgRecord.metadata?.Channel === 'CloudflareR2') {
        // 检查是否配置了R2
        if (typeof env.img_r2 == "undefined" || env.img_r2 == null || env.img_r2 == "") {
            return new Response('Error: Please configure R2 database', { status: 500 });
        }
        
        const R2DataBase = env.img_r2;
        const object = await R2DataBase.get(params.id);

        if (object === null) {
            return new Response('Error: Failed to fetch image', { status: 500 });
        }

        const headers = new Headers();
        object.writeHttpMetadata(headers)
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

        // 返回图片
        const newRes = new Response(object.body, {
            status: 200,
            headers,
        });

        return newRes;
    }


    // S3渠道
    if (imgRecord.metadata?.Channel === "S3") {
        const s3Client = new S3Client({
            region: imgRecord.metadata?.S3Region || "auto", // 默认使用 auto 区域
            endpoint: imgRecord.metadata?.S3Endpoint,
            credentials: {
                accessKeyId: imgRecord.metadata?.S3AccessKeyId,
                secretAccessKey: imgRecord.metadata?.S3SecretAccessKey
            }
        });

        const bucketName = imgRecord.metadata?.S3BucketName;
        const key = imgRecord.metadata?.S3FileKey;

        try {
            const command = new GetObjectCommand({
                Bucket: bucketName,
                Key: key
            });


            const response = await s3Client.send(command);

            // 设置响应头
            const headers = new Headers();
            headers.set("Content-Disposition", `inline; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`);
            headers.set("Access-Control-Allow-Origin", "*");

            if (fileType) {
                headers.set("Content-Type", fileType);
            }

            // 根据Referer设置CDN缓存策略
            if (Referer && Referer.includes(url.origin)) {
                headers.set('Cache-Control', 'private, max-age=86400');
            } else {
                headers.set('Cache-Control', 'public, max-age=604800');
            }

            // 返回 S3 文件流
            return new Response(response.Body, { status: 200, headers });

        } catch (error) {
            return new Response(`Error: Failed to fetch from S3 - ${error.message}`, { status: 500 });
        }
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
        TgFileID = params.id.split('.')[0];
    } else if (imgRecord.metadata?.Channel === 'TelegramNew') {
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
        const filePath = await getFilePath(TgBotToken, TgFileID);
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

async function returnWithCheck(request, env, url, imgRecord) {
    const response = new Response('good', { status: 200 });

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