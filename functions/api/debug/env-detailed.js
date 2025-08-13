/**
 * 详细的环境变量检查
 */

export async function onRequest(context) {
    try {
        var env = context.env;
        
        var result = {
            env: {
                hasDB: !!env.DB,
                hasImgUrl: !!env.img_url,
                dbType: env.DB ? typeof env.DB : 'undefined',
                imgUrlType: env.img_url ? typeof env.img_url : 'undefined'
            },
            dbDetails: {},
            kvDetails: {},
            errors: []
        };
        
        // 检查DB详细信息
        if (env.DB) {
            try {
                result.dbDetails.exists = true;
                result.dbDetails.hasPrepare = typeof env.DB.prepare === 'function';
                
                if (result.dbDetails.hasPrepare) {
                    var stmt = env.DB.prepare('SELECT 1 as test');
                    var testResult = await stmt.first();
                    result.dbDetails.connectionTest = 'SUCCESS';
                    result.dbDetails.testResult = testResult;
                } else {
                    result.dbDetails.connectionTest = 'NO_PREPARE_METHOD';
                }
            } catch (error) {
                result.dbDetails.connectionTest = 'FAILED';
                result.dbDetails.error = error.message;
                result.errors.push('DB test failed: ' + error.message);
            }
        } else {
            result.dbDetails.exists = false;
        }
        
        // 检查KV详细信息
        if (env.img_url) {
            try {
                result.kvDetails.exists = true;
                result.kvDetails.hasGet = typeof env.img_url.get === 'function';
                result.kvDetails.hasList = typeof env.img_url.list === 'function';
                
                if (result.kvDetails.hasList) {
                    var listResult = await env.img_url.list({ limit: 1 });
                    result.kvDetails.connectionTest = 'SUCCESS';
                    result.kvDetails.hasKeys = listResult.keys.length > 0;
                } else {
                    result.kvDetails.connectionTest = 'NO_LIST_METHOD';
                }
            } catch (error) {
                result.kvDetails.connectionTest = 'FAILED';
                result.kvDetails.error = error.message;
                result.errors.push('KV test failed: ' + error.message);
            }
        } else {
            result.kvDetails.exists = false;
        }
        
        // 测试数据库适配器
        try {
            // 不导入，直接测试基本逻辑
            if (env.DB && typeof env.DB.prepare === 'function') {
                result.adapterTest = 'D1_AVAILABLE';
            } else if (env.img_url && typeof env.img_url.get === 'function') {
                result.adapterTest = 'KV_AVAILABLE';
            } else {
                result.adapterTest = 'NO_DATABASE';
                result.errors.push('No valid database binding found');
            }
        } catch (error) {
            result.adapterTest = 'ADAPTER_ERROR';
            result.errors.push('Adapter test failed: ' + error.message);
        }
        
        return new Response(JSON.stringify(result, null, 2), {
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
