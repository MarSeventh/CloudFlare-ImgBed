import { errorHandling, telemetryData, checkDatabaseConfig } from './utils/middleware';

// 安全的中间件链，带错误处理
export async function onRequest(context) {
    try {
        // 检查数据库配置
        var dbCheckResult = await checkDatabaseConfig(context);
        if (dbCheckResult instanceof Response) {
            return dbCheckResult;
        }

        // 错误处理中间件
        var errorResult = await errorHandling(context);
        if (errorResult instanceof Response) {
            return errorResult;
        }

        // 遥测数据中间件
        var telemetryResult = await telemetryData(context);
        if (telemetryResult instanceof Response) {
            return telemetryResult;
        }

        return await context.next();
    } catch (error) {
        console.error('Middleware chain error:', error);
        return new Response(JSON.stringify({
            error: 'Middleware error: ' + error.message,
            stack: error.stack
        }), {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }
}