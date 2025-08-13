/**
 * D1 数据库操作工具类
 * 用于替代原有的KV存储操作
 */

export class D1Database {
    constructor(db) {
        this.db = db;
    }

    // ==================== 文件操作 ====================

    /**
     * 保存文件记录 (替代 KV.put)
     * @param {string} fileId - 文件ID
     * @param {string} value - 文件值 (对于分块文件)
     * @param {Object} options - 选项，包含metadata
     */
    async putFile(fileId, value = '', options = {}) {
        const metadata = options.metadata || {};
        
        // 从metadata中提取字段用于索引
        const extractedFields = this.extractMetadataFields(metadata);
        
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO files (
                id, value, metadata, file_name, file_type, file_size, 
                upload_ip, upload_address, list_type, timestamp, 
                label, directory, channel, channel_name, 
                tg_file_id, tg_chat_id, tg_bot_token, is_chunked
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        return await stmt.bind(
            fileId,
            value,
            JSON.stringify(metadata),
            extractedFields.fileName,
            extractedFields.fileType,
            extractedFields.fileSize,
            extractedFields.uploadIP,
            extractedFields.uploadAddress,
            extractedFields.listType,
            extractedFields.timestamp,
            extractedFields.label,
            extractedFields.directory,
            extractedFields.channel,
            extractedFields.channelName,
            extractedFields.tgFileId,
            extractedFields.tgChatId,
            extractedFields.tgBotToken,
            extractedFields.isChunked
        ).run();
    }

    /**
     * 获取文件记录 (替代 KV.get)
     * @param {string} fileId - 文件ID
     * @returns {Object|null} 文件记录
     */
    async getFile(fileId) {
        const stmt = this.db.prepare('SELECT * FROM files WHERE id = ?');
        const result = await stmt.bind(fileId).first();
        
        if (!result) return null;
        
        return {
            value: result.value,
            metadata: JSON.parse(result.metadata || '{}')
        };
    }

    /**
     * 获取文件记录包含元数据 (替代 KV.getWithMetadata)
     * @param {string} fileId - 文件ID
     * @returns {Object|null} 文件记录
     */
    async getFileWithMetadata(fileId) {
        return await this.getFile(fileId);
    }

    /**
     * 删除文件记录 (替代 KV.delete)
     * @param {string} fileId - 文件ID
     */
    async deleteFile(fileId) {
        const stmt = this.db.prepare('DELETE FROM files WHERE id = ?');
        return await stmt.bind(fileId).run();
    }

    /**
     * 列出文件 (替代 KV.list)
     * @param {Object} options - 选项
     */
    async listFiles(options = {}) {
        const { prefix = '', limit = 1000, cursor = null } = options;
        
        let query = 'SELECT id, metadata FROM files';
        let params = [];
        
        if (prefix) {
            query += ' WHERE id LIKE ?';
            params.push(prefix + '%');
        }
        
        if (cursor) {
            query += prefix ? ' AND' : ' WHERE';
            query += ' id > ?';
            params.push(cursor);
        }
        
        query += ' ORDER BY id LIMIT ?';
        params.push(limit + 1); // 多取一个用于判断是否有下一页
        
        const stmt = this.db.prepare(query);
        const results = await stmt.bind(...params).all();
        
        const hasMore = results.length > limit;
        if (hasMore) {
            results.pop(); // 移除多取的那一个
        }
        
        const keys = results.map(row => ({
            name: row.id,
            metadata: JSON.parse(row.metadata || '{}')
        }));
        
        return {
            keys,
            cursor: hasMore ? keys[keys.length - 1]?.name : null,
            list_complete: !hasMore
        };
    }

    // ==================== 设置操作 ====================

    /**
     * 保存设置 (替代 KV.put)
     * @param {string} key - 设置键
     * @param {string} value - 设置值
     * @param {string} category - 设置分类
     */
    async putSetting(key, value, category = null) {
        // 从key中推断category
        if (!category && key.startsWith('manage@sysConfig@')) {
            category = key.split('@')[2];
        }
        
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO settings (key, value, category) 
            VALUES (?, ?, ?)
        `);
        
        return await stmt.bind(key, value, category).run();
    }

    /**
     * 获取设置 (替代 KV.get)
     * @param {string} key - 设置键
     * @returns {string|null} 设置值
     */
    async getSetting(key) {
        const stmt = this.db.prepare('SELECT value FROM settings WHERE key = ?');
        const result = await stmt.bind(key).first();
        return result ? result.value : null;
    }

    /**
     * 删除设置 (替代 KV.delete)
     * @param {string} key - 设置键
     */
    async deleteSetting(key) {
        const stmt = this.db.prepare('DELETE FROM settings WHERE key = ?');
        return await stmt.bind(key).run();
    }

    /**
     * 列出设置 (替代 KV.list)
     * @param {Object} options - 选项
     */
    async listSettings(options = {}) {
        const { prefix = '', limit = 1000 } = options;
        
        let query = 'SELECT key, value FROM settings';
        let params = [];
        
        if (prefix) {
            query += ' WHERE key LIKE ?';
            params.push(prefix + '%');
        }
        
        query += ' ORDER BY key LIMIT ?';
        params.push(limit);
        
        const stmt = this.db.prepare(query);
        const results = await stmt.bind(...params).all();
        
        const keys = results.map(row => ({
            name: row.key,
            value: row.value
        }));
        
        return { keys };
    }

    // ==================== 索引操作 ====================

    /**
     * 保存索引操作记录
     * @param {string} operationId - 操作ID
     * @param {Object} operation - 操作数据
     */
    async putIndexOperation(operationId, operation) {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO index_operations (id, type, timestamp, data) 
            VALUES (?, ?, ?, ?)
        `);
        
        return await stmt.bind(
            operationId,
            operation.type,
            operation.timestamp,
            JSON.stringify(operation.data)
        ).run();
    }

    /**
     * 获取索引操作记录
     * @param {string} operationId - 操作ID
     */
    async getIndexOperation(operationId) {
        const stmt = this.db.prepare('SELECT * FROM index_operations WHERE id = ?');
        const result = await stmt.bind(operationId).first();
        
        if (!result) return null;
        
        return {
            type: result.type,
            timestamp: result.timestamp,
            data: JSON.parse(result.data)
        };
    }

    /**
     * 删除索引操作记录
     * @param {string} operationId - 操作ID
     */
    async deleteIndexOperation(operationId) {
        const stmt = this.db.prepare('DELETE FROM index_operations WHERE id = ?');
        return await stmt.bind(operationId).run();
    }

    /**
     * 列出索引操作记录
     * @param {Object} options - 选项
     */
    async listIndexOperations(options = {}) {
        const { limit = 1000, processed = null } = options;
        
        let query = 'SELECT * FROM index_operations';
        let params = [];
        
        if (processed !== null) {
            query += ' WHERE processed = ?';
            params.push(processed);
        }
        
        query += ' ORDER BY timestamp LIMIT ?';
        params.push(limit);
        
        const stmt = this.db.prepare(query);
        const results = await stmt.bind(...params).all();
        
        return results.map(row => ({
            id: row.id,
            type: row.type,
            timestamp: row.timestamp,
            data: JSON.parse(row.data),
            processed: row.processed
        }));
    }

    // ==================== 工具方法 ====================

    /**
     * 从metadata中提取字段用于索引
     * @param {Object} metadata - 元数据
     * @returns {Object} 提取的字段
     */
    extractMetadataFields(metadata) {
        return {
            fileName: metadata.FileName || null,
            fileType: metadata.FileType || null,
            fileSize: metadata.FileSize || null,
            uploadIP: metadata.UploadIP || null,
            uploadAddress: metadata.UploadAddress || null,
            listType: metadata.ListType || null,
            timestamp: metadata.TimeStamp || null,
            label: metadata.Label || null,
            directory: metadata.Directory || null,
            channel: metadata.Channel || null,
            channelName: metadata.ChannelName || null,
            tgFileId: metadata.TgFileId || null,
            tgChatId: metadata.TgChatId || null,
            tgBotToken: metadata.TgBotToken || null,
            isChunked: metadata.IsChunked || false
        };
    }

    /**
     * 通用的put方法，根据key类型自动选择存储位置
     * @param {string} key - 键
     * @param {string} value - 值
     * @param {Object} options - 选项
     */
    async put(key, value, options = {}) {
        if (key.startsWith('manage@sysConfig@') || key.startsWith('manage@')) {
            // 系统配置
            return await this.putSetting(key, value);
        } else if (key.startsWith('manage@index@operation_')) {
            // 索引操作
            const operationId = key.replace('manage@index@operation_', '');
            const operation = JSON.parse(value);
            return await this.putIndexOperation(operationId, operation);
        } else {
            // 文件记录
            return await this.putFile(key, value, options);
        }
    }

    /**
     * 通用的get方法，根据key类型自动选择获取位置
     * @param {string} key - 键
     */
    async get(key) {
        if (key.startsWith('manage@sysConfig@') || key.startsWith('manage@')) {
            // 系统配置
            return await this.getSetting(key);
        } else if (key.startsWith('manage@index@operation_')) {
            // 索引操作
            const operationId = key.replace('manage@index@operation_', '');
            const operation = await this.getIndexOperation(operationId);
            return operation ? JSON.stringify(operation) : null;
        } else {
            // 文件记录
            const file = await this.getFile(key);
            return file ? file.value : null;
        }
    }

    /**
     * 通用的getWithMetadata方法
     * @param {string} key - 键
     */
    async getWithMetadata(key) {
        if (key.startsWith('manage@sysConfig@') || key.startsWith('manage@')) {
            // 系统配置没有metadata概念
            const value = await this.getSetting(key);
            return value ? { value, metadata: {} } : null;
        } else {
            // 文件记录
            return await this.getFileWithMetadata(key);
        }
    }

    /**
     * 通用的delete方法
     * @param {string} key - 键
     */
    async delete(key) {
        if (key.startsWith('manage@sysConfig@') || key.startsWith('manage@')) {
            // 系统配置
            return await this.deleteSetting(key);
        } else if (key.startsWith('manage@index@operation_')) {
            // 索引操作
            const operationId = key.replace('manage@index@operation_', '');
            return await this.deleteIndexOperation(operationId);
        } else {
            // 文件记录
            return await this.deleteFile(key);
        }
    }

    /**
     * 通用的list方法
     * @param {Object} options - 选项
     */
    async list(options = {}) {
        const { prefix = '' } = options;

        if (prefix.startsWith('manage@sysConfig@') || prefix.startsWith('manage@')) {
            // 系统配置
            return await this.listSettings(options);
        } else if (prefix.startsWith('manage@index@operation_')) {
            // 索引操作 - 需要特殊处理
            const operations = await this.listIndexOperations(options);
            const keys = operations.map(op => ({
                name: 'manage@index@operation_' + op.id
            }));
            return { keys };
        } else {
            // 文件记录
            return await this.listFiles(options);
        }
    }
}

    /**
     * 通用的put方法，根据key类型自动选择存储位置
     * @param {string} key - 键
     * @param {string} value - 值
     * @param {Object} options - 选项
     */
    async put(key, value, options = {}) {
        if (key.startsWith('manage@sysConfig@') || key.startsWith('manage@')) {
            // 系统配置
            return await this.putSetting(key, value);
        } else if (key.startsWith('manage@index@operation_')) {
            // 索引操作
            const operationId = key.replace('manage@index@operation_', '');
            const operation = JSON.parse(value);
            return await this.putIndexOperation(operationId, operation);
        } else {
            // 文件记录
            return await this.putFile(key, value, options);
        }
    }

    /**
     * 通用的get方法，根据key类型自动选择获取位置
     * @param {string} key - 键
     */
    async get(key) {
        if (key.startsWith('manage@sysConfig@') || key.startsWith('manage@')) {
            // 系统配置
            return await this.getSetting(key);
        } else if (key.startsWith('manage@index@operation_')) {
            // 索引操作
            const operationId = key.replace('manage@index@operation_', '');
            const operation = await this.getIndexOperation(operationId);
            return operation ? JSON.stringify(operation) : null;
        } else {
            // 文件记录
            const file = await this.getFile(key);
            return file ? file.value : null;
        }
    }

    /**
     * 通用的getWithMetadata方法
     * @param {string} key - 键
     */
    async getWithMetadata(key) {
        if (key.startsWith('manage@sysConfig@') || key.startsWith('manage@')) {
            // 系统配置没有metadata概念
            const value = await this.getSetting(key);
            return value ? { value, metadata: {} } : null;
        } else {
            // 文件记录
            return await this.getFileWithMetadata(key);
        }
    }

    /**
     * 通用的delete方法
     * @param {string} key - 键
     */
    async delete(key) {
        if (key.startsWith('manage@sysConfig@') || key.startsWith('manage@')) {
            // 系统配置
            return await this.deleteSetting(key);
        } else if (key.startsWith('manage@index@operation_')) {
            // 索引操作
            const operationId = key.replace('manage@index@operation_', '');
            return await this.deleteIndexOperation(operationId);
        } else {
            // 文件记录
            return await this.deleteFile(key);
        }
    }

    /**
     * 通用的list方法
     * @param {Object} options - 选项
     */
    async list(options = {}) {
        const { prefix = '' } = options;
        
        if (prefix.startsWith('manage@sysConfig@') || prefix.startsWith('manage@')) {
            // 系统配置
            return await this.listSettings(options);
        } else if (prefix.startsWith('manage@index@operation_')) {
            // 索引操作 - 需要特殊处理
            const operations = await this.listIndexOperations(options);
            const keys = operations.map(op => ({
                name: 'manage@index@operation_' + op.id
            }));
            return { keys };
        } else {
            // 文件记录
            return await this.listFiles(options);
        }
    }
}
