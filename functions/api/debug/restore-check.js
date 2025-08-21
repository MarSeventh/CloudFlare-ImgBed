/**
 * 恢复功能检查工具
 */

import { getDatabase } from '../../utils/databaseAdapter.js';

export async function onRequest(context) {
    var env = context.env;
    var url = new URL(context.request.url);
    var action = url.searchParams.get('action') || 'status';
    
    try {
        var db = getDatabase(env);
        var results = {
            action: action,
            timestamp: new Date().toISOString()
        };
        
        if (action === 'status') {
            // 检查当前数据库状态
            
            // 统计文件数量
            var fileCount = 0;
            var cursor = null;
            while (true) {
                var response = await db.listFiles({
                    limit: 1000,
                    cursor: cursor
                });
                
                if (!response || !response.keys || !Array.isArray(response.keys)) {
                    break;
                }
                
                for (var item of response.keys) {
                    if (!item.name.startsWith('manage@') && !item.name.startsWith('chunk_')) {
                        if (item.metadata && item.metadata.TimeStamp) {
                            fileCount++;
                        }
                    }
                }
                
                cursor = response.cursor;
                if (!cursor) break;
            }
            
            // 统计设置数量
            var settingsResponse = await db.listSettings({});
            var settingsCount = 0;
            if (settingsResponse && settingsResponse.keys) {
                settingsCount = settingsResponse.keys.length;
            }
            
            // 检查关键设置
            var keySettings = {};
            var settingKeys = ['manage@sysConfig@page', 'manage@sysConfig@security'];
            for (var key of settingKeys) {
                try {
                    var value = await db.get(key);
                    keySettings[key] = {
                        exists: !!value,
                        length: value ? value.length : 0
                    };
                } catch (error) {
                    keySettings[key] = {
                        exists: false,
                        error: error.message
                    };
                }
            }
            
            results.status = {
                fileCount: fileCount,
                settingsCount: settingsCount,
                keySettings: keySettings
            };
            
        } else if (action === 'test') {
            // 测试恢复一个简单的设置
            var testKey = 'test_restore_' + Date.now();
            var testValue = 'test_value_' + Date.now();
            
            try {
                // 写入测试数据
                await db.put(testKey, testValue);
                
                // 读取验证
                var retrieved = await db.get(testKey);
                
                // 清理测试数据
                await db.delete(testKey);
                
                results.test = {
                    success: true,
                    valueMatch: retrieved === testValue,
                    testKey: testKey,
                    testValue: testValue,
                    retrievedValue: retrieved
                };
            } catch (error) {
                results.test = {
                    success: false,
                    error: error.message
                };
            }
            
        } else if (action === 'sample') {
            // 提供样本恢复数据
            // 创建样本数据
            var testFileKey = "test_file_" + Date.now();
            var testSettingKey = "test_setting_" + Date.now();
            var testSettingValue = "test_value_" + Date.now();

            results.sampleData = {
                timestamp: Date.now(),
                version: "2.0.2",
                data: {
                    fileCount: 1,
                    files: {},
                    settings: {}
                }
            };

            // 动态添加文件和设置
            results.sampleData.data.files[testFileKey] = {
                metadata: {
                    FileName: "test.jpg",
                    FileType: "image/jpeg",
                    FileSize: "0.1",
                    TimeStamp: Date.now(),
                    Channel: "Test",
                    ListType: "None"
                },
                value: null
            };

            results.sampleData.data.settings[testSettingKey] = testSettingValue;
            
            results.instructions = {
                usage: "Use this sample data to test restore functionality",
                endpoint: "/api/manage/sysConfig/backup",
                method: "POST with action=restore"
            };
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
