import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getDatabase } from '../functions/utils/databaseAdapter.js';
import { oldContentIsShared } from '../functions/utils/rawReplacementStorage.js';
import { TRASH_PREFIX, saveTrashEntry, trashSharesStorage } from '../functions/utils/trash.js';

// Workers cap storage operations per request, so reference scans must cost
// list pages, not one read per stored file.
function fixture() {
    const map = new Map();
    const ops = { get: 0, getWithMetadata: 0, list: 0 };
    const kv = {
        async get(key) { ops.get++; return map.get(key)?.value ?? null; },
        async getWithMetadata(key) { ops.getWithMetadata++; return structuredClone(map.get(key) || { value: null, metadata: null }); },
        async put(key, value, options = {}) { map.set(key, structuredClone({ value, metadata: options.metadata || null })); },
        async delete(key) { map.delete(key); },
        async list({ prefix = '', limit = 1000, cursor } = {}) {
            ops.list++;
            const names = [...map.keys()].filter(k => k.startsWith(prefix)).sort();
            const start = cursor ? names.indexOf(cursor) + 1 : 0, slice = names.slice(start, start + limit);
            const more = start + limit < names.length;
            return { keys: slice.map(name => ({ name, metadata: map.get(name).metadata })),
                list_complete: !more, cursor: more ? slice.at(-1) : undefined };
        }
    };
    const env = { img_url: kv, DISCORD_BOT_TOKEN: 'fake', DISCORD_CHANNEL_ID: '42' };
    const raw = (key, metadata, value = '') => map.set(key, { value, metadata });
    const reset = () => Object.keys(ops).forEach(k => { ops[k] = 0; });
    return { env, map, ops, raw, reset, db: getDatabase(env) };
}

const r2 = (key, extra = {}) => ({ Channel: 'CloudflareR2', ChannelName: 'r2', R2FileKey: key, TimeStamp: 1, ...extra });
const discord = (messageId, extra = {}) => ({ Channel: 'Discord', ChannelName: 'Discord_env', DiscordMessageId: messageId, TimeStamp: 1, ...extra });

test('unshared old content is detected with list pages only, across thousands of files', async () => {
    const f = fixture();
    for (let i = 0; i < 2500; i++) f.raw(`photos/${i}.jpg`, r2(`objects/${i}`));
    const old = { value: '', metadata: r2('objects/old') };
    const staged = { value: '', metadata: r2('imgbed-raw-replacements/x/content') };
    f.raw('target.jpg', staged.metadata);
    f.reset();
    assert.equal(await oldContentIsShared(f.env, 'target.jpg', old, staged), false);
    assert.equal(f.ops.getWithMetadata, 0);
    assert.ok(f.ops.list <= 5, `list calls: ${f.ops.list}`);
    assert.ok(f.ops.get <= 3, `get calls: ${f.ops.get}`);
});

test('an active record sharing the old object keeps it; the target itself is not counted', async () => {
    const f = fixture();
    const old = { value: '', metadata: r2('objects/old') };
    // Stale list metadata at the target path must not count as a reference.
    f.raw('target.jpg', old.metadata);
    const staged = { value: '', metadata: r2('imgbed-raw-replacements/x/content') };
    assert.equal(await oldContentIsShared(f.env, 'target.jpg', old, staged), false);
    f.raw('copy.jpg', r2('objects/old'));
    assert.equal(await oldContentIsShared(f.env, 'target.jpg', old, staged), true);
});

test('only chunked records of the same channel are fetched; chunk lists are compared', async () => {
    const f = fixture();
    for (let i = 0; i < 50; i++) f.raw(`d/${i}.bin`, discord(String(1000 + i)));
    for (let i = 0; i < 50; i++) f.raw(`r/${i}.jpg`, r2(`objects/${i}`, { IsChunked: true }), '[]');
    f.raw('d/chunked.bin', discord('', { IsChunked: true }), JSON.stringify([{ messageId: '7' }, { messageId: '8' }]));
    const old = { value: '', metadata: discord('8') };
    const staged = { value: '', metadata: discord('9') };
    f.reset();
    assert.equal(await oldContentIsShared(f.env, 'target.bin', old, staged), true);
    assert.equal(f.ops.getWithMetadata, 1);
});

test('recycle bin hints skip unrelated entries; legacy entries are still checked', async () => {
    const f = fixture();
    const shared = { value: '', metadata: r2('objects/shared') };
    for (let i = 0; i < 100; i++) {
        await saveTrashEntry(f.db, { id: `f_${String(i).padStart(32, '0')}`, kind: 'file', path: `t/${i}.jpg`,
            state: 'deleted', record: { value: '', metadata: discord(String(i)) } });
    }
    const old = { value: '', metadata: r2('objects/shared') };
    const staged = { value: '', metadata: r2('imgbed-raw-replacements/x/content') };
    f.reset();
    assert.equal(await oldContentIsShared(f.env, 'target.jpg', old, staged), false);
    assert.equal(f.ops.get, 1, 'only the upload config is read');
    // An entry written before hints existed has no list metadata and is fetched.
    f.map.set(TRASH_PREFIX + 'f_legacy', { value: JSON.stringify({ id: 'f_legacy', kind: 'file', path: 'old.jpg',
        state: 'deleted', record: shared }), metadata: { TrashPath: 'old.jpg', TrashKind: 'file' } });
    assert.equal(await oldContentIsShared(f.env, 'target.jpg', old, staged), true);
});

test('purge sharing check compares digests before fetching recovery records', async () => {
    const f = fixture();
    const record = { value: '', metadata: r2('objects/a') };
    for (let i = 0; i < 100; i++) {
        await saveTrashEntry(f.db, { id: `f_${String(i).padStart(32, '0')}`, kind: 'file', path: `t/${i}.jpg`,
            state: 'deleted', record: { value: '', metadata: r2(`objects/other-${i}`) } });
    }
    const self = 'f_' + 'a'.repeat(32);
    await saveTrashEntry(f.db, { id: self, kind: 'file', path: 'a.jpg', state: 'deleted', record });
    f.reset();
    assert.equal(await trashSharesStorage(f.db, self, 'a.jpg', record), false);
    assert.equal(f.ops.get, 0);
    await saveTrashEntry(f.db, { id: 'f_' + 'b'.repeat(32), kind: 'file', path: 'b.jpg', state: 'purging', record });
    assert.equal(await trashSharesStorage(f.db, self, 'a.jpg', record), true);
    await saveTrashEntry(f.db, { id: 'f_' + 'b'.repeat(32), kind: 'file', path: 'b.jpg', state: 'purged' });
    assert.equal(await trashSharesStorage(f.db, self, 'a.jpg', record), false);
});
