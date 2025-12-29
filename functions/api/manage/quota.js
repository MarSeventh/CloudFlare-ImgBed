/**
 * 容量配额管理 API
 * GET: 获取各渠道容量统计（从索引元数据读取）
 * POST: 重新统计容量（触发索引重建）
 */

import { getIndexMeta, rebuildIndex } from '../../utils/indexManager.js';

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

    // GET: 获取容量统计（从索引元数据读取，只需 1 次读取）
    if (request.method === 'GET') {
        return await getQuotaStats(context);
    }

    // POST: 重新统计容量（触发索引重建）
    if (request.method === 'POST') {
        return await recalculateQuota(context);
    }

    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
}

// 获取各渠道容量统计（从索引元数据读取）
async function getQuotaStats(context) {
    try {
        const indexMeta = await getIndexMeta(context);

        return new Response(JSON.stringify({
            success: true,
            quotaStats: indexMeta.channelStats || {},
            totalSizeMB: indexMeta.totalSizeMB || 0,
            totalCount: indexMeta.totalCount || 0,
            lastUpdated: indexMeta.lastUpdated
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

// 重新统计容量（触发索引重建，会重新计算所有容量统计）
async function recalculateQuota(context) {
    try {
        // 重建索引会自动重新计算所有容量统计
        const result = await rebuildIndex(context);

        if (!result.success) {
            return new Response(JSON.stringify({
                success: false,
                error: result.error || 'Failed to rebuild index'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // 重建完成后，获取最新的统计数据
        const indexMeta = await getIndexMeta(context);

        return new Response(JSON.stringify({
            success: true,
            message: 'Quota recalculated successfully',
            channelStats: indexMeta.channelStats || {},
            totalSizeMB: indexMeta.totalSizeMB || 0,
            totalCount: indexMeta.totalCount || 0,
            totalUniqueFiles: result.indexedCount
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
