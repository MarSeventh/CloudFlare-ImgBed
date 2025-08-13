/**
 * 恢复功能测试工具
 */

import { getDatabase } from '../../utils/databaseAdapter.js';

export async function onRequest(context) {
    var env = context.env;
    var request = context.request;
    
    try {
        if (request.method !== 'POST') {
            return new Response('Method not allowed', { status: 405 });
        }
        
        var testData = await request.json();
        var db = getDatabase(env);
        
        var results = {
            settings: [],
            files: [],
            errors: []
        };
        
        // 测试恢复设置
        if (testData.settings) {
            for (var key in testData.settings) {
                try {
                    var value = testData.settings[key];
                    await db.put(key, value);
                    
                    // 验证是否成功保存
                    var retrieved = await db.get(key);
                    results.settings.push({
                        key: key,
                        saved: true,
                        retrieved: retrieved !== null,
                        valueMatch: retrieved === value,
                        originalLength: value.length,
                        retrievedLength: retrieved ? retrieved.length : 0
                    });
                } catch (error) {
                    results.errors.push({
                        type: 'setting',
                        key: key,
                        error: error.message
                    });
                }
            }
        }
        
        // 测试恢复文件
        if (testData.files) {
            for (var fileId in testData.files) {
                try {
                    var fileData = testData.files[fileId];
                    
                    if (fileData.value) {
                        await db.put(fileId, fileData.value, {
                            metadata: fileData.metadata
                        });
                    } else if (fileData.metadata) {
                        await db.put(fileId, '', {
                            metadata: fileData.metadata
                        });
                    }
                    
                    // 验证是否成功保存
                    var retrieved = await db.getWithMetadata(fileId);
                    results.files.push({
                        fileId: fileId,
                        saved: true,
                        retrieved: retrieved !== null,
                        hasMetadata: retrieved && retrieved.metadata !== null
                    });
                } catch (error) {
                    results.errors.push({
                        type: 'file',
                        fileId: fileId,
                        error: error.message
                    });
                }
            }
        }
        
        return new Response(JSON.stringify(results, null, 2), {
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
    } catch (error) {
        return new Response(JSON.stringify({
            error: error.message,
            stack: error.stack
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
}
