/**
 * GET /api/manage/dedup/scan：探测 Node 部署支持情况。
 * POST /api/manage/dedup/scan：读取已索引的 R2 文件，以 SHA-256 分组报告重复内容。
 *
 * 扫描不修改记录、索引或存储。每组建议保留有效时间戳最早的记录；
 * 整组时间戳未知时显式标注。单文件上限 100 MiB，总预算 30 秒，参数只能调低。
 * 读取异常、跳过文件、超时或索引变化均标记为不完整；其他渠道报告为不可读。
 */
import { getDatabase } from '../../../utils/databaseAdapter.js';

class ScanTimeoutError extends Error {
    constructor() {
        super('scan time budget exceeded');
        this.name = 'ScanTimeoutError';
    }
}

// 每个存储等待与剩余预算竞速:到点即抛,不再等待底层返回
async function withDeadline(run, deadline) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new ScanTimeoutError();
    let timer;
    try {
        const result = await Promise.race([
            Promise.resolve().then(run),
            new Promise((_, reject) => { timer = setTimeout(() => reject(new ScanTimeoutError()), remaining); }),
        ]);
        if (Date.now() >= deadline) throw new ScanTimeoutError();
        return result;
    } finally {
        clearTimeout(timer);
    }
}

// 缺失/零/负/非数值时间戳一律视为「未知」,不参与最早记录选取
function timestampOrUnknown(value) {
    return Number.isFinite(value) && value > 0 ? value : null;
}

// 有界流式读取:最多消费 cap 字节,越界立即返回;每个 chunk 受 deadline 约束;
// 所有退出路径(越界/超时/异常/读完)都取消底层流,不悬挂不占内存
async function readBounded(body, cap, deadline) {
    const reader = body.getReader();
    const chunks = [];
    let total = 0;
    try {
        while (true) {
            const step = await withDeadline(() => reader.read(), deadline);
            if (step.done) break;
            total += step.value?.length || 0;
            if (total > cap) return { oversized: true };
            chunks.push(step.value);
        }
        const bytes = new Uint8Array(total);
        let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
        return { bytes };
    } finally {
        void reader.cancel('dedup scan released the stream').catch(() => {});
    }
}

/**
 * 经存储绑定直接读取文件内容(管理员可信路径):
 * - R2: env.img_r2.get(id),以返回的 obj.size 为准执行大小上限,流式有界读取;
 * - 其余渠道(Telegram/S3/Discord/HuggingFace/WebDAV):返回 null 计入 readErrors
 *   (这些渠道无本地绑定,宁缺毋滥 —— 不用公开路由,避免白名单/重定向造成的假哈希)
 */
async function readRecordBytes(env, fileId, meta, maxFileBytes, deadline) {
    if (meta.Channel === 'CloudflareR2' && env.img_r2?.get) {
        let pending;
        let obj;
        try {
            obj = await withDeadline(() => {
                pending = Promise.resolve(env.img_r2.get(fileId));
                return pending;
            }, deadline);
        } catch (err) {
            // 获取超时后仍可能收到文件流，按请求结束状态释放，不再依赖系统时钟。
            if (pending) void pending.then(result => result?.body?.cancel()).catch(() => {});
            throw err;
        }
        if (!obj || !obj.body) return null;
        // 实际对象大小是权威:元数据谎报更小时以 obj.size 为准跳过
        if (Number.isFinite(obj.size) && obj.size > maxFileBytes) {
            void obj.body.cancel().catch(() => {});
            return { oversized: true };
        }
        return await readBounded(obj.body, maxFileBytes, deadline);
    }
    return null;
}

export async function onRequest(context) {
    const { request, env } = context;

    // 能力标志:只有 Node 服务端部署提供(Workers/Pages 即便绑定 D1 也没有)。
    // 判定前置且对任意方法生效:前端可经 GET 无副作用地探测能力,统一与扫描相同的判定
    if (env?.SERVER_RUNTIME !== 'node') {
        return new Response(JSON.stringify({
            error: 'duplicate scan is only available on Docker / Node.js server deployments',
            supported: false,
        }), {
            status: 501,
            headers: { 'content-type': 'application/json' },
        });
    }

    if (request.method === 'GET') {
        return new Response(JSON.stringify({ supported: true }), {
            headers: { 'content-type': 'application/json' },
        });
    }

    if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'method not allowed, use POST' }), {
            status: 405,
            headers: { 'content-type': 'application/json', 'allow': 'GET, POST' },
        });
    }

    const url = new URL(request.url);

    // 单文件大小上限:默认 100MB,只允许调低;非法值回退默认,防止 NaN 绕过保护
    const parsedMax = parseInt(url.searchParams.get('maxFileMB') || '100', 10);
    const maxFileMB = Number.isFinite(parsedMax) && parsedMax >= 1 ? Math.min(parsedMax, 100) : 100;
    const maxFileBytes = maxFileMB * 1024 * 1024;

    // 总时间预算:默认 30s,只允许调低(0 = 立即超时,便于测试);对每一次存储等待生效
    const parsedTimeout = parseInt(url.searchParams.get('timeoutMs') || '30000', 10);
    const timeoutMs = Number.isFinite(parsedTimeout) && parsedTimeout >= 0 ? Math.min(parsedTimeout, 30000) : 30000;
    const deadline = Date.now() + timeoutMs;
    let timedOut = false;

    const db = getDatabase(env);

    // ===== 读取分片索引,显式报告读取失败(含 meta 本身损坏/缺失)=====
    const INDEX_META_KEY = 'manage@index@meta';
    const INDEX_KEY = 'manage@index';
    const meta = { chunkCount: 0 };
    const chunkErrors = [];
    let metaStr = null;
    let metaReadFailed = false;
    try {
        metaStr = await withDeadline(() => db.get(INDEX_META_KEY), deadline);
    } catch (err) {
        if (err instanceof ScanTimeoutError) {
            timedOut = true;
        } else {
            console.error('dedup scan: failed to read index meta:', err);
            chunkErrors.push({ chunk: 'meta', error: String(err?.message || err) });
            metaReadFailed = true;
        }
    }
    if (!metaReadFailed && !timedOut && metaStr !== null && metaStr !== undefined) {
        try {
            const parsed = JSON.parse(metaStr);
            if (!Number.isSafeInteger(parsed?.chunkCount) || parsed.chunkCount < 0) {
                throw new Error('invalid index chunk count');
            }
            meta.chunkCount = parsed.chunkCount;
        } catch (err) {
            console.error('dedup scan: failed to parse index meta:', err);
            chunkErrors.push({ chunk: 'meta', error: String(err?.message || err) });
        }
    } else if (!metaReadFailed && !timedOut) {
        chunkErrors.push({ chunk: 'meta', error: 'index meta missing' });
    }
    const entries = [];
    for (let i = 0; i < (meta.chunkCount || 0); i++) {
        if (timedOut) break;
        try {
            const chunkStr = await withDeadline(() => db.get(`${INDEX_KEY}_${i}`), deadline);
            if (chunkStr === null || chunkStr === undefined) {
                // 缺失分片:不能当空数组静默吞掉,否则 scanned 偏少却报完整
                chunkErrors.push({ chunk: i, error: 'chunk missing' });
                continue;
            }
            const chunk = JSON.parse(chunkStr);
            if (!Array.isArray(chunk)) throw new Error('invalid index chunk');
            for (const entry of chunk) entries.push(entry);
        } catch (err) {
            if (err instanceof ScanTimeoutError) {
                timedOut = true;
                break;
            }
            console.error(`dedup scan: failed to read chunk ${i}:`, err);
            chunkErrors.push({ chunk: i, error: String(err?.message || err) });
        }
    }

    // ===== 逐条目读取记录元数据(记录缺失计入 recordErrors)=====
    const records = [];
    const recordErrors = [];
    const seen = new Set();
    for (const entry of entries) {
        if (timedOut) break;
        if (typeof entry?.id !== 'string' || !entry.id || seen.has(entry.id)) {
            recordErrors.push({ id: entry?.id ?? null, error: 'invalid or repeated index entry' });
            continue;
        }
        seen.add(entry.id);
        try {
            const rec = await withDeadline(() => db.getWithMetadata(entry.id), deadline);
            if (!rec || (rec.value === null && rec.metadata === null)) {
                recordErrors.push({ id: entry.id, error: 'record not found' });
                continue;
            }
            records.push({ id: entry.id, metadata: rec.metadata || {} });
        } catch (err) {
            if (err instanceof ScanTimeoutError) {
                timedOut = true;
                break;
            }
            recordErrors.push({ id: entry.id, error: String(err?.message || err) });
        }
    }

    // ===== 按记录元数据定位渠道并读取内容(管理员路径:直接读存储绑定,不经公开 /file/ 路由)=====
    const groups = new Map();
    const readErrors = [];
    const skippedOversized = [];
    let processed = 0;
    for (const record of records) {
        if (timedOut) break;
        processed++;
        const meta = record.metadata || {};
        // 元数据侧 fail-closed:缺失/非法按超限跳过;实际读取另有 obj.size + 有界流双保险
        const sizeBytes = Number(meta.FileSizeBytes);
        if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > maxFileBytes) {
            skippedOversized.push(record.id);
            continue;
        }
        try {
            const result = await readRecordBytes(env, record.id, meta, maxFileBytes, deadline);
            if (result === null) {
                readErrors.push({ id: record.id, error: 'content not readable via storage binding' });
                continue;
            }
            if (result.oversized) {
                skippedOversized.push(record.id);
                continue;
            }
            const digest = await withDeadline(() => crypto.subtle.digest('SHA-256', result.bytes), deadline);
            const hash = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
            if (!groups.has(hash)) groups.set(hash, []);
            groups.get(hash).push({
                id: record.id,
                name: meta.FileName || record.id,
                size: meta.FileSize || '',
                channel: meta.ChannelName || meta.Channel || '',
                timestamp: meta.TimeStamp ?? null,
            });
        } catch (err) {
            if (err instanceof ScanTimeoutError) {
                timedOut = true;
                break;
            }
            console.error(`dedup scan: failed to read ${record.id}:`, err);
            readErrors.push({ id: record.id, error: String(err?.message || err) });
        }
    }

    // 扫描只读取索引快照，不触发索引合并；待处理操作或期间的索引变化须标记不完整。
    let indexChanged = false;
    if (!timedOut) {
        try {
            const pending = await withDeadline(() => db.list({ prefix: 'manage@index@operation_', limit: 1 }), deadline);
            const currentMeta = await withDeadline(() => db.get(INDEX_META_KEY), deadline);
            indexChanged = pending.keys.length > 0 || currentMeta !== metaStr;
        } catch (err) {
            if (err instanceof ScanTimeoutError) timedOut = true;
            else chunkErrors.push({ chunk: 'meta', error: String(err?.message || err) });
        }
    }

    // ===== 分组:显式按有效时间戳升序选建议保留(索引为倒序,不能取 items[0];
    // 缺失/非法时间戳不参与「最早」,排组内末位,整组无效时标注 keepTimestampUnknown)=====
    const duplicateGroups = [];
    let redundantCopies = 0;
    for (const [hash, items] of groups) {
        if (items.length < 2) continue;
        const sorted = [...items].sort((a, b) => {
            const ta = timestampOrUnknown(a.timestamp);
            const tb = timestampOrUnknown(b.timestamp);
            if (ta === null && tb === null) return a.id < b.id ? -1 : 1;
            if (ta === null) return 1;
            if (tb === null) return -1;
            return ta - tb;
        });
        const group = {
            sha256: hash,
            count: items.length,
            keep: sorted[0],
            duplicates: sorted.slice(1),
        };
        if (timestampOrUnknown(sorted[0].timestamp) === null) group.keepTimestampUnknown = true;
        duplicateGroups.push(group);
        redundantCopies += items.length - 1;
    }

    // 完整性 = 未超时 且 分片/记录/内容三类错误与超限跳过全部为零:
    // 任何文件未能真正读取,都不得报「完整扫描」(哪怕结论恰好也是零重复)
    const complete = !timedOut && !indexChanged
        && chunkErrors.length === 0
        && recordErrors.length === 0
        && readErrors.length === 0
        && skippedOversized.length === 0;

    return new Response(JSON.stringify({
        complete,
        timedOut,
        indexChanged,
        chunkErrors,
        scanned: processed,
        recordErrors,
        readErrors,
        skippedOversized,
        readableChannels: ['CloudflareR2'],
        totalGroups: groups.size,
        duplicateGroups,
        redundantCopies,
        scannedAt: new Date().toISOString(),
    }, null, 2), {
        headers: { 'content-type': 'application/json' },
    });
}
