/**
 * 容量配额管理 API
 * GET: 获取各渠道容量统计
 * POST: 重新统计容量（校准数据）
 */

import { getDatabase } from '../../utils/databaseAdapter.js';
import { getIndexInfo } from '../../utils/indexManager.js';

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

        // 获取索引信息，包含所有文件
        const indexInfo = await getIndexInfo(context);

        if (!indexInfo || !indexInfo.success) {
            return new Response(JSON.stringify({
                success: false,
                error: 'Failed to get index info'
            }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // 从索引中重新计算各渠道容量
        const channelStats = {};

        // 需要遍历索引中的所有文件
        const allFiles = await getAllFilesFromIndex(context);

        for (const file of allFiles) {
            const channelName = file.metadata?.ChannelName;
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
            channelStats
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

// 从索引获取所有文件
async function getAllFilesFromIndex(context) {
    const { env } = context;
    const db = getDatabase(env);

    const allFiles = [];

    // 读取索引元数据
    const metaData = await db.get('manage@index@meta');
    if (!metaData) {
        // 没有索引元数据，尝试读取旧格式索引
        const oldIndex = await db.get('manage@index');
        if (oldIndex) {
            const index = JSON.parse(oldIndex);
            return index.files || [];
        }
        return [];
    }

    const meta = JSON.parse(metaData);
    const chunkCount = meta.chunkCount || 1;

    // 读取所有分块
    for (let i = 0; i < chunkCount; i++) {
        const chunkKey = `manage@index_${i}`;
        const chunkData = await db.get(chunkKey);
        if (chunkData) {
            const chunk = JSON.parse(chunkData);
            allFiles.push(...chunk);
        }
    }

    return allFiles;
}
