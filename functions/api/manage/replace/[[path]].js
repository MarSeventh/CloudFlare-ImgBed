import { acquireFileLocks } from '../../../utils/replacementLock.js';
import { getDatabase } from '../../../utils/databaseAdapter.js';
import { moveFileToTrash } from '../../../utils/trash.js';
import { resolveFilePath } from '../../../utils/fileIdentity.js';
import { authenticate, AUTH_SCOPE } from '../../../utils/auth/authCore.js';
import { addFileToIndex, removeFileFromIndex } from '../../../utils/indexManager.js';
import { purgeCFCache, purgePublicFileListCache, purgeRandomFileListCache } from '../../../utils/purgeCache.js';
import { cleanPersistedMetadata } from '../../../utils/metadata/metadataSecurity.js';
import { cloneReplacementContent, removeStoredContent, storageIdentity, supportsReplacement } from '../../../utils/replacementStorage.js';

const reply = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const signature = record => JSON.stringify(record);

export async function onRequest(context) {
    const { env, request } = context;
    if (request.method !== 'POST') return reply({ success: false, message: 'Method not allowed' }, 405);
    let snapshot; let committed = false; let release;
    try {
        const auth = await authenticate({ env, request, requiredPermission: 'replace', authScope: AUTH_SCOPE.ADMIN });
        if (!auth.authorized) return reply({ success: false, message: '需要内容替换权限' }, 401);
        const body = await request.json().catch(() => { throw fail('请求格式错误'); });
        if (!body || typeof body.target !== 'string' || !body.target || typeof body.deleteSource !== 'boolean') {
            throw fail('请选择目标文件并明确是否删除源文件');
        }
        if (body.deleteSource) {
            const deletion = await authenticate({ env, request, requiredPermission: 'delete', authScope: AUTH_SCOPE.ADMIN });
            if (!deletion.authorized) return reply({ success: false, message: '删除源文件需要额外的删除权限' }, 403);
        }
        const db = getDatabase(env);
        const raw = Array.isArray(context.params.path) ? context.params.path.join('/') : String(context.params.path || '');
        const sourcePath = await resolveFilePath(db, decodeURIComponent(raw));
        const targetPath = await resolveFilePath(db, body.target);
        if (!sourcePath || !targetPath || sourcePath.endsWith('/') || targetPath.endsWith('/')) throw fail('文件不存在', 404);
        if (sourcePath === targetPath) throw fail('源文件与被替换文件不能相同');
        release = acquireFileLocks(env, [sourcePath, targetPath]);
        if (!(await db.getWithMetadata(sourcePath))?.metadata || !(await db.getWithMetadata(targetPath))?.metadata) throw fail('文件不存在', 404);
        if (body.expectedSourcePath !== sourcePath || body.expectedTargetPath !== targetPath) throw fail('文件位置已变化，请重新选择', 409);
        if (await resolveFilePath(db, decodeURIComponent(raw)) !== sourcePath || await resolveFilePath(db, body.target) !== targetPath) throw fail('文件位置已变化，请重新选择', 409);
        const source = await db.ensureFileIdentity(sourcePath);
        const target = await db.ensureFileIdentity(targetPath);
        if (!source?.metadata?.FixedId || !target?.metadata?.FixedId) throw fail('文件不存在或不是可替换的文件', 404);
        if (source.metadata.FixedId === target.metadata.FixedId) throw fail('源文件与被替换文件不能相同');
        if (!supportsReplacement(source.metadata)) throw fail('此外链或旧版渠道不支持作为替换源，请先上传文件');
        const sourceType = source.metadata.FileType?.split(';')[0].trim().toLowerCase();
        const targetType = target.metadata.FileType?.split(';')[0].trim().toLowerCase();
        if (!sourceType || sourceType !== targetType) throw fail('请选择相同文件类型的目标，例如 PNG 替换 PNG、PDF 替换 PDF');
        // A stale file picker must not overwrite a newer replacement.
        if ((body.sourceVersion || '') !== (source.metadata.ContentVersion || '') ||
            (body.targetVersion || '') !== (target.metadata.ContentVersion || '')) throw fail('文件内容已变化，请重新选择', 409);

        snapshot = await cloneReplacementContent(env, sourcePath, source);
        if (signature(await db.getWithMetadata(sourcePath)) !== signature(source) ||
            signature(await db.getWithMetadata(targetPath)) !== signature(target)) throw fail('文件已被其他操作修改，请重试', 409);
        const metadata = cleanPersistedMetadata(snapshot.metadata);
        for (const key of ['FixedId', 'FileName', 'Directory', 'Tags', 'NamePolicyVersion', 'TimeStamp', 'UploadIP', 'UploadAddress', 'ListType']) {
            delete metadata[key];
            if (key in target.metadata) metadata[key] = structuredClone(target.metadata[key]);
        }
        metadata.ContentVersion = crypto.randomUUID();
        metadata.ContentUpdatedAt = Date.now();
        // From this point on, an uncertain database failure must not trigger
        // deletion of the staged bytes: the record may already be published.
        committed = true;
        await db.put(targetPath, snapshot.value, { metadata });
        const warnings = [];
        let sourceDeleted = false;
        if (body.deleteSource) {
            try {
                if (signature(await db.getWithMetadata(sourcePath)) !== signature(source)) throw new Error('源文件已变化');
                // Preserve the source bytes and identity in the recycle bin.
                await moveFileToTrash(db, sourcePath);
                sourceDeleted = true;
            } catch { warnings.push('目标已替换，但源文件未删除，请检查后重试删除'); }
        }
        try {
            if (!(await addFileToIndex(context, targetPath, metadata)).success) throw new Error('Index update failed');
            if (sourceDeleted && !(await removeFileFromIndex(context, sourcePath)).success) throw new Error('Index update failed');
        } catch { warnings.push('文件已更新，列表索引刷新失败，请稍后刷新'); }
        const url = new URL(request.url);
        await purgeCFCache(env, `${url.origin}/file/${targetPath.split('/').map(encodeURIComponent).join('/')}`);
        if (sourceDeleted) await purgeCFCache(env, `${url.origin}/file/${sourcePath.split('/').map(encodeURIComponent).join('/')}`);
        const dirs = [...new Set([sourcePath, targetPath].map(path => path.split('/').slice(0, -1).join('/')))];
        await purgeRandomFileListCache(url.origin, ...dirs);
        await purgePublicFileListCache(url.origin, ...dirs);
        // Skip old-target cleanup when it aliases the retained source's storage.
        if (storageIdentity(targetPath, target) !== storageIdentity(sourcePath, source)) {
            try { await removeStoredContent(env, targetPath, target); }
            catch { warnings.push('目标已替换，旧内容在存储服务中的清理失败'); }
        }
        return reply({ success: true, targetPath, fixedId: metadata.FixedId, sourceDeleted, sourceTrashed: sourceDeleted, warnings });
    } catch (error) {
        if (snapshot && !committed) await snapshot.rollback();
        console.error('File replacement failed:', error.message);
        return reply({ success: false, message: error.status ? error.message : '替换失败，请刷新检查文件状态后重试' }, error.status || 500);
    } finally { release?.(); }
}
