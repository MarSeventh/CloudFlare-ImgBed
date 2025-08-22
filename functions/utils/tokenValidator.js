// API Token权限验证工具函数
import { getTokenPermissions } from '../api/manage/apiTokens.js';

/**
 * 验证API Token权限
 * @param {Request} request - 请求对象
 * @param {Object} db - 数据库适配器
 * @param {string} requiredPermission - 需要的权限 ('upload', 'delete', 'list')
 * @returns {Promise<{valid: boolean, error?: string}>}
 */
export async function validateApiToken(request, db, requiredPermission) {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader) {
        return { valid: false, error: '缺少Authorization头' };
    }

    let token;
    
    // 支持两种格式: "Bearer token" 或 "token"
    if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
    } else {
        token = authHeader;
    }

    if (!token) {
        return { valid: false, error: '无效的Token格式' };
    }

    // 获取Token权限
    const permissions = await getTokenPermissions(db, token);
    
    if (!permissions) {
        return { valid: false, error: '无效的Token' };
    }

    // 检查权限，如果不需要特定权限（requiredPermission为null），则只要token有效就通过
    if (requiredPermission !== null && !permissions.includes(requiredPermission)) {
        return { valid: false, error: `缺少${requiredPermission}权限` };
    }

    return { valid: true };
}

/**
 * 从请求中提取Token信息
 * @param {Request} request - 请求对象
 * @param {KVNamespace} kv - KV存储
 * @returns {Promise<object|null>} Token信息或null
 */
export async function getTokenInfo(request, kv) {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader) {
        return null;
    }

    let token;
    
    if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
    } else {
        token = authHeader;
    }

    if (!token) {
        return null;
    }

    // 从KV中获取Token信息
    const settingsStr = await kv.get('manage@sysConfig@security');
    const settings = settingsStr ? JSON.parse(settingsStr) : {};
    const tokens = settings.apiTokens?.tokens || {};
    
    // 查找匹配的token
    for (const tokenId in tokens) {
        if (tokens[tokenId].token === token) {
            return tokens[tokenId];
        }
    }
    
    return null;
}
