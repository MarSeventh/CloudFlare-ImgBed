// [[path]].js
import { TelegramAPI } from '../utils/telegramAPI.js'

// CORS 跨域响应头（可按需扩展）
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Range',
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

    let tgFileId, tgBotToken, fileName;

    try {
        // 解析参数：GET 从查询字符串，POST 从 JSON body
        if (request.method === 'GET') {
            tgFileId = url.searchParams.get('tgFileId');
            tgBotToken = url.searchParams.get('tgBotToken');
            fileName = url.searchParams.get('fileName') || undefined; // 可选
        } else {
            const body = await request.json();
            tgFileId = body.tgFileId;
            tgBotToken = body.tgBotToken;
            fileName = body.fileName || undefined;
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

        // 获取文件路径（相对路径，如：photos/file_1.jpg）
        const filePath = await telegram.getFilePath(tgFileId);
        if (!filePath) {
            return errorResponse('Failed to get file path from Telegram API', 502);
        }

        // 拼接完整文件下载地址
        const targetUrl = `https://api.telegram.org/file/bot${tgBotToken}/${filePath}`;

        // 构建请求头：透传客户端的 Range 头（如果存在）
        const fetchHeaders = {};
        const clientRange = request.headers.get('Range');
        if (clientRange) {
            fetchHeaders['Range'] = clientRange;
        }

        // 流式获取文件，避免内存溢出
        const fileResponse = await fetch(targetUrl, {
            method: 'GET',
            headers: fetchHeaders,
        });

        if (!fileResponse.ok && fileResponse.status !== 206) {
            // 返回上游的错误状态（如 404）
            return new Response(
                `Telegram API error: ${fileResponse.status} ${fileResponse.statusText}`,
                {
                    status: fileResponse.status,
                    headers: { ...corsHeaders }
                }
            );
        }

        // 构建最终响应头：保留原始文件相关头部，添加 CORS 与自定义项
        const responseHeaders = new Headers(fileResponse.headers);
        responseHeaders.set('Access-Control-Allow-Origin', '*');
        responseHeaders.set('Accept-Ranges', 'bytes'); // 声明支持范围请求
        responseHeaders.set('X-Source', 'Telegram-File-Proxy');

        // 如果提供了文件名，设置 Content-Disposition（提示浏览器下载）
        if (fileName) {
            const safeName = encodeURIComponent(fileName);
            responseHeaders.set('Content-Disposition', `attachment; filename="${safeName}"`);
        }

        // 返回流式响应，状态码保持原样（200 或 206）
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