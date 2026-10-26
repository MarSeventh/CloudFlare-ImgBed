import { errorHandling, telemetryData, checkDatabaseConfig } from '../utils/middleware';

// CORS 跨域响应头（额外放行 PicGo 的 x-picgo-secret 头）
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, authCode, x-picgo-secret',
    'Access-Control-Max-Age': '86400',
};

// OPTIONS 预检请求处理
async function handleOptions(context) {
    if (context.request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: corsHeaders
        });
    }
    return context.next();
}

export const onRequest = [checkDatabaseConfig, handleOptions, errorHandling, telemetryData];
