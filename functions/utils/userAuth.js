import { fetchSecurityConfig } from './sysConfig';
import { validateApiToken } from './tokenValidator';
import { getDatabase } from './databaseAdapter.js';

/** 
 * 客户端用户认证
 * @param {Object} env - 环境变量
 * @param {URL} url - 请求的URL
 * @param {Request} request - 请求对象
 * @param {string|null} requiredPermission - 如果提供，则进行Token验证
 * @return {Promise<boolean>} 返回是否认证通过
 */
export async function userAuthCheck(env, url, request, requiredPermission = null) {
    // 首先使用Token验证
    const tokenValidation = await validateApiToken(request, getDatabase(env), requiredPermission);
    if (tokenValidation.valid) {
        return true;
    }
        
    // Token验证失败，继续尝试传统认证方式
    const securityConfig = await fetchSecurityConfig(env);
    const rightAuthCode = securityConfig.auth.user.authCode;

    // 优先从请求 URL 参数获取 authCode
    let authCode = url.searchParams.get('authCode');

    // 如果 URL 参数中没有 authCode，从 Referer 中获取
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