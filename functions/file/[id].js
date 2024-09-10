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
    const TgFileID = params.id.split('.')[0]; // 文件 ID
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
                    return Response.redirect(new URL("/block-img.html", request.url).href, 302); // Ensure URL is correctly formed
                }
            }
        } catch (e) {
            return Response.redirect(new URL("/block-img.html", request.url).href, 302); // Ensure URL is correctly formed
        }
    }
    // 检查是否配置了 KV 数据库
    if (typeof env.img_url == "undefined" || env.img_url == null || env.img_url == "") {
        return new Response('Error: Please configure KV database', { status: 500 });
    }
    const imgRecord = await env.img_url.getWithMetadata(params.id);

    if (imgRecord.metadata?.Channel === 'Telegram') {
        targetUrl = `https://api.telegram.org/file/bot${env.TG_BOT_TOKEN}/${imgRecord.metadata.TgFilePath}`;
    } else {
        targetUrl = 'https://telegra.ph/' + url.pathname + url.search;
    }
    const fileName = imgRecord.metadata?.FileName || 'file';
    const encodedFileName = encodeURIComponent(fileName);
    const fileType = imgRecord.metadata?.FileType || 'image/jpeg';

    const response = await getFileContent(request, imgRecord, TgFileID, env, url);
    
    try {
        const headers = new Headers(response.headers);
        headers.set('Content-Disposition', `inline; filename="${encodedFileName}"`);
        headers.set('Content-Type', fileType);
        const newRes =  new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers,
        });

        if (response.ok) {
            // Referer header equal to the admin page
            if (request.headers.get('Referer') == url.origin + "/admin") {
                //show the image
                return newRes;
            }

            if (typeof env.img_url == "undefined" || env.img_url == null || env.img_url == "") { } else {
                //check the record from kv
                const record = await env.img_url.getWithMetadata(params.id);
                if (record.metadata === null) {
                } else {
                    //if the record is not null, redirect to the image
                    if (record.metadata.ListType == "White") {
                        return newRes;
                    } else if (record.metadata.ListType == "Block") {
                        console.log("Referer")
                        console.log(request.headers.get('Referer'))
                        if (typeof request.headers.get('Referer') == "undefined" || request.headers.get('Referer') == null || request.headers.get('Referer') == "") {
                            return Response.redirect(url.origin + "/block-img.html", 302)
                        } else {
                            return Response.redirect("https://static-res.pages.dev/teleimage/img-block-compressed.png", 302)
                        }

                    } else if (record.metadata.Label == "adult") {
                        if (typeof request.headers.get('Referer') == "undefined" || request.headers.get('Referer') == null || request.headers.get('Referer') == "") {
                            return Response.redirect(url.origin + "/block-img.html", 302)
                        } else {
                            return Response.redirect("https://static-res.pages.dev/teleimage/img-block-compressed.png", 302)
                        }
                    }
                    //check if the env variables WhiteList_Mode are set
                    if (env.WhiteList_Mode == "true") {
                        //if the env variables WhiteList_Mode are set, redirect to the image
                        return Response.redirect(url.origin + "/whitelist-on.html", 302);
                    } else {
                        //if the env variables WhiteList_Mode are not set, redirect to the image
                        return newRes;
                    }
                }
            }
        }
        return newRes;
    } catch (error) {
        return new Response('Error: ' + error, { status: 500 });
    }
}

async function getFileContent(request, imgRecord, file_id, env, url, max_retries = 2) {
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
            } else {
                // 若为TG渠道，更新TgFilePath
                if (imgRecord.metadata?.Channel === 'Telegram') {
                    const filePath = await getFilePath(env, file_id);
                    if (filePath) {
                        imgRecord.metadata.TgFilePath = filePath;
                        await env.img_url.put(file_id, "", {
                            metadata: imgRecord.metadata,
                        });
                        // 更新targetUrl
                        if (imgRecord.metadata?.Channel === 'Telegram') {
                            targetUrl = `https://api.telegram.org/file/bot${env.TG_BOT_TOKEN}/${imgRecord.metadata.TgFilePath}`;
                        } else {
                            targetUrl = 'https://telegra.ph/' + url.pathname + url.search;
                        }
                    }
                }
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
