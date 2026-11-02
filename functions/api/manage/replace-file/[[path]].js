import { getDatabase } from '../../../utils/databaseAdapter.js';
import { isFixedId, resolveFilePath } from '../../../utils/fileIdentity.js';
import { authenticate, AUTH_SCOPE } from '../../../utils/auth/authCore.js';
import { addFileToIndex } from '../../../utils/indexManager.js';
import { invalidateTrashCaches } from '../../../utils/trash.js';
import { cleanPersistedMetadata } from '../../../utils/metadata/metadataSecurity.js';
import { removeStoredContent } from '../../../utils/replacementStorage.js';
import { acquireFileLocks } from '../../../utils/replacementLock.js';
import { RAW_REPLACEMENT_LIMIT, stageRawReplacement, oldContentIsShared } from '../../../utils/rawReplacementStorage.js';

const reply = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const signature = record => JSON.stringify(record);
const mime = type => type?.split(';')[0].trim().toLowerCase();

// Bound the entire multipart body even when Content-Length is absent/untrusted.
async function readForm(request) {
    const limit = RAW_REPLACEMENT_LIMIT + 64 * 1024;
    if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('multipart/form-data;')) throw fail('需要 multipart/form-data');
    if (Number(request.headers.get('Content-Length')) > limit) throw fail('文件最大为 20 MiB', 413);
    const reader = request.body?.getReader();
    if (!reader) throw fail('缺少上传文件');
    const parts = []; let size = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > limit) { await reader.cancel(); throw fail('文件最大为 20 MiB', 413); }
            parts.push(value);
        }
    } finally { reader.releaseLock(); }
    try {
        return await new Response(new Blob(parts), { headers: { 'Content-Type': request.headers.get('Content-Type') } }).formData();
    } catch { throw fail('multipart 表单格式错误'); }
}

export async function onRequest(context) {
    const { request, env } = context;
    if (!['GET', 'POST'].includes(request.method)) return reply({ success: false, message: 'Method not allowed' }, 405);
    let staged, release, writeStarted = false;
    try {
        const auth = await authenticate({ env, request, requiredPermission: 'replace', authScope: AUTH_SCOPE.ADMIN });
        if (!auth.authorized) return reply({ success: false, message: '需要内容替换权限' }, 401);
        if (new URL(request.url).search) throw fail('参数必须放在表单中；不支持 URL 参数、远程地址或 dryRun');
        const raw = Array.isArray(context.params.path) ? context.params.path.join('/') : String(context.params.path || '');
        if (!isFixedId(raw)) throw fail('请使用目标文件的固定 ID');
        const db = getDatabase(env);
        if (request.method === 'GET') {
            const path = await resolveFilePath(db, raw);
            if (!path || path.endsWith('/') || path.startsWith('manage@')) throw fail('目标文件不存在', 404);
            release = acquireFileLocks(env, [path]);
            const record = await db.getWithMetadata(path);
            if (!record?.metadata?.Channel || record.metadata.FixedId !== raw || await resolveFilePath(db, raw) !== path) throw fail('目标文件不存在', 404);
            // A replace grant does not imply browsing, notes, tags or credentials.
            return reply({ id: raw, path, contentVersion: record.metadata.ContentVersion || '', type: record.metadata.FileType || '' });
        }
        const form = await readForm(request);
        const allowed = new Set(['file', 'expectedPath', 'expectedVersion']);
        for (const key of form.keys()) if (!allowed.has(key) || form.getAll(key).length !== 1) throw fail('仅支持单个 file、expectedPath、expectedVersion；不支持 dryRun 或远程地址');
        const file = form.get('file'), expectedPath = form.get('expectedPath'), expectedVersion = form.get('expectedVersion');
        if (!(file instanceof Blob) || typeof file.name !== 'string') throw fail('file 必须是本地文件内容');
        if (file.size > RAW_REPLACEMENT_LIMIT) throw fail('文件最大为 20 MiB', 413);
        if (typeof expectedPath !== 'string' || typeof expectedVersion !== 'string') throw fail('必须提供 expectedPath 和 expectedVersion（初始版本为空字符串）');
        const path = await resolveFilePath(db, raw);
        if (!path || path.endsWith('/') || path.startsWith('manage@')) throw fail('目标文件不存在', 404);
        if (expectedPath !== path) throw fail('文件位置已变化，请刷新后重试', 409);
        release = acquireFileLocks(env, [path]);
        if (await resolveFilePath(db, raw) !== path) throw fail('文件位置已变化，请刷新后重试', 409);
        const target = await db.getWithMetadata(path);
        if (!target?.metadata?.Channel || target.metadata.FixedId !== raw) throw fail('目标文件不存在', 404);
        if (expectedVersion !== (target.metadata.ContentVersion || '')) throw fail('文件内容已变化，请刷新后重试', 409);
        if (!mime(file.type) || mime(file.type) !== mime(target.metadata.FileType)) throw fail('上传文件的 MIME 类型必须与目标相同');
        staged = await stageRawReplacement(env, path, target, file);
        if (await resolveFilePath(db, raw) !== path || signature(await db.getWithMetadata(path)) !== signature(target)) {
            throw fail('文件已被其他操作修改，请刷新后重试', 409);
        }
        const metadata = cleanPersistedMetadata(staged.metadata);
        metadata.ContentVersion = crypto.randomUUID();
        metadata.ContentUpdatedAt = Date.now();
        // A rejected DB promise can follow an applied write (or identity alias
        // update). Never roll back staged bytes or clean old bytes after this.
        writeStarted = true;
        const result = await db.put(path, staged.value, { metadata });
        if (result?.success === false) throw new Error('Database rejected write');
        const warnings = [];
        try {
            if (!(await addFileToIndex(context, path, metadata)).success) throw new Error('Index update failed');
        } catch { warnings.push('文件已替换，列表索引刷新失败，请稍后刷新'); }
        try {
            const cacheResults = await invalidateTrashCaches(context, path);
            if (cacheResults.includes('unconfigured')) warnings.push('未配置 CDN 缓存清理，原链接可能暂时返回旧内容；浏览器已有缓存无法远程清除');
            if (cacheResults.includes(false)) throw new Error('Cache purge failed');
        }
        catch { warnings.push('文件已替换，缓存刷新失败'); }
        try {
            if (await oldContentIsShared(env, path, target, { value: staged.value, metadata })) {
                warnings.push('文件已替换，旧内容仍被其他记录引用，已保留');
            } else await removeStoredContent(env, path, target);
        } catch { warnings.push('文件已替换，旧存储内容未能安全清理，已保留'); }
        return reply({ success: true, targetPath: path, fixedId: raw, contentVersion: metadata.ContentVersion,
            contentUpdatedAt: metadata.ContentUpdatedAt, warnings });
    } catch (error) {
        const warnings = [...(error.warnings || [])];
        if (staged && !writeStarted) warnings.push(...await staged.rollback());
        return reply({ success: false, message: writeStarted ? '数据库写入结果不确定，请刷新核对目标后再操作；新旧内容均已保留' :
            error.status ? error.message : '替换失败，目标未更新', warnings,
            ...(writeStarted ? { outcome: 'unknown', stagedRetained: true } : {}) }, error.status || 500);
    } finally { release?.(); }
}
