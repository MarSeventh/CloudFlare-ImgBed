/**
 * 文件有效期：上传时计算到期时间、KV 到期标记、清理到期文件
 *
 * 到期时间只保存在元数据 ExpiresAt 中：
 * - D1 / SQLite：通过 idx_files_expires 表达式索引按到期时间查询
 * - KV：上传时额外写一个空标记键 manage@expiry@<到期时间>@<fileId>，按键名顺序即到期顺序
 *
 * 清理与修改的协调：
 * - 文件一到期，访问即返回 404，管理接口也不再允许修改（返回 409），因此到期后不会再被续期
 * - 清理只处理到期超过 CLEANUP_GRACE_MS 的文件，给到期前已发出的修改请求和 KV 跨地域同步留出时间
 * - 每个文件删除前重新读取当前记录确认仍然到期，删除记录时再按到期时间和上传时间做条件删除（D1）或比对（KV），
 *   清理期间被替换的记录不会被旧快照删除
 * - 删除失败的文件推迟 CLEANUP_RETRY_MS 再试（D1 写入 ExpiryCleanupRetryAt，KV 把标记移到重试时间），
 *   持续失败的文件不会一直占据每次清理的批次
 */
import { getDatabase } from './databaseAdapter.js';
import { fetchOthersConfig, fetchUploadConfig } from './sysConfig.js';
import { batchRemoveFilesFromIndex } from './indexManager.js';
import { deleteStoredFile } from '../api/manage/delete/[[path]].js';
import {
    EXPIRY_MARKER_PREFIX, resolveExpiresAt, getExpiresAt, buildExpiryMarkerKey, parseExpiryMarkerKey, isMissingRecord
} from './fileExpiryHelpers.js';

// Workers 免费计划每次调用最多 50 个子请求（KV / D1 / R2 / fetch / Cache API 都计入），留出余量
const DEFAULT_SUBREQUEST_BUDGET = 45;
// 每次清理的固定开销：查询到期文件、记录一次索引操作
const FIXED_SUBREQUESTS = 3;
// 每个文件：重新读取记录 + 删除存储对象 + 条件删除记录；KV 删除记录前需再读一次，另需删除标记
const SUBREQUESTS_PER_FILE = 3;
const SUBREQUESTS_PER_FILE_KV = 5;
// 到期后至少等这么久才删除；期间访问已返回 404
export const CLEANUP_GRACE_MS = 5 * 60 * 1000;
// 删除失败的文件推迟这么久再重试
export const CLEANUP_RETRY_MS = 60 * 60 * 1000;
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
    const { fileExpiry } = await fetchUploadConfig(env);
    if (!fileExpiry?.enabled) {
        return { expiresAt: null };
    }

    // WebDAV 客户端经内部 Token 转发上传，同步工具遇到文件自行消失会出问题，不设置有效期
    const othersConfig = await fetchOthersConfig(env);
    if (isWebDAVInternalRequest(request, othersConfig.webDAV)) {
        return { expiresAt: null };
    }

    return resolveExpiresAt(fileExpiry, url.searchParams.get('expire'));
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
 * 补写 KV 到期标记；D1 无需处理
 * 正常写入记录时由 databaseAdapter 的 KV 适配器自动先写标记，这里供清理任务修正失效标记
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

async function listDueFiles(db, cutoff, limit) {
    if (!usesExpiryMarkers(db)) {
        const rows = await db.listExpiredFiles(cutoff, limit);
        return rows.map(row => ({ fileId: row.id }));
    }

    const { keys } = await db.list({ prefix: EXPIRY_MARKER_PREFIX, limit });
    const due = [];
    for (const { name } of keys) {
        const marker = parseExpiryMarkerKey(name);
        if (marker && marker.expiresAt > cutoff) {
            break;
        }
        due.push({ markerKey: name, fileId: marker?.fileId, markerExpiresAt: marker?.expiresAt });
    }
    return due;
}

/**
 * 重新读取当前记录，确认仍应删除
 * @returns {Promise<{fileId, markerKey?, record, expiresAt}|null>} 需要删除的目标；
 *   record 为 null 表示记录已不存在，只需补做索引移除和标记删除（上次清理中途失败或文件已被删除）
 */
async function confirmDue(db, item, cutoff) {
    if (!item.fileId) {
        // 无法解析的标记直接丢弃
        await db.delete(item.markerKey);
        return null;
    }

    const found = await db.getWithMetadata(item.fileId);
    const record = isMissingRecord(found) ? null : found;
    const expiresAt = getExpiresAt(record?.metadata);

    if (!item.markerKey) {
        return record && expiresAt !== null && expiresAt <= cutoff
            ? { fileId: item.fileId, record, expiresAt }
            : null;
    }

    if (!record) {
        return { fileId: item.fileId, markerKey: item.markerKey, record: null };
    }
    // 标记时间不早于记录的到期时间时有效：等于到期时间，或是删除失败后移到的重试时间
    if (expiresAt === null || expiresAt > item.markerExpiresAt) {
        // 有效期被延长或改回永久，标记已失效；仍有有效期的补写正确的标记
        if (expiresAt !== null) {
            await trackFileExpiry(db, item.fileId, record.metadata);
        }
        await db.delete(item.markerKey);
        return null;
    }
    return { fileId: item.fileId, markerKey: item.markerKey, record, expiresAt };
}

// 记录仍是确认时的版本（到期时间和上传时间相同）才删除；返回是否已不存在该记录
async function deleteRecordIfUnchanged(db, target) {
    const timeStamp = target.record.metadata?.TimeStamp;
    if (!usesExpiryMarkers(db)) {
        return await db.deleteExpiredFileIfUnchanged(target.fileId, target.expiresAt, timeStamp);
    }
    // KV 没有条件写入：删除前再读一次比对，只能缩小与替换上传交错的窗口
    const current = await db.getWithMetadata(target.fileId);
    if (isMissingRecord(current)) {
        return true;
    }
    if (getExpiresAt(current.metadata) !== target.expiresAt || current.metadata?.TimeStamp !== timeStamp) {
        return false;
    }
    await db.delete(target.fileId);
    return true;
}

// 删除失败的文件推迟重试；推迟失败时下次清理照常重试
async function deferRetry(db, target, now) {
    const retryAt = now + CLEANUP_RETRY_MS;
    try {
        if (target.markerKeys.length > 0) {
            const retryKey = buildExpiryMarkerKey(retryAt, target.fileId);
            await db.put(retryKey, '');
            for (const markerKey of target.markerKeys) {
                if (markerKey !== retryKey) await db.delete(markerKey);
            }
        } else {
            await db.deferExpiredFileCleanup(target.fileId, target.expiresAt, target.record.metadata?.TimeStamp, retryAt);
        }
    } catch (error) {
        console.warn(`Failed to defer cleanup of ${target.fileId}:`, error);
    }
}

/**
 * 清理到期超过 CLEANUP_GRACE_MS 的文件：先从索引移除，再删除存储对象、记录，最后删除 KV 标记
 * 任一步失败时记录或标记仍在，下次清理会再次找到并重试；索引移除可重复执行
 * 每个文件单独处理错误，一个文件失败不影响同批其他文件
 * @returns {Promise<{deleted: number, failed: number, hasMore: boolean}>}
 */
export async function cleanupExpiredFiles(context, { now = Date.now(), limit } = {}) {
    const { env } = context;
    const db = getDatabase(env);
    const usingMarkers = usesExpiryMarkers(db);
    const batchSize = limit ?? getCleanupBatchSize(env, usingMarkers);
    const cutoff = now - CLEANUP_GRACE_MS;
    const due = await listDueFiles(db, cutoff, batchSize);
    const hasMore = due.length >= batchSize;

    let failed = 0;
    // 同一文件可能有多个到期标记（如重试标记和元数据改写后补回的原标记），按文件合并，只删除一次
    const targets = [];
    const targetsById = new Map();
    for (const item of due) {
        try {
            const target = await confirmDue(db, item, cutoff);
            const existing = target && targetsById.get(target.fileId);
            if (existing) {
                if (target.markerKey) existing.markerKeys.push(target.markerKey);
            } else if (target) {
                target.markerKeys = target.markerKey ? [target.markerKey] : [];
                targetsById.set(target.fileId, target);
                targets.push(target);
            }
        } catch (error) {
            console.error(`Expired file check failed for ${item.fileId}:`, error);
            failed++;
        }
    }

    if (targets.length === 0) {
        return { deleted: 0, failed, hasMore };
    }

    // 先移除索引：之后删除失败时文件已到期不可访问，下次清理会再次移除；
    // 反过来先删记录，索引移除失败后就没有可重试的线索
    const indexResult = await batchRemoveFilesFromIndex(context, targets.map(target => target.fileId));
    if (!indexResult.success) {
        return { deleted: 0, failed: failed + targets.length, hasMore };
    }

    let deleted = 0;
    for (const target of targets) {
        try {
            if (target.record) {
                if (!await deleteStoredFile(env, target.fileId, target.record)) {
                    throw new Error('storage channel reported a failed deletion');
                }
                if (!await deleteRecordIfUnchanged(db, target)) {
                    console.error(`Expired file ${target.fileId} was replaced during cleanup; its storage object was already deleted`);
                    failed++;
                    continue;
                }
                deleted++;
            }
        } catch (error) {
            console.error(`Expired file cleanup failed for ${target.fileId}:`, error);
            failed++;
            await deferRetry(db, target, now);
            continue;
        }

        // 标记删除失败不影响已完成的删除：下次清理发现记录已不存在，会再次移除索引并删除标记
        for (const markerKey of target.markerKeys) {
            try {
                await db.delete(markerKey);
            } catch (error) {
                console.warn(`Failed to delete expiry marker ${markerKey}, will retry:`, error);
            }
        }
    }

    return { deleted, failed, hasMore };
}

/**
 * 后台入口（Worker Cron Trigger、Docker 定时器）调用
 * 它们不经过 functions/_middleware.js，在这里显式标记部署平台
 */
export async function runExpiryCleanupJob(env, runtime, waitUntil, options = {}) {
    const context = { env: { ...env, SERVER_RUNTIME: runtime }, waitUntil };
    return await cleanupExpiredFiles(context, options);
}

/**
 * Pages 管理端请求顺带清理一批（Pages 没有定时任务，依靠它和手动清理）；Worker 和 Docker 使用各自的定时入口
 * 同一实例内限频，不额外写入状态；功能关闭时跳过，避免未使用该功能的 KV 部署消耗 list 额度
 */
export function maybeCleanupExpiredFiles(context, now = Date.now()) {
    if (context.env.SERVER_RUNTIME !== 'pages') {
        return;
    }
    if (now - lastOpportunisticRun < OPPORTUNISTIC_INTERVAL_MS) {
        return;
    }
    lastOpportunisticRun = now;
    context.waitUntil((async () => {
        const { fileExpiry } = await fetchUploadConfig(context.env);
        if (fileExpiry?.enabled) {
            await cleanupExpiredFiles(context, { now });
        }
    })().catch(error => {
        console.error('Expired files cleanup failed:', error);
    }));
}

/**
 * 统计当前可以清理的文件数：到期超过 CLEANUP_GRACE_MS，且不在删除失败后的重试等待中
 * KV 按到期标记统计并按文件去重，最多读取 1000 个标记，是近似值：续期、改为永久或删除后留下的旧标记
 * 在下次清理移除前也会计入，capped 表示标记超过单次读取上限
 * @returns {Promise<{count: number, capped: boolean}>}
 */
export async function countExpiredFiles(env, now = Date.now()) {
    const db = getDatabase(env);
    const cutoff = now - CLEANUP_GRACE_MS;
    if (!usesExpiryMarkers(db)) {
        return { count: await db.countExpiredFiles(cutoff), capped: false };
    }

    const { keys, list_complete } = await db.list({ prefix: EXPIRY_MARKER_PREFIX, limit: MAX_COUNTED_MARKERS });
    const fileIds = new Set();
    for (const { name } of keys) {
        const marker = parseExpiryMarkerKey(name);
        if (marker && marker.expiresAt > cutoff) {
            return { count: fileIds.size, capped: false };
        }
        fileIds.add(marker?.fileId ?? name);
    }
    return { count: fileIds.size, capped: list_complete === false };
}
