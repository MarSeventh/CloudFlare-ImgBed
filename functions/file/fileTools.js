/* ======== 文件读取工具函数 ======== */

// 判断请求域名是否在允许的域名列表中
export function isDomainAllowed(context) {
    const { Referer, securityConfig, url } = context;

    const allowedDomains = securityConfig.access.allowedDomains;
    
    if (Referer) {
        try {
            const refererUrl = new URL(Referer);
            if (allowedDomains && allowedDomains.trim() !== '') {
                const domains = allowedDomains.split(',');
                domains.push(url.hostname);// 把自身域名加入白名单

                let isAllowed = domains.some(domain => {
                    let domainPattern = new RegExp(`(^|\\.)${domain.replace('.', '\\.')}$`); // Escape dot in domain
                    return domainPattern.test(refererUrl.hostname);
                });
                
                if (!isAllowed) {
                    return false;
                }
            }
        } catch (e) {
            return false;
        }
    }

    return true;
}

// 公共响应头设置函数
export function setCommonHeaders(headers, encodedFileName, fileType, Referer, url) {
    headers.set('Content-Disposition', `inline; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`);
    headers.set('Access-Control-Allow-Origin', '*');
    headers.set('Accept-Ranges', 'bytes');
    headers.set('Vary', 'Range');
    
    if (fileType) {
        headers.set('Content-Type', fileType);
    }
    
    // 根据Referer设置CDN缓存策略
    if (Referer && Referer.includes(url.origin)) {
        headers.set('Cache-Control', 'private, max-age=86400'); // 本地缓存 1天
    } else {
        headers.set('Cache-Control', 'public, max-age=2592000'); // CDN缓存 30天
    }
}

// 设置Range请求相关头部
export function setRangeHeaders(headers, rangeStart, rangeEnd, totalSize) {
    const contentLength = rangeEnd - rangeStart + 1;
    headers.set('Content-Length', contentLength.toString());
    headers.set('Content-Range', `bytes ${rangeStart}-${rangeEnd}/${totalSize}`);
}

// 处理HEAD请求的公共函数
export function handleHeadRequest(headers, etag = null) {
    const responseHeaders = new Headers();
    
    // 复制关键头部
    responseHeaders.set('Content-Length', headers.get('Content-Length') || '0');
    responseHeaders.set('Content-Type', headers.get('Content-Type') || 'application/octet-stream');
    responseHeaders.set('Content-Disposition', headers.get('Content-Disposition') || 'inline');
    responseHeaders.set('Access-Control-Allow-Origin', headers.get('Access-Control-Allow-Origin') || '*');
    responseHeaders.set('Accept-Ranges', headers.get('Accept-Ranges') || 'bytes');
    responseHeaders.set('Cache-Control', headers.get('Cache-Control') || 'public, max-age=2592000');
    
    if (etag) {
        responseHeaders.set('ETag', etag);
    }
    
    return new Response(null, {
        status: 200,
        headers: responseHeaders,
    });
}

export async function getFileContent(request, targetUrl, max_retries = 2) {
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

export function isTgChannel(imgRecord) {
    return imgRecord.metadata?.Channel === 'Telegram' || imgRecord.metadata?.Channel === 'TelegramNew';
}

// 图片可访问性检查
export async function returnWithCheck(context, imgRecord) {
    const { request, env, url, securityConfig } = context;
    const whiteListMode = securityConfig.access.whiteListMode;

    const response = new Response('success', { status: 200 });

    // Referer header equal to the dashboard page or upload page
    if (request.headers.get('Referer') && request.headers.get('Referer').includes(url.origin)) {
        //show the image
        return response;
    }

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
    
    // other cases
    return response;
}

export async function return404(url) {
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

export async function returnBlockImg(url) {
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

export async function returnWhiteListImg(url) {
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