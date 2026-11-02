import { acquireFileLocks } from '../../../utils/replacementLock.js';
import { getDatabase } from '../../../utils/databaseAdapter.js';
import { resolveFilePath } from '../../../utils/fileIdentity.js';
import { authenticate, AUTH_SCOPE } from '../../../utils/auth/authCore.js';
import { catalogEntries, updateFolderEntries, validFolder } from '../../../utils/organizationCatalog.js';
import { removeFileFromIndex } from '../../../utils/indexManager.js';
import { saveTrashEntry, moveFileToTrash, withTrashLock, invalidateTrashCaches, trashError } from '../../../utils/trash.js';

const reply = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function onRequest(context) {
    const { request, env } = context;
    if (!['GET', 'DELETE'].includes(request.method)) return reply({ success: false, error: 'Method not allowed' }, 405);
    const auth = await authenticate({ env, request, requiredPermission: 'delete', authScope: AUTH_SCOPE.ADMIN });
    if (!auth.authorized) return reply({ success: false, error: '需要文件删除权限' }, 401);
    try {
        const db = getDatabase(env), url = new URL(request.url);
        const raw = Array.isArray(context.params.path) ? context.params.path.join('/') : String(context.params.path || '');
        const path = decodeURIComponent(raw);
        const deleted = [], failed = [], warnings = [];
        let conflicted = false;
        const remove = async filePath => {
            const release = acquireFileLocks(env, [filePath]);
            try {
                await withTrashLock(url.origin, filePath, () => moveFileToTrash(db, filePath));
                deleted.push(filePath);
                if (!(await removeFileFromIndex(context, filePath)).success) warnings.push('索引刷新失败，请稍后重建索引');
                await invalidateTrashCaches(context, filePath);
            } finally { release(); }
        };
        if (url.searchParams.get('folder') === 'true') {
            if (!validFolder(path)) throw trashError('目录路径无效', 400);
            // Internal enumeration does not require an additional list grant.
            let cursor;
            do {
                const page = await db.list({ prefix: path + '/', limit: 1000, ...(cursor ? { cursor } : {}) });
                for (const key of page.keys || []) {
                    if (!key.name.startsWith(path + '/') || !key.metadata?.Channel || key.metadata.TimeStamp == null) continue;
                    try { await remove(key.name); } catch (error) { failed.push(key.name); if (error.status === 409) conflicted = true; }
                }
                cursor = page.list_complete === false ? page.cursor : null;
            } while (cursor);
            if (!failed.length) {
                const folders = (await catalogEntries(db, 'folder')).map(e => e.name)
                    .filter(name => name === path || name.startsWith(path + '/'));
                if (folders.length) {
                    const id = 'd_' + crypto.randomUUID();
                    await saveTrashEntry(db, { id, kind: 'folder', path, folders, deletedAt: Date.now(), state: 'deleted' });
                    await updateFolderEntries(db, path);
                }
            }
            return reply({ success: !failed.length, deleted, failed, warnings, trashed: true }, conflicted ? 409 : 200);
        }
        const resolved = await resolveFilePath(db, path);
        if (!resolved) throw trashError('文件不存在', 404);
        await remove(resolved);
        return reply({ success: true, fileId: resolved, trashed: true, warnings });
    } catch (error) {
        return reply({ success: false, error: error.status ? error.message : '移入回收站失败，请刷新后重试' }, error.status || 500);
    }
}
