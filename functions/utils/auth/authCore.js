/**
 * 统一认证核心
 * 所有认证逻辑的单一来源，按优先级依次尝试各种认证方式
 */

import { fetchSecurityConfig } from '../sysConfig.js';
import { validateApiToken } from './tokenValidator.js';
import { getDatabase } from '../databaseAdapter.js';
import { verifyPassword, needsRehash, hashPassword } from './passwordHash.js';
import { validateSession } from './sessionManager.js';

/**
 * 认证范围常量
 * - 'admin'  : 仅管理员（admin session / API Token / Basic Auth）
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

    const adminConfigured = !!(adminUsername && adminUsername.trim());
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

    // 4. Basic Auth（仅管理员场景）
    if (checkAdmin && adminConfigured && request.headers.has('Authorization')) {
        const basicResult = await verifyBasicAuth(request, adminUsername, adminPassword, env);
        if (basicResult.valid) {
            return { authorized: true, authType: 'admin' };
        }
    }

    // 5. authCode（仅用户场景）
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
 * Basic Auth 验证 + 自动 rehash
 */
async function verifyBasicAuth(request, expectedUser, expectedPass, env) {
    try {
        const { user, pass } = parseBasicAuth(request);
        const passwordMatch = await verifyPassword(pass, expectedPass);
        if (user !== expectedUser || !passwordMatch) {
            return { valid: false };
        }

        // 验证通过后，自动升级旧版哈希为 PBKDF2
        if (needsRehash(expectedPass) || !expectedPass.startsWith('$pbkdf2$')) {
            try {
                const db = getDatabase(env);
                const settingsStr = await db.get('manage@sysConfig@security');
                if (settingsStr) {
                    const settings = JSON.parse(settingsStr);
                    if (settings.auth?.admin) {
                        settings.auth.admin.adminPassword = await hashPassword(pass);
                        await db.put('manage@sysConfig@security', JSON.stringify(settings));
                    }
                }
            } catch (e) {
                console.error('Failed to rehash admin password:', e);
            }
        }

        return { valid: true };
    } catch {
        return { valid: false };
    }
}

/**
 * 解析 Basic Auth 头
 */
function parseBasicAuth(request) {
    const auth = request.headers.get('Authorization');
    if (!auth) {
        throw new Error('No Authorization header');
    }

    const [scheme, encoded] = auth.split(' ');
    if (scheme !== 'Basic' || !encoded) {
        throw new Error('Invalid auth scheme');
    }

    const buffer = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
    const decoded = new TextDecoder().decode(buffer).normalize();

    const index = decoded.indexOf(':');
    if (index === -1 || /[\0-\x1F\x7F]/.test(decoded)) {
        throw new Error('Invalid authorization value');
    }

    return {
        user: decoded.substring(0, index),
        pass: decoded.substring(index + 1),
    };
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
