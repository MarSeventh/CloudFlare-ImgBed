import assert from 'node:assert/strict';
import { createHash, pbkdf2Sync } from 'node:crypto';
import { loadFunction, memoryDatabase } from './helpers/loadFunction.js';
import * as passwords from '../functions/utils/auth/passwordHash.js';
import * as expiration from '../functions/utils/auth/tokenExpiration.js';
import * as sessionConfig from '../functions/utils/auth/sessionConfig.js';

function request(path = '/api/manage/list', headers = {}, method = 'GET') {
    return new Request(`https://test${path}`, { headers, method });
}

describe('password compatibility', () => {
    const password = 'test-password';

    it('verifies PBKDF2 against an independent fixture and rejects a wrong password', async () => {
        const salt = '00112233445566778899aabbccddeeff';
        const digest = pbkdf2Sync(password, Buffer.from(salt, 'hex'), 100000, 32, 'sha256').toString('hex');
        const fixture = `$pbkdf2$${salt}$${digest}`;
        assert.equal(await passwords.hashPassword(password, salt), fixture);
        assert.equal(await passwords.verifyPassword(password, fixture), true);
        assert.equal(await passwords.verifyPassword('wrong', fixture), false);
    });

    it('retains legacy SHA-256 and plaintext login compatibility', async () => {
        const salt = 'legacy-salt';
        const digest = createHash('sha256').update(salt + password).digest('hex');
        for (const stored of [password, `$sha256$${salt}$${digest}`]) {
            assert.equal(await passwords.verifyPassword(password, stored), true);
            assert.equal(await passwords.verifyPassword('wrong', stored), false);
        }
        assert.equal(await passwords.verifyPassword('', password), false);
        assert.equal(await passwords.verifyPassword(password, ''), false);
        assert.equal(await passwords.verifyPassword(password, '$pbkdf2$invalid'), false);
    });
});

describe('authentication and permission boundaries', () => {
    let db, config, sessions, core, tokens, userAuth, middleware;

    beforeEach(async () => {
        db = memoryDatabase();
        config = {
            auth: { admin: { adminUsername: 'admin', adminPassword: 'password' }, user: { authCode: 'user-code' } },
            access: { sessionSecure: true, adminSessionMaxAge: 7, userSessionMaxAge: 2 },
        };
        const dependencies = {
            ...passwords, ...sessionConfig,
            getDatabase: () => db,
            fetchSecurityConfig: async () => config,
        };
        sessions = await loadFunction('functions/utils/auth/sessionManager.js', dependencies);
        tokens = await loadFunction('functions/utils/auth/tokenValidator.js', {
            ...expiration,
            getTokenData: async (database, token) => JSON.parse(await database.get(`token@${token}`)),
        });
        core = await loadFunction('functions/utils/auth/authCore.js', { ...dependencies, ...sessions, ...tokens });
        userAuth = await loadFunction('functions/utils/auth/userAuth.js', core);
        middleware = await loadFunction('functions/api/manage/_middleware.js', core);
    });

    async function authenticate(req, authScope = core.AUTH_SCOPE.ADMIN, requiredPermission = 'list') {
        return core.authenticate({ env: {}, request: req, url: new URL(req.url), authScope, requiredPermission });
    }

    async function putToken(token, permissions, expiresAt = null) {
        await db.put(`token@${token}`, JSON.stringify({ permissions, expiresAt }));
    }

    async function putSession(token, authType, expiresAt = Date.now() + 60000) {
        await db.put(`manage@session@${token}`, JSON.stringify({ authType, expiresAt }));
    }

    async function manage(req, next = async () => new Response('allowed')) {
        const context = { env: {}, request: req, next: () => middleware.onRequest[1]({ ...context, next }) };
        return middleware.onRequest[0](context);
    }

    it('denies anonymous requests when credentials are configured in every scope', async () => {
        for (const scope of Object.values(core.AUTH_SCOPE)) {
            assert.deepEqual(await authenticate(request(), scope), { authorized: false, authType: null });
        }
    });

    it('preserves open access only for the corresponding unconfigured scope', async () => {
        config.auth.user.authCode = '';
        assert.equal((await authenticate(request(), core.AUTH_SCOPE.USER)).authorized, true);
        assert.equal((await authenticate(request(), core.AUTH_SCOPE.ADMIN)).authorized, false);
        config.auth.user.authCode = 'user-code';
        config.auth.admin = { adminUsername: '', adminPassword: '' };
        assert.equal((await authenticate(request(), core.AUTH_SCOPE.ADMIN)).authorized, true);
        assert.equal((await authenticate(request(), core.AUTH_SCOPE.USER)).authorized, false);
    });

    it('never grants admin scope to a user session or an authCode', async () => {
        await putSession('user', 'user');
        const req = request('/api/manage/list?authCode=user-code', { Cookie: 'user_session=user' });
        assert.equal((await authenticate(req, core.AUTH_SCOPE.ADMIN)).authorized, false);
        assert.deepEqual(await authenticate(req, core.AUTH_SCOPE.USER), { authorized: true, authType: 'user' });
        assert.equal((await authenticate(req, core.AUTH_SCOPE.EITHER)).authorized, true);
    });

    it('allows an admin session to access both admin and user resources', async () => {
        await putSession('admin', 'admin');
        for (const scope of Object.values(core.AUTH_SCOPE)) {
            assert.deepEqual(await authenticate(request('/', { Cookie: 'admin_session=admin' }), scope), { authorized: true, authType: 'admin' });
        }
    });

    it('accepts Bearer and raw API tokens only with the required permission', async () => {
        await putToken('list-token', ['list']);
        for (const value of ['Bearer list-token', 'list-token']) {
            const req = request('/', { Authorization: value });
            assert.equal((await authenticate(req, core.AUTH_SCOPE.ADMIN, 'list')).authorized, true);
            assert.equal((await authenticate(req, core.AUTH_SCOPE.USER, 'upload')).authorized, false);
            assert.equal((await authenticate(req, core.AUTH_SCOPE.ADMIN, 'delete')).authorized, false);
            assert.equal((await authenticate(req, core.AUTH_SCOPE.ADMIN, null)).authorized, true);
        }
    });

    it('rejects expired or unknown tokens even with matching permissions', async () => {
        await putToken('expired', ['list'], '2000-01-01T00:00:00.000Z');
        for (const token of ['expired', 'unknown']) {
            const req = request('/', { Authorization: `Bearer ${token}` });
            assert.equal((await tokens.validateApiToken(req, db, 'list')).valid, false);
            assert.equal((await authenticate(req)).authorized, false);
        }
    });

    for (const [name, path, headers] of [
        ['URL', '/?authCode=user-code', {}],
        ['Referer', '/', { Referer: 'https://test/?authCode=user-code' }],
        ['header', '/', { authCode: 'user-code' }],
        ['encoded cookie', '/', { Cookie: 'other=1; authCode=user%2Dcode' }],
    ]) {
        it(`retains user authCode authentication through ${name}`, async () => {
            const req = request(path, headers);
            assert.equal(await userAuth.userAuthCheck({}, new URL(req.url), req), true);
        });
    }

    it('respects URL > Referer > header > cookie authCode precedence', async () => {
        for (const req of [
            request('/?authCode=wrong', { Referer: 'https://test/?authCode=user-code', authCode: 'user-code', Cookie: 'authCode=user-code' }),
            request('/', { Referer: 'https://test/?authCode=wrong', authCode: 'user-code', Cookie: 'authCode=user-code' }),
            request('/', { authCode: 'wrong', Cookie: 'authCode=user-code' }),
        ]) {
            assert.equal((await authenticate(req, core.AUTH_SCOPE.USER)).authorized, false);
        }
    });

    it('rejects expired, corrupt, missing, and mismatched sessions', async () => {
        await putSession('expired', 'admin', 0);
        await putSession('mismatched', 'user');
        await db.put('manage@session@corrupt', '{');
        for (const token of ['expired', 'mismatched', 'corrupt', 'missing']) {
            assert.equal((await sessions.validateSession({}, request('/', { Cookie: `admin_session=${token}` }), 'admin')).valid, false);
        }
        assert.equal(await db.get('manage@session@expired'), null);
    });

    it('creates independent HttpOnly sessions with configured TTL and Secure cookies', async () => {
        for (const [authType, days] of [['admin', 7], ['user', 2]]) {
            const { token, cookie } = await sessions.createSession({}, authType);
            assert.match(token, /^[0-9a-f]{64}$/);
            assert.ok(cookie.startsWith(`${authType}_session=${token};`));
            for (const attribute of ['Path=/', 'HttpOnly', 'SameSite=Strict', 'Secure', `Max-Age=${days * 86400}`]) {
                assert.ok(cookie.split('; ').includes(attribute), attribute);
            }
            const stored = JSON.parse(await db.get(`manage@session@${token}`));
            assert.equal(stored.authType, authType);
            const lifetime = stored.expiresAt - stored.createdAt;
            assert.ok(lifetime >= days * 86400 * 1000 && lifetime <= days * 86400 * 1000 + 1000);
            assert.equal((await sessions.validateSession({}, request('/', { Cookie: `${authType}_session=${token}` }), authType)).valid, true);
        }
    });

    it('logs out one session type without removing the other', async () => {
        await putSession('admin', 'admin');
        await putSession('user', 'user');
        const req = request('/', { Cookie: 'admin_session=admin; user_session=user' });
        const cookie = await sessions.destroySession({}, req, 'admin');
        assert.ok(cookie.includes('admin_session=;'));
        assert.ok(cookie.includes('Max-Age=0'));
        assert.equal((await sessions.validateSession({}, req, 'admin')).valid, false);
        assert.equal((await sessions.validateSession({}, req, 'user')).valid, true);
    });

    it('returns 401 without invoking a protected handler and prevents caching', async () => {
        const response = await manage(request(), () => assert.fail('unauthorized handler was invoked'));
        assert.equal(response.status, 401);
        assert.equal(response.headers.get('Cache-Control'), 'no-store');
    });

    it('maps list/delete/manage routes to exact token permissions', async () => {
        await putToken('list', ['list']);
        await putToken('delete', ['delete']);
        await putToken('manage', ['manage']);
        for (const [path, permission] of [
            ['/api/manage/list', 'list'], ['/api/manage/list/', 'list'],
            ['/api/manage/batch/list', 'list'], ['/api/manage/delete/file', 'delete'],
            ['/api/manage/delete', 'delete'], ['/api/manage/listOther', 'manage'],
            ['/api/manage/apiTokens', 'manage'],
        ]) {
            for (const token of ['list', 'delete', 'manage']) {
                const response = await manage(request(path, { Authorization: `Bearer ${token}` }));
                assert.equal(response.status, token === permission ? 200 : 401, `${token} accessing ${path}`);
                if (response.status === 200) assert.equal(response.headers.get('Cache-Control'), 'private, no-store, max-age=0');
            }
        }
    });

    it('allows CORS preflight without running protected operations', async () => {
        const response = await manage(request('/api/manage/delete', {}, 'OPTIONS'), () => assert.fail('preflight ran handler'));
        assert.equal(response.status, 204);
        assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*');
        assert.ok(response.headers.get('Access-Control-Allow-Headers').includes('Authorization'));
    });

    it('retains explicit response cache policy and prevents caching of handler errors', async () => {
        await putSession('admin', 'admin');
        const req = request('/', { Cookie: 'admin_session=admin' });
        const explicit = await manage(req, async () => new Response('data', { headers: { 'Cache-Control': 'private, max-age=5' } }));
        assert.equal(explicit.headers.get('Cache-Control'), 'private, max-age=5');
        const failed = await manage(req, async () => { throw new Error('test failure'); });
        assert.equal(failed.status, 500);
        assert.equal(failed.headers.get('Cache-Control'), 'private, no-store, max-age=0');
    });
});

describe('session lifetime configuration', () => {
    it('keeps malformed or timestamp values from becoming long-lived sessions', () => {
        for (const value of [undefined, null, '', 0, -1, Infinity, 'invalid', 3660, 1700000000000]) {
            assert.equal(sessionConfig.normalizeSessionMaxAgeDays(value), 14);
            assert.equal(sessionConfig.sessionMaxAgeDaysToTtl(value), 14 * 86400);
        }
        assert.equal(sessionConfig.sessionMaxAgeDaysToTtl('7'), 7 * 86400);
        assert.equal(sessionConfig.normalizeSessionMaxAgeDays(2.9), 2);
    });
});
