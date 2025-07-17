import { fetchSecurityConfig } from './sysConfig';

export async function userAuthCheck(env, url, request) {
    const securityConfig = await fetchSecurityConfig(env);
    const rightAuthCode = securityConfig.auth.user.authCode;

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

export function UnauthorizedResponse(reason) {
    return new Response(reason, {
        status: 401,
        statusText: "Unauthorized",
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, GET',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization, authCode',
            "Content-Type": "text/plain;charset=UTF-8",
            "Cache-Control": "no-store",
            "Content-Length": reason.length,
        },
    });
}

function isValidAuthCode(rightAuthCode, authCode) {
    return authCode === rightAuthCode;
}

function isAuthCodeDefined(authCode) {
    return authCode !== undefined && authCode !== null && authCode.trim() !== '';
}


function getCookieValue(cookies, name) {
    const match = cookies.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
}