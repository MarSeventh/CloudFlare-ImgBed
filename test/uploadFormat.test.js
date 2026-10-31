import assert from 'node:assert/strict';
import { isUploadFormatAllowed, normalizeUploadFormatConfig, validateUploadFormatConfig } from '../functions/utils/uploadFormat.js';
import * as expiry from '../functions/utils/fileExpiryHelpers.js';
import { loadFunction, memoryDatabase } from './helpers/loadFunction.js';

describe('upload format restrictions', () => {
    it('defaults to disabled and normalizes extensions', () => {
        assert.deepEqual(normalizeUploadFormatConfig(), { enabled: false, mode: 'whitelist', extensions: [] });
        assert.deepEqual(validateUploadFormatConfig({ enabled: true, mode: 'whitelist', extensions: [' JPG ', '.jpg', 'tar.GZ'] }), {
            config: { enabled: true, mode: 'whitelist', extensions: ['jpg', 'tar.gz'] },
        });
        assert.equal(isUploadFormatAllowed('anything.exe'), true);
        assert.equal(isUploadFormatAllowed('no-extension', { enabled: false, mode: 'whitelist', extensions: ['jpg'] }), true);
    });

    it('matches suffixes case-insensitively, including compound extensions and extensionless files', () => {
        for (const mode of ['whitelist', 'blacklist']) {
            const config = { enabled: true, mode, extensions: ['jpg', 'tar.gz'] };
            for (const name of ['photo.JPG', 'album/photo.jpg', 'backup.tar.gz']) {
                assert.equal(isUploadFormatAllowed(name, config), mode === 'whitelist', name);
            }
            for (const name of ['photo.jpg.exe', 'photojpg', 'folder.jpg/file', 'file', '.jpg', 'file.', null]) {
                assert.equal(isUploadFormatAllowed(name, config), mode === 'blacklist', String(name));
            }
        }
    });

    it('rejects invalid settings and an enabled empty whitelist', () => {
        for (const raw of [null, {}, { enabled: 'true', mode: 'whitelist', extensions: ['jpg'] },
            { enabled: true, mode: 'other', extensions: ['jpg'] },
            ...[[], ['*'], ['image/png'], ['jpg,png'], [1], ['a'.repeat(33)], Array.from({ length: 201 }, (_, i) => `ext${i}`)]
                .map(extensions => ({ enabled: true, mode: 'whitelist', extensions }))]) {
            assert.ok(validateUploadFormatConfig(raw).error, JSON.stringify(raw));
        }
        assert.ok(validateUploadFormatConfig({ enabled: false, mode: 'whitelist', extensions: [] }).config);
        assert.ok(validateUploadFormatConfig({ enabled: true, mode: 'blacklist', extensions: [] }).config);
    });

    it('persists restrictions under upload settings and preserves them when channel settings are saved', async () => {
        const db = memoryDatabase();
        const route = await loadFunction('functions/api/manage/sysConfig/upload.js', { ...expiry, getDatabase: () => db });
        const call = body => route.onRequest({ env: {}, request: new Request('https://test/api/manage/sysConfig/upload',
            body === undefined ? {} : { method: 'POST', body: JSON.stringify(body) }) });
        const defaults = await (await call()).json();
        assert.deepEqual(defaults.fileFormat, { enabled: false, mode: 'whitelist', extensions: [] });
        const config = { enabled: true, mode: 'blacklist', extensions: ['EXE', '.exe', 'cmd'] };
        assert.equal((await call({ fileFormat: config })).status, 200);
        assert.equal((await call({ telegram: { channels: [] } })).status, 200);
        assert.deepEqual((await (await call()).json()).fileFormat, { enabled: true, mode: 'blacklist', extensions: ['exe', 'cmd'] });
        const before = await db.get('manage@sysConfig@upload');
        assert.equal((await call({ fileFormat: { ...config, mode: 'whitelist', extensions: [] } })).status, 400);
        assert.equal(await db.get('manage@sysConfig@upload'), before);
    });
});
