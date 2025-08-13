/**
 * 不使用中间件的测试页面
 */

export async function onRequest(context) {
    try {
        var env = context.env;
        
        var result = {
            success: true,
            message: "Test without middleware works",
            hasDB: !!env.DB,
            hasKV: !!env.img_url,
            timestamp: new Date().toISOString()
        };
        
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
