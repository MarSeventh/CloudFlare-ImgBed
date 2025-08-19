/**
 * 数据库适配器
 * 提供统一的接口，可以在KV和D1之间切换
 */

import { D1Database } from './d1Database.js';

/**
 * 创建数据库适配器
 * @param {Object} env - 环境变量
 * @returns {Object} 数据库适配器实例
 */
export function createDatabaseAdapter(env) {
    // 检查是否配置了D1数据库
    if (env.DB && typeof env.DB.prepare === 'function') {
        // 使用D1数据库
        console.log('Using D1 Database');
        return new D1Database(env.DB);
    } else {
        console.error('D1 database not configured. Please configure D1 database (env.DB)');
        return null;
    }
}

// KV适配器已移除 - 此D1版本仅支持D1数据库

/**
 * 获取数据库实例的便捷函数
 * 这个函数可以在整个应用中使用，确保一致的数据库访问
 * @param {Object} env - 环境变量
 * @returns {Object} 数据库实例
 */
export function getDatabase(env) {
    var adapter = createDatabaseAdapter(env);
    if (!adapter) {
        throw new Error('D1 database not configured. Please configure D1 database (env.DB) in Cloudflare Pages Dashboard.');
    }
    return adapter;
}

/**
 * 检查数据库配置
 * @param {Object} env - 环境变量
 * @returns {Object} 配置信息
 */
export function checkDatabaseConfig(env) {
    var hasD1 = env.DB && typeof env.DB.prepare === 'function';

    return {
        hasD1: hasD1,
        usingD1: hasD1,
        configured: hasD1,
        database: hasD1 ? 'D1' : 'None'
    };
}

/**
 * 数据库健康检查
 * @param {Object} env - 环境变量
 * @returns {Promise<Object>} 健康检查结果
 */
export async function healthCheck(env) {
    var config = checkDatabaseConfig(env);

    if (!config.configured) {
        return {
            healthy: false,
            error: 'No database configured',
            config: config
        };
    }

    try {
        var db = getDatabase(env);

        // D1健康检查 - 尝试查询一个简单的表
        var stmt = db.db.prepare('SELECT 1 as test');
        await stmt.first();

        return {
            healthy: true,
            config: config
        };
    } catch (error) {
        return {
            healthy: false,
            error: error.message,
            config: config
        };
    }
}


