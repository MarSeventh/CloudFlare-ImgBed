import assert from 'node:assert/strict';
import { loadFunction, memoryDatabase } from './helpers/loadFunction.js';
import { createContext } from './helpers/context.js';
import { managementFixture } from './helpers/management.js';
import { sqliteDatabase } from './helpers/database.js';
import * as helpers from '../functions/utils/fileExpiryHelpers.js';
import * as fileTools from '../functions/file/fileTools.js';
import * as imageTransform from '../functions/file/imageTransform.js';
import { maybeServeFromCache } from '../deploy/worker/workerCache.js';
import { createDatabaseAdapter } from '../functions/utils/databaseAdapter.js';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 9, 25);

// Cloudflare KV's getWithMetadata returns { value: null, metadata: null } for missing keys, not null
function nativeKv() {
    const kv = memoryDatabase();
    const read = kv.getWithMetadata.bind(kv);
    kv.getWithMetadata = async key => (await read(key)) ?? { value: null, metadata: null };
    // Like KV, honour the list limit
    const list = kv.list.bind(kv);
    kv.list = async (options = {}) => {
        const result = await list(options);
        return options.limit && result.keys.length > options.limit
            ? { keys: result.keys.slice(0, options.limit), list_complete: false }
            : result;
    };
    return kv;
}

const enabledConfig = (overrides = {}) => helpers.normalizeFileExpiryConfig({
    enabled: true, defaultExpire: '7d', allowCustom: true, options: ['12h', '7d', 'forever'], ...overrides,
});

describe('file expiry', () => {
    describe('options and settings', () => {
        it('parses hour and day options and rejects everything else', () => {
            assert.equal(helpers.parseExpireOption('12h'), 12 * HOUR);
            assert.equal(helpers.parseExpireOption('3650d'), 3650 * DAY);
            assert.equal(helpers.parseExpireOption('forever'), 0);
            for (const invalid of ['0h', '3651d', '1.5d', '1w', '01d', '', null, 7, ' 1d']) {
                assert.equal(helpers.parseExpireOption(invalid), null, String(invalid));
            }
        });

        it('validates saved settings, sorts options by duration and keeps forever last', () => {
            const { config } = helpers.validateFileExpiryConfig({
                enabled: true, defaultExpire: '1d', allowCustom: true, options: ['forever', '7d', '12h', '1d'],
            });
            assert.deepEqual(config, { enabled: true, defaultExpire: '1d', allowCustom: true, options: ['12h', '1d', '7d', 'forever'] });

            const errors = [
                { enabled: true, defaultExpire: '1d', options: ['1d', '2x'] },
                { enabled: true, defaultExpire: '2d', options: ['1d'] },
                { enabled: true, defaultExpire: '1d', options: [] },
                { enabled: true, defaultExpire: '1h', options: Array.from({ length: 21 }, (_, i) => `${i + 1}h`) },
                { enabled: true },
            ];
            for (const raw of errors) {
                assert.ok(helpers.validateFileExpiryConfig(raw).error, JSON.stringify(raw));
            }
        });

        it('treats missing historical settings as disabled', () => {
            assert.deepEqual(helpers.normalizeFileExpiryConfig(undefined), helpers.DEFAULT_FILE_EXPIRY_CONFIG);
            assert.equal(helpers.normalizeFileExpiryConfig({ enabled: 'true' }).enabled, false);
        });

        it('leaves the backend in control of the final expiry', () => {
            assert.deepEqual(helpers.resolveExpiresAt(helpers.DEFAULT_FILE_EXPIRY_CONFIG, '12h', NOW), { expiresAt: null });
            assert.deepEqual(helpers.resolveExpiresAt(enabledConfig(), null, NOW), { expiresAt: NOW + 7 * DAY });
            assert.deepEqual(helpers.resolveExpiresAt(enabledConfig(), '12h', NOW), { expiresAt: NOW + 12 * HOUR });
            assert.deepEqual(helpers.resolveExpiresAt(enabledConfig(), 'forever', NOW), { expiresAt: null });
            // 24h is not the same option as 1d: only listed values are accepted
            assert.ok(helpers.resolveExpiresAt(enabledConfig(), '24h', NOW).error);
            // When clients may not choose, their parameter is ignored rather than rejected
            assert.deepEqual(helpers.resolveExpiresAt(enabledConfig({ allowCustom: false }), 'forever', NOW), { expiresAt: NOW + 7 * DAY });
        });

        it('keeps expiring files out of shared caches and caps lifetimes at the remaining validity and one hour', () => {
            assert.equal(helpers.capCacheControl('public, max-age=2592000', NOW + 90 * 1000, NOW), 'private, max-age=90');
            assert.equal(helpers.capCacheControl('public, max-age=2592000', NOW + 90 * DAY, NOW), 'private, max-age=3600');
            assert.equal(helpers.capCacheControl('private, max-age=86400', NOW + 90 * DAY, NOW), 'private, max-age=3600');
            assert.equal(helpers.capCacheControl('public, max-age=2592000', null, NOW), 'public, max-age=2592000');
            assert.equal(helpers.capCacheControl('private, no-store, max-age=0', NOW + DAY, NOW), 'private, no-store, max-age=0');
        });

        it('versions expiring files by content and response headers, not by the expiry itself', () => {
            const metadata = { TimeStamp: NOW, FileSizeBytes: 10, FileName: 'a.png', FileType: 'image/png', ExpiresAt: NOW + DAY };
            const etag = helpers.buildExpiringFileEtag(metadata);
            assert.match(etag, /^"exp-[0-9a-z]+"$/);
            assert.equal(helpers.buildExpiringFileEtag({ ...metadata, ExpiresAt: NOW + HOUR }), etag);
            assert.notEqual(helpers.buildExpiringFileEtag({ ...metadata, FileName: 'b.png' }), etag);
            assert.notEqual(helpers.buildExpiringFileEtag({ ...metadata, TimeStamp: NOW + 1 }), etag);

            assert.ok(helpers.etagMatches(etag, etag));
            assert.ok(helpers.etagMatches(`"other", W/${etag}`, etag));
            assert.ok(!helpers.etagMatches('"other"', etag));
            assert.ok(!helpers.etagMatches(null, etag));
        });

        it('encodes markers so key order follows expiry order', () => {
            const early = helpers.buildExpiryMarkerKey(NOW, 'a/z.png');
            const late = helpers.buildExpiryMarkerKey(NOW + 1, 'a/a.png');
            assert.ok(early < late);
            assert.deepEqual(helpers.parseExpiryMarkerKey(early), { expiresAt: NOW, fileId: 'a/z.png' });
            assert.equal(helpers.parseExpiryMarkerKey('manage@expiry@bad'), null);
        });

        it('saves and validates expiry under upload settings, preserving it on channel-only saves', async () => {
            const db = memoryDatabase();
            const upload = await loadFunction('functions/api/manage/sysConfig/upload.js', {
                getDatabase: () => db, ...helpers,
            });
            const post = body => upload.onRequest(createContext('https://test/api/manage/sysConfig/upload', {
                method: 'POST', body: JSON.stringify(body), env: {},
            }));
            assert.equal((await post({ fileExpiry: enabledConfig() })).status, 200);
            assert.equal((await upload.getUploadConfig(db, {})).fileExpiry.enabled, true);
            assert.equal((await post({ telegram: { channels: [] } })).status, 200);
            assert.equal(JSON.parse(await db.get('manage@sysConfig@upload')).fileExpiry.enabled, true);
            const rejected = await post({ fileExpiry: { enabled: true, defaultExpire: '1d', options: ['1y'] } });
            assert.equal(rejected.status, 400);
            assert.deepEqual(JSON.parse(await db.get('manage@sysConfig@upload')).fileExpiry.options, enabledConfig().options);
        });

        it('does not read or migrate expiry from other settings', async () => {
            const db = memoryDatabase();
            await db.put('manage@sysConfig@others', JSON.stringify({ fileExpiry: enabledConfig() }));
            const upload = await loadFunction('functions/api/manage/sysConfig/upload.js', { getDatabase: () => db, ...helpers });
            const others = await loadFunction('functions/api/manage/sysConfig/others.js', { getDatabase: () => db });
            assert.equal((await upload.getUploadConfig(db, {})).fileExpiry.enabled, false);
            assert.equal((await others.getOthersConfig(db, {})).fileExpiry, undefined);
            await others.onRequest(createContext('https://test/api/manage/sysConfig/others', {
                method: 'POST', body: JSON.stringify({ fileExpiry: enabledConfig(), webDAV: {} }), env: {},
            }));
            assert.equal(JSON.parse(await db.get('manage@sysConfig@others')).fileExpiry, undefined);
            assert.equal(await db.get('manage@sysConfig@upload'), null);
        });
    });

    describe('user configuration', () => {
        async function userConfig(fileExpiry) {
            const route = await loadFunction('functions/api/userConfig.js', {
                fetchPageConfig: async () => ({ config: [] }),
                fetchUploadConfig: async () => ({ fileExpiry }),
            });
            return (await route.onRequest(createContext('https://test/api/userConfig'))).json();
        }

        it('always announces support, with the choices clients may make only while enabled', async () => {
            // Without the field the frontend knows the backend predates file expiry
            assert.deepEqual((await userConfig(helpers.DEFAULT_FILE_EXPIRY_CONFIG)).fileExpiry, { enabled: false });
            assert.deepEqual((await userConfig(undefined)).fileExpiry, { enabled: false });
            assert.deepEqual((await userConfig(enabledConfig())).fileExpiry, {
                enabled: true, defaultExpire: '7d', allowCustom: true, options: ['12h', '7d', 'forever'],
            });
            assert.deepEqual((await userConfig(enabledConfig({ allowCustom: false }))).fileExpiry, {
                enabled: true, defaultExpire: '7d', allowCustom: false, options: ['7d'],
            });
        });
    });

    describe('uploads', () => {
        async function loadResolver(others) {
            return loadFunction('functions/utils/fileExpiryService.js', {
                ...helpers, fetchUploadConfig: async () => ({ fileExpiry: others.fileExpiry }),
                fetchOthersConfig: async () => ({ webDAV: others.webDAV }),
            });
        }

        function uploadContext(query = '', headers = {}) {
            return createContext(`https://test/upload${query}`, { method: 'POST', headers });
        }

        it('applies the configured default and validates client choices', async () => {
            const service = await loadResolver({ fileExpiry: enabledConfig(), webDAV: {} });
            const before = Date.now();
            const { expiresAt } = await service.resolveUploadExpiry(uploadContext());
            assert.ok(expiresAt >= before + 7 * DAY && expiresAt <= Date.now() + 7 * DAY);
            assert.ok((await service.resolveUploadExpiry(uploadContext('?expire=30d'))).error);
        });

        it('never expires files uploaded through the WebDAV internal token', async () => {
            const service = await loadResolver({
                fileExpiry: enabledConfig({ allowCustom: false }), webDAV: { internalToken: 'internal' },
            });
            assert.deepEqual(await service.resolveUploadExpiry(uploadContext('', { Authorization: 'Bearer internal' })), { expiresAt: null });
            assert.ok((await service.resolveUploadExpiry(uploadContext('', { Authorization: 'Bearer other' }))).expiresAt);
        });
    });

    describe('HuggingFace direct upload', () => {
        it('rejects an invalid expiry before committing the file to HuggingFace', async () => {
            const commits = [];
            const route = await loadFunction('functions/upload/huggingface/commitUpload.js', {
                HuggingFaceAPI: class { async commitLfsFile(...args) { commits.push(args); return {}; } },
                resolveFileType: () => 'image/png',
                fetchPageConfig: async () => ({ config: [] }),
                fetchUploadConfig: async () => ({ huggingface: { channels: [{ name: 'hf', token: 't', repo: 'owner/repo' }] } }),
                getDatabase: () => memoryDatabase(),
                moderateContent: async () => 'None', endUpload: async () => {}, getUploadIp: () => '', getIPAddress: async () => '',
                sanitizeUploadFolder: value => value,
                createResponse: (body, init) => new Response(body, init),
                checkUploadFormat: (await loadFunction('functions/upload/uploadTools.js')).checkUploadFormat,
                userAuthCheck: async () => true, UnauthorizedResponse: () => new Response(null, { status: 401 }),
                resolveUploadExpiry: async () => ({ error: 'Invalid expire option' }),
            });
            const response = await route.onRequestPost(createContext('https://test/upload/huggingface/commitUpload?expire=30d', {
                method: 'POST',
                body: JSON.stringify({ fullId: 'a.png', filePath: 'a.png', sha256: 'x', fileSize: 1, fileName: 'a.png' }),
            }));
            assert.equal(response.status, 400);
            assert.deepEqual(commits, []);
        });
    });

    describe('file access', () => {
        let db, route;

        beforeEach(async () => {
            db = createDatabaseAdapter({ img_url: nativeKv() });
            route = await loadFunction('functions/file/[[path]].js', {
                getDatabase: () => db, ...helpers, ...fileTools, ...imageTransform,
                fetchSecurityConfig: async () => ({ access: { whiteListMode: false } }),
            });
        });

        it('returns 404 for expired files without reading storage', async () => {
            await db.put('old.png', '', { metadata: { Channel: 'CloudflareR2', ExpiresAt: Date.now() - 1 } });
            const ctx = createContext('https://test/file/old.png', {
                params: { path: 'old.png' }, env: { img_r2: { get: () => assert.fail('should not read storage') } },
            });
            assert.equal((await route.onRequest(ctx)).status, 404);
        });

        function r2Env(reads = []) {
            return { img_r2: { async get(id) { reads.push(id); return { body: new Response('x').body, size: 1, writeHttpMetadata() {} }; } } };
        }

        function request(id, { method = 'GET', headers = {}, env = r2Env() } = {}) {
            return route.onRequest(createContext(`https://test/file/${id}`, { method, headers, env, params: { path: id } }));
        }

        it('serves expiring files with private caching limited to the remaining validity', async () => {
            await db.put('soon.png', '', { metadata: { Channel: 'CloudflareR2', FileType: 'image/png', ExpiresAt: Date.now() + 120 * 1000 } });
            const response = await request('soon.png');
            assert.equal(response.status, 200);
            const cacheControl = response.headers.get('Cache-Control');
            assert.match(cacheControl, /^private, max-age=\d+$/);
            const maxAge = Number(/max-age=(\d+)/.exec(cacheControl)[1]);
            assert.ok(maxAge > 100 && maxAge <= 120, cacheControl);
        });

        it('revalidates expiring files with an ETag and answers 304 without reading storage', async () => {
            const metadata = { Channel: 'CloudflareR2', FileType: 'image/png', TimeStamp: NOW, ExpiresAt: Date.now() + 7 * DAY };
            await db.put('week.png', '', { metadata });
            const etag = helpers.buildExpiringFileEtag(metadata);

            for (const method of ['GET', 'HEAD']) {
                const response = await request('week.png', { method });
                assert.equal(response.status, 200, method);
                assert.equal(response.headers.get('ETag'), etag, method);
                assert.equal(response.headers.get('Cache-Control'), 'private, max-age=3600', method);
            }

            const reads = [];
            const revalidated = await request('week.png', { headers: { 'If-None-Match': etag }, env: r2Env(reads) });
            assert.equal(revalidated.status, 304);
            assert.equal(revalidated.headers.get('ETag'), etag);
            assert.equal(revalidated.headers.get('Cache-Control'), 'private, max-age=3600');
            assert.deepEqual(reads, []);

            // Once expired, a matching ETag no longer helps
            await db.put('week.png', '', { metadata: { ...metadata, ExpiresAt: Date.now() - 1 } });
            assert.equal((await request('week.png', { headers: { 'If-None-Match': etag } })).status, 404);
        });

        it('leaves permanent files on the original shared caching without an ETag', async () => {
            await db.put('forever.png', '', { metadata: { Channel: 'CloudflareR2', FileType: 'image/png', TimeStamp: NOW } });
            const response = await request('forever.png');
            assert.equal(response.headers.get('Cache-Control'), 'public, max-age=2592000');
            assert.equal(response.headers.get('ETag'), null);
        });
    });

    describe('Worker cache', () => {
        // The real cache function from the generated Worker entry, with the file route's
        // check and a Cache API double that, like Cloudflare's, only sees this data center
        let db, route, cache, tasks, storageReads, previousCaches;

        beforeEach(async () => {
            db = createDatabaseAdapter({ img_url: nativeKv() });
            route = await loadFunction('functions/file/[[path]].js', {
                getDatabase: () => db, ...helpers, ...fileTools, ...imageTransform,
                fetchSecurityConfig: async () => ({ access: { whiteListMode: false } }),
            });
            const entries = new Map();
            cache = {
                entries,
                async match(request) { return entries.get(request.url)?.clone(); },
                async put(request, response) { entries.set(request.url, response); },
                async delete(request) { return entries.delete(request.url); },
            };
            previousCaches = globalThis.caches;
            globalThis.caches = { default: cache };
            tasks = [];
            storageReads = 0;
        });

        afterEach(() => {
            globalThis.caches = previousCaches;
        });

        async function fetchFile(id, method = 'GET') {
            const context = createContext(`https://test/file/${id}`, {
                method, params: { path: id },
                env: { img_r2: { async get() { storageReads++; return { body: new Response('x').body, size: 1, writeHttpMetadata() {} }; } } },
            });
            const ctx = { waitUntil: promise => tasks.push(promise) };
            const response = await maybeServeFromCache(context.request, ctx,
                () => route.onRequest(context), () => route.isCachedResponseServable(context));
            await Promise.all(tasks);
            return response;
        }

        it('keeps serving cached permanent files without reading storage', async () => {
            await db.put('photo.png', '', { metadata: { Channel: 'CloudflareR2', FileType: 'image/png' } });
            assert.equal((await fetchFile('photo.png')).status, 200);
            assert.equal((await fetchFile('photo.png')).status, 200);
            assert.equal(storageReads, 1);
        });

        it('stops serving a cached permanent file once it is given an expiry, before and after it is due', async () => {
            const metadata = { Channel: 'CloudflareR2', FileType: 'image/png' };
            await db.put('photo.png', '', { metadata });
            await fetchFile('photo.png');
            assert.equal(cache.entries.size, 1);

            await db.put('photo.png', '', { metadata: { ...metadata, ExpiresAt: Date.now() + DAY } });
            const response = await fetchFile('photo.png');
            assert.equal(response.status, 200);
            assert.equal(response.headers.get('Cache-Control'), 'private, max-age=3600');
            assert.equal(storageReads, 2);
            // The stale public entry is dropped and the private response is not stored
            assert.equal(cache.entries.size, 0);

            await fetchFile('photo.png');
            await db.put('photo.png', '', { metadata: { ...metadata, ExpiresAt: Date.now() - 1 } });
            for (const method of ['GET', 'HEAD']) {
                assert.equal((await fetchFile('photo.png', method)).status, 404, method);
            }
        });

        it('drops cached entries for files that were expired or deleted after caching', async () => {
            const metadata = { Channel: 'CloudflareR2', FileType: 'image/png' };
            await db.put('due.png', '', { metadata });
            await db.put('gone.png', '', { metadata });
            await fetchFile('due.png');
            await fetchFile('gone.png');
            // On KV a missing record falls back to the legacy Telegraph path; answer it with a 404 here
            const previousFetch = globalThis.fetch;
            globalThis.fetch = async () => new Response('missing', { status: 404 });
            try {
                await db.put('due.png', '', { metadata: { ...metadata, ExpiresAt: Date.now() - 1 } });
                await db.delete('gone.png');
                for (const method of ['HEAD', 'GET']) {
                    assert.equal((await fetchFile('due.png', method)).status, 404, method);
                    assert.equal((await fetchFile('gone.png', method)).status, 404, method);
                }
            } finally {
                globalThis.fetch = previousFetch;
            }
            assert.equal(cache.entries.has('https://test/file/due.png'), false);
        });

        it('treats a missing KV record as not servable from cache', async () => {
            const context = { env: {}, params: { path: 'missing.png' } };
            assert.equal(await route.isCachedResponseServable(context), false);
            await db.put('missing.png', '', { metadata: { Channel: 'CloudflareR2' } });
            assert.equal(await route.isCachedResponseServable(context), true);
        });
    });

    describe('cleanup', () => {
        async function loadCleanup(db, env, extra = {}) {
            const index = await loadFunction('functions/utils/indexManager.js', {
                getDatabase: () => db, checkDatabaseConfig: () => ({ usingD1: false }),
            });
            const purges = [];
            const deletion = await loadFunction('functions/api/manage/delete/[[path]].js', {
                getDatabase: () => db, ...index,
                purgeCFCache: async () => purges.push('file'),
                purgeRandomFileListCache: async () => purges.push('random'),
                purgePublicFileListCache: async () => purges.push('public'),
            });
            const service = await loadFunction('functions/utils/fileExpiryService.js', {
                getDatabase: () => db, ...index, ...deletion, ...helpers,
                fetchUploadConfig: async () => ({ fileExpiry: enabledConfig() }),
                fetchOthersConfig: async () => ({ webDAV: {} }), ...extra,
            });
            const context = { env, backgroundTasks: [], waitUntil(promise) { this.backgroundTasks.push(promise); } };
            return { service, index, context, purges };
        }

        function r2(objects) {
            return { img_r2: { async delete(id) { objects.delete(id); } } };
        }

        // Index removal records one operation; fail it to check that nothing is deleted without it
        function failIndexOperations(db, times = 1) {
            const put = db.put.bind(db);
            db.put = async (key, ...args) => {
                if (key.startsWith('manage@index@operation_') && times-- > 0) throw new Error('index unavailable');
                return put(key, ...args);
            };
        }

        async function indexedIds(index, context) {
            return (await index.readIndex(context, { count: -1 })).files.map(file => file.id).sort();
        }

        async function seedIndex(db, ids) {
            await db.put('manage@index@meta', JSON.stringify({ chunkCount: 1, totalCount: ids.length }));
            await db.put('manage@index_0', JSON.stringify(ids.map(id => ({ id, metadata: {} }))));
        }

        describe('on D1 / SQLite', () => {
            it('uses the expression index instead of scanning the table', async () => {
                const { sqlite } = await sqliteDatabase();
                const plan = sqlite.db.prepare(
                    "EXPLAIN QUERY PLAN SELECT id, value, metadata FROM files WHERE json_extract(metadata, '$.ExpiresAt') <= ? " +
                    "AND COALESCE(json_extract(metadata, '$.ExpiryCleanupRetryAt'), 0) <= ? " +
                    "ORDER BY json_extract(metadata, '$.ExpiresAt') LIMIT ?"
                ).all(NOW, NOW, 5);
                assert.deepEqual(plan.map(row => row.detail), ['SEARCH files USING INDEX idx_files_expires (<expr><?)']);
            });

            it('deletes due files oldest first and leaves future and permanent files alone', async () => {
                const { db } = await sqliteDatabase();
                const objects = new Map();
                const files = {
                    'due-1.png': NOW - 2 * HOUR, 'due-2.png': NOW - HOUR, 'later.png': NOW + HOUR, 'forever.png': undefined,
                };
                for (const [id, expiresAt] of Object.entries(files)) {
                    await db.put(id, '', { metadata: { Channel: 'CloudflareR2', ...(expiresAt && { ExpiresAt: expiresAt }) } });
                    objects.set(id, 'content');
                }
                const { service, context, purges } = await loadCleanup(db, r2(objects));

                assert.deepEqual(await service.countExpiredFiles(context.env, NOW), { count: 2, capped: false });
                assert.deepEqual(await service.cleanupExpiredFiles(context, { now: NOW, limit: 1 }), { deleted: 1, failed: 0, hasMore: true });
                assert.equal(await db.getWithMetadata('due-1.png'), null);
                assert.notEqual(await db.getWithMetadata('due-2.png'), null);

                assert.deepEqual(await service.cleanupExpiredFiles(context, { now: NOW }), { deleted: 1, failed: 0, hasMore: false });
                assert.deepEqual([...objects.keys()].sort(), ['forever.png', 'later.png']);
                assert.deepEqual(await service.countExpiredFiles(context.env, NOW), { count: 0, capped: false });
                // Expiring files never enter shared caches, so cleanup does not need request-bound purges
                assert.deepEqual(purges, []);
            });

            it('waits out the grace period after expiry before deleting', async () => {
                const { db } = await sqliteDatabase();
                const objects = new Map([['recent.png', 'content']]);
                await db.put('recent.png', '', { metadata: { Channel: 'CloudflareR2', ExpiresAt: NOW - 60 * 1000 } });
                const { service, context } = await loadCleanup(db, r2(objects));

                assert.deepEqual(await service.countExpiredFiles(context.env, NOW), { count: 0, capped: false });
                assert.deepEqual(await service.cleanupExpiredFiles(context, { now: NOW }), { deleted: 0, failed: 0, hasMore: false });
                assert.deepEqual(await service.cleanupExpiredFiles(context, { now: NOW + service.CLEANUP_GRACE_MS }), { deleted: 1, failed: 0, hasMore: false });
                assert.equal(objects.size, 0);
            });

            it('rechecks each file before deletion instead of trusting the listed snapshot', async () => {
                const { db } = await sqliteDatabase();
                const objects = new Map([['renewed.png', 'content'], ['forever.png', 'content']]);
                await db.put('renewed.png', '', { metadata: { Channel: 'CloudflareR2', ExpiresAt: NOW - HOUR } });
                await db.put('forever.png', '', { metadata: { Channel: 'CloudflareR2', ExpiresAt: NOW - HOUR } });
                // Changes land after the due list was read, as during a long cleanup queue
                const listExpiredFiles = db.listExpiredFiles.bind(db);
                db.listExpiredFiles = async (...args) => {
                    const rows = await listExpiredFiles(...args);
                    await db.put('renewed.png', '', { metadata: { Channel: 'CloudflareR2', ExpiresAt: NOW + DAY } });
                    await db.put('forever.png', '', { metadata: { Channel: 'CloudflareR2' } });
                    return rows;
                };
                const { service, context } = await loadCleanup(db, r2(objects));

                assert.deepEqual(await service.cleanupExpiredFiles(context, { now: NOW }), { deleted: 0, failed: 0, hasMore: false });
                assert.equal(objects.size, 2);
                assert.equal((await db.getWithMetadata('renewed.png')).metadata.ExpiresAt, NOW + DAY);
                assert.notEqual(await db.getWithMetadata('forever.png'), null);
            });

            it('never deletes a record that was replaced while its storage was being deleted', async () => {
                const { db } = await sqliteDatabase();
                await db.put('photo.png', '', { metadata: { Channel: 'CloudflareR2', ExpiresAt: NOW - HOUR } });
                const env = { img_r2: { async delete() {
                    await db.put('photo.png', 'new', { metadata: { Channel: 'CloudflareR2', FileName: 'new upload' } });
                } } };
                const { service, context } = await loadCleanup(db, env);

                assert.deepEqual(await service.cleanupExpiredFiles(context, { now: NOW }), { deleted: 0, failed: 1, hasMore: false });
                assert.equal((await db.getWithMetadata('photo.png')).metadata.FileName, 'new upload');
            });

            it('isolates failures per file and keeps failed files for the next run', async () => {
                const { db } = await sqliteDatabase();
                const objects = new Map([['broken.png', 'content'], ['fine.png', 'content']]);
                await db.put('broken.png', '', { metadata: { Channel: 'CloudflareR2', ExpiresAt: NOW - 2 * HOUR } });
                await db.put('fine.png', '', { metadata: { Channel: 'CloudflareR2', ExpiresAt: NOW - HOUR } });
                const env = { img_r2: { async delete(id) {
                    if (id === 'broken.png') throw new Error('storage unavailable');
                    objects.delete(id);
                } } };
                const { service, context } = await loadCleanup(db, env);

                assert.deepEqual(await service.cleanupExpiredFiles(context, { now: NOW }), { deleted: 1, failed: 1, hasMore: false });
                assert.notEqual(await db.getWithMetadata('broken.png'), null);
                assert.equal(await db.getWithMetadata('fine.png'), null);
                assert.deepEqual([...objects.keys()], ['broken.png']);
                // Waiting for its retry, the failed file is not counted as cleanable until then
                assert.deepEqual(await service.countExpiredFiles(context.env, NOW), { count: 0, capped: false });
                const retry = NOW + service.CLEANUP_RETRY_MS + service.CLEANUP_GRACE_MS;
                assert.deepEqual(await service.countExpiredFiles(context.env, retry), { count: 1, capped: false });
            });

            it('keeps files whose channel reports a failed deletion instead of dropping their record', async () => {
                const { db } = await sqliteDatabase();
                // WebDAV without channel credentials: the channel helper returns false instead of throwing
                await db.put('remote.png', '', { metadata: { Channel: 'WebDAV', ExpiresAt: NOW - HOUR } });
                const { service, context } = await loadCleanup(db, {});

                assert.deepEqual(await service.cleanupExpiredFiles(context, { now: NOW }), { deleted: 0, failed: 1, hasMore: false });
                assert.notEqual(await db.getWithMetadata('remote.png'), null);
            });

            it('defers persistently failing files so later due files are still cleaned', async () => {
                const { db } = await sqliteDatabase();
                const objects = new Map([['broken.png', 'content'], ['fine.png', 'content']]);
                await db.put('broken.png', '', { metadata: { Channel: 'CloudflareR2', ExpiresAt: NOW - 2 * HOUR } });
                await db.put('fine.png', '', { metadata: { Channel: 'CloudflareR2', ExpiresAt: NOW - HOUR } });
                let fail = true;
                const env = { img_r2: { async delete(id) {
                    if (id === 'broken.png' && fail) throw new Error('storage unavailable');
                    objects.delete(id);
                } } };
                const { service, context } = await loadCleanup(db, env);

                // Batches of one: the oldest file fails first, then must not block the next one
                assert.deepEqual(await service.cleanupExpiredFiles(context, { now: NOW, limit: 1 }), { deleted: 0, failed: 1, hasMore: true });
                assert.deepEqual(await service.cleanupExpiredFiles(context, { now: NOW, limit: 1 }), { deleted: 1, failed: 0, hasMore: true });
                assert.deepEqual([...objects.keys()], ['broken.png']);
                assert.deepEqual(await service.cleanupExpiredFiles(context, { now: NOW, limit: 1 }), { deleted: 0, failed: 0, hasMore: false });

                fail = false;
                // Retry times are compared with the same cutoff as expiry times
                const retry = NOW + service.CLEANUP_RETRY_MS + service.CLEANUP_GRACE_MS;
                assert.deepEqual(await service.cleanupExpiredFiles(context, { now: retry, limit: 1 }), { deleted: 1, failed: 0, hasMore: true });
                assert.equal(objects.size, 0);
                assert.equal(await db.getWithMetadata('broken.png'), null);
            });

            it('keeps a replacement that happens to carry the same expiry time', async () => {
                const { db } = await sqliteDatabase();
                await db.put('photo.png', '', { metadata: { Channel: 'CloudflareR2', TimeStamp: 1, ExpiresAt: NOW - HOUR } });
                const env = { img_r2: { async delete() {
                    // e.g. restored from a backup between the recheck and the record deletion
                    await db.put('photo.png', 'new', { metadata: { Channel: 'CloudflareR2', TimeStamp: 2, ExpiresAt: NOW - HOUR } });
                } } };
                const { service, context } = await loadCleanup(db, env);

                assert.deepEqual(await service.cleanupExpiredFiles(context, { now: NOW }), { deleted: 0, failed: 1, hasMore: false });
                assert.equal((await db.getWithMetadata('photo.png')).metadata.TimeStamp, 2);
            });

            it('deletes nothing when the index cannot be updated and finishes on the next run', async () => {
                const { db } = await sqliteDatabase();
                const objects = new Map([['due.png', 'content']]);
                await db.put('due.png', '', { metadata: { Channel: 'CloudflareR2', ExpiresAt: NOW - HOUR } });
                failIndexOperations(db);
                const { service, context } = await loadCleanup(db, r2(objects));

                assert.deepEqual(await service.cleanupExpiredFiles(context, { now: NOW }), { deleted: 0, failed: 1, hasMore: false });
                assert.ok(objects.has('due.png'));
                assert.notEqual(await db.getWithMetadata('due.png'), null);

                assert.deepEqual(await service.cleanupExpiredFiles(context, { now: NOW }), { deleted: 1, failed: 0, hasMore: false });
                assert.equal(objects.size, 0);
            });
        });

        describe('on KV', () => {
            // The real KV adapter writes markers; kv is the namespace behind it
            let kv, db, objects, cleanup;

            beforeEach(async () => {
                kv = nativeKv();
                db = createDatabaseAdapter({ img_url: kv });
                objects = new Map();
                cleanup = await loadCleanup(db, r2(objects));
            });

            async function put(id, expiresAt) {
                await db.put(id, '', { metadata: { Channel: 'CloudflareR2', ExpiresAt: expiresAt } });
                objects.set(id, 'content');
            }

            function markers() {
                return [...kv.records.keys()].filter(key => key.startsWith(helpers.EXPIRY_MARKER_PREFIX));
            }

            it('writes one marker per expiring file record and none for permanent files or settings', async () => {
                await put('due.png', NOW - 1);
                await db.put('forever.png', '', { metadata: { Channel: 'CloudflareR2' } });
                await db.put('manage@sysConfig@others', '{}', { metadata: { ExpiresAt: NOW } });
                assert.deepEqual(markers(), [helpers.buildExpiryMarkerKey(NOW - 1, 'due.png')]);
            });

            it('writes the marker before the record, so a failed marker write leaves no untracked file', async () => {
                const write = kv.put.bind(kv);
                kv.put = async (key, ...args) => {
                    if (key.startsWith(helpers.EXPIRY_MARKER_PREFIX)) throw new Error('kv write failed');
                    return write(key, ...args);
                };
                await assert.rejects(put('photo.png', NOW + DAY), /kv write failed/);
                assert.equal(kv.records.has('photo.png'), false);
            });

            it('deletes due files and their markers, stopping at the first marker inside the grace period', async () => {
                await put('due.png', NOW - HOUR);
                await put('recent.png', NOW - 60 * 1000);
                await put('later.png', NOW + HOUR);
                const { service, context, index } = cleanup;
                await seedIndex(db, ['due.png', 'recent.png', 'later.png']);

                assert.deepEqual(await service.countExpiredFiles(context.env, NOW), { count: 1, capped: false });
                assert.deepEqual(await service.cleanupExpiredFiles(context, { now: NOW }), { deleted: 1, failed: 0, hasMore: false });
                assert.equal(kv.records.has('due.png'), false);
                assert.equal(objects.has('due.png'), false);
                assert.deepEqual(markers(), [
                    helpers.buildExpiryMarkerKey(NOW - 60 * 1000, 'recent.png'),
                    helpers.buildExpiryMarkerKey(NOW + HOUR, 'later.png'),
                ]);
                assert.deepEqual(await indexedIds(index, context), ['later.png', 'recent.png']);
            });

            it('drops stale markers after a move, permanent change or extension without deleting the file', async () => {
                await put('moved.png', NOW - HOUR);
                await db.delete('moved.png');
                await put('kept.png', NOW - HOUR);
                await db.put('kept.png', '', { metadata: { Channel: 'CloudflareR2' } });
                await put('extended.png', NOW - HOUR);
                await db.put('extended.png', '', { metadata: { Channel: 'CloudflareR2', ExpiresAt: NOW + DAY } });

                assert.deepEqual(await cleanup.service.cleanupExpiredFiles(cleanup.context, { now: NOW }), { deleted: 0, failed: 0, hasMore: false });
                assert.ok(objects.has('kept.png') && objects.has('extended.png'));
                // The extension gets a marker at its new time even if the edit path missed it
                assert.deepEqual(markers(), [helpers.buildExpiryMarkerKey(NOW + DAY, 'extended.png')]);
            });

            it('still removes deleted files from the index when deleting their marker fails, and retries the marker', async () => {
                await put('due.png', NOW - HOUR);
                const { service, context, index } = cleanup;
                await seedIndex(db, ['due.png']);
                const remove = db.delete.bind(db);
                let failMarker = true;
                db.delete = async key => {
                    if (key.startsWith(helpers.EXPIRY_MARKER_PREFIX) && failMarker) { failMarker = false; throw new Error('kv unavailable'); }
                    return remove(key);
                };

                assert.deepEqual(await service.cleanupExpiredFiles(context, { now: NOW }), { deleted: 1, failed: 0, hasMore: false });
                assert.equal(kv.records.has('due.png'), false);
                assert.deepEqual(await indexedIds(index, context), []);
                assert.equal(markers().length, 1);

                // The leftover marker points at a missing record: the next run finishes it
                assert.deepEqual(await service.cleanupExpiredFiles(context, { now: NOW }), { deleted: 0, failed: 0, hasMore: false });
                assert.deepEqual(markers(), []);
            });

            it('moves the marker of a failing file to its retry time so later files are still cleaned', async () => {
                await put('broken.png', NOW - 2 * HOUR);
                await put('fine.png', NOW - HOUR);
                let fail = true;
                const env = { img_r2: { async delete(id) {
                    if (id === 'broken.png' && fail) throw new Error('storage unavailable');
                    objects.delete(id);
                } } };
                const { service, context } = await loadCleanup(db, env);

                assert.deepEqual(await service.cleanupExpiredFiles(context, { now: NOW, limit: 1 }), { deleted: 0, failed: 1, hasMore: true });
                const retry = NOW + service.CLEANUP_RETRY_MS;
                assert.deepEqual(markers(), [
                    helpers.buildExpiryMarkerKey(NOW - HOUR, 'fine.png'),
                    helpers.buildExpiryMarkerKey(retry, 'broken.png'),
                ]);
                assert.deepEqual(await service.cleanupExpiredFiles(context, { now: NOW, limit: 1 }), { deleted: 1, failed: 0, hasMore: true });

                fail = false;
                assert.deepEqual(await service.cleanupExpiredFiles(context, { now: retry + service.CLEANUP_GRACE_MS }), { deleted: 1, failed: 0, hasMore: false });
                assert.deepEqual(markers(), []);
                assert.equal(objects.size, 0);
            });

            it('cleans a file once when a metadata write restored its original marker after a deferral', async () => {
                await put('photo.png', NOW - 2 * HOUR);
                let fail = true;
                const env = { img_r2: { async delete(id) {
                    if (fail) throw new Error('storage unavailable');
                    objects.delete(id);
                } } };
                const { service, context } = await loadCleanup(db, env);
                assert.deepEqual(await service.cleanupExpiredFiles(context, { now: NOW }), { deleted: 0, failed: 1, hasMore: false });

                // A later metadata write (tags, block list ...) makes the adapter write the original marker again
                await db.put('photo.png', '', { metadata: { Channel: 'CloudflareR2', ExpiresAt: NOW - 2 * HOUR, Tags: ['x'] } });
                assert.equal(markers().length, 2);

                fail = false;
                const later = NOW + service.CLEANUP_RETRY_MS + service.CLEANUP_GRACE_MS;
                assert.deepEqual(await service.countExpiredFiles(context.env, later), { count: 1, capped: false });
                assert.deepEqual(await service.cleanupExpiredFiles(context, { now: later }), { deleted: 1, failed: 0, hasMore: false });
                assert.deepEqual(markers(), []);
            });

            it('keeps the marker when the index cannot be updated so the next run can finish', async () => {
                await put('due.png', NOW - HOUR);
                const { service, context, index } = cleanup;
                await seedIndex(db, ['due.png']);
                failIndexOperations(db);

                assert.deepEqual(await service.cleanupExpiredFiles(context, { now: NOW }), { deleted: 0, failed: 1, hasMore: false });
                assert.ok(objects.has('due.png'));
                assert.equal(markers().length, 1);

                assert.deepEqual(await service.cleanupExpiredFiles(context, { now: NOW }), { deleted: 1, failed: 0, hasMore: false });
                assert.deepEqual(await indexedIds(index, context), []);
                assert.deepEqual(markers(), []);
            });

            it('isolates marker read and write failures per file', async () => {
                await put('unreadable.png', NOW - 2 * HOUR);
                await put('extended.png', NOW - HOUR - 1);
                await db.put('extended.png', '', { metadata: { Channel: 'CloudflareR2', ExpiresAt: NOW + DAY } });
                await put('due.png', NOW - HOUR);
                const read = db.getWithMetadata.bind(db);
                db.getWithMetadata = async key => {
                    if (key === 'unreadable.png') throw new Error('kv read failed');
                    return read(key);
                };
                const write = db.put.bind(db);
                db.put = async (key, ...args) => {
                    if (key.startsWith(helpers.EXPIRY_MARKER_PREFIX)) throw new Error('kv write failed');
                    return write(key, ...args);
                };

                assert.deepEqual(await cleanup.service.cleanupExpiredFiles(cleanup.context, { now: NOW }), { deleted: 1, failed: 2, hasMore: false });
                assert.equal(kv.records.has('due.png'), false);
                assert.ok(objects.has('unreadable.png') && objects.has('extended.png'));
            });

            it('rechecks the record before deleting it so a replacement survives', async () => {
                await put('photo.png', NOW - HOUR);
                const env = { img_r2: { async delete() {
                    await db.put('photo.png', 'new', { metadata: { Channel: 'CloudflareR2', FileName: 'new upload' } });
                } } };
                const { service, context } = await loadCleanup(db, env);

                assert.deepEqual(await service.cleanupExpiredFiles(context, { now: NOW }), { deleted: 0, failed: 1, hasMore: false });
                assert.equal((await db.getWithMetadata('photo.png')).metadata.FileName, 'new upload');
            });
        });

        it('treats a Discord message or HuggingFace file that is already gone as deleted', async () => {
            const { DiscordAPI } = await import('../functions/utils/storage/discordAPI.js');
            const { HuggingFaceAPI } = await import('../functions/utils/storage/huggingfaceAPI.js');
            const previousFetch = globalThis.fetch;
            try {
                const discord = [
                    ['deleted', 204, null, true],
                    ['unknown message', 404, { code: 10008, message: 'Unknown Message' }, true],
                    ['unknown channel', 404, { code: 10003, message: 'Unknown Channel' }, false],
                    ['404 without a body', 404, null, false],
                    ['forbidden', 403, null, false],
                    ['server error', 500, null, false],
                ];
                for (const [label, status, body, expected] of discord) {
                    globalThis.fetch = async () => new Response(body && JSON.stringify(body), { status });
                    assert.equal(await new DiscordAPI('token').deleteMessage('channel', 'message'), expected, `discord ${label}`);
                }

                const huggingface = [
                    ['deleted', 200, null, true],
                    ['missing file', 404, 'EntryNotFound', true],
                    ['missing repository', 404, 'RepoNotFound', false],
                    ['missing branch', 404, 'RevisionNotFound', false],
                    ['404 without an error code', 404, null, false],
                    ['forbidden', 403, null, false],
                ];
                for (const [label, status, errorCode, expected] of huggingface) {
                    globalThis.fetch = async () => new Response(null, { status, headers: errorCode ? { 'X-Error-Code': errorCode } : {} });
                    assert.equal(await new HuggingFaceAPI('token', 'owner/repo').deleteFile('a.png'), expected, `huggingface ${label}`);
                }
            } finally {
                globalThis.fetch = previousFetch;
            }
        });

        it('sizes each run from the subrequest budget', async () => {
            const { service } = await loadCleanup(memoryDatabase(), {});
            assert.equal(service.getCleanupBatchSize({}, false), 14);
            assert.equal(service.getCleanupBatchSize({}, true), 8);
            assert.equal(service.getCleanupBatchSize({ EXPIRY_CLEANUP_SUBREQUESTS: '1000' }, false), 332);
        });
    });

    describe('management', () => {
        async function metadataRoute() {
            const fixture = await managementFixture();
            const route = await loadFunction('functions/api/manage/metadata/[[path]].js', fixture.mocks);
            const patch = body => {
                const context = createContext('https://test/api/manage/metadata/photo.png', {
                    method: 'PATCH', body: JSON.stringify(body), env: fixture.env, params: { path: 'photo.png' },
                });
                return route.onRequest(context).then(async response => {
                    await Promise.all(context.backgroundTasks);
                    return response;
                });
            };
            return { fixture, patch };
        }

        it('lets administrators change or clear the expiry and keeps KV markers in step', async () => {
            const { fixture, patch } = await metadataRoute();
            const soon = Date.now() + HOUR;
            await fixture.seed([{ id: 'photo.png', metadata: { Channel: 'CloudflareR2', ExpiresAt: soon } }]);

            const later = Date.now() + DAY;
            assert.equal((await patch({ ExpiresAt: later })).status, 200);
            assert.equal((await fixture.db.getWithMetadata('photo.png')).metadata.ExpiresAt, later);
            assert.equal((await patch({ ExpiresAt: null })).status, 200);
            assert.equal('ExpiresAt' in (await fixture.db.getWithMetadata('photo.png')).metadata, false);

            for (const invalid of [Date.now() - 1, '2026-10-25', 1.5]) {
                assert.equal((await patch({ ExpiresAt: invalid })).status, 400);
            }
        });

        it('purges configured CDN caches only when the expiry moves earlier', async () => {
            const { fixture, patch } = await metadataRoute();
            await fixture.seed([{ id: 'photo.png', metadata: { Channel: 'CloudflareR2' } }]);
            const filePurges = () => fixture.purges.filter(([kind]) => kind === 'file').length;

            await patch({ ExpiresAt: Date.now() + DAY });
            assert.deepEqual(fixture.purges, [['file', 'https://test/file/photo.png']]);
            await patch({ ExpiresAt: Date.now() + 2 * DAY });
            await patch({ FileName: 'renamed.png' });
            assert.equal(filePurges(), 1);
            await patch({ ExpiresAt: Date.now() + HOUR });
            assert.equal(filePurges(), 2);
            await patch({ ExpiresAt: null });
            assert.equal(filePurges(), 2);
        });

        it('refuses to renew or edit files that have already expired', async () => {
            const { fixture, patch } = await metadataRoute();
            const expiredAt = Date.now() - 1;
            await fixture.seed([{ id: 'photo.png', metadata: { Channel: 'CloudflareR2', ExpiresAt: expiredAt } }]);

            for (const body of [{ ExpiresAt: Date.now() + DAY }, { ExpiresAt: null }, { FileName: 'renamed.png' }]) {
                const response = await patch(body);
                assert.equal(response.status, 409, JSON.stringify(body));
                assert.equal((await response.json()).success, false);
            }
            assert.equal((await fixture.db.getWithMetadata('photo.png')).metadata.ExpiresAt, expiredAt);
        });

        it('writes a marker for the new ID when a file is moved on KV', async () => {
            const fixture = await managementFixture();
            const move = await loadFunction('functions/api/manage/move/[[path]].js', {
                ...fixture.mocks, getDatabase: () => createDatabaseAdapter({ img_url: fixture.db }),
            });
            await fixture.seed([{ id: 'album/photo.png', metadata: { Channel: 'CloudflareR2', ExpiresAt: NOW } }]);
            const ctx = createContext('https://test/api/manage/move/album,photo.png?dist=archive', {
                env: fixture.env, params: { path: encodeURIComponent('album,photo.png') },
            });
            assert.equal((await move.onRequest(ctx)).status, 200);
            assert.ok(fixture.db.records.has(helpers.buildExpiryMarkerKey(NOW, 'archive/photo.png')));
        });

        it('keeps the internal cleanup retry time out of management views and backups', async () => {
            const metadataSecurity = await import('../functions/utils/metadata/metadataSecurity.js');
            const metadata = { Channel: 'CloudflareR2', ExpiresAt: NOW, ExpiryCleanupRetryAt: NOW + HOUR };
            assert.deepEqual(metadataSecurity.stripSensitiveMetadata(metadata), { Channel: 'CloudflareR2', ExpiresAt: NOW });
            assert.equal('ExpiryCleanupRetryAt' in metadataSecurity.cleanPersistedMetadata(metadata), false);
        });

        it('leaves expiry markers out of settings backups', async () => {
            const db = memoryDatabase();
            await db.put('manage@sysConfig@upload', '{}');
            await db.put(helpers.buildExpiryMarkerKey(NOW, 'photo.png'), '');
            const route = await loadFunction('functions/api/manage/batch/settings.js', { getDatabase: () => db });
            const response = await route.onRequestGet(createContext('https://test/api/manage/batch/settings'));
            assert.deepEqual(Object.keys((await response.json()).settings), ['sysConfig@upload']);
        });
    });

    describe('runtimes and background entries', () => {
        async function loadService(overrides = {}) {
            const seen = [];
            const service = await loadFunction('functions/utils/fileExpiryService.js', {
                ...helpers,
                getDatabase: env => { seen.push(env.SERVER_RUNTIME); return { listExpiredFiles: async () => [] }; },
                fetchUploadConfig: async () => ({ fileExpiry: enabledConfig() }),
                batchRemoveFilesFromIndex: async () => ({ success: true }),
                deleteStoredFile: async () => {},
                ...overrides,
            });
            return { service, seen };
        }

        // Each HTTP entry declares its platform the way it does in production (Pages declares nothing),
        // and the root middleware turns that into env.SERVER_RUNTIME before the management route runs
        for (const [runtime, data] of [['pages', {}], ['worker', { serverRuntime: 'worker' }], ['node', { serverRuntime: 'node' }]]) {
            it(`cleans up on ${runtime} management requests only when that platform has no scheduler`, async () => {
                const { service, seen } = await loadService();
                const { onRequest: rootMiddleware } = await import('../functions/_middleware.js');
                const tasks = [];
                const context = {
                    env: { SERVER_RUNTIME: 'node' }, data,
                    waitUntil: promise => tasks.push(promise),
                    next: async () => { service.maybeCleanupExpiredFiles(context); return new Response('ok'); },
                };
                await rootMiddleware(context);
                await Promise.all(tasks);
                assert.deepEqual(seen, runtime === 'pages' ? ['pages'] : []);
            });
        }

        for (const runtime of ['worker', 'node']) {
            it(`marks the ${runtime} background entry explicitly without changing the shared environment`, async () => {
                const { service, seen } = await loadService();
                // A stale value from an earlier request or a configured variable must not leak in
                const env = { SERVER_RUNTIME: 'pages', img_d1: {} };
                assert.deepEqual(await service.runExpiryCleanupJob(env, runtime, () => {}), { deleted: 0, failed: 0, hasMore: false });
                assert.deepEqual(seen, [runtime]);
                assert.equal(env.SERVER_RUNTIME, 'pages');
            });
        }

        it('runs the Docker timer through the node background entry', async () => {
            const { startExpiryCleanupTimer } = await import('../deploy/server/expiryCleanup.js');
            const calls = [];
            let scheduled;
            const runOnce = startExpiryCleanupTimer({
                runExpiryCleanupJob: async (env, runtime, waitUntil, options) => {
                    calls.push([env.marker, runtime, options.limit]);
                    return { deleted: 0, failed: 0, hasMore: false };
                },
                createEnv: () => ({ marker: 'docker-env', SERVER_RUNTIME: 'pages' }),
                intervalMinutes: 10,
                schedule: (fn, ms) => { scheduled = [fn, ms]; },
            });
            assert.equal(scheduled[1], 10 * 60 * 1000);
            await scheduled[0]();
            await runOnce();
            assert.deepEqual(calls, [['docker-env', 'node', 100], ['docker-env', 'node', 100]]);
            assert.equal(startExpiryCleanupTimer({ intervalMinutes: 0, schedule: () => assert.fail('disabled') }), null);
        });

        it('wires the generated Worker entry to the worker background entry and the cache check', async () => {
            const { readFile } = await import('node:fs/promises');
            const generated = await readFile('deploy/worker/index.js', 'utf8');
            assert.match(generated, /runExpiryCleanupJob\(env, 'worker', /);
            assert.match(generated, /mod\.isCachedResponseServable\(context\)/);
            // The committed entry must match the generator output
            const generator = await readFile('deploy/worker/generate-routes.js', 'utf8');
            assert.ok(generator.includes("runExpiryCleanupJob(env, 'worker', "));
        });
    });
});
