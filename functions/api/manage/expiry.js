/**
 * 文件有效期清理 API
 * GET: 已到期但尚未清理的文件数（数量一直不降说明定时清理没有运行）
 * POST: 立即清理一批到期文件
 */

import { cleanupExpiredFiles, countExpiredFiles } from '../../utils/fileExpiryService.js';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
};

export async function onRequest(context) {
    const { request, env } = context;

    if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'GET' && request.method !== 'POST') {
        return new Response('Method not allowed', { status: 405, headers: corsHeaders });
    }

    try {
        const cleanup = request.method === 'POST' ? await cleanupExpiredFiles(context) : null;
        const pending = await countExpiredFiles(env);

        return new Response(JSON.stringify({
            success: true,
            pending: pending.count,
            pendingCapped: pending.capped,
            ...(cleanup && { cleanup }),
        }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    } catch (error) {
        return new Response(JSON.stringify({
            success: false,
            error: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}
