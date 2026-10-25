import assert from 'node:assert/strict';
import { loadFunction, memoryDatabase } from './helpers/loadFunction.js';
import { createContext } from './helpers/context.js';
import { managementFixture } from './helpers/management.js';
import { sqliteDatabase } from './helpers/database.js';
import * as helpers from '../functions/utils/fileExpiryHelpers.js';
import * as fileTools from '../functions/file/fileTools.js';
import * as imageTransform from '../functions/file/imageTransform.js';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 9, 25);

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

        it('keeps expiring files out of shared caches and caps lifetimes at the remaining validity', () => {
            assert.equal(helpers.capCacheControl('public, max-age=2592000', NOW + 90 * 1000, NOW), 'private, max-age=90');
            assert.equal(helpers.capCacheControl('public, max-age=2592000', NOW + 90 * DAY, NOW), 'private, max-age=2592000');
            assert.equal(helpers.capCacheControl('private, max-age=86400', NOW + 90 * DAY, NOW), 'private, max-age=86400');
            assert.equal(helpers.capCacheControl('public, max-age=2592000', null, NOW), 'public, max-age=2592000');
            assert.equal(helpers.capCacheControl('private, no-store, max-age=0', NOW + DAY, NOW), 'private, no-store, max-age=0');
        });

        it('encodes markers so key order follows expiry order', () => {
            const early = helpers.buildExpiryMarkerKey(NOW, 'a/z.png');
            const late = helpers.buildExpiryMarkerKey(NOW + 1, 'a/a.png');
            assert.ok(early < late);
            assert.deepEqual(helpers.parseExpiryMarkerKey(early), { expiresAt: NOW, fileId: 'a/z.png' });
            assert.equal(helpers.parseExpiryMarkerKey('manage@expiry@bad'), null);
        });

        it('keeps saved expiry settings when a save omits them and rejects invalid ones', async () => {
            const db = memoryDatabase();
            await db.put('manage@sysConfig@others', JSON.stringify({ fileExpiry: { enabled: true, defaultExpire: '1d', options: ['1d'] } }));
            const others = await loadFunction('functions/api/manage/sysConfig/others.js', {
                getDatabase: () => db, ...helpers,
            });
            const post = body => others.onRequest(createContext('https://test/api/manage/sysConfig/others', {
                method: 'POST', body: JSON.stringify(body), env: {},
            }));

            assert.equal((await post({ webDAV: {} })).status, 200);
            assert.equal(JSON.parse(await db.get('manage@sysConfig@others')).fileExpiry.enabled, true);

            const rejected = await post({ fileExpiry: { enabled: true, defaultExpire: '1d', options: ['1y'] } });
            assert.equal(rejected.status, 400);
            assert.equal(JSON.parse(await db.get('manage@sysConfig@others')).fileExpiry.options[0], '1d');
        });
    });

    describe('user configuration', () => {
        async function userConfig(fileExpiry) {
            const route = await loadFunction('functions/api/userConfig.js', {
                fetchPageConfig: async () => ({ config: [] }),
                fetchOthersConfig: async () => ({ fileExpiry }),
            });
            return (await route.onRequest(createContext('https://test/api/userConfig'))).json();
        }

        it('publishes the choices clients may make and nothing while disabled', async () => {
            assert.equal((await userConfig(helpers.DEFAULT_FILE_EXPIRY_CONFIG)).fileExpiry, undefined);
            assert.deepEqual((await userConfig(enabledConfig())).fileExpiry, {
                defaultExpire: '7d', allowCustom: true, options: ['12h', '7d', 'forever'],
            });
            assert.deepEqual((await userConfig(enabledConfig({ allowCustom: false }))).fileExpiry, {
                defaultExpire: '7d', allowCustom: false, options: ['7d'],
            });
        });
    });

    describe('uploads', () => {
        async function loadResolver(others) {
            return loadFunction('functions/utils/fileExpiryService.js', {
                ...helpers, fetchOthersConfig: async () => others,
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

    describe('file access', () => {
        let db, route;

        beforeEach(async () => {
            db = memoryDatabase();
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

        it('serves expiring files with private caching limited to the remaining validity', async () => {
            await db.put('soon.png', '', { metadata: { Channel: 'CloudflareR2', FileType: 'image/png', ExpiresAt: Date.now() + 120 * 1000 } });
            const ctx = createContext('https://test/file/soon.png', {
                params: { path: 'soon.png' }, env: { img_r2: { async get() { return { body: new Response('x').body, size: 1, writeHttpMetadata() {} }; } } },
            });
            const response = await route.onRequest(ctx);
            assert.equal(response.status, 200);
            const cacheControl = response.headers.get('Cache-Control');
            assert.match(cacheControl, /^private, max-age=\d+$/);
            const maxAge = Number(/max-age=(\d+)/.exec(cacheControl)[1]);
            assert.ok(maxAge > 100 && maxAge <= 120, cacheControl);
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
                fetchOthersConfig: async () => ({ fileExpiry: enabledConfig(), webDAV: {} }), ...extra,
            });
            const context = { env, backgroundTasks: [], waitUntil(promise) { this.backgroundTasks.push(promise); } };
            return { service, index, context, purges };
        }

        function r2(objects) {
            return { img_r2: { async delete(id) { objects.delete(id); } } };
        }

        describe('on D1 / SQLite', () => {
            it('uses the expression index instead of scanning the table', async () => {
                const { sqlite } = await sqliteDatabase();
                const plan = sqlite.db.prepare(
                    "EXPLAIN QUERY PLAN SELECT id, value, metadata FROM files WHERE json_extract(metadata, '$.ExpiresAt') <= ? " +
                    "ORDER BY json_extract(metadata, '$.ExpiresAt') LIMIT ?"
                ).all(NOW, 5);
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

            it('keeps files whose storage deletion fails for the next run', async () => {
                const { db } = await sqliteDatabase();
                await db.put('due.png', '', { metadata: { Channel: 'CloudflareR2', ExpiresAt: NOW - 1 } });
                const env = { img_r2: { async delete() { throw new Error('storage unavailable'); } } };
                const { service, context } = await loadCleanup(db, env);
                assert.deepEqual(await service.cleanupExpiredFiles(context, { now: NOW }), { deleted: 0, failed: 1, hasMore: false });
                assert.notEqual(await db.getWithMetadata('due.png'), null);
            });
        });

        describe('on KV', () => {
            let db, objects, cleanup;

            beforeEach(async () => {
                db = memoryDatabase();
                objects = new Map();
                cleanup = await loadCleanup(db, r2(objects));
            });

            async function put(id, expiresAt) {
                const metadata = { Channel: 'CloudflareR2', ExpiresAt: expiresAt };
                await db.put(id, '', { metadata });
                await cleanup.service.trackFileExpiry(db, id, metadata);
                objects.set(id, 'content');
            }

            function markers() {
                return [...db.records.keys()].filter(key => key.startsWith(helpers.EXPIRY_MARKER_PREFIX));
            }

            it('writes one marker per expiring file and none for permanent files', async () => {
                await put('due.png', NOW - 1);
                await cleanup.service.trackFileExpiry(db, 'forever.png', { Channel: 'CloudflareR2' });
                assert.deepEqual(markers(), [helpers.buildExpiryMarkerKey(NOW - 1, 'due.png')]);
            });

            it('deletes due files and their markers, stopping at the first future marker', async () => {
                await put('due.png', NOW - 1);
                await put('later.png', NOW + HOUR);
                const { service, context, index } = cleanup;
                await db.put('manage@index@meta', JSON.stringify({ chunkCount: 1, totalCount: 2 }));
                await db.put('manage@index_0', JSON.stringify([{ id: 'due.png', metadata: {} }, { id: 'later.png', metadata: {} }]));

                assert.deepEqual(await service.countExpiredFiles(context.env, NOW), { count: 1, capped: false });
                assert.deepEqual(await service.cleanupExpiredFiles(context, { now: NOW }), { deleted: 1, failed: 0, hasMore: false });
                assert.equal(await db.getWithMetadata('due.png'), null);
                assert.equal(objects.has('due.png'), false);
                assert.deepEqual(markers(), [helpers.buildExpiryMarkerKey(NOW + HOUR, 'later.png')]);

                const files = await index.readIndex(context, { count: -1 });
                assert.deepEqual(files.files.map(file => file.id), ['later.png']);
            });

            it('drops stale markers after a move, permanent change or extension without deleting the file', async () => {
                await put('moved.png', NOW - 1);
                await db.delete('moved.png');
                await put('kept.png', NOW - 1);
                await db.put('kept.png', '', { metadata: { Channel: 'CloudflareR2' } });
                await put('extended.png', NOW - 1);
                await db.put('extended.png', '', { metadata: { Channel: 'CloudflareR2', ExpiresAt: NOW + DAY } });

                assert.deepEqual(await cleanup.service.cleanupExpiredFiles(cleanup.context, { now: NOW }), { deleted: 0, failed: 0, hasMore: false });
                assert.ok(objects.has('kept.png') && objects.has('extended.png'));
                // The extension gets a marker at its new time even if the edit path missed it
                assert.deepEqual(markers(), [helpers.buildExpiryMarkerKey(NOW + DAY, 'extended.png')]);
            });
        });

        it('sizes each run from the subrequest budget', async () => {
            const { service } = await loadCleanup(memoryDatabase(), {});
            assert.equal(service.getCleanupBatchSize({}, false), 21);
            assert.equal(service.getCleanupBatchSize({}, true), 10);
            assert.equal(service.getCleanupBatchSize({ EXPIRY_CLEANUP_SUBREQUESTS: '1000' }, false), 498);
        });
    });

    describe('management', () => {
        it('lets administrators change or clear the expiry and keeps KV markers in step', async () => {
            const fixture = await managementFixture();
            const tracked = [];
            const route = await loadFunction('functions/api/manage/metadata/[[path]].js', {
                ...fixture.mocks, trackFileExpiry: async (db, id, metadata) => tracked.push([id, metadata.ExpiresAt]),
            });
            await fixture.seed([{ id: 'photo.png', metadata: { Channel: 'CloudflareR2', ExpiresAt: NOW } }]);
            const patch = body => route.onRequest(createContext('https://test/api/manage/metadata/photo.png', {
                method: 'PATCH', body: JSON.stringify(body), env: fixture.env, params: { path: 'photo.png' },
            }));

            const later = Date.now() + DAY;
            assert.equal((await patch({ ExpiresAt: later })).status, 200);
            assert.equal((await fixture.db.getWithMetadata('photo.png')).metadata.ExpiresAt, later);
            assert.equal((await patch({ ExpiresAt: null })).status, 200);
            assert.equal('ExpiresAt' in (await fixture.db.getWithMetadata('photo.png')).metadata, false);
            assert.deepEqual(tracked, [['photo.png', later], ['photo.png', undefined]]);

            for (const invalid of [Date.now() - 1, '2026-10-25', 1.5]) {
                assert.equal((await patch({ ExpiresAt: invalid })).status, 400);
            }
        });

        it('writes a marker for the new ID when a file is moved', async () => {
            const fixture = await managementFixture();
            const tracked = [];
            const move = await loadFunction('functions/api/manage/move/[[path]].js', {
                ...fixture.mocks, trackFileExpiry: async (db, id, metadata) => tracked.push([id, metadata.ExpiresAt]),
            });
            await fixture.seed([{ id: 'album/photo.png', metadata: { Channel: 'CloudflareR2', ExpiresAt: NOW } }]);
            const ctx = createContext('https://test/api/manage/move/album,photo.png?dist=archive', {
                env: fixture.env, params: { path: encodeURIComponent('album,photo.png') },
            });
            assert.equal((await move.onRequest(ctx)).status, 200);
            assert.deepEqual(tracked, [['archive/photo.png', NOW]]);
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
});
