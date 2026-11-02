import { getDatabase } from './databaseAdapter.js';
import { isFixedId } from './fileIdentity.js';

export const TRASH_PREFIX = 'manage@trash@';
export const trashError = (message, status = 409) => Object.assign(new Error(message), { status });
const locks = new Set();

export async function saveTrashEntry(db, entry) {
    // Small KV list metadata avoids fetching recovery payloads for every list.
    // D1 listSettings already returns values. Long Unicode paths use that fallback.
    const metadata = { TrashPath: entry.path, TrashKind: entry.kind };
    const options = new TextEncoder().encode(JSON.stringify(metadata)).length <= 1000 ? { metadata } : {};
    await db.put(TRASH_PREFIX + entry.id, JSON.stringify(entry), options);
}

// KV has no distributed compare-and-swap. Serialize local requests and recheck
// records before transitions; failed purges remain locked against restoration.
export async function withTrashLock(origin, id, callback) {
    const key = origin + '/' + id;
    if (locks.has(key)) throw trashError('该项目正在处理中，请稍后重试');
    locks.add(key);
    try { return await callback(); } finally { locks.delete(key); }
}

export async function trashPage(db, cursor, limit = 100) {
    const page = await db.list({ prefix: TRASH_PREFIX, limit, ...(cursor ? { cursor } : {}) });
    const entries = (await Promise.all((page.keys || []).map(async key => {
        const value = key.value ?? await db.get(key.name);
        return value ? JSON.parse(value) : null;
    }))).filter(Boolean);
    return { entries, cursor: page.list_complete === false ? page.cursor : null };
}

export async function hiddenTrashPaths(db) {
    const paths = new Set(); let cursor;
    do {
        const page = await db.list({ prefix: TRASH_PREFIX, limit: 1000, ...(cursor ? { cursor } : {}) });
        for (const key of page.keys || []) {
            if (key.metadata?.TrashPath) {
                if (key.metadata.TrashKind !== 'folder') paths.add(key.metadata.TrashPath);
            }
            else {
                const value = key.value ?? await db.get(key.name);
                if (value) { const entry = JSON.parse(value); if (entry.kind !== 'folder') paths.add(entry.path); }
            }
        }
        cursor = page.list_complete === false ? page.cursor : null;
    } while (cursor);
    return paths;
}

export async function moveFileToTrash(db, path) {
    if (!path || path.startsWith('manage@')) throw trashError('文件不存在', 404);
    const record = await db.ensureFileIdentity(path);
    if (!record?.metadata?.Channel || !isFixedId(record.metadata.FixedId)) throw trashError('文件不存在', 404);
    const id = record.metadata.FixedId;
    if (await db.get(TRASH_PREFIX + id)) throw trashError('该文件已有回收站记录，请先处理该记录');
    const entry = { id, kind: 'file', path, deletedAt: Date.now(), state: 'deleted', record };
    // Persist the recovery copy before removing the live catalog record.
    // Storage bytes and identity aliases are untouched by soft deletion.
    await saveTrashEntry(db, entry);
    try {
        if (JSON.stringify(await db.getWithMetadata(path)) !== JSON.stringify(record)) throw trashError('文件已变化，请重试');
        await db.delete(path);
    } catch (error) {
        if ((await db.getWithMetadata(path))?.metadata?.FixedId === id) await db.delete(TRASH_PREFIX + id);
        throw error;
    }
    return entry;
}

export async function invalidateTrashCaches(context, path) {
    // Keep index/list imports independent of the legacy cache module graph.
    const { purgeCFCache, purgePublicFileListCache, purgeRandomFileListCache } = await import('./purgeCache.js');
    const url = new URL(context.request.url);
    const parts = path.split('/').slice(0, -1);
    const dirs = ['', ...parts.map((_, i) => parts.slice(0, i + 1).join('/'))];
    return await Promise.all([
        purgeCFCache(context.env, `${url.origin}/file/${path.split('/').map(encodeURIComponent).join('/')}`),
        purgePublicFileListCache(url.origin, ...dirs),
        purgeRandomFileListCache(url.origin, ...dirs)
    ]);
}

export async function loadTrashEntry(env, id) {
    if (!/^(f_[a-f0-9]{32}|d_[a-f0-9-]{36})$/.test(id)) throw trashError('回收站项目不存在', 404);
    const db = getDatabase(env);
    const value = await db.get(TRASH_PREFIX + id);
    const entry = value && JSON.parse(value);
    if (!entry || entry.state === 'purged') throw trashError('回收站项目不存在', 404);
    return { db, entry };
}
