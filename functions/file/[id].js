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

    try {
        // 解码params.id
        params.id = decodeURIComponent(params.id);
    } catch (e) {
        return new Response('Error: Decode Image ID Failed', { status: 400 });
    }
    
    const url = new URL(request.url);
    let Referer = request.headers.get('Referer')
    if (Referer) {
        try {
            let refererUrl = new URL(Referer);
            if (env.ALLOWED_DOMAINS && env.ALLOWED_DOMAINS.trim() !== '') {
                let allowedDomains = env.ALLOWED_DOMAINS.split(',');
                let isAllowed = allowedDomains.some(domain => {
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

        const newRes = new Response(object.body, {
            status: 200,
            headers,
        });

        return newRes;
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
        const filePath = await getFilePath(env, TgFileID);
        if (filePath === null) {
            return new Response('Error: Failed to fetch image path', { status: 500 });
        }
        targetUrl = `https://api.telegram.org/file/bot${env.TG_BOT_TOKEN}/${filePath}`;
    } else {
        targetUrl = 'https://telegra.ph/' + url.pathname + url.search;
    }

    const response = await getFileContent(request);
    if (response === null) {
        return new Response('Error: Failed to fetch image', { status: 500 });
    } else if (response.status === 404) {
        return new Response('Error: Image Not Found', { status: 404 });
    }
    
    try {
        const headers = new Headers(response.headers);
        headers.set('Content-Disposition', `inline; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`);
        headers.set('Access-Control-Allow-Origin', '*');
        if (fileType) {
            headers.set('Content-Type', fileType);
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

    // Referer header equal to the dashboard page
    if (request.headers.get('Referer') == url.origin + "/dashboard") {
        //show the image
        return response;
    }

    if (typeof env.img_url == "undefined" || env.img_url == null || env.img_url == "") { } else {
        //check the record from kv
        const record = imgRecord;
        if (record.metadata === null) {
        } else {
            //if the record is not null, redirect to the image
            if (record.metadata.ListType == "White") {
                return response;
            } else if (record.metadata.ListType == "Block") {
                if (typeof request.headers.get('Referer') == "undefined" || request.headers.get('Referer') == null || request.headers.get('Referer') == "") {
                    return Response.redirect(url.origin + "/blockimg", 302)
                } else {
                    return new Response('Error: Image Blocked', { status: 404 });
                }

            } else if (record.metadata.Label == "adult") {
                if (typeof request.headers.get('Referer') == "undefined" || request.headers.get('Referer') == null || request.headers.get('Referer') == "") {
                    return Response.redirect(url.origin + "/blockimg", 302)
                } else {
                    return new Response('Error: Image Blocked', { status: 404 });
                }
            }
            //check if the env variables WhiteList_Mode are set
            if (env.WhiteList_Mode == "true") {
                //if the env variables WhiteList_Mode are set, redirect to the image
                return Response.redirect(url.origin + "/whiteliston", 302);
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

function isTgChannel(imgRecord) {
    return imgRecord.metadata?.Channel === 'Telegram' || imgRecord.metadata?.Channel === 'TelegramNew';
}