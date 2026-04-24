// getTelegramFile.js
import { TelegramAPI } from '../../utils/telegramAPI.js'

// CORS 跨域响应头（可按需扩展）
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
};

/**
 * 返回统一的错误响应
 * @param {string} message - 错误描述
 * @param {number} status - HTTP状态码
 * @returns {Response}
 */
function errorResponse(message, status = 400) {
    return new Response(JSON.stringify({ error: message }), {
        status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
}

export async function onRequest(context) {
    const { request } = context;
    const url = new URL(request.url);

    // 处理预检请求
    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: corsHeaders });
    }

    // 只允许 GET 和 POST 请求
    if (request.method !== 'GET' && request.method !== 'POST') {
        return errorResponse('Method not allowed', 405);
    }

    let tgFileId, tgBotToken;

    try {
        // 解析参数：GET 从查询字符串，POST 从 JSON body
        if (request.method === 'GET') {
            tgFileId = url.searchParams.get('tgFileId');
            tgBotToken = url.searchParams.get('tgBotToken');
        } else {
            const body = await request.json();
            tgFileId = body.tgFileId;
            tgBotToken = body.tgBotToken;
        }

        // 参数校验
        if (!tgFileId || !tgBotToken) {
            return errorResponse('Missing required parameters: tgFileId and tgBotToken');
        }

        // 基础长度/格式校验（可选）
        if (typeof tgFileId !== 'string' || tgFileId.length < 10) {
            return errorResponse('Invalid tgFileId format');
        }
        if (!tgBotToken.includes(':')) {
            return errorResponse('Invalid tgBotToken format (must contain ":")');
        }

        // 实例化 TelegramAPI（不使用代理，保持原官方地址）
        const telegram = new TelegramAPI(tgBotToken);

        // 获取文件内容（返回 Response 对象）
        const fileResponse = await telegram.getTelegramFileContent(tgFileId, tgBotToken);

        // 构建最终响应：保留原始文件内容，添加 CORS 头
        // 注意：文件可能较大，使用流式处理避免内存溢出
        const responseHeaders = new Headers(fileResponse.headers);
        responseHeaders.set('Access-Control-Allow-Origin', '*');

        // 可添加自定义头标识来源
        responseHeaders.set('X-Source', 'Telegram-File-Proxy');

        return new Response(fileResponse.body, {
            status: fileResponse.status,
            statusText: fileResponse.statusText,
            headers: responseHeaders,
        });

    } catch (error) {
        console.error('Error in getTelegramFile API:', error);
        return errorResponse(error.message || 'Internal server error', 500);
    }
}