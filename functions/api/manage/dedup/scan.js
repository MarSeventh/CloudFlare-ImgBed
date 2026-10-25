/**
 * 存量重复文件扫描(只读,仅 Node 服务端部署)
 *
 * POST /api/manage/dedup/scan
 *
 * 遍历分片索引,按渠道逐文件读取内容计算 SHA-256,按内容分组报告重复。
 * 纯信息性:不删除、不改链接;每组建议保留时间戳最早的一条。
 *
 * 部署限制:依赖 SERVER_RUNTIME === 'node' 能力标志(仅 Docker / Node.js
 * 服务端部署提供;Workers / Pages 包括绑定 D1 的场景均返回 501)。
 * 能力探测:GET 请求返回 {supported} 而不执行扫描,供前端统一禁用/隐藏入口。
 *
 * 有界执行:单文件大小上限(默认 100MB,只可经 ?maxFileMB 调低,非法值回退
 * 默认),元数据缺失或非法的记录按超限处理计入 skippedOversized;总时间预算
 * (默认 30s,可经 ?timeoutMs 调低)超限停止扫描并标注 timedOut:true;
 * 响应带完整性与失败范围,分片读取失败显式上报。
 */
import { getDatabase } from '../../../utils/databaseAdapter.js';

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

    // 总时间预算:默认 30s,只允许调低(0 = 立即超时,便于测试);超限停止扫描并标注 timedOut
    const parsedTimeout = parseInt(url.searchParams.get('timeoutMs') || '30000', 10);
    const timeoutMs = Number.isFinite(parsedTimeout) && parsedTimeout >= 0 ? Math.min(parsedTimeout, 30000) : 30000;
    const deadline = Date.now() + timeoutMs;
    let timedOut = false;

    const db = getDatabase(env);

    // ===== 读取分片索引,显式报告读取失败(含 meta 本身损坏/缺失)=====
    const INDEX_META_KEY = 'manage@index@meta';
    const INDEX_KEY = 'manage@index';
    const metaStr = await db.get(INDEX_META_KEY);
    const meta = { chunkCount: 0 };
    const chunkErrors = [];
    if (metaStr !== null && metaStr !== undefined) {
        try {
            const parsed = JSON.parse(metaStr);
            meta.chunkCount = Number.isFinite(parsed?.chunkCount) ? parsed.chunkCount : 0;
        } catch (err) {
            console.error('dedup scan: failed to parse index meta:', err);
            chunkErrors.push({ chunk: 'meta', error: String(err?.message || err) });
        }
    } else {
        chunkErrors.push({ chunk: 'meta', error: 'index meta missing' });
    }
    const entries = [];
    for (let i = 0; i < (meta.chunkCount || 0); i++) {
        try {
            const chunkStr = await db.get(`${INDEX_KEY}_${i}`);
            if (chunkStr === null || chunkStr === undefined) {
                // 缺失分片:不能当空数组静默吞掉,否则 scanned 偏少却报完整
                chunkErrors.push({ chunk: i, error: 'chunk missing' });
                continue;
            }
            const chunk = JSON.parse(chunkStr);
            entries.push(...chunk);
        } catch (err) {
            console.error(`dedup scan: failed to read chunk ${i}:`, err);
            chunkErrors.push({ chunk: i, error: String(err?.message || err) });
        }
    }

    // ===== 逐条目读取记录元数据(记录缺失计入 recordErrors)=====
    const records = [];
    const recordErrors = [];
    for (const entry of entries) {
        try {
            const rec = await db.getWithMetadata(entry.id);
            if (rec === null || rec === undefined) {
                recordErrors.push({ id: entry.id, error: 'record not found' });
                continue;
            }
            records.push({ id: entry.id, metadata: rec.metadata || entry.metadata || {} });
        } catch (err) {
            recordErrors.push({ id: entry.id, error: String(err?.message || err) });
        }
    }

    // ===== 按记录元数据定位渠道并读取内容(管理员路径:直接读存储绑定,不经公开 /file/ 路由)=====
    const groups = new Map();
    const readErrors = [];
    const skippedOversized = [];
    for (const record of records) {
        if (Date.now() >= deadline) {
            // 时间预算耗尽:停止扫描,已扫部分照常返回,显式标注
            timedOut = true;
            break;
        }
        const meta = record.metadata || {};
        // 大小上限 fail-closed:元数据缺失/非法时按超限跳过,不做无界读取
        const sizeBytes = Number(meta.FileSizeBytes);
        if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > maxFileBytes) {
            skippedOversized.push(record.id);
            continue;
        }
        try {
            const bytes = await readRecordBytes(env, record.id, meta);
            if (bytes === null) {
                readErrors.push({ id: record.id, error: 'content not readable via storage binding' });
                continue;
            }
            const digest = await crypto.subtle.digest('SHA-256', bytes);
            const hash = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
            if (!groups.has(hash)) groups.set(hash, []);
            groups.get(hash).push({
                id: record.id,
                name: meta.FileName || record.id,
                size: meta.FileSize || '',
                channel: meta.ChannelName || meta.Channel || '',
                timestamp: meta.TimeStamp || 0,
            });
        } catch (err) {
            console.error(`dedup scan: failed to read ${record.id}:`, err);
            readErrors.push({ id: record.id, error: String(err?.message || err) });
        }
    }

    // ===== 分组:每组显式选时间戳最早的一条为建议保留(索引为倒序,不能取 items[0])=====
    const duplicateGroups = [];
    let redundantCopies = 0;
    for (const [hash, items] of groups) {
        if (items.length < 2) continue;
        const sorted = [...items].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        duplicateGroups.push({
            sha256: hash,
            count: items.length,
            keep: sorted[0],
            duplicates: sorted.slice(1),
        });
        redundantCopies += items.length - 1;
    }

    // 完整性 = 分片全部读齐 且 未超时(超时发生在记录循环之后,必须在响应前定案)
    return new Response(JSON.stringify({
        complete: chunkErrors.length === 0 && !timedOut,
        timedOut,
        chunkErrors,
        scanned: records.length,
        recordErrors,
        readErrors,
        skippedOversized,
        totalGroups: groups.size,
        duplicateGroups,
        redundantCopies,
        scannedAt: new Date().toISOString(),
    }, null, 2), {
        headers: { 'content-type': 'application/json' },
    });
}

/**
 * 经存储绑定直接读取文件内容(管理员可信路径):
 * - R2: env.img_r2.get(id).body
 * - 其余渠道(Telegram/S3/Discord/HuggingFace/WebDAV):返回 null 计入 readErrors
 *   (这些渠道无本地绑定,宁缺毋滥 —— 不用公开路由,避免白名单/重定向造成的假哈希)
 */
async function readRecordBytes(env, fileId, meta) {
    if (meta.Channel === 'CloudflareR2' && env.img_r2?.get) {
        const obj = await env.img_r2.get(fileId);
        if (!obj || !obj.body) return null;
        return new Uint8Array(await new Response(obj.body).arrayBuffer());
    }
    return null;
}
