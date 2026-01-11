/**
 * 数据库适配器
 * 提供统一的接口，可以在KV、D1和KVROCKS之间切换
 */

import { D1Database } from './d1Database.js';
import { createRedis } from '@bitphinix/redis-on-workers';

/**
 * 创建数据库适配器
 * @param {Object} env - 环境变量
 * @returns {Object} 数据库适配器实例
 */
export function createDatabaseAdapter(env) {
    // 检查是否配置了数据库
    if (env.img_kvrocks && typeof env.img_kvrocks === 'string') {
        // 使用KVROCKS存储
        return new KVROCKSAdapter(env.img_kvrocks);
    } else if (env.img_d1 && typeof env.img_d1.prepare === 'function') {
        // 使用D1数据库
        return new D1Database(env.img_d1);
    } else if (env.img_url && typeof env.img_url.get === 'function') {
        // 使用KV存储
        return new KVAdapter(env.img_url);
    } else {
        console.error('No database configured. Please configure either KV (env.img_url), D1 (env.img_d1) or KVROCKS (env.img_kvrocks).');
        return null;
    }
}

/**
 * KVROCKS适配器类
 * 连接外部KVROCKS存储
 */
class KVROCKSAdapter {
    constructor(connectionString) {
        this.connectionString = connectionString;
        this.redis = null;
        this.connected = false;
    }

    /**
     * 建立连接
     */
    async connect() {
        if (!this.connected) {
            try {
                this.redis = createRedis(this.connectionString);
                // 测试连接
                await this.redis.send('PING');
                this.connected = true;
                console.log('Connected to KVROCKS successfully');
            } catch (error) {
                console.error('Failed to connect to KVROCKS:', error);
                throw error;
            }
        }
        return this.redis;
    }

    /**
     * 关闭连接
     */
    async disconnect() {
        if (this.connected && this.redis) {
            try {
                await this.redis.close();
                this.connected = false;
                console.log('Disconnected from KVROCKS');
            } catch (error) {
                console.error('Error disconnecting from KVROCKS:', error);
            }
        }
    }

    /**
     * 保存键值对
     */
    async put(key, value, options) {
        options = options || {};
        const redis = await this.connect();
        
        try {
            // 处理元数据
            if (options.metadata) {
                const metadataKey = `${key}:metadata`;
                await redis.send('SET', metadataKey, JSON.stringify(options.metadata));
            }
            
            // 保存主值
            await redis.send('SET', key, value);
            
            // 处理过期时间
            if (options.expiration || options.expirationTtl) {
                const ttl = options.expirationTtl || Math.max(0, Math.floor((options.expiration - Date.now()) / 1000));
                if (ttl > 0) {
                    await redis.send('EXPIRE', key, ttl);
                    if (options.metadata) {
                        const metadataKey = `${key}:metadata`;
                        await redis.send('EXPIRE', metadataKey, ttl);
                    }
                }
            }
            
            return { success: true };
        } catch (error) {
            console.error('KVROCKS put error:', error);
            throw error;
        }
    }

    /**
     * 获取值
     */
    async get(key, options) {
        const redis = await this.connect();
        try {
            const value = await redis.send('GET', key);
            return value === null ? null : value;
        } catch (error) {
            console.error('KVROCKS get error:', error);
            throw error;
        }
    }

    /**
     * 获取值和元数据
     */
    async getWithMetadata(key, options) {
        const redis = await this.connect();
        try {
            const [value, metadataJson] = await Promise.all([
                redis.send('GET', key),
                redis.send('GET', `${key}:metadata`)
            ]);
            
            if (value === null) {
                return null;
            }
            
            return {
                value: value,
                metadata: metadataJson ? JSON.parse(metadataJson) : {}
            };
        } catch (error) {
            console.error('KVROCKS getWithMetadata error:', error);
            throw error;
        }
    }

    /**
     * 删除键
     */
    async delete(key, options) {
        const redis = await this.connect();
        try {
            await Promise.all([
                redis.send('DEL', key),
                redis.send('DEL', `${key}:metadata`)
            ]);
            return { success: true };
        } catch (error) {
            console.error('KVROCKS delete error:', error);
            throw error;
        }
    }

    /**
     * 列出键
     */
    async list(options) {
        options = options || {};
        const prefix = options.prefix || '';
        const limit = options.limit || 1000;
        const cursor = options.cursor || '0';
        
        const redis = await this.connect();
        try {
            const pattern = prefix ? `${prefix}*` : '*';
            const [newCursor, keys] = await redis.send('SCAN', cursor, 'MATCH', pattern, 'COUNT', limit);
            
            // 过滤掉元数据键
            const dataKeys = keys.filter(key => !key.endsWith(':metadata'));
            
            // 获取元数据
            const keysWithMetadata = await Promise.all(dataKeys.map(async key => {
                const metadataJson = await redis.send('GET', `${key}:metadata`);
                return {
                    name: key,
                    metadata: metadataJson ? JSON.parse(metadataJson) : {}
                };
            }));
            
            return {
                keys: keysWithMetadata,
                cursor: newCursor !== '0' ? newCursor : null,
                list_complete: newCursor === '0'
            };
        } catch (error) {
            console.error('KVROCKS list error:', error);
            throw error;
        }
    }

    // 为了兼容性，添加一些别名方法
    async putFile(fileId, value, options) {
        return await this.put(fileId, value, options);
    }

    async getFile(fileId, options) {
        const result = await this.getWithMetadata(fileId, options);
        return result;
    }

    async getFileWithMetadata(fileId, options) {
        return await this.getWithMetadata(fileId, options);
    }

    async deleteFile(fileId, options) {
        return await this.delete(fileId, options);
    }

    async listFiles(options) {
        return await this.list(options);
    }

    async putSetting(key, value, options) {
        return await this.put(key, value, options);
    }

    async getSetting(key, options) {
        return await this.get(key, options);
    }

    async deleteSetting(key, options) {
        return await this.delete(key, options);
    }

    async listSettings(options) {
        return await this.list(options);
    }

    async putIndexOperation(operationId, operation, options) {
        const key = 'manage@index@operation_' + operationId;
        return await this.put(key, JSON.stringify(operation), options);
    }

    async getIndexOperation(operationId, options) {
        const key = 'manage@index@operation_' + operationId;
        const result = await this.get(key, options);
        return result ? JSON.parse(result) : null;
    }

    async deleteIndexOperation(operationId, options) {
        const key = 'manage@index@operation_' + operationId;
        return await this.delete(key, options);
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
                    processed: false // KVROCKS中没有这个字段，默认为false
                });
            }
        }
        
        return operations;
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

    async get(key, options) {
        options = options || {};
        return await this.kv.get(key, options);
    }

    async getWithMetadata(key, options) {
        options = options || {};
        return await this.kv.getWithMetadata(key, options);
    }

    async delete(key, options) {
        options = options || {};
        return await this.kv.delete(key, options);
    }

    async list(options) {
        options = options || {};
        return await this.kv.list(options);
    }

    // 为了兼容性，添加一些别名方法
    async putFile(fileId, value, options) {
        return await this.put(fileId, value, options);
    }

    async getFile(fileId, options) {
        const result = await this.getWithMetadata(fileId, options);
        return result;
    }

    async getFileWithMetadata(fileId, options) {
        return await this.getWithMetadata(fileId, options);
    }

    async deleteFile(fileId, options) {
        return await this.delete(fileId, options);
    }

    async listFiles(options) {
        return await this.list(options);
    }

    async putSetting(key, value, options) {
        return await this.put(key, value, options);
    }

    async getSetting(key, options) {
        return await this.get(key, options);
    }

    async deleteSetting(key, options) {
        return await this.delete(key, options);
    }

    async listSettings(options) {
        return await this.list(options);
    }

    async putIndexOperation(operationId, operation, options) {
        const key = 'manage@index@operation_' + operationId;
        return await this.put(key, JSON.stringify(operation), options);
    }

    async getIndexOperation(operationId, options) {
        const key = 'manage@index@operation_' + operationId;
        const result = await this.get(key, options);
        return result ? JSON.parse(result) : null;
    }

    async deleteIndexOperation(operationId, options) {
        const key = 'manage@index@operation_' + operationId;
        return await this.delete(key, options);
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
        throw new Error('Database not configured. Please configure D1 database (env.img_d1), KV storage (env.img_url) or KVROCKS (env.img_kvrocks).');
    }
    return adapter;
}

/**
 * 检查数据库配置
 * @param {Object} env - 环境变量
 * @returns {Object} 配置信息
 */
export function checkDatabaseConfig(env) {
    var hasKVROCKS = env.img_kvrocks && typeof env.img_kvrocks === 'string';
    var hasD1 = env.img_d1 && typeof env.img_d1.prepare === 'function';
    var hasKV = env.img_url && typeof env.img_url.get === 'function';

    return {
        hasKVROCKS: hasKVROCKS,
        hasD1: hasD1,
        hasKV: hasKV,
        usingKVROCKS: hasKVROCKS,
        usingD1: !hasKVROCKS && hasD1,
        usingKV: !hasKVROCKS && !hasD1 && hasKV,
        configured: hasKVROCKS || hasD1 || hasKV
    };
}
