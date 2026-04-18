/**
 * 统一认证核心
 * 所有认证逻辑的单一来源，按优先级依次尝试各种认证方式
 */

import { fetchSecurityConfig } from '../sysConfig.js';
import { validateApiToken } from './tokenValidator.js';
import { getDatabase } from '../databaseAdapter.js';
import { verifyPassword } from './passwordHash.js';
import { validateSession } from './sessionManager.js';

/**
 * 认证范围常量
 * - 'admin'  : 仅管理员（admin session / API Token）
 * - 'user'   : 仅用户（user session / admin session / API Token / authCode）
 * - 'either' : 管理员或用户任一通过即可（所有认证方式）
 */
export const AUTH_SCOPE = {
    ADMIN: 'admin',
    USER: 'user',
    EITHER: 'either',
};

/**
 * 统一认证函数
 *
 * @param {Object} options
 * @param {Object} options.env - 环境变量
 * @param {Request} options.request - 请求对象
 * @param {URL} [options.url] - 请求URL（authCode 提取需要）
 * @param {string|null} [options.requiredPermission] - API Token 所需权限
 * @param {'admin'|'user'|'either'} [options.authScope='either'] - 认证范围
 * @returns {Promise<{authorized: boolean, authType: 'admin'|'user'|null}>}
 */
export async function authenticate({
    env,
    request,
    url = null,
    requiredPermission = null,
    authScope = AUTH_SCOPE.EITHER,
}) {
    // 读取安全配置
    const securityConfig = await fetchSecurityConfig(env);
    const adminUsername = securityConfig.auth.admin.adminUsername;
    const adminPassword = securityConfig.auth.admin.adminPassword;
    const userAuthCode = securityConfig.auth.user.authCode;

    const adminConfigured = !!(adminUsername && adminUsername.trim()) || !!(adminPassword && adminPassword.trim());
    const authCodeConfigured = !!(userAuthCode && userAuthCode.trim());

    const checkAdmin = authScope === AUTH_SCOPE.ADMIN || authScope === AUTH_SCOPE.EITHER;
    const checkUser = authScope === AUTH_SCOPE.USER || authScope === AUTH_SCOPE.EITHER;

    // 管理员未配置时，管理端认证视为不需要，直接放行
    if (checkAdmin && !checkUser && !adminConfigured) {
        return { authorized: true, authType: null };
    }

    // --- Session 验证 ---

    // 1. admin session（管理员和用户场景都接受 admin session）
    const adminSession = await validateSession(env, request, 'admin');
    if (adminSession.valid) {
        return { authorized: true, authType: 'admin' };
    }

    // 2. user session（仅用户场景接受，管理端不接受 user session）
    if (checkUser) {
        const userSession = await validateSession(env, request, 'user');
        if (userSession.valid) {
            return { authorized: true, authType: 'user' };
        }
    }

    // --- Token 验证 ---

    // 3. API Token
    const db = getDatabase(env);
    const tokenResult = await validateApiToken(request, db, requiredPermission);
    if (tokenResult.valid) {
        return { authorized: true, authType: 'admin' };
    }

    // --- 凭据验证 ---

    // 4. authCode（仅用户场景）
    if (checkUser) {
        if (authCodeConfigured) {
            if (url) {
                const authCode = extractAuthCode(url, request);
                if (authCode && await verifyPassword(authCode, userAuthCode)) {
                    return { authorized: true, authType: 'user' };
                }
            }
            // authCode 已配置但验证失败，拒绝访问
            return { authorized: false, authType: null };
        }
        // authCode 未配置，视为不需要用户端认证
    }

    // --- 兜底判断 ---

    // 如果所有启用的认证方式都未配置凭据，视为无需认证
    const needsAdmin = checkAdmin && adminConfigured;
    const needsUser = checkUser && authCodeConfigured;

    if (!needsAdmin && !needsUser) {
        return { authorized: true, authType: null };
    }

    return { authorized: false, authType: null };
}

/**
 * 从多个来源提取 authCode
 * 优先级：URL 参数 > Referer > 请求头 > Cookie
 */
function extractAuthCode(url, request) {
    let authCode = url.searchParams.get('authCode');

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

    if (!authCode) {
        authCode = request.headers.get('authCode');
    }

    if (!authCode) {
        const cookies = request.headers.get('Cookie');
        if (cookies) {
            const match = cookies.match(new RegExp('(^| )authCode=([^;]+)'));
            authCode = match ? decodeURIComponent(match[2]) : null;
        }
    }

    return authCode;
}
