/**
 * 会话管理工具
 * 使用数据库存储会话，通过 HttpOnly Cookie 传递会话 Token
 * 管理端和用户端使用独立的 Cookie（admin_session / user_session）
 */

import { generateSessionToken } from './passwordHash.js';
import { getDatabase } from './databaseAdapter.js';

const SESSION_PREFIX = 'session@';
const SESSION_MAX_AGE = 14 * 24 * 60 * 60; // 14天（秒）

// Cookie 名称映射
const COOKIE_NAMES = {
    admin: 'admin_session',
    user: 'user_session',
};

/**
 * 创建新会话
 * @param {Object} env - 环境变量
 * @param {string} authType - 认证类型 ('admin' | 'user')
 * @param {string} [username] - 用户名（管理员登录时使用）
 * @returns {Promise<{token: string, cookie: string}>}
 */
export async function createSession(env, authType, username = '') {
    const db = getDatabase(env);
    const token = generateSessionToken();
    const sessionData = {
        authType,
        username,
        createdAt: Date.now(),
        expiresAt: Date.now() + SESSION_MAX_AGE * 1000,
    };

    await db.put(`${SESSION_PREFIX}${token}`, JSON.stringify(sessionData));

    const cookieName = COOKIE_NAMES[authType] || 'session';
    const cookie = buildSessionCookie(cookieName, token, SESSION_MAX_AGE);
    return { token, cookie };
}

/**
 * 验证会话（按 authType 读取对应的 Cookie）
 * @param {Object} env - 环境变量
 * @param {Request} request - 请求对象
 * @param {string} authType - 要验证的认证类型 ('admin' | 'user')
 * @returns {Promise<{valid: boolean, session?: Object}>}
 */
export async function validateSession(env, request, authType) {
    const cookieName = COOKIE_NAMES[authType] || 'session';
    const token = getCookieValue(request, cookieName);
    if (!token) {
        return { valid: false };
    }

    const db = getDatabase(env);
    const sessionStr = await db.get(`${SESSION_PREFIX}${token}`);
    if (!sessionStr) {
        return { valid: false };
    }

    try {
        const session = JSON.parse(sessionStr);
        // 验证 authType 匹配
        if (session.authType !== authType) {
            return { valid: false };
        }
        if (Date.now() > session.expiresAt) {
            await db.delete(`${SESSION_PREFIX}${token}`);
            return { valid: false };
        }
        return { valid: true, session };
    } catch {
        return { valid: false };
    }
}

/**
 * 验证任意有效会话（不限 authType，用于 sessionCheck 接口）
 * @param {Object} env - 环境变量
 * @param {Request} request - 请求对象
 * @returns {Promise<{valid: boolean, session?: Object}>}
 */
export async function validateAnySession(env, request) {
    // 优先检查 admin，再检查 user
    const adminResult = await validateSession(env, request, 'admin');
    if (adminResult.valid) return adminResult;

    const userResult = await validateSession(env, request, 'user');
    if (userResult.valid) return userResult;

    return { valid: false };
}

/**
 * 销毁会话
 * @param {Object} env - 环境变量
 * @param {Request} request - 请求对象
 * @param {string} [authType] - 要销毁的认证类型，不传则销毁所有
 * @returns {Promise<string|string[]>} 清除 Cookie 的 Set-Cookie 头
 */
export async function destroySession(env, request, authType) {
    const db = getDatabase(env);

    if (authType) {
        // 销毁指定类型的会话
        const cookieName = COOKIE_NAMES[authType] || 'session';
        const token = getCookieValue(request, cookieName);
        if (token) {
            await db.delete(`${SESSION_PREFIX}${token}`);
        }
        return buildSessionCookie(cookieName, '', 0);
    } else {
        // 销毁所有类型的会话
        const cookies = [];
        for (const [type, cookieName] of Object.entries(COOKIE_NAMES)) {
            const token = getCookieValue(request, cookieName);
            if (token) {
                await db.delete(`${SESSION_PREFIX}${token}`);
            }
            cookies.push(buildSessionCookie(cookieName, '', 0));
        }
        return cookies;
    }
}

/**
 * 按认证类型批量清除会话
 * @param {Object} env - 环境变量
 * @param {string} authType - 要清除的认证类型 ('admin' | 'user')
 * @returns {Promise<number>} 清除的会话数量
 */
export async function destroySessionsByAuthType(env, authType) {
    const db = getDatabase(env);
    let destroyed = 0;

    let cursor = undefined;
    let hasMore = true;

    while (hasMore) {
        const listOptions = { prefix: SESSION_PREFIX };
        if (cursor) {
            listOptions.cursor = cursor;
        }

        const result = await db.list(listOptions);
        const keys = result.keys || [];

        for (const key of keys) {
            try {
                const sessionStr = await db.get(key.name);
                if (sessionStr) {
                    const session = JSON.parse(sessionStr);
                    if (session.authType === authType) {
                        await db.delete(key.name);
                        destroyed++;
                    }
                }
            } catch {
                await db.delete(key.name);
                destroyed++;
            }
        }

        cursor = result.cursor;
        hasMore = !result.list_complete && cursor;
    }

    return destroyed;
}

/**
 * 从请求中提取指定 Cookie 的值
 * @param {Request} request - 请求对象
 * @param {string} name - Cookie 名称
 * @returns {string|null}
 */
function getCookieValue(request, name) {
    const cookieHeader = request.headers.get('Cookie');
    if (!cookieHeader) return null;

    const regex = new RegExp('(^|;\\s*)' + name + '=([^;]+)');
    const match = cookieHeader.match(regex);
    return match ? match[2] : null;
}

/**
 * 构建 Set-Cookie 头的值
 * @param {string} name - Cookie 名称
 * @param {string} token - 会话 Token
 * @param {number} maxAge - 最大存活时间（秒）
 * @returns {string}
 */
function buildSessionCookie(name, token, maxAge) {
    const parts = [
        `${name}=${token}`,
        `Path=/`,
        `HttpOnly`,
        `SameSite=Strict`,
        `Max-Age=${maxAge}`,
    ];
    parts.push('Secure');
    return parts.join('; ');
}
