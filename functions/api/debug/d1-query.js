/**
 * D1数据库查询测试工具
 */

import { getDatabase } from '../../utils/databaseAdapter.js';

export async function onRequest(context) {
    var env = context.env;
    var url = new URL(context.request.url);
    var query = url.searchParams.get('query') || 'files';
    
    try {
        var db = getDatabase(env);
        var results = {
            databaseType: db.constructor.name,
            query: query,
            results: null,
            error: null
        };
        
        if (query === 'files') {
            // 直接查询files表
            try {
                var stmt = db.db.prepare('SELECT COUNT(*) as count FROM files');
                var countResult = await stmt.first();
                results.totalFiles = countResult.count;
                
                // 查询前5条记录
                var stmt2 = db.db.prepare('SELECT id, metadata, created_at FROM files ORDER BY created_at DESC LIMIT 5');
                var fileResults = await stmt2.all();

                // 检查结果格式
                console.log('fileResults type:', typeof fileResults);
                console.log('fileResults:', fileResults);

                if (Array.isArray(fileResults)) {
                    results.sampleFiles = fileResults.map(function(row) {
                        return {
                            id: row.id,
                            metadata: JSON.parse(row.metadata || '{}'),
                            created_at: row.created_at
                        };
                    });
                } else {
                    results.sampleFiles = [];
                    results.fileResultsType = typeof fileResults;
                    results.fileResultsValue = fileResults;
                }
            } catch (error) {
                results.error = 'Direct query failed: ' + error.message;
            }
        } else if (query === 'list') {
            // 测试listFiles方法
            try {
                var listResult = await db.listFiles({ limit: 5 });
                results.listResult = listResult;
            } catch (error) {
                results.error = 'listFiles failed: ' + error.message;
            }
        } else if (query === 'listall') {
            // 测试通用list方法
            try {
                var listAllResult = await db.list({ limit: 5 });
                results.listAllResult = listAllResult;
            } catch (error) {
                results.error = 'list failed: ' + error.message;
            }
        } else if (query === 'prefix') {
            // 测试带前缀的查询
            var prefix = url.searchParams.get('prefix') || 'cosplay/';
            try {
                var prefixResult = await db.list({ prefix: prefix, limit: 10 });
                results.prefixResult = prefixResult;
                results.prefix = prefix;
            } catch (error) {
                results.error = 'prefix query failed: ' + error.message;
            }
        } else if (query === 'settings') {
            // 查询设置表
            try {
                var stmt = db.db.prepare('SELECT COUNT(*) as count FROM settings');
                var countResult = await stmt.first();
                results.totalSettings = countResult.count;
                
                var stmt2 = db.db.prepare('SELECT key, value FROM settings LIMIT 5');
                var settingResults = await stmt2.all();
                results.sampleSettings = settingResults;
            } catch (error) {
                results.error = 'Settings query failed: ' + error.message;
            }
        } else {
            results.error = 'Unknown query type. Use: files, list, listall, prefix, settings';
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
