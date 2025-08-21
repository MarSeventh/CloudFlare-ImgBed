/**
 * 设置检查工具
 */

import { getDatabase } from '../../utils/databaseAdapter.js';

export async function onRequest(context) {
    var env = context.env;
    
    try {
        var db = getDatabase(env);
        
        var results = {
            allSettings: [],
            expectedSettings: [
                'manage@sysConfig@page',
                'manage@sysConfig@security', 
                'manage@sysConfig@upload',
                'manage@sysConfig@others'
            ],
            missingSettings: [],
            existingSettings: {}
        };
        
        // 列出所有设置
        var allSettings = await db.listSettings({});
        results.allSettings = allSettings.keys.map(function(item) {
            return {
                key: item.name,
                hasValue: !!item.value,
                valueLength: item.value ? item.value.length : 0
            };
        });
        
        // 检查每个预期的设置
        for (var i = 0; i < results.expectedSettings.length; i++) {
            var settingKey = results.expectedSettings[i];
            try {
                var value = await db.get(settingKey);
                if (value) {
                    results.existingSettings[settingKey] = {
                        exists: true,
                        length: value.length,
                        preview: value.substring(0, 200) + (value.length > 200 ? '...' : '')
                    };
                } else {
                    results.missingSettings.push(settingKey);
                    results.existingSettings[settingKey] = {
                        exists: false
                    };
                }
            } catch (error) {
                results.existingSettings[settingKey] = {
                    exists: false,
                    error: error.message
                };
            }
        }
        
        // 检查是否有其他manage@开头的设置
        var manageSettings = await db.listSettings({ prefix: 'manage@' });
        results.manageSettings = manageSettings.keys.map(function(item) {
            return {
                key: item.name,
                hasValue: !!item.value,
                valueLength: item.value ? item.value.length : 0
            };
        });
        
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
