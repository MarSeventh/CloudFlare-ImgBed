/**
 * 最简单的测试页面
 */

export async function onRequest(context) {
    try {
        return new Response(JSON.stringify({
            success: true,
            message: "Minimal test works",
            timestamp: new Date().toISOString()
        }), {
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
