/**
 * 幽灵索引修剪:以存储渠道的真实对象为准,清理「索引有、渠道无」的记录
 *
 * POST /api/manage/dedup/prune-ghosts[?dryRun=true]
 *
 * - 需要管理员权限(manage 中间件)
 * - 遍历所有已启用的 S3 兼容渠道,列出真实对象
 * - 索引中存在但渠道缺失的记录(幽灵)将被删除(KV 文件记录 + 分片条目)
 * - 渠道存在但索引缺失的对象会在报告中列出(不自动补录,避免缺 metadata)
 * - ?dryRun=true 时只返回报告,不执行任何删除
 *
 * 背景:渠道侧对象被外部清理后,索引不会自动同步,管理面板的文件列表
 * 会长期虚报(实测索引 3981 vs 渠道 444)。
 */
import { getDatabase } from '../../../utils/databaseAdapter.js';
import { getUploadConfig } from '../sysConfig/upload.js';
import { createS3Client } from '../../../utils/storage/s3Client.js';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';
// 与 functions/utils/indexManager.js 中的常量保持一致(该文件未导出这些常量)
const INDEX_KEY = 'manage@index';
const INDEX_META_KEY = 'manage@index@meta';
const OPERATION_KEY_PREFIX = 'manage@index@operation_';

export async function onRequest(context) {
    if (context.request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'method not allowed, use POST' }), {
            status: 405,
            headers: { 'content-type': 'application/json' },
        });
    }

    const { env } = context;
    const url = new URL(context.request.url);
    const dryRun = url.searchParams.get('dryRun') === 'true';

    const db = getDatabase(env);
    const uploadConfig = await getUploadConfig(db, env);

    // 1. 列出所有启用渠道的真实对象
    const realKeys = new Set();
    const channelReport = [];
    const channels = (uploadConfig.s3?.channels || []).filter(ch => ch.enabled);
    for (const channel of channels) {
        try {
            const s3Client = createS3Client(channel);
            let token;
            let count = 0;
            do {
                const resp = await s3Client.send(new ListObjectsV2Command({
                    Bucket: channel.bucketName,
                    ContinuationToken: token,
                }));
                for (const obj of resp.Contents || []) {
                    realKeys.add(obj.Key);
                    count++;
                }
                token = resp.IsTruncated ? resp.NextContinuationToken : undefined;
            } while (token);
            channelReport.push({ channel: channel.name, objects: count });
        } catch (err) {
            channelReport.push({ channel: channel.name, error: err.message });
        }
    }

    // 2. 读现有分片索引
    const metaStr = await db.get(INDEX_META_KEY);
    const meta = metaStr ? JSON.parse(metaStr) : { chunkCount: 0, totalCount: 0 };
    const entries = [];
    for (let i = 0; i < (meta.chunkCount || 0); i++) {
        try {
            const chunkStr = await db.get(`${INDEX_KEY}_${i}`);
            const chunk = chunkStr ? JSON.parse(chunkStr) : [];
            entries.push(...chunk);
        } catch (err) {
            console.error(`prune-ghosts: failed to read chunk ${i}:`, err);
        }
    }

    // 3. 分类:幽灵(索引有渠道无)/ 正常(两侧都有)/ 缺失(渠道有索引无)
    const ghosts = [];
    const normals = [];
    const indexedKeys = new Set();
    for (const entry of entries) {
        indexedKeys.add(entry.id);
        if (!realKeys.has(entry.id)) {
            ghosts.push(entry);
        } else {
            normals.push(entry);
        }
    }
    const missingInIndex = [...realKeys].filter(k => !indexedKeys.has(k));

    const report = {
        channels: channelReport,
        realObjects: realKeys.size,
        indexedEntries: entries.length,
        ghosts: ghosts.length,
        missingInIndex: missingInIndex.length,
        deleted: [],
        kept: normals.length,
        dryRun,
    };

    if (dryRun) {
        report.ghostSamples = ghosts.slice(0, 30).map(g => ({ id: g.id, name: g.metadata?.FileName }));
        return new Response(JSON.stringify(report, null, 2), {
            headers: { 'content-type': 'application/json' },
        });
    }

    // 4. 删除幽灵的 KV 文件记录
    for (const ghost of ghosts) {
        try {
            await db.delete(ghost.id);
            report.deleted.push({ id: ghost.id, name: ghost.metadata?.FileName });
        } catch (err) {
            report.deleted.push({ id: ghost.id, error: err.message });
        }
    }

    // 5. 重写分片(只保留真实存在的记录),清理多余分片
    const chunkSize = 500; // 与 indexManager 的 INDEX_CHUNK_SIZE_D1 一致(docker 部署)
    const keptFiles = normals;
    const chunks = [];
    for (let i = 0; i < keptFiles.length; i += chunkSize) {
        chunks.push(keptFiles.slice(i, i + chunkSize));
    }
    if (chunks.length === 0) chunks.push([]);

    const newMeta = {
        lastUpdated: Date.now(),
        totalCount: keptFiles.length,
        totalSizeMB: 0,
        channelStats: {},
        lastOperationId: null,
        chunkCount: chunks.length,
        chunkSize: chunkSize,
    };
    await db.put(INDEX_META_KEY, JSON.stringify(newMeta));
    for (let i = 0; i < chunks.length; i++) {
        await db.put(`${INDEX_KEY}_${i}`, JSON.stringify(chunks[i]));
    }
    // 清理超出的旧分片
    for (let i = chunks.length; i < (meta.chunkCount || 0); i++) {
        await db.delete(`${INDEX_KEY}_${i}`);
    }

    // 6. 清空操作日志,防止历史 add 操作把幽灵重新合并回索引
    const opsKeys = [];
    let opCursor;
    do {
        const list = await db.list({ limit: 1000, cursor: opCursor });
        for (const key of list.keys || []) {
            if (key.startsWith(OPERATION_KEY_PREFIX)) opsKeys.push(key);
        }
        opCursor = list.cursor;
    } while (opCursor && opsKeys.length < 5000);
    for (const key of opsKeys) {
        await db.delete(key);
    }
    report.clearedOperations = opsKeys.length;

    return new Response(JSON.stringify(report, null, 2), {
        headers: { 'content-type': 'application/json' },
    });
}
