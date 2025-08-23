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
    if (env.img_d1 && typeof env.img_d1.prepare === 'function') {
        // 使用D1数据库
        return new D1Database(env.img_d1);
    } else if (env.img_url && typeof env.img_url.get === 'function') {
        // 回退到KV存储
        return new KVAdapter(env.img_url);
    } else {
        console.error('No database configured. Please configure either D1 (env.img_d1) or KV (env.img_url)');
        return null;
    }
}

/**
 * KV适配器类
 * 保持与原有KV接口的兼容性
 */
class KVAdapter {
    constructor(kv) {
        this.kv = kv;
    }

    // 直接代理到KV的方法
    async put(key, value, options) {
        options = options || {};
        return await this.kv.put(key, value, options);
    }

    async get(key) {
        return await this.kv.get(key);
    }

    async getWithMetadata(key) {
        return await this.kv.getWithMetadata(key);
    }

    async delete(key) {
        return await this.kv.delete(key);
    }

    async list(options) {
        options = options || {};
        return await this.kv.list(options);
    }

    // 为了兼容性，添加一些别名方法
    async putFile(fileId, value, options) {
        return await this.put(fileId, value, options);
    }

    async getFile(fileId) {
        const result = await this.getWithMetadata(fileId);
        return result;
    }

    async getFileWithMetadata(fileId) {
        return await this.getWithMetadata(fileId);
    }

    async deleteFile(fileId) {
        return await this.delete(fileId);
    }

    async listFiles(options) {
        return await this.list(options);
    }

    async putSetting(key, value) {
        return await this.put(key, value);
    }

    async getSetting(key) {
        return await this.get(key);
    }

    async deleteSetting(key) {
        return await this.delete(key);
    }

    async listSettings(options) {
        return await this.list(options);
    }

    async putIndexOperation(operationId, operation) {
        const key = 'manage@index@operation_' + operationId;
        return await this.put(key, JSON.stringify(operation));
    }

    async getIndexOperation(operationId) {
        const key = 'manage@index@operation_' + operationId;
        const result = await this.get(key);
        return result ? JSON.parse(result) : null;
    }

    async deleteIndexOperation(operationId) {
        const key = 'manage@index@operation_' + operationId;
        return await this.delete(key);
    }

    async listIndexOperations(options) {
        const listOptions = Object.assign({}, options, {
            prefix: 'manage@index@operation_'
        });
        const result = await this.list(listOptions);
        
        // 转换格式以匹配D1Database的返回格式
        const operations = [];
        for (const item of result.keys) {
            const operationData = await this.get(item.name);
            if (operationData) {
                const operation = JSON.parse(operationData);
                operations.push({
                    id: item.name.replace('manage@index@operation_', ''),
                    type: operation.type,
                    timestamp: operation.timestamp,
                    data: operation.data,
                    processed: false // KV中没有这个字段，默认为false
                });
            }
        }
        
        return operations;
    }
}

/**
 * 获取数据库实例的便捷函数
 * 这个函数可以在整个应用中使用，确保一致的数据库访问
 * @param {Object} env - 环境变量
 * @returns {Object} 数据库实例
 */
export function getDatabase(env) {
    var adapter = createDatabaseAdapter(env);
    if (!adapter) {
        throw new Error('Database not configured. Please configure D1 database (env.img_d1) or KV storage (env.img_url).');
    }
    return adapter;
}

/**
 * 检查数据库配置
 * @param {Object} env - 环境变量
 * @returns {Object} 配置信息
 */
export function checkDatabaseConfig(env) {
    var hasD1 = env.img_d1 && typeof env.img_d1.prepare === 'function';
    var hasKV = env.img_url && typeof env.img_url.get === 'function';

    return {
        hasD1: hasD1,
        hasKV: hasKV,
        usingD1: hasD1,
        usingKV: !hasD1 && hasKV,
        configured: hasD1 || hasKV
    };
}
