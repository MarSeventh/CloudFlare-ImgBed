import { getDatabase } from '../../../utils/databaseAdapter.js';
import { NOTES_PREFIX } from '../../../utils/fileNotes.js';
import { authenticate, AUTH_SCOPE } from '../../../utils/auth/authCore.js';
import { addFileToIndex } from '../../../utils/indexManager.js';
import { registerEntry } from '../../../utils/organizationCatalog.js';
import { removeStoredContent, storageIdentity } from '../../../utils/replacementStorage.js';
import { TRASH_PREFIX, saveTrashEntry, trashPage, trashSharesStorage, loadTrashEntry, withTrashLock, invalidateTrashCaches, trashError } from '../../../utils/trash.js';

const reply = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function onRequest(context) {
    const { env, request } = context;
    const url = new URL(request.url);
    const raw = Array.isArray(context.params.path) ? context.params.path.join('/') : String(context.params.path || '');
    const [id, action, extra] = raw.split('/');
    const listing = request.method === 'GET' && !id;
    const restore = request.method === 'POST' && action === 'restore' && !extra;
    const purge = request.method === 'DELETE' && id && !action;
    if (!listing && !restore && !purge) return reply({ success: false, error: 'Method or route not allowed' }, 405);
    const auth = await authenticate({ env, request, requiredPermission: listing ? 'list' : restore ? 'delete' : 'purge', authScope: AUTH_SCOPE.ADMIN });
    if (!auth.authorized) return reply({ success: false, error: '权限不足' }, 401);
    try {
        if (listing) {
            const page = await trashPage(getDatabase(env), url.searchParams.get('cursor'), 100);
            return reply({ success: true, cursor: page.cursor, files: page.entries.filter(e => e.state !== 'purged').map(e => ({
                id: e.id, path: e.path, kind: e.kind, deletedAt: e.deletedAt, state: e.state,
                name: e.record?.metadata?.FileName || e.path.split('/').pop(),
                type: e.record?.metadata?.FileType || '', size: e.record?.metadata?.FileSizeBytes || 0,
                channel: e.record?.metadata?.Channel || ''
            })) });
        }
        return await withTrashLock(url.origin, id, async () => {
            const { db, entry } = await loadTrashEntry(env, id);
            const current = await db.getWithMetadata(entry.path);
            const alreadyRestored = restore && entry.state === 'deleted' && current?.metadata?.FixedId === id;
            if (entry.kind === 'file' && current?.metadata && !alreadyRestored) throw trashError('原路径已存在文件，不能覆盖或永久删除');
            if (entry.kind === 'file') {
                const livePath = await db.get('manage@identity@id@' + id);
                if (!alreadyRestored && livePath && (await db.getWithMetadata(livePath))?.metadata?.FixedId === id) throw trashError('该文件仍在文件库中，不能处理回收站副本');
            }
            if (restore) {
                if (entry.state !== 'deleted') throw trashError('该项目已开始永久删除，不能恢复；请重试永久删除');
                if (entry.kind === 'folder') {
                    for (const folder of entry.folders) await registerEntry(db, 'folder', folder);
                } else {
                    if (!alreadyRestored) await db.put(entry.path, entry.record.value, { metadata: entry.record.metadata });
                    if (!(await addFileToIndex(context, entry.path, alreadyRestored ? current.metadata : entry.record.metadata)).success) {
                        await db.delete(TRASH_PREFIX + id);
                        return reply({ success: true, warning: '已恢复文件，索引更新失败，请重建索引' });
                    }
                }
                await db.delete(TRASH_PREFIX + id);
                await invalidateTrashCaches(context, entry.path);
                return reply({ success: true, restored: true, path: entry.path });
            }
            // Only a recovery record can reach physical deletion, never a live ID.
            const storageDeleted = ['CloudflareR2', 'S3', 'WebDAV', 'Discord', 'HuggingFace'].includes(entry.record?.metadata?.Channel);
            if (entry.kind === 'file') {
                // Channels without storage cleanup cannot free shared bytes; skip the scans.
                if (storageDeleted) {
                    const identity = storageIdentity(entry.path, entry.record);
                    let cursor;
                    do {
                        // Active records: list metadata suffices except for chunk lists (in the value).
                        const page = await db.list({ limit: 1000, ...(cursor ? { cursor } : {}) });
                        for (const key of page.keys || []) {
                            if (key.metadata?.Channel !== entry.record.metadata.Channel) continue;
                            const active = key.metadata.IsChunked ? await db.getWithMetadata(key.name) : { metadata: key.metadata, value: '' };
                            if (active?.metadata && storageIdentity(key.name, active) === identity) {
                                throw trashError('存储内容仍被文件库引用，不能永久删除');
                            }
                        }
                        if (page.list_complete === false && !page.cursor) throw new Error('Incomplete storage reference scan');
                        cursor = page.list_complete === false ? page.cursor : null;
                    } while (cursor);
                }
                // Two recovery records may share imported/legacy backing content.
                // Remove only this record until the last reference is purged.
                const sharedRecovery = storageDeleted && await trashSharesStorage(db, id, entry.path, entry.record);
                entry.state = 'purging';
                await saveTrashEntry(db, entry);
                if (!sharedRecovery) await removeStoredContent(env, entry.path, entry.record);
                else entry.sharedRecovery = true;
            }
            // Minimal tombstones suppress stale indexes and contain no recovery data.
            if (entry.kind === 'file') await db.delete(NOTES_PREFIX + id);
            await saveTrashEntry(db, { id, path: entry.path, kind: entry.kind, state: 'purged', purgedAt: Date.now() });
            await invalidateTrashCaches(context, entry.path);
            return reply({ success: true, purged: true, storageDeleted: storageDeleted && !entry.sharedRecovery });
        });
    } catch (error) {
        return reply({ success: false, error: error.status ? error.message : '操作失败，回收站记录已保留；请检查存储配置后重试' }, error.status || 500);
    }
}
