import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequest as security } from '../functions/api/manage/sysConfig/security.js';
import { telegramAllowedUsers, validateAllowedUsers } from '../functions/utils/telegramAllowlist.js';

function fixture(env = {}) {
    const map = new Map();
    const kv = {
        get: async key => map.get(key)?.value ?? null,
        getWithMetadata: async key => structuredClone(map.get(key) || { value: null, metadata: null }),
        put: async (key, value, options = {}) => map.set(key, { value, metadata: options.metadata || null }),
        delete: async key => map.delete(key),
        list: async () => ({ keys: [], list_complete: true })
    };
    const ctx = { ...env, img_url: kv };
    const call = (method, body) => security({ env: ctx, request: new Request('https://img.example/api/manage/sysConfig/security',
        { method, ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) }) });
    const stored = () => JSON.parse(map.get('manage@sysConfig@security')?.value || '{}');
    return { map, call, stored };
}

test('settings GET lists dashboard users and read-only env IDs, and never returns API tokens', async () => {
    const f = fixture({ TG_UPLOAD_ALLOWED_USER_IDS: '111, 222,@bad' });
    f.map.set('manage@sysConfig@security', { value: JSON.stringify({
        telegramBot: { allowedUsers: [{ id: '333', note: 'Bob' }, { id: 'oops' }] },
        apiTokens: { tokens: { t1: { token: 'secret-token-value', permissions: ['manage'] } } } }) });
    const body = await (await f.call('GET')).json();
    assert.deepEqual(body.telegramBot.allowedUsers, [{ id: '333', note: 'Bob' }]);
    assert.deepEqual(body.telegramBot.envUserIds, ['111', '222']);
    assert.equal(body.telegramBot.envInvalid, true);
    assert.equal(body.apiTokens, undefined);
    assert.ok(!JSON.stringify(body).includes('secret-token-value'));
});

test('settings POST stores only dashboard users; env IDs are never persisted', async () => {
    const f = fixture({ TG_UPLOAD_ALLOWED_USER_IDS: '111' });
    const response = await f.call('POST', { telegramBot: { allowedUsers: [{ id: '333', note: '  Bob\u0007 ' }] } });
    assert.equal(response.status, 200);
    assert.deepEqual(f.stored().telegramBot, { allowedUsers: [{ id: '333', note: 'Bob' }] });
    assert.ok(!JSON.stringify(f.stored()).includes('"111"'));
    // Saving other settings without telegramBot keeps the list unchanged.
    assert.equal((await f.call('POST', { access: { allowedDomains: '' } })).status, 200);
    assert.deepEqual(f.stored().telegramBot.allowedUsers, [{ id: '333', note: 'Bob' }]);
});

test('settings POST rejects malformed, duplicate or oversized lists without saving', async () => {
    for (const allowedUsers of [[{ id: '@name' }], [{ id: '-100123' }], [{ id: '9007199254740999' }],
        [{ id: '1' }, { id: '1' }], [{ id: '1', note: 5 }], 'nope', Array.from({ length: 201 }, (_, i) => ({ id: String(i + 1) }))]) {
        const f = fixture();
        assert.equal((await f.call('POST', { telegramBot: { allowedUsers } })).status, 400);
        assert.equal(f.map.size, 0);
    }
});

test('effective list is the union, env first, with dashboard notes applied to env IDs', () => {
    const result = telegramAllowedUsers({ TG_UPLOAD_ALLOWED_USER_IDS: '111,222' },
        { telegramBot: { allowedUsers: [{ id: '222', note: 'Phone' }, { id: '333', note: 'Bob' }] } });
    assert.deepEqual(result.users, [
        { id: '111', note: '', source: 'env' }, { id: '222', note: 'Phone', source: 'env' }, { id: '333', note: 'Bob', source: 'config' }]);
    assert.equal(result.misconfigured, false);
    assert.deepEqual(telegramAllowedUsers({}, undefined).users, []);
    assert.equal(validateAllowedUsers([{ id: '42', note: 'x'.repeat(100) }]).users[0].note.length, 64);
});
