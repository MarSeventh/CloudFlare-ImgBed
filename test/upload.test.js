import assert from 'node:assert/strict';
import { File } from 'node:buffer';
import { loadFunction, memoryDatabase } from './helpers/loadFunction.js';
import * as responses from '../functions/utils/apiResponse.js';
import { png } from './helpers/files.js';

describe('upload', () => {
    let db, tools, mocks, storage, waits;

    beforeEach(async () => {
        db = memoryDatabase();
        storage = {};
        waits = [];
        tools = await loadFunction('functions/upload/uploadTools.js', { getDatabase: () => db });
        const { UnauthorizedResponse } = await loadFunction('functions/utils/auth/userAuth.js');
        mocks = {
            ...tools,
            ...responses,
            getDatabase: () => db,
            checkDatabaseConfig: () => ({ usingD1: false }),
            fetchSecurityConfig: async () => ({ upload: { moderate: { enabled: false } } }),
            fetchUploadConfig: async () => ({
                cfr2: { channels: [{ name: 'mock' }] },
                telegram: { channels: [{ name: 'mock', botToken: 'mock', chatId: 'mock' }], loadBalance: { enabled: false } },
                s3: { channels: [{ name: 'mock', bucketName: 'mock' }], loadBalance: { enabled: false } },
                webdav: { channels: [{ name: 'mock', baseUrl: 'https://storage.invalid' }] },
                huggingface: { channels: [{ name: 'mock', token: 'mock', repo: 'mock/repo', isPrivate: true }] },
            }),
            fetchPageConfig: async () => ({ config: [] }),
            userAuthCheck: async () => true,
            UnauthorizedResponse,
            isBlockedUploadIp: async () => false,
            getIPAddress: async () => '',
            getUploadIp: () => '',
            moderateContent: async () => 'None',
            endUpload: async () => {},
            createS3Client: () => ({ async send(command) {
                if (command.kind === 'put' || command.kind === 'create') storage.contentType = command.input.ContentType;
                return { UploadId: 'multipart', ETag: 'etag' };
            } }),
            PutObjectCommand: class { constructor(input) { this.kind = 'put'; this.input = input; } },
            CreateMultipartUploadCommand: class { constructor(input) { this.kind = 'create'; this.input = input; } },
            UploadPartCommand: class { constructor(input) { this.kind = 'part'; this.input = input; } },
            CompleteMultipartUploadCommand: class { constructor(input) { this.kind = 'complete'; this.input = input; } },
            TelegramAPI: class {
                async sendFile(file, chat, method) { storage.method = method; storage.fileName = file.name; return {}; }
                getFileInfo() { return { file_id: 'mock-id', file_size: 24 }; }
                async getFilePath() { return 'mock-path'; }
            },
            WebDAVAPI: class { async putFile(id, file, type) { storage.contentType = type; } },
            HuggingFaceAPI: class {
                async getLfsUploadInfo() { return {}; }
                async commitLfsFile() { return {}; }
            },
        };
    });

    function context(url, body) {
        return {
            request: new Request(url, { method: 'POST', body }),
            url: new URL(url),
            env: { img_r2: {
                async put(id, file, options) { storage.contentType = options.httpMetadata.contentType; },
                async createMultipartUpload(id, options) { storage.contentType = options.httpMetadata.contentType; return { uploadId: 'multipart' }; },
                resumeMultipartUpload() { return { async uploadPart() { return { etag: 'etag' }; }, async complete() {} }; },
            } },
            waitUntil(promise) { waits.push(promise); },
            securityConfig: { upload: { moderate: { enabled: false } } },
        };
    }

    it('requires upload permission before parsing a file or writing to storage', async () => {
        const route = await loadFunction('functions/upload/index.js', {
            ...mocks,
            userAuthCheck: async (env, url, request, permission) => {
                assert.equal(permission, 'upload');
                return false;
            },
        });
        const response = await route.onRequest(context('https://test/upload?uploadChannel=cfr2'));
        assert.equal(response.status, 401);
        assert.equal(response.headers.get('Cache-Control'), 'no-store');
        assert.equal(db.records.size, 0);
        assert.deepEqual(storage, {});
    });

    it('blocks forbidden upload IPs before parsing or storing a file', async () => {
        const route = await loadFunction('functions/upload/index.js', { ...mocks, isBlockedUploadIp: async () => true });
        const response = await route.onRequest(context('https://test/upload?uploadChannel=cfr2'));
        assert.equal(response.status, 403);
        assert.equal(db.records.size, 0);
        assert.deepEqual(storage, {});
    });

    it('sanitizes destination directories and avoids overwriting duplicate original filenames', async () => {
        const route = await loadFunction('functions/upload/index.js', mocks);
        await db.put('_/photos/photo.png', 'existing', { metadata: { FileName: 'keep.png' } });
        const form = new FormData();
        form.set('file', new File([png()], 'photo.png', { type: 'image/png' }));
        const response = await route.onRequest(context('https://test/upload?uploadChannel=cfr2&uploadNameType=origin&uploadFolder=..%2Fphotos%2F%2F', form));
        assert.equal(response.status, 200);
        assert.equal(decodeURI((await response.json())[0].src), '/file/_/photos/photo(1).png');
        const record = await db.getWithMetadata('_/photos/photo(1).png');
        assert.equal(record.metadata.Directory, '_/photos/');
        assert.equal(record.metadata.FileName, 'photo.png');
        assert.equal(record.metadata.FileSizeBytes, png().length);
        assert.equal(await db.get('_/photos/photo.png'), 'existing');
        await Promise.all(waits);
    });

    for (const channel of ['cfr2', 's3', 'webdav']) {
        for (const [type, expected] of [['application/octet-stream; charset=binary', 'image/png'], ['application/pdf; name=Test', 'application/pdf; name=test']]) {
            it(`stores consistent metadata and upstream headers for ${channel}: ${type}`, async () => {
                const route = await loadFunction('functions/upload/index.js', mocks);
                const form = new FormData();
                form.append('file', new File([png()], 'photo.PNG', { type }));
                const response = await route.onRequest(context(`https://test/upload?uploadChannel=${channel}&autoRetry=false`, form));
                assert.equal(response.status, 200, await response.clone().text());
                const [{ src }] = await response.json();
                const record = await db.getWithMetadata(src.slice('/file/'.length));
                assert.equal(record.metadata.FileType, expected);
                assert.equal(storage.contentType, expected);
                if (expected === 'image/png') assert.deepEqual([record.metadata.Width, record.metadata.Height], [400, 200]);
                else assert.equal(record.metadata.Width, undefined);
                await Promise.all(waits);
            });
        }
    }

    it('retains Telegram special-format routing and serverCompress=false', async () => {
        const route = await loadFunction('functions/upload/index.js', mocks);
        for (const [name, type, query, method] of [
            ['photo.png', 'image/png', '', 'sendPhoto'],
            ['photo.png', 'application/octet-stream', '&serverCompress=false', 'sendDocument'],
            ['photo.svg', 'image/svg+xml; charset=utf-8', '', 'sendDocument'],
            ['photo.ico', 'image/x-icon', '', 'sendDocument'],
            ['photo.GIF', 'image/gif; charset=binary', '', 'sendAnimation'],
            ['photo.WEBP', 'image/webp', '', 'sendAnimation'],
        ]) {
            const form = new FormData();
            form.append('file', new File([png()], name, { type }));
            const response = await route.onRequest(context(`https://test/upload?uploadChannel=telegram&autoRetry=false${query}`, form));
            assert.equal(response.status, 200);
            assert.equal(storage.method, method);
            if (method === 'sendAnimation') assert.equal(storage.fileName.endsWith('.jpeg'), true);
        }
        await Promise.all(waits);
    });

    for (const [channel, fileType, expected] of [
        ['cfr2', 'application/octet-stream; charset=binary', 'image/png'],
        ['s3', 'application/octet-stream; charset=binary', 'image/png'],
        ['cfr2', 'application/pdf', 'application/pdf'],
        ['s3', 'application/pdf', 'application/pdf'],
    ]) {
        it(`normalizes ${channel} chunk session, multipart headers and merged metadata: ${fileType}`, async () => {
            const chunk = await loadFunction('functions/upload/chunkUpload.js', mocks, {
                // The existing route leaves its timeout scheduled after a successful
                // upload. Do not keep the test process alive for that timeout.
                setTimeout: (...args) => setTimeout(...args).unref(),
            });
            const form = new FormData();
            form.set('originalFileName', 'photo.png');
            form.set('originalFileType', fileType);
            form.set('totalChunks', '1');
            const uploadContext = context(`https://test/upload?uploadChannel=${channel}`, form);
            uploadContext.uploadConfig = await mocks.fetchUploadConfig();
            const initialized = await chunk.initializeChunkedUpload(uploadContext);
            assert.equal(initialized.status, 200);
            const { uploadId } = await initialized.json();
            const session = JSON.parse(await db.get(`upload_session_${uploadId}`));
            assert.equal(session.originalFileType, expected);

            const partForm = new FormData();
            for (const [key, value] of form.entries()) partForm.set(key, value);
            partForm.set('uploadId', uploadId);
            partForm.set('chunkIndex', '0');
            partForm.set('file', new File([png()], 'part'));
            uploadContext.request = new Request(uploadContext.url, { method: 'POST', body: partForm });
            const uploaded = await chunk.handleChunkUpload(uploadContext);
            assert.equal(uploaded.status, 200);
            assert.equal(storage.contentType, expected);
            assert.equal((await db.getWithMetadata(`chunk_${uploadId}_000`)).metadata.status, 'completed');

            const merge = await loadFunction('functions/upload/chunkMerge.js', { ...mocks, ...chunk });
            const mergeForm = new FormData();
            mergeForm.set('originalFileName', 'photo.png');
            mergeForm.set('uploadId', uploadId);
            mergeForm.set('totalChunks', '1');
            // No MIME in merge request: reuse the type stored in the session.
            uploadContext.request = new Request(uploadContext.url, { method: 'POST', body: mergeForm });
            const merged = await merge.handleChunkMerge(uploadContext);
            assert.equal(merged.status, 200, await merged.clone().text());
            const [{ src }] = await merged.json();
            const metadata = (await db.getWithMetadata(src.slice('/file/'.length))).metadata;
            assert.equal(metadata.FileType, expected);
            assert.equal(metadata.FileSizeBytes, 24);
            await Promise.all(waits);
        });
    }

    it('accepts absent MIME at chunk initialization and keeps required filename validation', async () => {
        const chunk = await loadFunction('functions/upload/chunkUpload.js', mocks);
        const form = new FormData();
        form.set('originalFileName', 'photo.png');
        form.set('totalChunks', '1');
        const ctx = context('https://test/upload?uploadChannel=cfr2', form);
        const initialized = await chunk.initializeChunkedUpload(ctx);
        const { uploadId } = await initialized.json();
        assert.equal(JSON.parse(await db.get(`upload_session_${uploadId}`)).originalFileType, 'image/png');
        form.delete('originalFileName');
        assert.equal((await chunk.initializeChunkedUpload(context('https://test/upload', form))).status, 400);
    });

    it('normalizes HuggingFace direct-upload naming and committed metadata', async () => {
        let namedType;
        const getUrl = await loadFunction('functions/upload/huggingface/getUploadUrl.js', {
            ...mocks,
            buildUniqueFileId: async (ctx, name, type) => { namedType = type; return name; },
        });
        const body = { fileSize: 24, fileName: 'photo.png', fileType: 'application/octet-stream; charset=binary', sha256: 'mock', fileSample: 'mock' };
        const initialized = await getUrl.onRequestPost(context('https://test/upload/huggingface/getUploadUrl', JSON.stringify(body)));
        assert.equal(initialized.status, 200, await initialized.clone().text());
        assert.equal(namedType, 'image/png');
        const { fullId, filePath } = await initialized.json();
        const commit = await loadFunction('functions/upload/huggingface/commitUpload.js', mocks);
        const response = await commit.onRequestPost(context('https://test/upload/huggingface/commitUpload', JSON.stringify({ ...body, fullId, filePath })));
        assert.equal(response.status, 200, await response.clone().text());
        assert.equal((await db.getWithMetadata(fullId)).metadata.FileType, 'image/png');
        await Promise.all(waits);
    });

});
