import assert from 'node:assert/strict';
import { onRequest } from '../functions/_middleware.js';
import { withProjectHeaders } from '../functions/utils/projectHeaders.js';
import { readFile } from 'node:fs/promises';
import { loadFunction } from './helpers/loadFunction.js';

describe('deployment runtime', () => {
    for (const runtime of ['pages', 'worker', 'node']) {
        it(`sets ${runtime} from the entry context and exposes it to the frontend`, async () => {
            const userConfig = await loadFunction('functions/api/userConfig.js', {
                fetchPageConfig: async () => ({ config: [{ id: 'serverRuntime', value: 'incorrect' }] }),
                fetchUploadConfig: async () => ({}),
            });
            const context = {
                env: { SERVER_RUNTIME: 'node', img_d1: {} },
                data: runtime === 'pages' ? {} : { serverRuntime: runtime },
                next: () => userConfig.onRequest(context),
            };
            const response = await onRequest(context);
            assert.equal(response.headers.get('X-Project'), 'CloudFlare-ImgBed');
            assert.equal(response.headers.get('X-Powered-By'), 'SanyueQi');
            assert.equal(context.env.SERVER_RUNTIME, runtime);
            const body = await response.json();
            assert.equal(body.serverRuntime, runtime);
            assert.equal(body.autoTagOnUpload, undefined);
        });
    }
});

describe('project response headers', () => {
    function assertProjectHeaders(response) {
        assert.equal(response.headers.get('X-Project'), 'CloudFlare-ImgBed');
        assert.equal(response.headers.get('X-Powered-By'), 'SanyueQi');
    }

    it('preserves streaming bodies, range/cache/CORS headers and multiple cookies', async () => {
        const headers = new Headers({
            'Content-Type': 'application/octet-stream',
            'Content-Length': '3',
            'Content-Range': 'bytes 0-2/10',
            'Cache-Control': 'private, max-age=86400',
            'ETag': '"file-etag"',
            'Access-Control-Allow-Origin': '*',
            'Vary': 'Range',
            'X-Project': 'upstream',
            'X-Powered-By': 'upstream',
        });
        headers.append('Set-Cookie', 'first=1; HttpOnly; Path=/');
        headers.append('Set-Cookie', 'second=2; Secure; Path=/');
        const original = new Response(new Uint8Array([0, 1, 255]), {
            status: 206, statusText: 'Partial Content', headers,
        });
        const response = withProjectHeaders(original);
        assertProjectHeaders(response);
        assert.equal(response.status, 206);
        assert.equal(response.statusText, 'Partial Content');
        assert.equal(response.body, original.body, 'reuse the stream instead of buffering or teeing it');
        assert.equal(original.bodyUsed, false);
        assert.equal(original.headers.get('X-Project'), 'upstream');
        assert.equal(original.headers.get('X-Powered-By'), 'upstream');
        for (const [name, value] of original.headers) {
            if (!['x-project', 'x-powered-by', 'set-cookie'].includes(name)) {
                assert.equal(response.headers.get(name), value, name);
            }
        }
        assert.deepEqual(response.headers.getSetCookie(), original.headers.getSetCookie());
        assert.deepEqual(new Uint8Array(await response.arrayBuffer()), new Uint8Array([0, 1, 255]));
    });

    it('handles immutable redirect headers without changing Location or status', () => {
        const original = Response.redirect('https://example.com/login', 302);
        assert.throws(() => original.headers.set('X-Test', 'value'), TypeError);
        const response = withProjectHeaders(original);
        assertProjectHeaders(response);
        assert.equal(response.status, 302);
        assert.equal(response.headers.get('Location'), 'https://example.com/login');
        assert.equal(response.body, null);
    });

    for (const status of [200, 204, 304, 401, 403, 404, 405, 500]) {
        it(`preserves null bodies and status ${status}`, () => {
            const response = withProjectHeaders(new Response(null, { status }));
            assertProjectHeaders(response);
            assert.equal(response.status, status);
            assert.equal(response.body, null);
        });
    }

    it('allows the Node adapter to retain its native response constructor', () => {
        class NativeResponse extends Response {}
        const response = withProjectHeaders(new Response('ok'), NativeResponse);
        assert.ok(response instanceof NativeResponse);
        assertProjectHeaders(response);
    });

    it('does not duplicate project headers when multiple response layers apply them', () => {
        assertProjectHeaders(withProjectHeaders(withProjectHeaders(new Response('ok'))));
    });

    it('publishes the same headers for Pages/Workers static assets', async () => {
        const rules = await readFile(new URL('../frontend-dist/_headers', import.meta.url), 'utf8');
        assert.deepEqual(rules.trim().split(/\r?\n/), ['/*', '  X-Project: CloudFlare-ImgBed', '  X-Powered-By: SanyueQi']);
    });
});
