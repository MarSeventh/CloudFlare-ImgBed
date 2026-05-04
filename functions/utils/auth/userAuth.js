/**
 * 用户端认证工具
 * 基于统一认证核心，保持原有导出签名不变
 */

import { authenticate, AUTH_SCOPE } from './authCore.js';

/**
 * 客户端用户认证
 * @param {Object} env - 环境变量
 * @param {URL} url - 请求的URL
 * @param {Request} request - 请求对象
 * @param {string|null} requiredPermission - 如果提供，则进行Token权限验证
 * @return {Promise<boolean>} 返回是否认证通过
 */
export async function userAuthCheck(env, url, request, requiredPermission = null) {
    const result = await authenticate({
        env,
        request,
        url,
        requiredPermission,
        authScope: AUTH_SCOPE.USER,
    });
    return result.authorized;
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
