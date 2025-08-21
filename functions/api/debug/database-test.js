/**
 * 数据库功能测试工具
 */

import { getDatabase } from '../../utils/databaseAdapter.js';

export async function onRequest(context) {
    var env = context.env;
    
    try {
        var results = {
            databaseType: null,
            listTest: null,
            getTest: null,
            putTest: null,
            errors: []
        };
        
        // 测试数据库连接
        try {
            var db = getDatabase(env);
            results.databaseType = db.constructor.name || 'Unknown';
        } catch (error) {
            results.errors.push('Database connection failed: ' + error.message);
            return new Response(JSON.stringify(results, null, 2), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // 测试list方法
        try {
            var listResult = await db.list({ limit: 5 });
            results.listTest = {
                success: true,
                hasKeys: !!(listResult && listResult.keys),
                isArray: Array.isArray(listResult.keys),
                keyCount: listResult.keys ? listResult.keys.length : 0,
                structure: listResult ? Object.keys(listResult) : []
            };
        } catch (error) {
            results.listTest = {
                success: false,
                error: error.message
            };
            results.errors.push('List test failed: ' + error.message);
        }
        
        // 测试get方法
        try {
            var getResult = await db.get('test_key_that_does_not_exist');
            results.getTest = {
                success: true,
                result: getResult,
                isNull: getResult === null
            };
        } catch (error) {
            results.getTest = {
                success: false,
                error: error.message
            };
            results.errors.push('Get test failed: ' + error.message);
        }
        
        // 测试put方法（使用临时键）
        try {
            var testKey = 'test_' + Date.now();
            var testValue = 'test_value_' + Date.now();
            await db.put(testKey, testValue);
            
            // 立即读取验证
            var retrievedValue = await db.get(testKey);
            
            // 清理测试数据
            await db.delete(testKey);
            
            results.putTest = {
                success: true,
                valueMatch: retrievedValue === testValue,
                testKey: testKey,
                testValue: testValue,
                retrievedValue: retrievedValue
            };
        } catch (error) {
            results.putTest = {
                success: false,
                error: error.message
            };
            results.errors.push('Put test failed: ' + error.message);
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
