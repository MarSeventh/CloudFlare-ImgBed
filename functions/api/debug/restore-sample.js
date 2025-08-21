/**
 * 恢复样本数据测试
 */

import { getDatabase } from '../../utils/databaseAdapter.js';

export async function onRequest(context) {
    var env = context.env;
    
    try {
        var db = getDatabase(env);
        
        // 使用您提供的样本数据
        var sampleSettings = {
            "manage@sysConfig@page": "{\"config\":[{\"id\":\"siteTitle\",\"label\":\"网站标题\",\"placeholder\":\"Sanyue ImgHub\",\"category\":\"全局设置\",\"value\":\"ChuZhong ImgHub\"},{\"id\":\"siteIcon\",\"label\":\"网站图标\",\"category\":\"全局设置\"},{\"id\":\"ownerName\",\"label\":\"图床名称\",\"placeholder\":\"Sanyue ImgHub\",\"category\":\"全局设置\",\"value\":\"ChuZhong ImgHub\"},{\"id\":\"logoUrl\",\"label\":\"图床Logo\",\"category\":\"全局设置\"},{\"id\":\"bkInterval\",\"label\":\"背景切换间隔\",\"placeholder\":\"3000\",\"tooltip\":\"单位：毫秒 ms\",\"category\":\"全局设置\"},{\"id\":\"bkOpacity\",\"label\":\"背景图透明度\",\"placeholder\":\"1\",\"tooltip\":\"0-1 之间的小数\",\"category\":\"全局设置\"},{\"id\":\"urlPrefix\",\"label\":\"默认URL前缀\",\"tooltip\":\"自定义URL前缀，如：https://img.a.com/file/，留空则使用当前域名 <br/> 设置后将应用于客户端和管理端\",\"category\":\"全局设置\"},{\"id\":\"announcement\",\"label\":\"公告\",\"tooltip\":\"支持HTML标签\",\"category\":\"客户端设置\"},{\"id\":\"defaultUploadChannel\",\"label\":\"默认上传渠道\",\"type\":\"select\",\"options\":[{\"label\":\"Telegram\",\"value\":\"telegram\"},{\"label\":\"Cloudflare R2\",\"value\":\"cfr2\"},{\"label\":\"S3\",\"value\":\"s3\"}],\"placeholder\":\"telegram\",\"category\":\"客户端设置\"},{\"id\":\"defaultUploadFolder\",\"label\":\"默认上传目录\",\"placeholder\":\"/ 开头的合法目录，不能包含特殊字符， 默认为根目录\",\"category\":\"客户端设置\"},{\"id\":\"defaultUploadNameType\",\"label\":\"默认命名方式\",\"type\":\"select\",\"options\":[{\"label\":\"默认\",\"value\":\"default\"},{\"label\":\"仅前缀\",\"value\":\"index\"},{\"label\":\"仅原名\",\"value\":\"origin\"},{\"label\":\"短链接\",\"value\":\"short\"}],\"placeholder\":\"default\",\"category\":\"客户端设置\"},{\"id\":\"loginBkImg\",\"label\":\"登录页背景图\",\"tooltip\":\"1.填写 bing 使用必应壁纸轮播 <br/> 2.填写 [\\\"url1\\\",\\\"url2\\\"] 使用多张图片轮播 <br/> 3.填写 [\\\"url\\\"] 使用单张图片\",\"category\":\"客户端设置\"},{\"id\":\"uploadBkImg\",\"label\":\"上传页背景图\",\"tooltip\":\"1.填写 bing 使用必应壁纸轮播 <br/> 2.填写 [\\\"url1\\\",\\\"url2\\\"] 使用多张图片轮播 <br/> 3.填写 [\\\"url\\\"] 使用单张图片\",\"category\":\"客户端设置\"},{\"id\":\"footerLink\",\"label\":\"页脚传送门链接\",\"category\":\"客户端设置\"},{\"id\":\"disableFooter\",\"label\":\"隐藏页脚\",\"type\":\"boolean\",\"default\":false,\"category\":\"客户端设置\",\"value\":false},{\"id\":\"adminLoginBkImg\",\"label\":\"登录页背景图\",\"tooltip\":\"1.填写 bing 使用必应壁纸轮播 <br/> 2.填写 [\\\"url1\\\",\\\"url2\\\"] 使用多张图片轮播 <br/> 3.填写 [\\\"url\\\"] 使用单张图片\",\"category\":\"管理端设置\"}]}",
            "manage@sysConfig@security": "{\"auth\":{\"user\":{\"authCode\":\"ccxy211008\"},\"admin\":{\"adminUsername\":\"chuzhong\",\"adminPassword\":\"ccxy211008\"}},\"upload\":{\"moderate\":{\"enabled\":false,\"channel\":\"default\",\"moderateContentApiKey\":\"\",\"nsfwApiPath\":\"\"}},\"access\":{\"allowedDomains\":\"\",\"whiteListMode\":false}}"
        };
        
        var results = {
            beforeRestore: {},
            afterRestore: {},
            restoreResults: [],
            errors: []
        };
        
        // 检查恢复前的状态
        for (var key in sampleSettings) {
            try {
                var beforeValue = await db.get(key);
                results.beforeRestore[key] = {
                    exists: !!beforeValue,
                    length: beforeValue ? beforeValue.length : 0
                };
            } catch (error) {
                results.beforeRestore[key] = { error: error.message };
            }
        }
        
        // 执行恢复
        for (var key in sampleSettings) {
            try {
                var value = sampleSettings[key];
                console.log('恢复设置:', key, '长度:', value.length);
                
                await db.put(key, value);
                
                // 立即验证
                var retrieved = await db.get(key);
                var success = retrieved === value;
                
                results.restoreResults.push({
                    key: key,
                    success: success,
                    originalLength: value.length,
                    retrievedLength: retrieved ? retrieved.length : 0,
                    matches: success
                });
                
                if (!success) {
                    console.error('恢复验证失败:', key);
                    console.error('原始长度:', value.length);
                    console.error('检索长度:', retrieved ? retrieved.length : 0);
                }
                
            } catch (error) {
                results.errors.push({
                    key: key,
                    error: error.message
                });
                console.error('恢复失败:', key, error);
            }
        }
        
        // 检查恢复后的状态
        for (var key in sampleSettings) {
            try {
                var afterValue = await db.get(key);
                results.afterRestore[key] = {
                    exists: !!afterValue,
                    length: afterValue ? afterValue.length : 0
                };
            } catch (error) {
                results.afterRestore[key] = { error: error.message };
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
