// 暂时禁用中间件来排查问题
// import { errorHandling, telemetryData, checkDatabaseConfig } from './utils/middleware';

// export const onRequest = [checkDatabaseConfig, errorHandling, telemetryData];

// 临时的简单中间件
export async function onRequest(context) {
    try {
        return await context.next();
    } catch (error) {
        console.error('Middleware error:', error);
        return new Response(JSON.stringify({
            error: 'Middleware error: ' + error.message
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
}