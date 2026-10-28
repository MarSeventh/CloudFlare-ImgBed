import assert from 'node:assert/strict';
import { loadFunction } from './helpers/loadFunction.js';
import { createContext } from './helpers/context.js';
import { managementFixture } from './helpers/management.js';
import * as batchTools from '../functions/utils/deleteBatch.js';

describe('delete files', () => {
    let fixture, single, batch;

    beforeEach(async () => {
        fixture = await managementFixture();
        single = await loadFunction('functions/api/manage/delete/[[path]].js', fixture.mocks);
        batch = await loadFunction('functions/api/manage/delete/batch.js', { ...fixture.mocks, ...batchTools, ...single });
    });

    function context(id, options = {}) {
        return createContext(`https://test/api/manage/delete/${id}`, {
            method: 'DELETE', env: fixture.env, params: { path: encodeURIComponent(id.replaceAll('/', ',')) }, ...options,
        });
    }

    it('deletes the R2 object, database record and index entry and invalidates caches', async () => {
        const id = '相册/photo.png';
        await fixture.seed([{ id, metadata: { Channel: 'CloudflareR2', FileType: 'image/png' } }]);
        const ctx = context(id);
        const response = await single.onRequest(ctx);
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { success: true, fileId: id, existed: true });
        assert.equal(fixture.objects.has(id), false);
        assert.equal(await fixture.db.getWithMetadata(id), null);
        const index = await fixture.readFiles(ctx);
        assert.equal(index.success, true);
        assert.deepEqual(index.files, []);
        assert.deepEqual(fixture.purges, [
            ['file', `https://test/file/${id}`], ['random', 'https://test', '相册'], ['public', 'https://test', '相册'],
        ]);
    });

    it('keeps repeated deletion idempotent when the record no longer exists', async () => {
        await fixture.seed([]);
        for (let attempt = 0; attempt < 2; attempt++) {
            const ctx = context('missing.png');
            const response = await single.onRequest(ctx);
            assert.equal(response.status, 200);
            const body = await response.json();
            assert.equal(body.success, true);
            assert.equal(body.existed, false);
            assert.deepEqual((await fixture.readFiles(ctx)).files, []);
        }
        assert.deepEqual(fixture.purges, []);
    });

    it('removes stale index entries even when the record no longer exists', async () => {
        // 记录不存在,但索引里残留条目:DELETE 仍应清理索引(既有行为,existed=false)
        await fixture.seed([]);
        // 直接向索引注入残留条目
        await fixture.db.put('manage@index@meta', JSON.stringify({ chunkCount: 1, totalCount: 1, lastUpdated: Date.now() }));
        await fixture.db.put('manage@index_0', JSON.stringify([{ id: 'ghost.png', metadata: { FileName: 'ghost.png' } }]));
        const ctx = context('ghost.png');
        const response = await single.onRequest(ctx);
        assert.equal(response.status, 200);
        assert.equal((await response.json()).existed, false);
        await Promise.all(ctx.backgroundTasks);
        const index = await fixture.readFiles(ctx);
        assert.deepEqual(index.files, [], 'stale index entry should be removed');
    });

    it('reports per-item existed in batch responses and separates missing ids', async () => {
        await fixture.seed(['real.png', 'missing.png'].map(id => ({ id, metadata: { Channel: 'CloudflareR2', FileType: 'image/png' } })));
        await fixture.db.delete('missing.png');
        const payload = { fileIds: ['real.png', 'missing.png'] };
        const ctx = createContext('https://test/api/manage/delete/batch', {
            method: 'POST', env: fixture.env, body: JSON.stringify(payload),
        });
        Object.defineProperty(ctx.request, 'json', { value: async () => payload });
        const response = await batch.onRequest(ctx);
        assert.equal(response.status, 200);
        const body = await response.json();
        assert.deepEqual(body.deleted, ['real.png', 'missing.png']);
        assert.deepEqual(body.missing, ['missing.png']);
        assert.deepEqual(body.failed, []);
        const detail = body.details.find((item) => item.fileId === 'missing.png');
        assert.equal(detail.success, true);
        assert.equal(detail.existed, false);
        assert.deepEqual((await fixture.readFiles(ctx)).files, []);
    });

    it('preserves folder deletion results and cleans missing records from nested indexes', async () => {
        const ids = ['album/real.png', 'album/missing.png', 'album/sub/failed.png'];
        await fixture.seed(ids.map(id => ({ id, metadata: { Channel: 'CloudflareR2' } })));
        await fixture.db.delete('album/missing.png');
        const remove = fixture.env.img_r2.delete;
        fixture.env.img_r2.delete = async id => {
            if (id.endsWith('failed.png')) throw new Error('storage unavailable');
            await remove(id);
        };
        const route = await loadFunction('functions/api/manage/delete/[[path]].js', fixture.mocks, {
            fetch: async request => {
                const folder = new URL(request.url).searchParams.get('dir');
                return Response.json(folder === 'album'
                    ? { files: ids.slice(0, 2).map(name => ({ name })), directories: ['album/sub'] }
                    : { files: [{ name: ids[2] }], directories: [] });
            },
        });
        const ctx = createContext('https://test/api/manage/delete/album?folder=true', {
            method: 'DELETE', env: fixture.env, params: { path: 'album' },
        });
        const response = await route.onRequest(ctx);
        assert.equal(response.status, 200);
        const body = await response.json();
        assert.equal(body.success, true); // Existing folder response contract, even for partial failure.
        assert.deepEqual(body.deleted, ids.slice(0, 2));
        assert.deepEqual(body.failed, [ids[2]]);
        assert.deepEqual(body.missing, [ids[1]]);
        assert.deepEqual(body.details.map(({ success, existed }) => [success, existed]), [[true, true], [true, false], [false, true]]);
        assert.deepEqual((await fixture.readFiles(ctx)).files.map(file => file.id), [ids[2]]);
        assert.equal(fixture.objects.has(ids[2]), true);
    });

    it('retains the record and index when R2 deletion throws', async () => {
        await fixture.seed([{ id: 'photo.png', metadata: { Channel: 'CloudflareR2' } }]);
        fixture.env.img_r2.delete = async () => { throw new Error('storage unavailable'); };
        const ctx = context('photo.png');
        const response = await single.onRequest(ctx);
        assert.equal(response.status, 400);
        assert.equal((await response.json()).success, false);
        assert.notEqual(await fixture.db.getWithMetadata('photo.png'), null);
        assert.equal(fixture.objects.has('photo.png'), true);
        assert.deepEqual((await fixture.readFiles(ctx)).files.map(file => file.id), ['photo.png']);
        assert.deepEqual(fixture.purges, []);
    });

    it('deletes the configured S3 key rather than assuming it equals the public file ID', async () => {
        const commands = [];
        const route = await loadFunction('functions/api/manage/delete/[[path]].js', {
            ...fixture.mocks,
            resolveS3Credentials: async () => ({ bucketName: 'bucket', key: 'stored/key.png' }),
            createS3Client: () => ({ async send(command) { commands.push(command.input); } }),
            DeleteObjectCommand: class { constructor(input) { this.input = input; } },
        });
        await fixture.seed([{ id: 'public.png', metadata: { Channel: 'S3', S3FileKey: 'stored/key.png' } }]);
        const ctx = context('public.png');
        assert.equal((await route.onRequest(ctx)).status, 200);
        assert.deepEqual(commands, [{ Bucket: 'bucket', Key: 'stored/key.png' }]);
        assert.equal(await fixture.db.getWithMetadata('public.png'), null);
        assert.deepEqual((await fixture.readFiles(ctx)).files, []);
    });

    it('normalizes and deduplicates batch IDs, preserving failures and removing only successes from the index', async () => {
        await fixture.seed(['album/photo.png', 'docs/中文.txt', 'failed.png'].map(id => ({ id, metadata: { Channel: 'CloudflareR2' } })));
        const remove = fixture.env.img_r2.delete;
        fixture.env.img_r2.delete = async id => {
            if (id === 'failed.png') throw new Error('storage unavailable');
            await remove(id);
        };
        const ctx = context('batch', { method: 'POST', body: JSON.stringify({ fileIds: ['/album/photo.png/', 'album/photo.png', ' /docs/中文.txt/ ', 'failed.png'] }) });
        const response = await batch.onRequest(ctx);
        assert.equal(response.status, 200);
        const body = await response.json();
        assert.equal(body.success, false);
        assert.deepEqual(body.deleted, ['album/photo.png', 'docs/中文.txt']);
        assert.deepEqual(body.missing, []); // 去重后无重复 id,全部真实存在
        assert.deepEqual(body.failed, [{ fileId: 'failed.png', error: 'Delete file failed' }]);
        assert.ok(body.details.length === 3);
        assert.equal(await fixture.db.getWithMetadata('album/photo.png'), null);
        assert.equal(await fixture.db.getWithMetadata('docs/中文.txt'), null);
        assert.notEqual(await fixture.db.getWithMetadata('failed.png'), null);
        assert.deepEqual((await fixture.readFiles(ctx)).files.map(file => file.id), ['failed.png']);
        assert.ok(fixture.purges.some(([kind, url]) => kind === 'file' && url === 'https://test/file/docs/%E4%B8%AD%E6%96%87.txt'));
    });

    it('rejects invalid batch requests before deleting anything', async () => {
        await fixture.seed([{ id: 'keep.png', metadata: { Channel: 'CloudflareR2' } }]);
        for (const [method, body, status] of [
            ['GET', undefined, 405], ['POST', '{', 400],
            ['POST', JSON.stringify({ fileIds: [] }), 400],
            ['POST', JSON.stringify({ fileIds: ['keep.png', 42] }), 400],
            ['POST', JSON.stringify({ fileIds: Array.from({ length: 501 }, (_, i) => `${i}.png`) }), 400],
        ]) {
            const ctx = context('batch', { method, body });
            assert.equal((await batch.onRequest(ctx)).status, status);
            assert.deepEqual(ctx.backgroundTasks, []);
        }
        assert.equal(fixture.objects.has('keep.png'), true);
        assert.notEqual(await fixture.db.getWithMetadata('keep.png'), null);
        assert.deepEqual(fixture.purges, []);
    });

    it('does not enqueue an index removal when every batch item fails', async () => {
        await fixture.seed([{ id: 'keep.png', metadata: { Channel: 'CloudflareR2' } }]);
        fixture.env.img_r2.delete = async () => { throw new Error('storage unavailable'); };
        const ctx = context('batch', { method: 'POST', body: JSON.stringify({ fileIds: ['keep.png'] }) });
        const response = await batch.onRequest(ctx);
        const result = await response.json();
        assert.equal(result.success, false);
        assert.deepEqual(result.deleted, []);
        assert.deepEqual(result.failed.map(file => file.fileId), ['keep.png']);
        assert.deepEqual(ctx.backgroundTasks, []);
    });
});
