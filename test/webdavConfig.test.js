import assert from 'node:assert/strict';
import { getUploadConfig } from '../functions/api/manage/sysConfig/upload.js';
import { fetchUploadConfig } from '../functions/utils/sysConfig.js';
import { resolveWebDAVConfig } from '../functions/utils/webdavConfig.js';
import { onRequest as channelsOnRequest } from '../functions/api/channels.js';

function makeKV(initial = {}) {
    const store = new Map(Object.entries(initial));
    return {
        async get(key) { return store.get(key) ?? null; },
        async put(key, value) { store.set(key, value); },
        async delete(key) { store.delete(key); },
        async getWithMetadata(key) { return { value: store.get(key) ?? null, metadata: null }; },
        async list() { return { keys: [] }; },
    };
}

describe('WebDAV upload config', () => {
    it('exposes an environment-backed fixed WebDAV channel', async () => {
        const config = await getUploadConfig(makeKV(), {
            WEBDAV_BASE_URL: 'https://dav.example.com/root/',
            WEBDAV_USERNAME: 'alice',
            WEBDAV_PASSWORD: 'secret',
            WEBDAV_PUBLIC_URL: 'https://cdn.example.com/root/',
            WEBDAV_HEADERS: '{"X-Test":"1"}',
            WEBDAV_CREATE_DIRECTORY: 'false',
        });

        assert.equal(config.webdav.channels.length, 1);
        assert.equal(config.webdav.channels[0].name, 'WebDAV_env');
        assert.equal(config.webdav.channels[0].type, 'webdav');
        assert.equal(config.webdav.channels[0].baseUrl, 'https://dav.example.com/root/');
        assert.equal(config.webdav.channels[0].headers['X-Test'], '1');
        assert.equal(config.webdav.channels[0].createDirectory, false);
        assert.equal(config.webdav.channels[0].fixed, true);
    });

    it('filters disabled WebDAV channels from runtime upload config', async () => {
        const uploadSettings = JSON.stringify({
            webdav: {
                loadBalance: { enabled: false },
                channels: [
                    { name: 'enabled-dav', type: 'webdav', baseUrl: 'https://dav.example.com/', enabled: true },
                    { name: 'disabled-dav', type: 'webdav', baseUrl: 'https://dav2.example.com/', enabled: false },
                ],
            },
        });
        const env = { img_url: makeKV({ 'manage@sysConfig@upload': uploadSettings }) };

        const config = await fetchUploadConfig(env);

        assert.deepEqual(config.webdav.channels.map(ch => ch.name), ['enabled-dav']);
    });

    it('includes WebDAV channels in /api/channels output', async () => {
        const uploadSettings = JSON.stringify({
            webdav: {
                loadBalance: { enabled: false },
                channels: [{ name: 'dav-main', type: 'webdav', baseUrl: 'https://dav.example.com/', enabled: true }],
            },
        });
        const env = { img_url: makeKV({ 'manage@sysConfig@upload': uploadSettings }) };
        const request = new Request('https://img.example.com/api/channels');

        const response = await channelsOnRequest({ request, env });
        const body = await response.json();

        assert.equal(response.status, 200);
        assert.deepEqual(body.webdav, [{ name: 'dav-main', type: 'WebDAV' }]);
    });

    it('resolves WebDAV secrets from channel config by ChannelName', async () => {
        const uploadSettings = JSON.stringify({
            webdav: {
                loadBalance: { enabled: false },
                channels: [{
                    name: 'dav-main',
                    type: 'webdav',
                    baseUrl: 'https://dav.example.com/root/',
                    username: 'alice',
                    password: 'secret',
                    headers: { 'X-Test': '1' },
                    enabled: true,
                }],
            },
        });
        const env = { img_url: makeKV({ 'manage@sysConfig@upload': uploadSettings }) };

        const config = await resolveWebDAVConfig(env, {
            ChannelName: 'dav-main',
            WebDAVBaseUrl: 'https://dav.example.com/root/',
            WebDAVFilePath: 'a.png',
        });

        assert.equal(config.username, 'alice');
        assert.equal(config.password, 'secret');
        assert.deepEqual(config.headers, { 'X-Test': '1' });
    });
});
