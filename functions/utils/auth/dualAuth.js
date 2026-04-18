/**
 * 双重鉴权工具
 * 基于统一认证核心，管理端和用户端认证一次完成
 */

import { authenticate, AUTH_SCOPE } from './authCore.js';

/**
 * 双重鉴权检查：管理端或用户端任意一个通过即可
 * @param {Object} env - 环境变量
 * @param {URL} url - 请求的URL
 * @param {Request} request - 请求对象
 * @returns {Promise<{authorized: boolean, authType: string|null}>}
 */
export async function dualAuthCheck(env, url, request) {
    return await authenticate({
        env,
        request,
        url,
        requiredPermission: null,
        authScope: AUTH_SCOPE.EITHER,
    });
}
