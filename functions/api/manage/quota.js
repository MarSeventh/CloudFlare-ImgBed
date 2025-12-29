/**
 * 容量配额管理 API
 * GET: 获取各渠道容量统计
 * POST: 重新统计容量（校准数据）
 */

import { getDatabase } from '../../utils/databaseAdapter.js';
import { readIndex } from '../../utils/indexManager.js';

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

    // GET: 获取容量统计
    if (request.method === 'GET') {
        return await getQuotaStats(env);
    }

    // POST: 重新统计容量
    if (request.method === 'POST') {
        return await recalculateQuota(context);
    }

    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
}

// 获取各渠道容量统计
async function getQuotaStats(env) {
    try {
        const db = getDatabase(env);
        const quotaStats = {};

        // 获取所有 quota 记录
        const listResult = await db.list({ prefix: 'manage@quota@' });

        for (const item of listResult.keys) {
            const channelName = item.name.replace('manage@quota@', '');
            const quotaData = await db.get(item.name);

            if (quotaData) {
                quotaStats[channelName] = JSON.parse(quotaData);
            }
        }

        return new Response(JSON.stringify({
            success: true,
            quotaStats
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

// 重新统计各渠道容量
async function recalculateQuota(context) {
    const { env } = context;

    try {
        const db = getDatabase(env);

        // 使用 readIndex 获取所有文件（count=-1 表示获取全部）
        const indexResult = await readIndex(context, { count: -1 });

        if (!indexResult || !indexResult.success) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Failed to get index: ' + (indexResult?.error || 'Unknown error')
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        const allFiles = indexResult.files || [];

        // 使用 Map 按文件 ID 去重，防止重复计算
        const uniqueFiles = new Map();
        for (const file of allFiles) {
            if (file.id && !uniqueFiles.has(file.id)) {
                uniqueFiles.set(file.id, file);
            }
        }

        // 从去重后的文件列表重新计算各渠道容量
        const channelStats = {};

        for (const file of uniqueFiles.values()) {
            const channelName = file.metadata?.ChannelName;
            // FileSize 已经是 MB 单位
            const fileSize = parseFloat(file.metadata?.FileSize) || 0;

            if (channelName) {
                if (!channelStats[channelName]) {
                    channelStats[channelName] = { usedMB: 0, fileCount: 0 };
                }
                channelStats[channelName].usedMB += fileSize;
                channelStats[channelName].fileCount += 1;
            }
        }

        // 更新各渠道的 quota 记录
        const now = Date.now();
        for (const [channelName, stats] of Object.entries(channelStats)) {
            const quotaKey = `manage@quota@${channelName}`;
            const quotaData = {
                usedMB: Math.round(stats.usedMB * 100) / 100, // 保留两位小数
                fileCount: stats.fileCount,
                lastUpdated: now,
                recalculatedAt: now
            };
            await db.put(quotaKey, JSON.stringify(quotaData));
        }

        return new Response(JSON.stringify({
            success: true,
            message: 'Quota recalculated successfully',
            channelStats,
            totalUniqueFiles: uniqueFiles.size
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
