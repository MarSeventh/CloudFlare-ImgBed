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

export async function onRequestPost(context) {  // Contents of context object
    const { request, env, params, waitUntil, next, data } = context;
    const url = new URL(request.url);
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
        return new UnauthorizedException("error");
    }
    const clonedRequest = request.clone();
    await errorHandling(context);
    telemetryData(context);
    // 构建目标 URL 时剔除 authCode 参数
    const targetUrl = new URL(url.pathname, 'https://telegra.ph');
    url.searchParams.forEach((value, key) => {
        if (key !== 'authCode') {
            targetUrl.searchParams.append(key, value);
        }
    });
    // 复制请求头并剔除 authCode
    const headers = new Headers(clonedRequest.headers);
    headers.delete('authCode');
    const response = await fetch(targetUrl.href, {
        method: clonedRequest.method,
        headers: headers,
        body: clonedRequest.body,
    });
    try {
        const clonedRes = await response.clone().json(); // 等待响应克隆和解析完成
        const time = new Date().getTime();
        const src = clonedRes[0].src;
        const id = src.split('/').pop();
        const img_url = env.img_url;
        const apikey = env.ModerateContentApiKey;
    
        if (img_url == undefined || img_url == null || img_url == "") {
            // img_url 未定义或为空的处理逻辑
        } else {
            if (apikey == undefined || apikey == null || apikey == "") {
                await env.img_url.put(id, "", {
                    metadata: { ListType: "None", Label: "None", TimeStamp: time },
                });
            } else {
                try {
                    const fetchResponse = await fetch(`https://api.moderatecontent.com/moderate/?key=${apikey}&url=https://telegra.ph/${src}`);
                    if (!fetchResponse.ok) {
                        throw new Error(`HTTP error! status: ${fetchResponse.status}`);
                    }
                    const moderate_data = await fetchResponse.json();
                    await env.img_url.put(id, "", {
                        metadata: { ListType: "None", Label: moderate_data.rating_label, TimeStamp: time },
                    });
                } catch (error) {
                    console.error('Moderate Error:', error);
                } finally {
                    console.log('Moderate Done');
                }
            }
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        return response;
    }
}
