import assert from 'node:assert/strict';
import { loadFunction, memoryDatabase } from './helpers/loadFunction.js';
import { createContext } from './helpers/context.js';
import { managementFixture } from './helpers/management.js';
import * as fileTools from '../functions/file/fileTools.js';
import * as imageTransform from '../functions/file/imageTransform.js';
import * as adaptive from '../functions/random/adaptive.js';

describe('read and list files', () => {
    let db, mocks;

    beforeEach(() => {
        db = memoryDatabase();
        mocks = { getDatabase: () => db, checkDatabaseConfig: () => ({ usingD1: false }) };
    });

    function context(url) { return createContext(url); }

    it('preserves strict list filtering, OR selection, and generic historical metadata', async () => {
        const index = await loadFunction('functions/utils/indexManager.js', mocks);
        const files = [
            { id: 'a.png', metadata: { FileType: 'image/png' } },
            { id: 'b.mp4', metadata: { FileType: 'video/mp4' } },
            { id: 'c.bin', metadata: { FileType: 'application/x-image' } },
            { id: 'old.png', metadata: { FileType: 'application/octet-stream' } },
        ];
        await db.put('manage@index@meta', JSON.stringify({ chunkCount: 1, totalCount: files.length }));
        await db.put('manage@index_0', JSON.stringify(files));
        const ctx = context('https://test/api/manage/list');
        const images = await index.readIndex(ctx, { count: -1, fileType: ['image'] });
        assert.equal(images.success, true);
        assert.deepEqual(images.files.map(file => file.id), ['a.png']);
        const mixed = await index.readIndex(ctx, { count: -1, fileType: ['image', 'video'] });
        assert.deepEqual(mixed.files.map(file => file.id), ['a.png', 'b.mp4']);
        const other = await index.readIndex(ctx, { count: -1, fileType: ['other'] });
        assert.deepEqual(other.files.map(file => file.id), ['c.bin', 'old.png']);
        assert.equal((await index.readIndex(ctx, { count: -1, fileType: ['bogus'] })).files.length, 0);
    });

    it('keeps directory pagination, recursion and totals consistent through the management API', async () => {
        const fixture = await managementFixture();
        await fixture.seed([
            ['album/a.png', 'album/'], ['album/b.png', 'album/'], ['album/sub/c.png', 'album/sub/'], ['albumish/d.png', 'albumish/'],
        ].map(([id, Directory]) => ({ id, metadata: { Channel: 'CloudflareR2', Directory, FileName: id, FileType: 'image/png' } })));
        const route = await loadFunction('functions/api/manage/list.js', fixture.mocks);
        const list = async query => {
            const response = await route.onRequest(createContext(`https://test/api/manage/list?${query}`, { env: fixture.env }));
            assert.equal(response.status, 200);
            return response.json();
        };
        const page = await list('dir=album&start=1&count=1');
        assert.equal(page.isIndexedResponse, true);
        assert.deepEqual(page.files.map(file => file.name), ['album/b.png']);
        assert.deepEqual(page.directories, ['album/sub']);
        assert.equal(page.totalCount, 3);
        assert.equal(page.directFileCount, 2);
        assert.equal(page.returnedCount, 1);
        const recursive = await list('dir=album&count=-1&recursive=true');
        assert.deepEqual(recursive.files.map(file => file.name), ['album/a.png', 'album/b.png', 'album/sub/c.png']);
        assert.equal((await list('dir=album&count=-1&sum=true')).sum, 3);
        assert.deepEqual((await list('dir=album&search=B.PNG')).files.map(file => file.name), ['album/b.png']);
    });

    it('returns explicit errors for malformed IDs and missing records without reading storage', async () => {
        const route = await loadFunction('functions/file/[[path]].js', {
            ...mocks, ...fileTools, ...imageTransform,
            fetchSecurityConfig: async () => ({ access: { whiteListMode: false } }),
        });
        for (const [path, status] of [['%', 400], ['missing.png', 404]]) {
            const ctx = createContext('https://test/file/missing.png', {
                params: { path }, env: { img_r2: { get: () => assert.fail('should not read storage') } },
            });
            assert.equal((await route.onRequest(ctx)).status, status);
        }
    });

    it('keeps external files as redirects when no image transformation is requested', async () => {
        await db.put('external.png', '', { metadata: { Channel: 'External', ExternalLink: 'https://storage.invalid/photo.png' } });
        const route = await loadFunction('functions/file/[[path]].js', {
            ...mocks, ...fileTools, ...imageTransform,
            fetchSecurityConfig: async () => ({ access: { whiteListMode: false } }),
        });
        const response = await route.onRequest(createContext('https://test/file/external.png', { params: { path: 'external.png' } }));
        assert.equal(response.status, 302);
        assert.equal(response.headers.get('Location'), 'https://storage.invalid/photo.png');
    });

    it('requires admin authentication for previews and keeps authorized previews private', async () => {
        await db.put('blocked.png', '', { metadata: { Channel: 'CloudflareR2', FileType: 'image/png', ListType: 'Block' } });
        for (const authorized of [false, true]) {
            let reads = 0;
            const route = await loadFunction('functions/file/[[path]].js', {
                ...mocks, ...fileTools, ...imageTransform,
                fetchSecurityConfig: async () => ({ access: { whiteListMode: false } }),
                AUTH_SCOPE: { ADMIN: 'admin' },
                authenticate: async options => {
                    assert.equal(options.authScope, 'admin');
                    assert.equal(options.requiredPermission, 'manage');
                    return { authorized, authType: authorized ? 'admin' : null };
                },
            });
            const ctx = createContext('https://test/file/blocked.png?from=admin', {
                params: { path: 'blocked.png' },
                env: { img_r2: { async get() {
                    reads++;
                    return { body: new Response('image').body, writeHttpMetadata() {} };
                } } },
            });
            const response = await route.onRequest(ctx);
            assert.equal(response.status, authorized ? 200 : 401);
            assert.equal(reads, authorized ? 1 : 0);
            assert.equal(response.headers.get('Cache-Control'), authorized ? fileTools.FILE_CACHE_CONTROL.PRIVATE : fileTools.FILE_CACHE_CONTROL.NO_STORE);
        }
    });

    it('keeps content= working through the random API for records without a known type', async () => {
        const previousCaches = globalThis.caches;
        const route = await loadFunction('functions/random/index.js', {
            ...adaptive,
            fetchOthersConfig: async () => ({ randomImageAPI: { enabled: true, allowedDir: '' } }),
        });
        try {
            globalThis.caches = { default: { match: async () => new Response(JSON.stringify([{ name: 'notes.unknown', FileType: '' }])) } };
            const response = await route.onRequest({ request: new Request('https://test/random?content='), env: {} });
            assert.deepEqual(await response.json(), { url: '/file/notes.unknown' });
            const filtered = await route.onRequest({ request: new Request('https://test/random'), env: {} });
            assert.deepEqual(await filtered.json(), {});
        } finally {
            if (previousCaches === undefined) delete globalThis.caches;
            else globalThis.caches = previousCaches;
        }
    });

    it('preserves GET/HEAD/Range response behavior and Content-Type parameters without historical inference', async () => {
        const route = await loadFunction('functions/file/[[path]].js', {
            ...mocks, ...fileTools, ...imageTransform,
            fetchSecurityConfig: async () => ({ access: { whiteListMode: false } }),
        });
        for (const [type, expected] of [[' Application/PDF ; name=Photo ', 'application/pdf; name=Photo'], ['application/octet-stream', 'application/octet-stream']]) {
            await db.put('photo.jpg', '', { metadata: { Channel: 'CloudflareR2', FileName: 'photo.jpg', FileType: type } });
            for (const [method, range] of [['GET', false], ['HEAD', false], ['GET', true]]) {
                const ctx = context('https://test/file/photo.jpg');
                ctx.env.img_r2 = {};
                ctx.request = new Request(ctx.url, { method, headers: range ? { Range: 'bytes=0-1' } : {} });
                ctx.params = { path: 'photo.jpg' };
                ctx.env.img_r2.get = async (id, options) => ({
                    body: new Response(range ? 'so' : 'source').body,
                    size: 6,
                    range: options?.range,
                    writeHttpMetadata(headers) { headers.set('Content-Type', 'application/octet-stream'); },
                });
                const response = await route.onRequest(ctx);
                assert.equal(response.status, range ? 206 : 200);
                assert.equal(response.headers.get('Content-Type'), expected);
                assert.equal(await response.text(), method === 'HEAD' ? '' : range ? 'so' : 'source');
                if (range) assert.equal(response.headers.get('Content-Range'), 'bytes 0-1/6');
            }
        }
    });
});
