import { userAuthCheck } from './userAuth';
import { fetchSecurityConfig } from './sysConfig';
import { validateApiToken } from './tokenValidator';
import { getDatabase } from './databaseAdapter.js';

/**
 * 双重鉴权检查：管理端或用户端任意一个通过即可
 * 注意：管理端鉴权优先检查，确保管理员权限优先级更高
 * @param {Object} env - 环境变量
 * @param {URL} url - 请求的URL
 * @param {Request} request - 请求对象
 * @returns {Promise<{authorized: boolean, authType: string|null}>}
 */
export async function dualAuthCheck(env, url, request) {
    // 1. 优先尝试管理端鉴权 (Basic Auth / API Token)
    const adminAuthPassed = await adminAuthCheck(env, request);
    if (adminAuthPassed) {
        return { authorized: true, authType: 'admin' };
    }
    
    // 2. 尝试用户端鉴权 (authCode / API Token)
    const userAuthPassed = await userAuthCheck(env, url, request, null);
    if (userAuthPassed) {
        return { authorized: true, authType: 'user' };
    }
    
    return { authorized: false, authType: null };
}

/**
 * 管理端鉴权检查（提取自 _middleware.js 的逻辑）
 * @param {Object} env - 环境变量
 * @param {Request} request - 请求对象
 * @returns {Promise<boolean>} 返回是否认证通过
 */
async function adminAuthCheck(env, request) {
    // 读取安全配置
    const securityConfig = await fetchSecurityConfig(env);
    const basicUser = securityConfig.auth.admin.adminUsername;
    const basicPass = securityConfig.auth.admin.adminPassword;
    
    // 如果未配置管理员账号，视为无需管理端鉴权
    if (typeof basicUser === 'undefined' || basicUser === null || basicUser === '') {
        return true;
    }
    
    // 检查是否有 Authorization 头
    if (!request.headers.has('Authorization')) {
        return false;
    }
    
    // 尝试 API Token 验证
    const db = getDatabase(env);
    const tokenValidation = await validateApiToken(request, db, null);
    if (tokenValidation.valid) {
        return true;
    }
    
    // 尝试 Basic Auth 验证
    try {
        const { user, pass } = parseBasicAuth(request);
        return user === basicUser && pass === basicPass;
    } catch {
        return false;
    }
}

/**
 * 解析 Basic Auth 头
 * @param {Request} request - 请求对象
 * @returns {{user: string, pass: string}} 用户名和密码
 * @throws {Error} 如果格式无效
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
    
    // 解码 base64 并进行 unicode 规范化
    const buffer = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
    const decoded = new TextDecoder().decode(buffer).normalize();
    
    // 用户名和密码由第一个冒号分隔
    const index = decoded.indexOf(':');
    if (index === -1) {
        throw new Error('Invalid auth format');
    }
    
    return { 
        user: decoded.substring(0, index), 
        pass: decoded.substring(index + 1) 
    };
}
