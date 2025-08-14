/**
 * 简单的D1测试
 */

export async function onRequest(context) {
    var env = context.env;
    
    try {
        var results = {
            hasDB: !!env.DB,
            dbType: env.DB ? typeof env.DB : 'undefined'
        };
        
        if (!env.DB) {
            return new Response(JSON.stringify(results), {
                headers: { 'Content-Type': 'application/json' }
            });
        }
        
        // 测试简单查询
        try {
            var stmt = env.DB.prepare('SELECT COUNT(*) as count FROM files');
            var countResult = await stmt.first();
            results.countQuery = {
                success: true,
                count: countResult.count,
                resultType: typeof countResult
            };
        } catch (error) {
            results.countQuery = {
                success: false,
                error: error.message
            };
        }
        
        // 测试all()查询
        try {
            var stmt2 = env.DB.prepare('SELECT id FROM files LIMIT 3');
            var allResult = await stmt2.all();
            results.allQuery = {
                success: true,
                resultType: typeof allResult,
                isArray: Array.isArray(allResult),
                length: allResult ? allResult.length : 'N/A',
                sample: allResult
            };
        } catch (error) {
            results.allQuery = {
                success: false,
                error: error.message
            };
        }
        
        // 测试带参数的查询
        try {
            var stmt3 = env.DB.prepare('SELECT id FROM files WHERE id LIKE ? LIMIT 2');
            var paramResult = await stmt3.bind('cosplay/%').all();
            results.paramQuery = {
                success: true,
                resultType: typeof paramResult,
                isArray: Array.isArray(paramResult),
                length: paramResult ? paramResult.length : 'N/A',
                sample: paramResult
            };
        } catch (error) {
            results.paramQuery = {
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
