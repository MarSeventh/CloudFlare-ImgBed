/**
 * 文件有效期：上传时计算到期时间、KV 到期标记、清理到期文件
 *
 * 到期时间只保存在元数据 ExpiresAt 中：
 * - D1 / SQLite：通过 idx_files_expires 表达式索引按到期时间查询
 * - KV：上传时额外写一个空标记键 manage@expiry@<到期时间>@<fileId>，按键名顺序即到期顺序
 */
import { getDatabase } from './databaseAdapter.js';
import { fetchOthersConfig } from './sysConfig.js';
import { batchRemoveFilesFromIndex } from './indexManager.js';
import { deleteFile } from '../api/manage/delete/[[path]].js';
import {
    EXPIRY_MARKER_PREFIX, resolveExpiresAt, getExpiresAt, buildExpiryMarkerKey, parseExpiryMarkerKey
} from './fileExpiryHelpers.js';

// Workers 免费计划每次调用最多 50 个子请求（KV / D1 / R2 / fetch / Cache API 都计入），留出余量
const DEFAULT_SUBREQUEST_BUDGET = 45;
// 每次清理的固定开销：查询到期文件、记录一次索引操作
const FIXED_SUBREQUESTS = 3;
// 每个文件：删除存储对象 + 删除记录；KV 另需读取记录、删除标记
const SUBREQUESTS_PER_FILE = 2;
const SUBREQUESTS_PER_FILE_KV = 4;
// 统计待清理数量时 KV 最多列出的标记数
const MAX_COUNTED_MARKERS = 1000;
// 管理端请求顺带清理的最小间隔
const OPPORTUNISTIC_INTERVAL_MS = 10 * 60 * 1000;

let lastOpportunisticRun = 0;

/**
 * 计算本次上传的到期时间
 * @returns {Promise<{expiresAt: number|null}|{error: string}>}
 */
export async function resolveUploadExpiry(context) {
    const { env, request, url } = context;
    const othersConfig = await fetchOthersConfig(env);
    if (!othersConfig.fileExpiry?.enabled) {
        return { expiresAt: null };
    }

    // WebDAV 客户端经内部 Token 转发上传，同步工具遇到文件自行消失会出问题，不设置有效期
    if (isWebDAVInternalRequest(request, othersConfig.webDAV)) {
        return { expiresAt: null };
    }

    return resolveExpiresAt(othersConfig.fileExpiry, url.searchParams.get('expire'));
}

function isWebDAVInternalRequest(request, webDAVConfig) {
    const internalToken = webDAVConfig?.internalToken;
    const authHeader = request.headers.get('Authorization');
    if (!internalToken || !authHeader) {
        return false;
    }
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
    return token === internalToken;
}

function usesExpiryMarkers(db) {
    return typeof db.listExpiredFiles !== 'function';
}

/**
 * 写入新记录或修改 ExpiresAt 后调用；KV 写入到期标记，D1 无需处理
 */
export async function trackFileExpiry(db, fileId, metadata) {
    const expiresAt = getExpiresAt(metadata);
    if (expiresAt === null || !usesExpiryMarkers(db)) {
        return;
    }
    await db.put(buildExpiryMarkerKey(expiresAt, fileId), '');
}

/**
 * 按子请求额度计算每次最多清理的文件数
 * 付费计划可通过环境变量 EXPIRY_CLEANUP_SUBREQUESTS 调大
 */
export function getCleanupBatchSize(env, usingMarkers) {
    const configured = Number(env.EXPIRY_CLEANUP_SUBREQUESTS);
    const budget = Number.isFinite(configured) && configured > FIXED_SUBREQUESTS
        ? configured
        : DEFAULT_SUBREQUEST_BUDGET;
    const perFile = usingMarkers ? SUBREQUESTS_PER_FILE_KV : SUBREQUESTS_PER_FILE;
    return Math.max(1, Math.floor((budget - FIXED_SUBREQUESTS) / perFile));
}

async function listDueFiles(db, now, limit) {
    if (!usesExpiryMarkers(db)) {
        const rows = await db.listExpiredFiles(now, limit);
        return rows.map(row => ({
            fileId: row.id,
            record: { value: row.value, metadata: row.metadata },
        }));
    }

    const { keys } = await db.list({ prefix: EXPIRY_MARKER_PREFIX, limit });
    const due = [];
    for (const { name } of keys) {
        const marker = parseExpiryMarkerKey(name);
        if (marker && marker.expiresAt > now) {
            break;
        }
        due.push({ markerKey: name, fileId: marker?.fileId, markerExpiresAt: marker?.expiresAt });
    }
    return due;
}

/**
 * 清理已到期的文件：删除存储对象、记录和索引
 * 每次数量有上限，删不完的留到下次；删除失败的文件下次重试
 * @returns {Promise<{deleted: number, failed: number, hasMore: boolean}>}
 */
export async function cleanupExpiredFiles(context, { now = Date.now(), limit } = {}) {
    const { env } = context;
    const db = getDatabase(env);
    const usingMarkers = usesExpiryMarkers(db);
    const batchSize = limit ?? getCleanupBatchSize(env, usingMarkers);
    const due = await listDueFiles(db, now, batchSize);

    const deleted = [];
    let failed = 0;
    for (const item of due) {
        let record = item.record;

        if (item.markerKey) {
            record = item.fileId ? await db.getWithMetadata(item.fileId) : null;
            const expiresAt = getExpiresAt(record?.metadata);
            if (expiresAt !== item.markerExpiresAt) {
                // 记录已删除、有效期被修改或改回永久时，标记已失效；仍有有效期的补写正确的标记
                if (record && expiresAt !== null) {
                    await trackFileExpiry(db, item.fileId, record.metadata);
                }
                await db.delete(item.markerKey);
                continue;
            }
        }

        const result = await deleteFile(env, item.fileId, null, null, { record, skipPurge: true });
        // 兼容 deleteFile 返回布尔值或 { deleted, existed } 对象
        if (result === true || result?.deleted === true) {
            deleted.push(item.fileId);
            if (item.markerKey) {
                await db.delete(item.markerKey);
            }
        } else {
            failed++;
        }
    }

    if (deleted.length > 0) {
        await batchRemoveFilesFromIndex(context, deleted);
    }

    return { deleted: deleted.length, failed, hasMore: due.length >= batchSize };
}

/**
 * 管理端请求顺带清理一批（Pages 没有定时任务时依靠它和手动清理）
 * 同一实例内限频，不额外写入状态；功能关闭时跳过，避免未使用该功能的 KV 部署消耗 list 额度
 */
export function maybeCleanupExpiredFiles(context, now = Date.now()) {
    if (now - lastOpportunisticRun < OPPORTUNISTIC_INTERVAL_MS) {
        return;
    }
    lastOpportunisticRun = now;
    context.waitUntil((async () => {
        const othersConfig = await fetchOthersConfig(context.env);
        if (othersConfig.fileExpiry?.enabled) {
            await cleanupExpiredFiles(context, { now });
        }
    })().catch(error => {
        console.error('Expired files cleanup failed:', error);
    }));
}

/**
 * 统计已到期但尚未清理的文件数；KV 最多统计 1000 个
 * @returns {Promise<{count: number, capped: boolean}>}
 */
export async function countExpiredFiles(env, now = Date.now()) {
    const db = getDatabase(env);
    if (!usesExpiryMarkers(db)) {
        return { count: await db.countExpiredFiles(now), capped: false };
    }

    const { keys, list_complete } = await db.list({ prefix: EXPIRY_MARKER_PREFIX, limit: MAX_COUNTED_MARKERS });
    let count = 0;
    for (const { name } of keys) {
        const marker = parseExpiryMarkerKey(name);
        if (marker && marker.expiresAt > now) {
            return { count, capped: false };
        }
        count++;
    }
    return { count, capped: list_complete === false };
}
