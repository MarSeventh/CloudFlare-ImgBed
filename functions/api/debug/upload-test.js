/**
 * 上传功能测试工具
 */

import { getDatabase } from '../../utils/databaseAdapter.js';
import { fetchUploadConfig, fetchSecurityConfig } from '../../utils/sysConfig.js';

export async function onRequest(context) {
    var env = context.env;
    
    try {
        var results = {
            databaseCheck: null,
            configCheck: null,
            uploadConfigCheck: null,
            securityConfigCheck: null
        };
        
        // 检查数据库
        try {
            var db = getDatabase(env);
            results.databaseCheck = {
                success: true,
                type: db.constructor.name || 'Unknown'
            };
        } catch (error) {
            results.databaseCheck = {
                success: false,
                error: error.message
            };
        }
        
        // 检查上传配置
        try {
            var uploadConfig = await fetchUploadConfig(env);
            results.uploadConfigCheck = {
                success: true,
                hasChannels: !!(uploadConfig.telegram && uploadConfig.telegram.channels),
                channelCount: uploadConfig.telegram ? uploadConfig.telegram.channels.length : 0
            };
        } catch (error) {
            results.uploadConfigCheck = {
                success: false,
                error: error.message
            };
        }
        
        // 检查安全配置
        try {
            var securityConfig = await fetchSecurityConfig(env);
            results.securityConfigCheck = {
                success: true,
                hasAuth: !!(securityConfig.auth),
                hasUpload: !!(securityConfig.upload)
            };
        } catch (error) {
            results.securityConfigCheck = {
                success: false,
                error: error.message
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
