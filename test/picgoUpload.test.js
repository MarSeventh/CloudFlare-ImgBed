import assert from 'node:assert/strict';
import { File } from 'node:buffer';
import { loadFunction, memoryDatabase } from './helpers/loadFunction.js';
import * as responses from '../functions/utils/apiResponse.js';
import { png } from './helpers/files.js';

describe('picgo upload', () => {
    let db, storage, mocks, authRequests;

    beforeEach(async () => {
        db = memoryDatabase();
        storage = [];
        authRequests = [];
        const tools = await loadFunction('functions/upload/uploadTools.js', { getDatabase: () => db });
        const upload = await loadFunction('functions/upload/index.js', {
            ...tools,
            ...responses,
            getDatabase: () => db,
            fetchSecurityConfig: async () => ({ upload: { moderate: { enabled: false } } }),
            fetchUploadConfig: async () => ({ cfr2: { channels: [{ name: 'mock' }] } }),
            fetchPageConfig: async () => ({ config: [] }),
            userAuthCheck: async () => true,
            isBlockedUploadIp: async () => false,
            getIPAddress: async () => '',
            getUploadIp: () => '',
            moderateContent: async () => 'None',
            endUpload: async () => {},
        });
        mocks = {
            onRequest: upload.onRequest,
            getImageDimensions: tools.getImageDimensions,
            userAuthCheck: async (env, url, request, permission) => {
                assert.equal(permission, 'upload');
                authRequests.push(request);
                return request.headers.get('Authorization') === 'Bearer secret' && request.headers.get('authCode') === 'secret';
            },
        };
    });

    async function route(globals = {}) {
        return await loadFunction('functions/picgo/upload.js', mocks, globals);
    }

    function context(url, init = {}) {
        return {
            request: new Request(url, { method: 'POST', ...init }),
            env: { img_r2: { async put(id, file, options) { storage.push({ id, type: options.httpMetadata.contentType }); } } },
            waitUntil() {},
            data: {},
        };
    }

    function filesForm(...names) {
        const form = new FormData();
        for (const name of names) form.append('files', new File([png()], name, { type: 'image/png' }));
        return form;
    }

    it('rejects missing or wrong secrets with a PicGo error body', async () => {
        const { onRequest } = await route();
        const response = await onRequest(context('https://test/picgo/upload', { body: filesForm('a.png') }));
        assert.equal(response.status, 401);
        assert.deepEqual(await response.json(), { success: false, result: [], items: [], message: 'Unauthorized' });
        assert.equal(storage.length, 0);
    });

    for (const [name, url, headers] of [
        ['Authorization header', 'https://test/picgo/upload?uploader=cfr2', { Authorization: 'Bearer secret' }],
        ['x-picgo-secret header', 'https://test/picgo/upload?uploader=cfr2', { 'x-picgo-secret': 'secret' }],
        ['secret query', 'https://test/picgo/upload?uploader=cfr2&secret=secret', {}],
    ]) {
        it(`accepts the PicGo secret from the ${name} as API token or authCode`, async () => {
            const { onRequest } = await route();
            const response = await onRequest(context(url, { headers, body: filesForm('a.png') }));
            assert.equal(response.status, 200, await response.clone().text());
            assert.equal(authRequests.length, 1);
            assert.equal(authRequests[0].headers.has('x-picgo-secret'), false);
        });
    }

    it('uploads every multipart file and returns PicGo result and items', async () => {
        const { onRequest } = await route();
        const response = await onRequest(context('https://test/picgo/upload?uploader=cfr2&uploadNameType=origin&uploadFolder=picgo', {
            headers: { 'x-picgo-secret': 'secret' },
            body: filesForm('a.png', 'b.png'),
        }));
        assert.equal(response.status, 200, await response.clone().text());
        const body = await response.json();
        assert.equal(body.success, true);
        assert.deepEqual(body.result, ['https://test/file/picgo/a.png', 'https://test/file/picgo/b.png']);
        assert.deepEqual(body.items[0], {
            imgUrl: 'https://test/file/picgo/a.png', fileName: 'a.png', contentType: 'image/png',
            size: png().length, extname: '.png', width: 400, height: 200, origin: 'a.png', type: 'cfr2',
        });
        assert.deepEqual(storage.map(item => item.id), ['picgo/a.png', 'picgo/b.png']);
        assert.equal((await db.getWithMetadata('picgo/a.png')).metadata.Channel, 'CloudflareR2');
    });

    it('fetches remote URLs from a JSON list and reports unreadable local paths', async () => {
        const fetched = [];
        const { onRequest } = await route({
            fetch: async (url) => {
                fetched.push(String(url));
                return new Response(png(), { headers: { 'Content-Type': 'image/png' } });
            },
        });
        const response = await onRequest(context('https://test/picgo/upload?uploadChannel=cfr2&uploadNameType=origin', {
            headers: { 'x-picgo-secret': 'secret', 'Content-Type': 'application/json' },
            body: JSON.stringify({ list: ['https://img.example/dir/remote.png', '/Users/me/local.png'] }),
        }));
        assert.equal(response.status, 200, await response.clone().text());
        const body = await response.json();
        assert.deepEqual(fetched, ['https://img.example/dir/remote.png']);
        assert.deepEqual(body.result, ['https://test/file/remote.png']);
        assert.equal(body.items[0].origin, 'https://img.example/dir/remote.png');
        assert.equal(body.errors.length, 1);
        assert.equal(body.errors[0].origin, '/Users/me/local.png');
    });

    it('fails with 500 when no file could be uploaded', async () => {
        const { onRequest } = await route();
        const response = await onRequest(context('https://test/picgo/upload', {
            headers: { 'x-picgo-secret': 'secret', 'Content-Type': 'application/json' },
            body: JSON.stringify({ list: ['C:\\local.png'] }),
        }));
        assert.equal(response.status, 500);
        const body = await response.json();
        assert.equal(body.success, false);
        assert.deepEqual(body.result, []);
        assert.match(body.message, /http\(s\) URLs/);
    });

    for (const [name, init] of [
        ['empty body (clipboard upload)', {}],
        ['JSON without list', { body: '{}' }],
        ['invalid JSON', { body: '{' }],
        ['non-string list items', { body: JSON.stringify({ list: [1] }) }],
        ['multipart without files field', { body: new FormData() }],
    ]) {
        it(`rejects ${name} with 400`, async () => {
            const { onRequest } = await route();
            const response = await onRequest(context('https://test/picgo/upload', {
                ...init,
                headers: { 'x-picgo-secret': 'secret', ...(typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}) },
            }));
            assert.equal(response.status, 400);
            const body = await response.json();
            assert.equal(body.success, false);
            assert.ok(body.message);
            assert.equal(storage.length, 0);
        });
    }
});
