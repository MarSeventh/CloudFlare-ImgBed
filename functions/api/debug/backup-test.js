/**
 * 备份功能测试工具
 */

import { getDatabase } from '../../utils/databaseAdapter.js';

export async function onRequest(context) {
    var env = context.env;
    
    try {
        var db = getDatabase(env);
        
        var results = {
            databaseType: db.constructor.name || 'Unknown',
            settings: {
                all: [],
                manage: [],
                sysConfig: []
            },
            files: {
                count: 0,
                sample: []
            }
        };
        
        // 测试列出所有设置
        try {
            var allSettings = await db.listSettings({});
            results.settings.all = allSettings.keys.map(function(item) {
                return {
                    key: item.name,
                    hasValue: !!item.value,
                    valueLength: item.value ? item.value.length : 0
                };
            });
        } catch (error) {
            results.settings.allError = error.message;
        }
        
        // 测试列出manage@开头的设置
        try {
            var manageSettings = await db.listSettings({ prefix: 'manage@' });
            results.settings.manage = manageSettings.keys.map(function(item) {
                return {
                    key: item.name,
                    hasValue: !!item.value,
                    valueLength: item.value ? item.value.length : 0
                };
            });
        } catch (error) {
            results.settings.manageError = error.message;
        }
        
        // 测试列出sysConfig设置
        try {
            var sysConfigSettings = await db.listSettings({ prefix: 'manage@sysConfig@' });
            results.settings.sysConfig = sysConfigSettings.keys.map(function(item) {
                return {
                    key: item.name,
                    hasValue: !!item.value,
                    valueLength: item.value ? item.value.length : 0,
                    valuePreview: item.value ? item.value.substring(0, 100) + '...' : null
                };
            });
        } catch (error) {
            results.settings.sysConfigError = error.message;
        }
        
        // 测试列出文件
        try {
            var filesList = await db.listFiles({ limit: 5 });
            results.files.count = filesList.keys.length;
            results.files.sample = filesList.keys.map(function(item) {
                return {
                    id: item.name,
                    hasMetadata: !!item.metadata
                };
            });
        } catch (error) {
            results.files.error = error.message;
        }
        
        // 测试特定设置的读取
        try {
            var pageConfig = await db.get('manage@sysConfig@page');
            results.specificTests = {
                pageConfig: {
                    exists: !!pageConfig,
                    length: pageConfig ? pageConfig.length : 0,
                    preview: pageConfig ? pageConfig.substring(0, 200) + '...' : null
                }
            };
        } catch (error) {
            results.specificTests = { error: error.message };
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
