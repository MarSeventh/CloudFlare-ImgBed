import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTelegramWebhookHandler } from '../functions/utils/telegramWebhook.js';

const secret = 'test-secret-that-is-at-least-32-characters';
function fixture() {
    const records = new Map();
    const settings = new Map();
    const calls = [];
    const indexed = [];
    const env = { TG_WEBHOOK_SECRET: secret, TG_UPLOAD_ALLOWED_USER_IDS: '123',
        TG_UPLOAD_PUBLIC_URL: 'https://img.example.com' };
    const channel = { name: 'Telegram', chatId: '-100123', botToken: '456:fake' };
    const config = { telegram: { channels: [channel] } };
    const api = { fileDomain: 'https://api.telegram.org', async call(method, body) {
        calls.push({ method, body });
        if (method === 'getFile') return { file_path: 'photos/photo.jpg', file_size: 1024 };
        return { message_id: 999 };
    } };
    const services = {
        fetchUploadConfig: async () => config, createAPI: () => api,
        getDatabase: () => ({
            get: async key => key.startsWith('manage@') ? settings.get(key) ?? null : records.get(key)?.value ?? null,
            getWithMetadata: async key => records.get(key) || { value: null, metadata: null },
            put: async (key, value, options = {}) => key.startsWith('manage@') ? settings.set(key, value) : records.set(key, structuredClone({ value, metadata: options.metadata }))
        }),
        sanitizeUploadFolder: folder => folder.replace(/^\/+|\/+$/g, ''),
        moderateContent: async () => 'None',
        addFileToIndex: async (_context, id, metadata) => { indexed.push({ id, metadata }); return { success: true }; },
        purgeCDNCache: async () => {}
    };
    const update = { update_id: 1, message: { message_id: 7, chat: { id: 123, type: 'private' },
        from: { id: 123, is_bot: false }, photo: [
            { file_id: 'small', file_size: 100, width: 10, height: 10 },
            { file_id: 'large', file_size: 1024, width: 100, height: 100 }
        ] } };
    const pending = [];
    const run = async (body = update, headers = {}, method = 'POST') => {
        const handler = createTelegramWebhookHandler(services);
        const result = await handler({ env, request: new Request('https://img.example.com/telegram/webhook', {
            method, headers: { 'X-Telegram-Bot-Api-Secret-Token': secret, ...headers },
            ...(method === 'POST' ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {})
        }), waitUntil: task => pending.push(task) });
        await Promise.all(pending);
        return result;
    };
    return { env, config, api, services, update, records, indexed, calls, run };
}

test('private photo is copied to the channel, indexed and replied with a working file route', async () => {
    const f = fixture();
    assert.equal((await f.run()).status, 200);
    assert.equal(f.records.size, 1);
    const [{ metadata }] = f.records.values();
    assert.equal(metadata.TgFileId, 'large');
    assert.equal(metadata.ChannelName, 'Telegram');
    assert.equal(metadata.TgImportIndexed, true);
    assert.equal(metadata.Width, 100);
    assert.equal(f.indexed.length, 1);
    assert.deepEqual(f.calls.find(c => c.method === 'copyMessage').body,
        { chat_id: '-100123', from_chat_id: 123, message_id: 7 });
    assert.match(f.calls.find(c => c.method === 'sendMessage').body.text,
        /https:\/\/img.example.com\/file\/Telegram\/photo.jpg/);
    assert.ok(!JSON.stringify(metadata).includes('fake'));
});

test('unauthenticated requests and disabled configuration do no work', async () => {
    const f = fixture();
    assert.equal((await f.run(undefined, { 'X-Telegram-Bot-Api-Secret-Token': 'wrong' })).status, 401);
    delete f.env.TG_WEBHOOK_SECRET;
    assert.equal((await f.run()).status, 503);
    assert.equal(f.calls.length, 0);
});

test('empty or malformed allowlists fail closed', async () => {
    for (const ids of ['', '123,anybody', '*']) {
        const f = fixture(); f.env.TG_UPLOAD_ALLOWED_USER_IDS = ids;
        assert.equal((await f.run()).status, 503);
        assert.equal(f.calls.length, 0);
    }
});

test('non-allowlisted users, groups, channel posts, edited messages and bots are ignored', async () => {
    for (const change of [
        f => { f.update.message.from.id = 321; },
        f => { f.update.message.chat.type = 'group'; },
        f => { f.update.channel_post = f.update.message; delete f.update.message; },
        f => { f.update.edited_message = f.update.message; delete f.update.message; },
        f => { f.update.message.from.is_bot = true; }
    ]) {
        const f = fixture(); change(f);
        assert.equal((await f.run()).status, 200);
        assert.equal(f.calls.length, 0);
    }
});

test('retries reuse the saved record and do not repeat channel copy or index write', async () => {
    const f = fixture();
    await f.run(); await f.run();
    assert.equal(f.records.size, 1);
    assert.equal(f.calls.filter(c => c.method === 'copyMessage').length, 1);
    assert.equal(f.indexed.length, 1);
});

test('separate messages with the same filename keep both files with matching names and paths', async () => {
    const f = fixture();
    await f.run();
    f.update.message.message_id++;
    await f.run();
    assert.equal(f.records.size, 2);
    assert.ok(f.records.has('Telegram/photo.jpg'));
    assert.ok(f.records.has('Telegram/photo (2).jpg'));
    assert.equal(f.records.get('Telegram/photo (2).jpg').metadata.FileName, 'photo (2).jpg');
});

test('failed indexing returns retry status and can resume without copying again', async () => {
    const f = fixture();
    const original = f.services.addFileToIndex;
    f.services.addFileToIndex = async () => ({ success: false });
    assert.equal((await f.run()).status, 503);
    assert.equal(f.calls.filter(c => c.method === 'sendMessage').length, 0);
    f.services.addFileToIndex = original;
    assert.equal((await f.run()).status, 200);
    assert.equal(f.calls.filter(c => c.method === 'copyMessage').length, 1);
    assert.equal(f.indexed.length, 1);
});

test('a channel failure returns retry status and never registers a successful upload', async () => {
    const f = fixture();
    const call = f.api.call;
    f.api.call = async (method, body) => { if (method === 'copyMessage') throw new Error('Forbidden'); return call(method, body); };
    assert.equal((await f.run()).status, 503);
    assert.equal(f.records.size, 0);
    assert.equal(f.indexed.length, 0);
});

test('reply failure does not roll back or retry a successful upload', async () => {
    const f = fixture();
    const call = f.api.call;
    f.api.call = async (method, body) => { if (method === 'sendMessage') throw new Error('Blocked'); return call(method, body); };
    assert.equal((await f.run()).status, 200);
    assert.equal(f.records.size, 1);
});

test('documents retain original names and MIME types with safe storage keys', async () => {
    const f = fixture(); delete f.update.message.photo;
    f.update.message.document = { file_id: 'original', file_size: 1024,
        file_name: '../照片 #1%.heic', mime_type: 'image/heic' };
    await f.run();
    const [{ metadata }] = f.records.values();
    assert.equal(metadata.FileName, '照片 _1_.heic');
    assert.equal(metadata.FileType, 'image/heic');
    assert.match(f.calls.find(c => c.method === 'sendMessage').body.text, /\/Telegram\/%E7%85%A7%E7%89%87%20_1_.heic/);
});

test('oversize and unknown-size files receive guidance without being registered', async () => {
    for (const size of [21 * 1024 * 1024, undefined]) {
        const f = fixture(); delete f.update.message.photo;
        f.update.message.document = { file_id: 'big', file_size: size };
        assert.equal((await f.run()).status, 200);
        assert.equal(f.records.size, 0);
        assert.equal(f.calls.length, 1);
        assert.equal(f.calls[0].method, 'sendMessage');
    }
});

test('multiple channels require an explicit valid channel name', async () => {
    const f = fixture(); f.config.telegram.channels.push({ name: 'Second', botToken: '789:fake', chatId: '-100456' });
    assert.equal((await f.run()).status, 503);
    f.env.TG_UPLOAD_CHANNEL_NAME = 'missing';
    assert.equal((await f.run()).status, 503);
    f.env.TG_UPLOAD_CHANNEL_NAME = 'Second';
    assert.equal((await f.run()).status, 200);
    assert.equal(f.calls.find(c => c.method === 'copyMessage').body.chat_id, '-100456');
});

test('public links must use a configured HTTPS origin', async () => {
    for (const url of ['', 'http://img.example.com', 'https://img.example.com/login', 'https://user:password@img.example.com']) {
        const f = fixture(); f.env.TG_UPLOAD_PUBLIC_URL = url;
        assert.equal((await f.run()).status, 503);
        assert.equal(f.records.size, 0);
    }
});

test('help shows the allowed user ID without copying a file', async () => {
    const f = fixture(); f.update.message.text = '/id'; delete f.update.message.photo;
    assert.equal((await f.run()).status, 200);
    assert.match(f.calls[0].body.text, /123/);
    assert.equal(f.records.size, 0);
});

test('malformed JSON and unsupported HTTP methods are rejected', async () => {
    const f = fixture();
    assert.equal((await f.run('{')).status, 400);
    assert.equal((await f.run(undefined, {}, 'GET')).status, 405);
    assert.equal(f.calls.length, 0);
});

test('moderation uses the public file route and never receives the bot token', async () => {
    const f = fixture(); const checked = [];
    f.services.moderateContent = async (_env, url) => { checked.push(url); return 'adult'; };
    assert.equal((await f.run()).status, 200);
    assert.deepEqual(checked, ['https://img.example.com/file/Telegram/photo.jpg']);
    assert.ok(checked.every(url => !url.includes('456:fake') && !url.includes('/bot')));
    assert.equal(f.records.get('Telegram/photo.jpg').metadata.Label, 'adult');
    assert.equal(f.indexed[0].metadata.Label, 'adult');
});

test('a retry after an applied-but-failed record write reuses the reserved path', async () => {
    const f = fixture(); const getDatabase = f.services.getDatabase; let failOnce = true;
    f.services.getDatabase = env => {
        const db = getDatabase(env), put = db.put;
        return { ...db, async put(key, value, options) {
            await put(key, value, options);
            if (!key.startsWith('manage@') && failOnce) { failOnce = false; throw new Error('uncertain write'); }
        } };
    };
    assert.equal((await f.run()).status, 503);
    assert.equal((await f.run()).status, 200);
    assert.deepEqual([...f.records.keys()], ['Telegram/photo.jpg']);
    assert.equal(f.calls.filter(c => c.method === 'copyMessage').length, 1);
    assert.equal(f.indexed.length, 1);
});

test('a reserved path taken by another file is not mistaken for this upload', async () => {
    const f = fixture();
    const db = f.services.getDatabase(f.env);
    await db.put('manage@telegramImport@456_123_7', 'Telegram/photo.jpg');
    await db.put('Telegram/photo.jpg', '', { metadata: { FileName: 'photo.jpg', TgFileId: 'someone-else', TimeStamp: 1, Channel: 'TelegramNew' } });
    assert.equal((await f.run()).status, 200);
    assert.equal(f.records.get('Telegram/photo.jpg').metadata.TgFileId, 'someone-else');
    assert.equal(f.records.get('Telegram/photo (2).jpg').metadata.TgFileId, 'large');
    assert.equal(f.calls.filter(c => c.method === 'copyMessage').length, 1);
});
