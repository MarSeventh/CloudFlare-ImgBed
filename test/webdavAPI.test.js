import assert from 'node:assert/strict';
import { WebDAVAPI, buildWebDAVUrl, normalizeBaseUrl } from '../functions/utils/webdavAPI.js';

describe('WebDAVAPI', () => {
    let originalFetch;
    let calls;

    beforeEach(() => {
        originalFetch = globalThis.fetch;
        calls = [];
        globalThis.fetch = async (url, init = {}) => {
            calls.push({ url: String(url), init });
            return new Response('ok', { status: 201, statusText: 'Created' });
        };
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
    });

    it('normalizes base URLs and encodes object paths segment-by-segment', () => {
        assert.equal(normalizeBaseUrl('https://dav.example.com/root'), 'https://dav.example.com/root/');
        assert.equal(
            buildWebDAVUrl('https://dav.example.com/root/', '相册/a b.png'),
            'https://dav.example.com/root/%E7%9B%B8%E5%86%8C/a%20b.png'
        );
    });

    it('creates parent collections and uploads with basic auth', async () => {
        const api = new WebDAVAPI({
            baseUrl: 'https://dav.example.com/root',
            username: 'user',
            password: 'pass',
        });

        await api.putFile('album/photo.png', new Blob(['hello'], { type: 'image/png' }), 'image/png');

        assert.equal(calls.length, 2);
        assert.equal(calls[0].url, 'https://dav.example.com/root/album');
        assert.equal(calls[0].init.method, 'MKCOL');
        assert.equal(calls[1].url, 'https://dav.example.com/root/album/photo.png');
        assert.equal(calls[1].init.method, 'PUT');
        assert.equal(calls[1].init.headers.get('Authorization'), 'Basic dXNlcjpwYXNz');
        assert.equal(calls[1].init.headers.get('Content-Type'), 'image/png');
    });

    it('forwards range headers when reading files', async () => {
        globalThis.fetch = async (url, init = {}) => {
            calls.push({ url: String(url), init });
            return new Response('partial', { status: 206, headers: { 'Content-Range': 'bytes 0-2/7' } });
        };

        const api = new WebDAVAPI({ baseUrl: 'https://dav.example.com/root' });
        const res = await api.getFile('photo.png', { headers: { Range: 'bytes=0-2' } });

        assert.equal(res.status, 206);
        assert.equal(calls[0].init.method, 'GET');
        assert.equal(calls[0].init.headers.get('Range'), 'bytes=0-2');
    });

    it('treats delete 404 as idempotent success', async () => {
        globalThis.fetch = async (url, init = {}) => {
            calls.push({ url: String(url), init });
            return new Response('missing', { status: 404 });
        };

        const api = new WebDAVAPI({ baseUrl: 'https://dav.example.com/root' });
        assert.equal(await api.deleteFile('missing.png'), true);
        assert.equal(calls[0].init.method, 'DELETE');
    });

    it('uses WebDAV MOVE with an absolute destination URL', async () => {
        const api = new WebDAVAPI({ baseUrl: 'https://dav.example.com/root' });

        await api.moveFile('old/photo.png', 'new/photo.png');

        assert.equal(calls[0].init.method, 'MKCOL');
        assert.equal(calls[1].init.method, 'MOVE');
        assert.equal(calls[1].init.headers.get('Destination'), 'https://dav.example.com/root/new/photo.png');
        assert.equal(calls[1].init.headers.get('Overwrite'), 'T');
    });

    it('surfaces auth failures from providers', async () => {
        globalThis.fetch = async () => new Response('auth failed', { status: 401, statusText: 'Unauthorized' });
        const api = new WebDAVAPI({ baseUrl: 'https://dav.example.com/root' });

        await assert.rejects(
            () => api.getFile('secret.png'),
            /WebDAV GET failed: 401 Unauthorized - auth failed/
        );
    });
});
