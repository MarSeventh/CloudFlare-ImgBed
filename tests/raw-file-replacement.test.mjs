import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { getDatabase } from '../functions/utils/databaseAdapter.js';
import { onRequest as rawReplace } from '../functions/api/manage/replace-file/[[path]].js';
import { onRequest as replace } from '../functions/api/manage/replace/[[path]].js';
import { onRequest as read } from '../functions/file/[[path]].js';
import { onRequest as rename } from '../functions/api/manage/rename/[[path]].js';
import { onRequest as agent } from '../functions/api/agent/[[path]].js';
import { onRequest as remove } from '../functions/api/manage/delete/[[path]].js';
import { readIndex, rebuildIndex } from '../functions/utils/indexManager.js';
import { writeFileNotes, readFileNotes } from '../functions/utils/fileNotes.js';
import { agentOpenApi } from '../functions/utils/agentOpenApi.js';
import { stageRawReplacement } from '../functions/utils/rawReplacementStorage.js';
import { S3Client } from '@aws-sdk/client-s3';
import { DiscordAPI } from '../functions/utils/storage/discordAPI.js';
import { TelegramAPI } from '../functions/utils/storage/telegramAPI.js';
import { LocalR2Storage } from '../deploy/server/r2Storage.js';

const savedFetch = globalThis.fetch, savedCaches = globalThis.caches;
let purged;
beforeEach(() => {
    purged = [];
    globalThis.caches = { default: { put: async () => {}, match: async () => null, delete: async () => true } };
    globalThis.fetch = async (url, options) => {
        if (String(url).includes('api.cloudflare.com')) { purged.push(...JSON.parse(options.body).files); return Response.json({ success: true }); }
        throw new Error('Unexpected fetch: ' + url);
    };
});
afterEach(() => { globalThis.fetch = savedFetch; globalThis.caches = savedCaches; });

function fixture(engine = 'KV') {
    const map = new Map(); const objects = new Map(); const tasks = [];
    const env = { TG_BOT_TOKEN: '123:test', TG_CHAT_ID: '-100123',
        CF_ZONE_ID: 'test-zone', CF_EMAIL: 'test@example.com', CF_API_KEY: 'test-only' };
    if (engine === 'KV') env.img_url = {
        get: async key => map.get(key)?.value ?? null,
        getWithMetadata: async key => structuredClone(map.get(key) || { value: null, metadata: null }),
        put: async (key, value, options = {}) => map.set(key, structuredClone({ value, metadata: options.metadata || null })),
        delete: async key => map.delete(key),
        list: async ({ prefix = '' } = {}) => ({ keys: [...map].filter(([k]) => k.startsWith(prefix)).map(([name, r]) => ({ name, metadata: r.metadata })), list_complete: true })
    };
    else {
        const sqlite = new DatabaseSync(':memory:');
        sqlite.exec(readFileSync(new URL('../database/init.sql', import.meta.url), 'utf8'));
        env.img_d1 = { prepare(sql) {
            let args = []; const statement = {
                bind(...values) { args = values.map(v => v === undefined ? null : typeof v === 'boolean' ? Number(v) : v); return statement; },
                async first() { return sqlite.prepare(sql).get(...args) || null; },
                async run() { return sqlite.prepare(sql).run(...args); },
                async all() { return { results: sqlite.prepare(sql).all(...args) }; }
            }; return statement;
        } };
    }
    env.img_r2 = {
        get: async (key, options = {}) => {
            if (!objects.has(key)) return null;
            const bytes = objects.get(key); const range = options.range;
            const body = range ? bytes.slice(range.offset, range.offset + (range.length || bytes.length)) : bytes;
            return { body, size: bytes.length, httpMetadata: {}, customMetadata: {},
                writeHttpMetadata() {}, ...(range ? { range: { offset: range.offset, length: body.length } } : {}) };
        },
        put: async (key, body, options = {}) => {
            if (options.onlyIf?.etagDoesNotMatch === '*' && objects.has(key)) return null;
            objects.set(key, new Uint8Array(await new Response(body).arrayBuffer())); return {};
        },
        delete: async key => objects.delete(key)
    };
    const db = getDatabase(env);
    const context = (path, method = 'POST', body, query = '', headers = {}) => ({ env, data: {}, params: { path: path.split('/') },
        request: new Request(`https://test.example/file/${path}${query}`, { method, headers: { 'Content-Type': 'application/json', ...headers },
            ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }), waitUntil: task => tasks.push(task) });
    const add = async (path, overrides = {}, value = '') => {
        await db.put(path, value, { metadata: { Channel: 'TelegramNew', ChannelName: 'Telegram_env', TgFileId: path.startsWith('source') ? 'new' : 'old',
            FileName: path.split('/').pop(), FileType: 'image/png', TimeStamp: 1700000000000,
            FileSize: '0.01', FileSizeBytes: 8, Directory: path.split('/').slice(0, -1).join('/') + '/',
            Tags: ['target-tag'], ListType: 'None', Label: 'None', NamePolicyVersion: 1, ...overrides } });
        return (await db.getWithMetadata(path)).metadata.FixedId;
    };
    const run = (deleteSource = false, extra = {}, headers = {}) => replace(context('source/new.png', 'POST', {
        target: 'target/old.png', deleteSource, expectedSourcePath: 'source/new.png', expectedTargetPath: 'target/old.png', ...extra
    }, '', headers));
    return { map, objects, tasks, env, db, context, add, run };
}

function upload(f, id, fields = {}, headers = {}, file = new File(['new document'], '../unsafe/../new.pdf', { type: 'application/pdf' })) {
    const form = new FormData();
    form.set('file', file);
    form.set('expectedPath', 'target/report.pdf');
    form.set('expectedVersion', '');
    for (const [key, value] of Object.entries(fields)) { if (value === null) form.delete(key); else form.set(key, value); }
    return { ...f.context(id), request: new Request('https://test.example/api/manage/replace-file/' + id,
        { method: 'POST', headers, body: form }) };
}
async function target(f, overrides = {}) {
    const id = await f.add('target/report.pdf', { Channel: 'CloudflareR2', ChannelName: 'R2_env', FileType: 'application/pdf',
        Width: 80, Height: 90, Label: 'adult', Notes: 'legacy inline note', ExtraOwned: { keep: true }, ...overrides });
    await f.env.img_r2.put('target/report.pdf', 'old document');
    return id;
}
function interceptTargetWrite(f, engine, mode) {
    const intercept = async (key, run) => {
        if (key !== 'target/report.pdf') return run();
        if (mode === 'after') await run();
        throw new Error('write outcome uncertain');
    };
    if (engine === 'KV') {
        const put = f.env.img_url.put;
        f.env.img_url.put = (key, ...args) => intercept(key, () => put(key, ...args));
    } else {
        const prepare = f.env.img_d1.prepare;
        f.env.img_d1.prepare = sql => {
            const statement = prepare(sql), bind = statement.bind, run = statement.run; let key;
            statement.bind = (...args) => { key = args[0]; bind(...args); return statement; };
            if (sql.startsWith('INSERT OR REPLACE INTO files')) statement.run = () => intercept(key, run);
            return statement;
        };
    }
}
for (const engine of ['KV', 'D1']) {
    test(`${engine}: raw PDF replaces original only, preserving fixed/legacy links and every target-owned field/notes`, async () => {
        const f = fixture(engine), id = await target(f);
        await writeFileNotes(f.db, id, { notes: 'long note\n保留', expectedRevision: '' });
        const notes = await readFileNotes(f.db, id);
        await rebuildIndex(f.context(''));
        assert.equal((await rename(f.context('target/report.pdf', 'POST', { newFileName: 'current.pdf' }))).status, 200);
        const old = await f.db.getWithMetadata('target/current.pdf');
        const response = await rawReplace(upload(f, id, { expectedPath: 'target/current.pdf' }));
        assert.equal(response.status, 200, await response.clone().text());
        const result = await response.json(), current = await f.db.getWithMetadata('target/current.pdf');
        assert.deepEqual(result.warnings, []); assert.equal(result.fixedId, id);
        for (const [key, value] of Object.entries(old.metadata)) {
            if (['Width', 'Height', 'Label', 'FileSize', 'FileSizeBytes', 'R2FileKey', 'TgFileId'].includes(key)) continue;
            assert.deepEqual(current.metadata[key], value, key);
        }
        assert.equal(current.metadata.Width, undefined); assert.equal(current.metadata.Height, undefined);
        assert.equal(current.metadata.Label, 'None'); assert.equal(current.metadata.FileSizeBytes, 12);
        assert.equal(current.metadata.ContentVersion, result.contentVersion); assert.ok(current.metadata.ContentUpdatedAt);
        assert.deepEqual(await readFileNotes(f.db, id), notes);
        assert.equal(f.objects.size, 1); assert.equal(f.objects.has('target/current.pdf'), false);
        assert.match(current.metadata.R2FileKey, /^imgbed-raw-replacements\/[\da-f-]+\/content$/);
        for (const path of [id, 'target/report.pdf', 'target/current.pdf']) {
            assert.equal(await (await read(f.context(path, 'GET'))).text(), 'new document');
            assert.ok(purged.includes('https://test.example/file/' + path));
        }
        const files = (await f.db.list()).keys.filter(k => !k.name.startsWith('manage@'));
        assert.deepEqual(files.map(k => k.name), ['target/current.pdf']);
        assert.equal((await f.db.list({ prefix: 'manage@trash@' })).keys.length, 0);
        assert.equal((await f.db.list({ prefix: 'manage@identity@id@' })).keys.length, 1);
        const indexed = await readIndex(f.context(''), { includeSubdirFiles: true });
        assert.equal(indexed.files.length, 1); assert.equal(indexed.files[0].metadata.ContentVersion, result.contentVersion);
        await Promise.all(f.tasks);
    });

    test(`${engine}: MIME, required fields, raw dryRun/URL, path/version conflicts and unsupported channels never mutate`, async () => {
        const f = fixture(engine), id = await target(f), before = await f.db.getWithMetadata('target/report.pdf');
        for (const [fields, code] of [[{ expectedPath: 'old/path.pdf' }, 409], [{ expectedVersion: 'old' }, 409],
            [{ expectedVersion: null }, 400], [{ file: 'https://evil.example/p.pdf' }, 400], [{ dryRun: 'true' }, 400], [{ url: 'https://evil.example/a' }, 400]]) {
            const response = await rawReplace(upload(f, id, fields));
            assert.equal(response.status, code, await response.text());
        }
        assert.equal((await rawReplace(upload(f, id, {}, {}, new File(['wrong'], 'wrong.png', { type: 'image/png' })))).status, 400);
        assert.equal((await rawReplace(upload(f, id, {}, {}, new File([new Uint8Array(20 * 1024 * 1024 + 1)], 'big.pdf', { type: 'application/pdf' })))).status, 413);
        const query = upload(f, id); query.request = new Request(query.request.url + '?dryRun=true', query.request);
        assert.equal((await rawReplace(query)).status, 400);
        assert.deepEqual(await f.db.getWithMetadata('target/report.pdf'), before); assert.equal(f.objects.size, 1);
        for (const Channel of ['HuggingFace', 'External', 'Telegraph']) {
            await f.db.put('target/report.pdf', '', { metadata: { ...before.metadata, Channel } });
            const snapshot = await f.db.getWithMetadata('target/report.pdf');
            assert.equal((await rawReplace(upload(f, id))).status, 422);
            assert.deepEqual(await f.db.getWithMetadata('target/report.pdf'), snapshot); assert.equal(f.objects.size, 1);
        }
    });

    test(`${engine}: replace-only agent bearer works through manage middleware; upload/delete/organize/manage-only do not`, async () => {
        const f = fixture(engine), id = await target(f);
        const tokens = Object.fromEntries(['replace', 'upload', 'delete', 'organize', 'manage'].map(p => [p, { token: p, permissions: [p], permissionVersion: 2 }]));
        await f.db.put('manage@sysConfig@security', JSON.stringify({ apiTokens: { tokens } }));
        const { onRequest: middleware } = await import('../functions/api/manage/_middleware.js');
        for (const grant of ['upload', 'delete', 'organize', 'manage', 'replace']) {
            const ctx = upload(f, id, {}, { Authorization: 'Bearer ' + grant }); ctx.next = () => rawReplace(ctx);
            const response = await middleware[1](ctx);
            assert.equal(response.status, grant === 'replace' ? 200 : 401);
        }
        const discovery = await agent({ ...f.context(''), request: new Request('https://test.example/api/agent/', { headers: { Authorization: 'Bearer replace' } }) });
        const info = await discovery.json();
        assert.equal(info.rawReplacement.permission, 'replace'); assert.equal(info.rawReplacement.dryRun, false);
        assert.equal(info.replacement.canDeleteSource, false);
        const schema = agentOpenApi('https://test.example');
        const endpoint = schema.paths['/replace-file/{id}'];
        assert.equal(endpoint.servers[0].url, 'https://test.example/api/manage');
        const form = endpoint.post.requestBody.content['multipart/form-data'].schema;
        assert.deepEqual(form.required, ['file', 'expectedPath', 'expectedVersion']); assert.equal(form.properties.dryRun, undefined);
    });

    test(`${engine}: staging failure and snapshot conflicts roll back only independently staged content`, async () => {
        const f = fixture(engine), id = await target(f), old = await f.db.getWithMetadata('target/report.pdf');
        const put = f.env.img_r2.put;
        f.env.img_r2.put = async () => { throw new Error('storage failed'); };
        assert.equal((await rawReplace(upload(f, id))).status, 500);
        assert.deepEqual(await f.db.getWithMetadata('target/report.pdf'), old); assert.equal(f.objects.size, 1);
        f.env.img_r2.put = async (...args) => {
            await put(...args);
            await f.db.put('target/report.pdf', old.value, { metadata: { ...old.metadata, Tags: ['changed'] } });
            return {};
        };
        assert.equal((await rawReplace(upload(f, id))).status, 409);
        assert.equal(f.objects.size, 1); assert.deepEqual((await f.db.getWithMetadata('target/report.pdf')).metadata.Tags, ['changed']);
    });

    for (const mode of ['before', 'after']) test(`${engine}: uncertain DB ${mode} write retains old and staged bytes`, async () => {
        const f = fixture(engine), id = await target(f, { Label: 'None' }); interceptTargetWrite(f, engine, mode);
        const response = await rawReplace(upload(f, id)); assert.equal(response.status, 500);
        const result = await response.json(); assert.equal(result.outcome, 'unknown'); assert.equal(result.stagedRetained, true);
        assert.equal(f.objects.size, 2); assert.ok(f.objects.has('target/report.pdf'));
        assert.equal(await (await read(f.context(id, 'GET'))).text(), mode === 'after' ? 'new document' : 'old document');
        assert.equal((await f.db.list({ prefix: 'manage@trash@' })).keys.length, 0);
    });

    test(`${engine}: cleanup errors report partial success; shared old content in active/trash records is retained`, async () => {
        for (const shared of ['failure', 'active', 'trash']) {
            const f = fixture(engine), id = await target(f);
            if (shared === 'failure') f.env.img_r2.delete = async () => { throw new Error('delete failed'); };
            else {
                await f.add('other.pdf', { Channel: 'CloudflareR2', R2FileKey: 'target/report.pdf', FileType: 'application/pdf' });
                if (shared === 'trash') assert.equal((await remove(f.context('other.pdf', 'DELETE'))).status, 200);
            }
            const response = await rawReplace(upload(f, id)); assert.equal(response.status, 200);
            assert.ok((await response.json()).warnings.length); assert.equal(f.objects.size, 2);
            assert.equal(await (await read(f.context(id, 'GET'))).text(), 'new document');
        }
    });
}

test('dimensions, content moderation, size and versions follow new bytes, agent exposes current version', async () => {
    const f = fixture(), id = await target(f, { FileType: 'image/png' });
    await f.db.put('manage@sysConfig@upload', JSON.stringify({ cfr2: { channels: [{ savePath: 'environment variable', enabled: true, publicUrl: 'https://objects.example' }] } }));
    await f.db.put('manage@sysConfig@security', JSON.stringify({ upload: { moderate: { enabled: true, channel: 'moderatecontent.com', moderateContentApiKey: 'test-only' } },
        apiTokens: { tokens: { list: { token: 'list', permissions: ['list'], permissionVersion: 2 } } } }));
    const baseFetch = globalThis.fetch; let checkedUrl;
    globalThis.fetch = async (url, options) => {
        if (url === 'https://api.moderatecontent.com/moderate/') {
            checkedUrl = new URLSearchParams(options.body).get('url'); return Response.json({ rating_label: 'everyone' });
        }
        return baseFetch(url, options);
    };
    const png = new Uint8Array(24); png.set([0x89, 0x50, 0x4e, 0x47]);
    const view = new DataView(png.buffer); view.setUint32(16, 13); view.setUint32(20, 17);
    const response = await rawReplace(upload(f, id, {}, {}, new File([png], '..\\evil.png', { type: 'image/png; charset=binary' })));
    assert.equal(response.status, 200, await response.clone().text());
    const result = await response.json(), record = await f.db.getWithMetadata('target/report.pdf');
    assert.equal(record.metadata.Width, 13); assert.equal(record.metadata.Height, 17); assert.equal(record.metadata.FileSizeBytes, 24);
    assert.equal(record.metadata.Label, 'everyone'); assert.equal(checkedUrl, 'https://objects.example/' + record.metadata.R2FileKey);
    const detail = await agent({ ...f.context(''), request: new Request(`https://test.example/api/agent/files/${id}`, { headers: { Authorization: 'Bearer list' } }) });
    assert.equal((await detail.json()).contentVersion, result.contentVersion);
    assert.equal((await rawReplace(upload(f, id, {}, {}, new File([png], 'new.png', { type: 'image/png' })))).status, 409);
});

test('enabled moderation without public staging URL fails before storage mutation', async () => {
    const f = fixture(), id = await target(f, { FileType: 'image/png' });
    await f.db.put('manage@sysConfig@security', JSON.stringify({ upload: { moderate: { enabled: true } } }));
    assert.equal((await rawReplace(upload(f, id, {}, {}, new File(['png'], 'a.png', { type: 'image/png' })))).status, 422);
    assert.equal(f.objects.size, 1);
});

test('stage collision and target storage alias never overwrite or delete existing objects', async () => {
    const f = fixture(), id = await target(f), uuid = crypto.randomUUID;
    crypto.randomUUID = () => 'collision';
    const key = 'imgbed-raw-replacements/collision/content';
    await f.env.img_r2.put(key, 'another object');
    try {
        assert.equal((await rawReplace(upload(f, id))).status, 409);
        assert.equal(new TextDecoder().decode(f.objects.get(key)), 'another object');
        const old = await f.db.getWithMetadata('target/report.pdf');
        await f.db.put('target/report.pdf', '', { metadata: { ...old.metadata, R2FileKey: key } });
        assert.equal((await rawReplace(upload(f, id))).status, 409);
        assert.equal(f.objects.size, 2);
    } finally { crypto.randomUUID = uuid; }
});

test('R2 atomic create race returns conflict without cleanup of winner bytes', async () => {
    const f = fixture(), id = await target(f), put = f.env.img_r2.put;
    f.env.img_r2.put = async (key, body, options) => {
        await put(key, 'winner'); return put(key, body, options);
    };
    assert.equal((await rawReplace(upload(f, id))).status, 409);
    assert.equal(f.objects.size, 2);
    assert.equal(new TextDecoder().decode([...f.objects.values()][1]), 'winner');
});

test('original record replacement shares the raw target lock', async () => {
    const f = fixture(), id = await target(f);
    await f.add('source/new.png', { Channel: 'CloudflareR2', FileType: 'application/pdf' });
    await f.env.img_r2.put('source/new.png', 'source bytes');
    const put = f.env.img_r2.put; let nested;
    f.env.img_r2.put = async (...args) => {
        nested = await replace(f.context('source/new.png', 'POST', { target: 'target/report.pdf', deleteSource: false,
            expectedSourcePath: 'source/new.png', expectedTargetPath: 'target/report.pdf' }));
        return put(...args);
    };
    assert.equal((await rawReplace(upload(f, id))).status, 200); assert.equal(nested.status, 409);
});

test('index/cache failure and rollback cleanup failure are visible warnings', async () => {
    const f = fixture(), id = await target(f), originalPut = f.env.img_url.put;
    f.env.img_url.put = async (key, ...args) => {
        if (key.startsWith('manage@index')) throw new Error('index offline'); return originalPut(key, ...args);
    };
    globalThis.caches.default.put = async () => { throw new Error('cache offline'); };
    const response = await rawReplace(upload(f, id)); assert.equal(response.status, 200);
    assert.equal((await response.json()).warnings.length, 2);
    const g = fixture(), otherId = await target(g), put = g.env.img_r2.put;
    g.env.img_r2.put = async (...args) => {
        await put(...args); const record = await g.db.getWithMetadata('target/report.pdf');
        await g.db.put('target/report.pdf', '', { metadata: { ...record.metadata, Tags: ['changed'] } }); return {};
    };
    g.env.img_r2.delete = async () => { throw new Error('cleanup offline'); };
    const failed = await rawReplace(upload(g, otherId)); assert.equal(failed.status, 409);
    assert.ok((await failed.json()).warnings.length); assert.equal(g.objects.size, 2);
});

test('S3 raw staging uses configured credentials and create-only PUT, then deletes old object', async () => {
    const f = fixture(); Object.assign(f.env, { S3_ENDPOINT: 'https://s3.example', S3_BUCKET_NAME: 'bucket', S3_ACCESS_KEY_ID: 'test', S3_SECRET_ACCESS_KEY: 'test' });
    const id = await target(f, { Channel: 'S3', ChannelName: 'S3_env', S3FileKey: 'original.pdf' });
    const send = S3Client.prototype.send, commands = [];
    S3Client.prototype.send = async function(command) { commands.push(command); return {}; };
    try {
        assert.equal((await rawReplace(upload(f, id))).status, 200);
        assert.equal(commands[0].constructor.name, 'PutObjectCommand'); assert.equal(commands[0].input.IfNoneMatch, '*');
        assert.equal(new TextDecoder().decode(commands[0].input.Body), 'new document');
        assert.equal(commands[1].constructor.name, 'DeleteObjectCommand'); assert.equal(commands[1].input.Key, 'original.pdf');
        assert.equal((await f.db.getWithMetadata('target/report.pdf')).metadata.S3FileKey, commands[0].input.Key);
        // Conditional failure may mean another writer owns this key: never delete it.
        commands.length = 0;
        S3Client.prototype.send = async function(command) { commands.push(command); throw new Error('precondition failed'); };
        const current = await f.db.getWithMetadata('target/report.pdf');
        assert.equal((await rawReplace(upload(f, id, { expectedVersion: current.metadata.ContentVersion }))).status, 500);
        assert.equal(commands.length, 1);
    } finally { S3Client.prototype.send = send; }
});

test('WebDAV raw PUT is conditional, safe filename ignored; old DELETE follows target commit', async () => {
    const f = fixture(); Object.assign(f.env, { WEBDAV_BASE_URL: 'https://dav.example/root/', WEBDAV_CREATE_DIRECTORY: 'false' });
    const id = await target(f, { Channel: 'WebDAV', ChannelName: 'WebDAV_env', WebDAVFilePath: 'old.pdf' });
    const baseFetch = globalThis.fetch, calls = [];
    globalThis.fetch = async (url, options) => {
        if (!String(url).startsWith('https://dav.example')) return baseFetch(url, options);
        calls.push([url, options]);
        if (options.method === 'DELETE') assert.ok((await f.db.getWithMetadata('target/report.pdf')).metadata.ContentVersion);
        return new Response(null, { status: 201 });
    };
    assert.equal((await rawReplace(upload(f, id))).status, 200);
    assert.equal(calls[0][1].method, 'PUT'); assert.equal(calls[0][1].headers.get('If-None-Match'), '*');
    assert.match(calls[0][0], /\/imgbed-raw-replacements\/[\da-f-]+\/content$/);
    assert.equal(calls[1][1].method, 'DELETE'); assert.equal(calls[1][0], 'https://dav.example/root/old.pdf');
});

test('Discord uses independent message and cleans old parts only after publishing; malformed response rolls back new message', async () => {
    const f = fixture(); Object.assign(f.env, { DISCORD_BOT_TOKEN: 'test', DISCORD_CHANNEL_ID: 'channel' });
    const id = await target(f, { Channel: 'Discord', ChannelName: 'Discord_env', DiscordMessageId: 'old' });
    const proto = DiscordAPI.prototype, send = proto.sendFile, removeMessage = proto.deleteMessage, deleted = [];
    proto.sendFile = async () => ({ id: 'new', attachments: [{ id: 'attachment', url: 'https://cdn.example/new' }] });
    proto.deleteMessage = async (channel, message) => { deleted.push(message); return true; };
    try {
        assert.equal((await rawReplace(upload(f, id))).status, 200); assert.deepEqual(deleted, ['old']);
        const current = await f.db.getWithMetadata('target/report.pdf'); assert.equal(current.metadata.DiscordMessageId, 'new');
        proto.sendFile = async () => ({ id: 'bad', attachments: [] });
        const failed = await rawReplace(upload(f, id, { expectedVersion: current.metadata.ContentVersion }));
        assert.equal(failed.status, 502); assert.deepEqual(deleted, ['old', 'bad']);
        proto.sendFile = async () => ({ id: 'new', attachments: [] });
        assert.equal((await rawReplace(upload(f, id, { expectedVersion: current.metadata.ContentVersion }))).status, 502);
        assert.deepEqual(deleted, ['old', 'bad']); // Never delete an alias of the old message.
    } finally { proto.sendFile = send; proto.deleteMessage = removeMessage; }
});

test('Telegram sends original bytes as document and never deletes old immutable bytes', async () => {
    const f = fixture(), id = await target(f, { Channel: 'TelegramNew', ChannelName: 'Telegram_env', TgFileId: 'old' });
    const proto = TelegramAPI.prototype, send = proto.sendFile; const calls = [];
    proto.sendFile = async (file, channel, method, type) => { calls.push([await file.text(), method, type]);
        return { ok: true, result: { message_id: 12, document: { file_id: 'new', file_unique_id: 'unique' } } }; };
    try {
        assert.equal((await rawReplace(upload(f, id))).status, 200);
        assert.deepEqual(calls, [['new document', 'sendDocument', 'document']]);
        assert.equal((await f.db.getWithMetadata('target/report.pdf')).metadata.TgFileId, 'new');
    } finally { proto.sendFile = send; }
});

test('native preview R2 create-only staging cannot overwrite an existing object', async () => {
    const dir = mkdtempSync('/tmp/imgbed-r2-');
    try {
        const r2 = new LocalR2Storage(dir); await r2.put('stage/content', 'first');
        assert.equal(await r2.put('stage/content', 'second', { onlyIf: { etagDoesNotMatch: '*' } }), null);
        assert.equal(await new Response((await r2.get('stage/content')).body).text(), 'first');
    } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('legacy channel resolved by persisted identity retains a usable configured name; disabled channels fail before staging', async () => {
    const f = fixture(); Object.assign(f.env, { S3_ENDPOINT: 'https://s3.example', S3_BUCKET_NAME: 'bucket', S3_ACCESS_KEY_ID: 'test', S3_SECRET_ACCESS_KEY: 'test' });
    const id = await target(f, { Channel: 'S3', ChannelName: '', S3FileKey: 'old.pdf',
        S3Endpoint: 'https://s3.example', S3BucketName: 'bucket' });
    const send = S3Client.prototype.send; let calls = 0;
    S3Client.prototype.send = async () => { calls++; return {}; };
    try {
        const response = await rawReplace(upload(f, id)); assert.equal(response.status, 200);
        const current = await f.db.getWithMetadata('target/report.pdf');
        assert.equal(current.metadata.ChannelName, 'S3_env'); assert.equal(current.metadata.S3Endpoint, undefined);
        await f.db.put('manage@sysConfig@upload', JSON.stringify({ s3: { channels: [{ savePath: 'environment variable', enabled: false }] } }));
        const before = calls;
        assert.equal((await rawReplace(upload(f, id, { expectedVersion: current.metadata.ContentVersion }))).status, 422);
        assert.equal(calls, before);
    } finally { S3Client.prototype.send = send; }
});

function preflight(f, id, token = 'replace', query = '') {
    return { ...f.context(id), request: new Request(`https://test.example/api/manage/replace-file/${id}${query}`,
        { headers: { Authorization: 'Bearer ' + token } }) };
}
function beforeRecordWrite(f, engine, path, callback) {
    let intercepted = false;
    const intercept = async (key, run) => {
        if (key === path && !intercepted) { intercepted = true; await callback(); }
        return run();
    };
    if (engine === 'KV') {
        const put = f.env.img_url.put;
        f.env.img_url.put = (key, ...args) => intercept(key, () => put(key, ...args));
    } else {
        const prepare = f.env.img_d1.prepare;
        f.env.img_d1.prepare = sql => {
            const statement = prepare(sql), bind = statement.bind, run = statement.run; let key;
            statement.bind = (...args) => { key = args[0]; bind(...args); return statement; };
            if (sql.startsWith('INSERT OR REPLACE INTO files')) statement.run = () => intercept(key, run);
            return statement;
        };
    }
}

for (const engine of ['KV', 'D1']) {
    test(`${engine}: replace-only minimal GET preflight is private, permission bounded and usable for POST`, async () => {
        const f = fixture(engine), id = await target(f);
        await writeFileNotes(f.db, id, { notes: 'private note', expectedRevision: '' });
        const tokens = Object.fromEntries(['replace', 'list', 'organize', 'upload', 'delete', 'manage'].map(p => [p, { token: p, permissions: [p], permissionVersion: 2 }]));
        tokens.expired = { token: 'expired', permissions: ['replace'], permissionVersion: 2, expiresAt: '2000-01-01T00:00:00Z' };
        await f.db.put('manage@sysConfig@security', JSON.stringify({ auth: { admin: { adminUsername: 'admin' } }, apiTokens: { tokens } }));
        const { onRequest: middleware } = await import('../functions/api/manage/_middleware.js');
        const run = async ctx => { ctx.next = () => rawReplace(ctx); return middleware[1](ctx); };
        const before = await f.db.getWithMetadata('target/report.pdf');
        const response = await run(preflight(f, id));
        assert.equal(response.status, 200); assert.equal(response.headers.get('Cache-Control'), 'no-store');
        const snapshot = await response.json();
        assert.deepEqual(snapshot, { id, path: 'target/report.pdf', contentVersion: '', type: 'application/pdf' });
        assert.deepEqual(await f.db.getWithMetadata(snapshot.path), before); assert.equal(f.objects.size, 1);
        for (const token of ['list', 'organize', 'upload', 'delete', 'manage', 'expired', 'revoked']) {
            assert.equal((await run(preflight(f, id, token))).status, 401, token);
        }
        const anonymous = preflight(f, id); anonymous.request = new Request(anonymous.request.url);
        assert.equal((await run(anonymous)).status, 401);
        for (const route of ['files', 'files/' + id, 'files/' + id + '/notes', 'folders', 'tags']) {
            const denied = await agent({ ...f.context(''), request: new Request('https://test.example/api/agent/' + route, { headers: { Authorization: 'Bearer replace' } }) });
            assert.equal(denied.status, 403);
        }
        assert.equal((await run(preflight(f, 'f_' + '0'.repeat(32)))).status, 404);
        assert.equal((await run(preflight(f, id, 'replace', '?dryRun=true'))).status, 400);
        const discovery = await agent({ ...f.context(''), request: new Request('https://test.example/api/agent/', { headers: { Authorization: 'Bearer replace' } }) });
        const capabilities = await discovery.json();
        assert.deepEqual(capabilities.operations, ['getReplacementTarget', 'replaceFileContents']);
        assert.deepEqual(capabilities.rawReplacement.preflight.fields, ['id', 'path', 'contentVersion', 'type']);
        const schema = agentOpenApi('https://test.example').paths['/replace-file/{id}'];
        for (const method of ['get', 'post']) {
            assert.equal(schema[method].responses[403], undefined);
            assert.match(schema[method].responses[401].description, /lacking replace/);
        }
        assert.deepEqual(schema.get.responses[200].content['application/json'].schema.required, ['id', 'path', 'contentVersion', 'type']);
        assert.equal((await run(upload(f, snapshot.id, { expectedPath: snapshot.path, expectedVersion: snapshot.contentVersion }, { Authorization: 'Bearer replace' }))).status, 200);
        const current = await (await run(preflight(f, id))).json();
        assert.notEqual(current.contentVersion, '');
        // The minimal endpoint follows the same ID after a rename, but never reveals extra metadata.
        assert.equal((await rename(f.context('target/report.pdf', 'POST', { newFileName: 'renamed.pdf' }, '', { Authorization: 'Bearer organize' }))).status, 200);
        const moved = await (await run(preflight(f, id))).json();
        assert.deepEqual(moved, { ...current, path: 'target/renamed.pdf' });
        assert.equal((await remove(f.context('target/renamed.pdf', 'DELETE', undefined, '', { Authorization: 'Bearer delete' }))).status, 200);
        assert.equal((await run(preflight(f, id))).status, 404);
    });

    test(`${engine}: raw commit gap rejects rename, metadata repair, move and single/folder deletion, plus both replacements`, async () => {
        const { onRequest: move } = await import('../functions/api/manage/move/[[path]].js');
        const { onRequest: identity } = await import('../functions/api/manage/identity/[[path]].js');
        const { onRequest: tags } = await import('../functions/api/manage/tags/[[path]].js');
        const f = fixture(engine), id = await target(f);
        await f.add('source/next.pdf', { Channel: 'CloudflareR2', FileType: 'application/pdf' });
        await f.env.img_r2.put('source/next.pdf', 'next');
        await f.add('other/report.pdf', { FileType: 'application/pdf' });
        const old = await f.db.getWithMetadata('target/report.pdf');
        const baseFetch = globalThis.fetch;
        globalThis.fetch = async (url, options) => {
            if (url instanceof Request && url.url.includes('/api/manage/list?')) return Response.json({ files: [{ name: 'target/report.pdf' }], directories: [] });
            return baseFetch(url, options);
        };
        let checks = 0;
        beforeRecordWrite(f, engine, 'target/report.pdf', async () => {
            // This callback runs AFTER the final snapshot check, immediately before
            // the storage adapter applies the DB write; no timing sleeps involved.
            const contexts = [
                [rename, f.context('target/report.pdf', 'POST', { newFileName: 'renamed.pdf' })],
                [rename, f.context('target/report.pdf', 'POST', { newFileName: 'report.pdf', FileType: 'image/png' })],
                [move, f.context('target/report.pdf', 'GET', undefined, '?dist=archive')],
                [move, f.context('other/report.pdf', 'GET', undefined, '?dist=target')],
                [move, f.context('target', 'GET', undefined, '?folder=true&dist=archive')],
                [remove, f.context('target/report.pdf', 'DELETE')],
                [remove, f.context('target', 'DELETE', undefined, '?folder=true')],
                [identity, f.context('target/report.pdf', 'POST')],
                [tags, f.context('target/report.pdf', 'POST', { action: 'set', tags: ['new'] })],
                [replace, f.context('source/next.pdf', 'POST', { target: 'target/report.pdf', deleteSource: true, expectedSourcePath: 'source/next.pdf', expectedTargetPath: 'target/report.pdf' })],
                [rawReplace, upload(f, id)]
            ];
            for (const [operation, context] of contexts) {
                // Alternate origins cannot bypass the database/path lock.
                context.request = new Request(context.request.url.replace('test.example', 'alias.example'), context.request);
                const response = await operation(context);
                assert.equal(response.status, 409, await response.clone().text()); checks++;
                const result = await response.json();
                if (result.failed) assert.deepEqual(result.failed, ['target/report.pdf']);
            }
            assert.deepEqual(await f.db.getWithMetadata('target/report.pdf'), old);
            assert.equal(await f.db.get('manage@trash@' + id), null);
        });
        const response = await rawReplace(upload(f, id));
        assert.equal(response.status, 200, await response.clone().text()); assert.equal(checks, 11);
        assert.equal(await (await read(f.context(id, 'GET'))).text(), 'new document');
        assert.equal((await f.db.getWithMetadata('target/renamed.pdf'))?.metadata ?? null, null);
        assert.equal((await f.db.getWithMetadata('archive/report.pdf'))?.metadata ?? null, null);
        // Failed multi-path acquisition must not leave the unrelated source locked.
        assert.equal((await rename(f.context('source/next.pdf', 'POST', { newFileName: 'next.pdf' }))).status, 200);
        assert.equal((await rename(f.context('target/report.pdf', 'POST', { newFileName: 'report.pdf' }))).status, 200);
        await Promise.all(f.tasks);
    });

    for (const action of ['rename', 'same-name', 'move', 'delete', 'record-replace']) test(`${engine}: ${action} owns the path before reading/writing, raw replacement loses with 409`, async () => {
        const { onRequest: move } = await import('../functions/api/manage/move/[[path]].js');
        const f = fixture(engine), id = await target(f);
        let tested = false;
        const conflict = async () => {
            tested = true;
            const response = await rawReplace(upload(f, id));
            assert.equal(response.status, 409, await response.clone().text());
            assert.equal(f.objects.has('target/report.pdf'), true);
        };
        let response;
        if (['rename', 'move', 'record-replace'].includes(action)) {
            if (action === 'record-replace') {
                await f.add('source/new.pdf', { Channel: 'CloudflareR2', FileType: 'application/pdf' });
                await f.env.img_r2.put('source/new.pdf', 'source');
            }
            const put = f.env.img_r2.put;
            f.env.img_r2.put = async (...args) => { await conflict(); return put(...args); };
            if (action === 'rename') response = await rename(f.context('target/report.pdf', 'POST', { newFileName: 'next.pdf' }));
            if (action === 'move') response = await move(f.context('target/report.pdf', 'GET', undefined, '?dist=archive'));
            if (action === 'record-replace') response = await replace(f.context('source/new.pdf', 'POST', { target: 'target/report.pdf', deleteSource: true, expectedSourcePath: 'source/new.pdf', expectedTargetPath: 'target/report.pdf' }));
        } else if (action === 'same-name') {
            beforeRecordWrite(f, engine, 'target/report.pdf', conflict);
            response = await rename(f.context('target/report.pdf', 'POST', { newFileName: 'report.pdf' }));
        } else {
            // Both backends store recovery payloads via db.put before live deletion.
            // Pause that recovery write while deletion owns its path lock.
            const binding = f.env.img_url || f.env.img_d1;
            if (engine === 'KV') {
                const put = binding.put;
                binding.put = async (key, ...args) => { if (key === 'manage@trash@' + id) await conflict(); return put(key, ...args); };
            } else {
                const prepare = binding.prepare;
                binding.prepare = sql => {
                    const statement = prepare(sql), bind = statement.bind, run = statement.run; let key;
                    statement.bind = (...args) => { key = args[0]; bind(...args); return statement; };
                    statement.run = async () => { if (key === 'manage@trash@' + id) await conflict(); return run(); };
                    return statement;
                };
            }
            response = await remove(f.context('target/report.pdf', 'DELETE'));
        }
        assert.equal(response.status, 200, await response.clone().text()); assert.equal(tested, true);
        if (action === 'record-replace') assert.equal((await response.json()).sourceDeleted, true); // no double locking
        await Promise.all(f.tasks);
    });
}

test('missing CDN purge configuration returns a specific warning without changing cache policy', async () => {
    const f = fixture(), id = await target(f);
    delete f.env.CF_ZONE_ID; delete f.env.CF_EMAIL; delete f.env.CF_API_KEY;
    const response = await rawReplace(upload(f, id));
    assert.equal(response.status, 200);
    assert.ok((await response.json()).warnings.some(w => w.includes('CDN') && w.includes('浏览器')));
    assert.equal(purged.length, 0);
    assert.equal(await (await read(f.context(id, 'GET'))).text(), 'new document');
});

test('failed or incomplete shared-content scan retains old bytes and warns after a successful commit', async () => {
    for (const mode of ['failure', 'incomplete']) {
        const f = fixture(), id = await target(f), list = f.env.img_url.list;
        f.env.img_url.list = async options => {
            if (options?.prefix === '') {
                if (mode === 'failure') throw new Error('reference scan unavailable');
                return { keys: [], list_complete: false };
            }
            return list(options);
        };
        const response = await rawReplace(upload(f, id));
        assert.equal(response.status, 200);
        assert.ok((await response.json()).warnings.some(w => w.includes('安全清理')));
        assert.equal(f.objects.size, 2); assert.ok(f.objects.has('target/report.pdf'));
        assert.equal(await (await read(f.context(id, 'GET'))).text(), 'new document');
    }
});

test('the path lock remains held through old-content cleanup and is released afterward', async () => {
    const f = fixture(), id = await target(f), del = f.env.img_r2.delete;
    let checked = false;
    f.env.img_r2.delete = async key => {
        checked = true;
        const response = await rename(f.context('target/report.pdf', 'POST', { newFileName: 'report.pdf' }));
        assert.equal(response.status, 409);
        return del(key);
    };
    assert.equal((await rawReplace(upload(f, id))).status, 200); assert.equal(checked, true);
    assert.equal((await rename(f.context('target/report.pdf', 'POST', { newFileName: 'report.pdf' }))).status, 200);
});
