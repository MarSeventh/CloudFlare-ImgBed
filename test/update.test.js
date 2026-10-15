import assert from 'node:assert/strict';
import { loadFunction } from './helpers/loadFunction.js';
import { createContext } from './helpers/context.js';
import { managementFixture } from './helpers/management.js';

describe('update files', () => {
    let fixture, metadata, rename, move;
    const original = {
        Channel: 'CloudflareR2', FileName: 'original.png', FileType: 'image/png',
        FileSizeBytes: 12, TimeStamp: 123, Directory: 'album/', Tags: ['keep'],
    };

    beforeEach(async () => {
        fixture = await managementFixture();
        metadata = await loadFunction('functions/api/manage/metadata/[[path]].js', fixture.mocks);
        rename = await loadFunction('functions/api/manage/rename/[[path]].js', fixture.mocks);
        move = await loadFunction('functions/api/manage/move/[[path]].js', fixture.mocks);
        await fixture.seed([{ id: 'album/photo.png', metadata: original }]);
    });

    function context(action, { id = 'album/photo.png', body, method = 'POST', query = '' } = {}) {
        return createContext(`https://test/api/manage/${action}/${id}${query}`, {
            method, body: typeof body === 'string' ? body : body === undefined ? undefined : JSON.stringify(body),
            env: fixture.env, params: { path: encodeURIComponent(id.replaceAll('/', ',')) },
        });
    }

    it('updates only allowed metadata fields and preserves file content and other metadata', async () => {
        const ctx = context('metadata', { method: 'PATCH', body: {
            FileName: '显示名称.jpg', FileType: 'image/jpeg', Channel: 'External', FileSizeBytes: 999, Tags: ['replace'],
        } });
        const response = await metadata.onRequest(ctx);
        assert.equal(response.status, 200);
        const expected = { ...original, FileName: '显示名称.jpg', FileType: 'image/jpeg' };
        assert.deepEqual((await response.json()).metadata, expected);
        assert.deepEqual(await fixture.db.getWithMetadata('album/photo.png'), { value: 'record-value', metadata: expected });
        assert.equal(fixture.objects.get('album/photo.png'), 'file-content');
        const index = await fixture.readFiles(ctx);
        assert.equal(index.success, true);
        assert.deepEqual(index.files, [{ id: 'album/photo.png', metadata: expected }]);
    });

    it('removes historical credentials from persisted metadata, response and index when editing', async () => {
        await fixture.seed([{ id: 'album/photo.png', metadata: {
            ...original, S3SecretAccessKey: 'test-secret', TgBotToken: 'test-token', WebDAVPassword: 'test-password', S3Endpoint: 'https://old.invalid',
        } }]);
        const ctx = context('metadata', { method: 'PATCH', body: { FileName: 'updated.png' } });
        const response = await metadata.onRequest(ctx);
        assert.equal(response.status, 200);
        const expected = { ...original, FileName: 'updated.png' };
        assert.deepEqual((await response.json()).metadata, expected);
        assert.deepEqual((await fixture.db.getWithMetadata('album/photo.png')).metadata, expected);
        assert.deepEqual((await fixture.readFiles(ctx)).files[0].metadata, expected);
    });

    it('rejects invalid metadata edits and missing records without writing', async () => {
        for (const [options, status] of [
            [{ method: 'GET' }, 405],
            [{ method: 'PATCH', body: '{' }, 400],
            [{ method: 'PATCH', body: { FileSizeBytes: 999 } }, 400],
            [{ method: 'PATCH', id: 'missing.png', body: { FileName: 'new.png' } }, 404],
        ]) {
            const ctx = context('metadata', options);
            assert.equal((await metadata.onRequest(ctx)).status, status);
            assert.deepEqual(ctx.backgroundTasks, []);
        }
        assert.deepEqual((await fixture.db.getWithMetadata('album/photo.png')).metadata, original);
    });

    it('renames a file across directories while preserving metadata, content and index consistency', async () => {
        const ctx = context('rename', { body: { newFileId: 'new/renamed.png' } });
        const response = await rename.onRequest(ctx);
        assert.equal(response.status, 200);
        const result = await response.json();
        assert.equal(result.newFileId, 'new/renamed.png');
        const expected = { ...original, Directory: 'new/' };
        assert.deepEqual(result.metadata, expected);
        assert.equal(await fixture.db.getWithMetadata('album/photo.png'), null);
        assert.deepEqual(await fixture.db.getWithMetadata('new/renamed.png'), { value: 'record-value', metadata: expected });
        assert.equal(fixture.objects.has('album/photo.png'), false);
        assert.equal(fixture.objects.get('new/renamed.png'), 'file-content');
        assert.deepEqual((await fixture.readFiles(ctx)).files, [{ id: 'new/renamed.png', metadata: expected }]);
        assert.deepEqual(fixture.purges, [
            ['file', 'https://test/file/album/photo.png'], ['random', 'https://test', 'album', 'new'], ['public', 'https://test', 'album', 'new'],
        ]);
    });

    it('rejects rename collisions without overwriting either record or object', async () => {
        await fixture.seed([
            { id: 'album/photo.png', metadata: original },
            { id: 'existing.png', value: 'target-value', metadata: { ...original, FileName: 'target.png' } },
        ]);
        const ctx = context('rename', { body: { newFileId: 'existing.png' } });
        const response = await rename.onRequest(ctx);
        assert.equal(response.status, 409);
        assert.equal((await fixture.db.getWithMetadata('album/photo.png')).value, 'record-value');
        assert.equal((await fixture.db.getWithMetadata('existing.png')).value, 'target-value');
        assert.equal(fixture.objects.has('album/photo.png'), true);
        assert.deepEqual(ctx.backgroundTasks, []);
        assert.deepEqual(fixture.purges, []);
    });

    it('validates rename method, JSON, name and source existence before changing records', async () => {
        for (const [options, status] of [
            [{ method: 'GET' }, 405], [{ body: '{' }, 400],
            [{ body: { newFileId: ' ' } }, 400],
            [{ id: '', body: { newFileId: 'new.png' } }, 400],
            [{ id: 'missing.png', body: { newFileId: 'new.png' } }, 404],
        ]) {
            const ctx = context('rename', options);
            assert.equal((await rename.onRequest(ctx)).status, status);
            assert.deepEqual(ctx.backgroundTasks, []);
        }
        assert.deepEqual((await fixture.db.getWithMetadata('album/photo.png')).metadata, original);
        assert.equal(fixture.objects.has('album/photo.png'), true);
    });

    for (const [destination, newId, directory] of [['new/folder', 'new/folder/photo.png', 'new/folder/'], ['', 'photo.png', '']]) {
        it(`moves a file to ${destination || 'the root'} and preserves its name and metadata`, async () => {
            const ctx = context('move', { query: `?dist=${destination}` });
            const response = await move.onRequest(ctx);
            assert.equal(response.status, 200);
            assert.equal((await response.json()).newFileId, newId);
            assert.equal(await fixture.db.getWithMetadata('album/photo.png'), null);
            const expected = { ...original, Directory: directory };
            assert.deepEqual((await fixture.db.getWithMetadata(newId)).metadata, expected);
            assert.equal(fixture.objects.get(newId), 'file-content');
            assert.equal(fixture.objects.has('album/photo.png'), false);
            assert.deepEqual((await fixture.readFiles(ctx)).files, [{ id: newId, metadata: expected }]);
        });
    }

    for (const action of ['rename', 'move']) {
        it(`preserves the source when ${action} cannot copy the R2 object`, async () => {
            fixture.env.img_r2.put = async () => { throw new Error('storage unavailable'); };
            const ctx = context(action, { body: { newFileId: 'new.png' }, query: '?dist=new' });
            const response = await (action === 'rename' ? rename : move).onRequest(ctx);
            assert.equal(response.status, action === 'rename' ? 500 : 400);
            assert.equal((await response.json()).success, false);
            assert.deepEqual((await fixture.db.getWithMetadata('album/photo.png')).metadata, original);
            assert.equal(fixture.objects.get('album/photo.png'), 'file-content');
            assert.equal(fixture.objects.size, 1);
            assert.deepEqual(ctx.backgroundTasks, []);
            assert.deepEqual(fixture.purges, []);
        });

        it(`keeps legacy Telegram ${action} unsupported without changing the record`, async () => {
            await fixture.seed([{ id: 'legacy.png', metadata: { Channel: 'Telegram', FileName: 'legacy.png' } }]);
            const ctx = context(action, { id: 'legacy.png', body: { newFileId: 'new.png' }, query: '?dist=new' });
            const response = await (action === 'rename' ? rename : move).onRequest(ctx);
            assert.equal(response.status, 400);
            assert.equal((await response.json()).success, false);
            assert.notEqual(await fixture.db.getWithMetadata('legacy.png'), null);
            assert.deepEqual(ctx.backgroundTasks, []);
        });
    }
});
