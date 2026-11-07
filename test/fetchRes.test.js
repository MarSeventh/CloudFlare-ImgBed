import assert from 'node:assert/strict';
import { loadFunction } from './helpers/loadFunction.js';

// /api/fetchRes must not reach internal addresses through a hostname that
// only resolves to one (wildcard DNS such as 192.168.0.1.nip.io, #746).
describe('fetchRes SSRF protection', () => {
    let fetched;

    async function call(target, { lookup, upstream } = {}) {
        fetched = [];
        const fetchStub = async (url) => {
            fetched.push(url);
            return upstream ? upstream(url) : new Response('ok', { status: 200 });
        };
        const mod = await loadFunction('functions/api/fetchRes.js', {
            dualAuthCheck: async () => ({ authorized: true }),
        }, { fetch: fetchStub });
        const env = lookup ? { DNS_LOOKUP: lookup } : {};
        const request = new Request('https://img.example/api/fetchRes', {
            method: 'POST',
            body: JSON.stringify({ url: target }),
        });
        return mod.onRequest({ request, env, data: {} });
    }

    const table = {
        '192.168.0.1.nip.io': [{ address: '192.168.0.1', family: 4 }],
        '10.0.0.5.sslip.io': [{ address: '10.0.0.5', family: 4 }],
        'rebind.example': [{ address: '93.184.216.34', family: 4 }, { address: '127.0.0.1', family: 4 }],
        'v6-loopback.example': [{ address: '::1', family: 6 }],
        'public.example': [{ address: '93.184.216.34', family: 4 }],
    };
    const lookup = async (hostname) => {
        if (!table[hostname]) throw Object.assign(new Error(`getaddrinfo ENOTFOUND ${hostname}`), { code: 'ENOTFOUND' });
        return table[hostname];
    };

    for (const host of ['192.168.0.1.nip.io', '10.0.0.5.sslip.io', 'rebind.example', 'v6-loopback.example']) {
        it(`blocks ${host}, which resolves to an internal address`, async () => {
            const response = await call(`http://${host}/`, { lookup });
            assert.equal(response.status, 400);
            assert.match((await response.json()).error, /internal addresses/);
            assert.deepEqual(fetched, []);
        });
    }

    it('fetches a hostname that resolves only to public addresses', async () => {
        const response = await call('http://public.example/a.png', { lookup });
        assert.equal(response.status, 200);
        assert.equal(await response.text(), 'ok');
        assert.deepEqual(fetched, ['http://public.example/a.png']);
    });

    it('refuses a hostname that does not resolve', async () => {
        const response = await call('http://missing.example/', { lookup });
        assert.equal(response.status, 400);
        assert.deepEqual(fetched, []);
    });

    it('blocks a redirect onto a hostname that resolves to an internal address', async () => {
        const response = await call('http://public.example/', {
            lookup,
            upstream: () => new Response(null, { status: 302, headers: { location: 'http://192.168.0.1.nip.io/admin' } }),
        });
        assert.equal(response.status, 400);
        assert.match((await response.json()).error, /Redirect to disallowed target/);
        assert.deepEqual(fetched, ['http://public.example/']);
    });

    it('keeps rejecting IP literals without a resolver (Pages / Workers)', async () => {
        const response = await call('http://127.0.0.1/');
        assert.equal(response.status, 400);
        assert.deepEqual(fetched, []);
    });

    it('fetches a public hostname without a resolver (Pages / Workers)', async () => {
        const response = await call('http://public.example/');
        assert.equal(response.status, 200);
        assert.deepEqual(fetched, ['http://public.example/']);
    });
});
