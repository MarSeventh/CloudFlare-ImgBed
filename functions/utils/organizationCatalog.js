import { validateFileName } from './fileNaming.js';
const PREFIX = 'manage@organization@';
export function validFolder(path, allowRoot = false) {
    return typeof path === 'string' && ((allowRoot && path === '') ||
        (path.length <= 600 && path.split('/').every(part => validateFileName(part) && !part.startsWith('manage@') && !part.startsWith('chunk_'))));
}
export async function catalogEntries(db, type) {
    const entries = []; let cursor;
    do {
        const page = await db.list({ prefix: PREFIX + type + '@', limit: 1000, ...(cursor ? { cursor } : {}) });
        for (const key of page.keys || []) {
            const value = await db.get(key.name);
            if (value) entries.push(JSON.parse(value));
        }
        cursor = page.list_complete ? null : page.cursor;
    } while (cursor);
    return entries;
}
export async function registerEntry(db, type, name) {
    await db.put(PREFIX + type + '@' + encodeURIComponent(name), JSON.stringify({ name }));
}
export async function storedSubfolders(db, directory) {
    const prefix = directory ? directory.replace(/\/$/, '') + '/' : '';
    const folders = await catalogEntries(db, 'folder');
    return [...new Set(folders.filter(f => f.name.startsWith(prefix) && f.name !== prefix.slice(0,-1))
        .map(f => prefix + f.name.slice(prefix.length).split('/')[0]))].filter(Boolean);
}
export async function updateFolderEntries(db, from, destination = null) {
    const entries = await catalogEntries(db, 'folder');
    for (const entry of entries) {
        if (entry.name !== from && !entry.name.startsWith(from + '/')) continue;
        if (destination !== null) await registerEntry(db, 'folder', destination + entry.name.slice(from.length));
        await db.delete(PREFIX + 'folder@' + encodeURIComponent(entry.name));
    }
}
