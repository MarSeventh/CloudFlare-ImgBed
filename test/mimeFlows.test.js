import assert from 'node:assert/strict';
import { File } from 'node:buffer';
import { loadFunction, memoryDatabase } from './helpers/loadFunction.js';
import * as responses from '../functions/utils/apiResponse.js';
import * as fileTools from '../functions/file/fileTools.js';
import * as imageTransform from '../functions/file/imageTransform.js';
import * as adaptive from '../functions/random/adaptive.js';

function png() {
    const bytes = new Uint8Array(24);
    bytes.set([137, 80, 78, 71]);
    const view = new DataView(bytes.buffer);
    view.setUint32(16, 400);
    view.setUint32(20, 200);
    return bytes;
}

describe('MIME flow integration', () => {
    let db, tools, mocks, storage, waits;

    beforeEach(async () => {
        db = memoryDatabase();
        storage = {};
        waits = [];
        tools = await loadFunction('functions/upload/uploadTools.js', { getDatabase: () => db });
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

    it('preserves strict list filtering, OR selection, and generic historical metadata', async () => {
        const index = await loadFunction('functions/utils/indexManager.js', mocks);
        const files = [
            { id: 'a.png', metadata: { FileType: 'image/png' } },
            { id: 'b.mp4', metadata: { FileType: 'video/mp4' } },
            { id: 'c.bin', metadata: { FileType: 'application/x-image' } },
            { id: 'old.png', metadata: { FileType: 'application/octet-stream' } },
        ];
        await db.put('manage@index@meta', JSON.stringify({ chunkCount: 1, totalCount: files.length }));
        await db.put('manage@index_0', JSON.stringify(files));
        const ctx = context('https://test/api/manage/list', '');
        const images = await index.readIndex(ctx, { count: -1, fileType: ['image'] });
        assert.equal(images.success, true);
        assert.deepEqual(images.files.map(file => file.id), ['a.png']);
        const mixed = await index.readIndex(ctx, { count: -1, fileType: ['image', 'video'] });
        assert.deepEqual(mixed.files.map(file => file.id), ['a.png', 'b.mp4']);
        const other = await index.readIndex(ctx, { count: -1, fileType: ['other'] });
        assert.deepEqual(other.files.map(file => file.id), ['c.bin', 'old.png']);
        assert.equal((await index.readIndex(ctx, { count: -1, fileType: ['bogus'] })).files.length, 0);
    });

    it('normalizes AI preview MIME while retaining format, signature, and size checks', async () => {
        const calls = [];
        const route = await loadFunction('functions/api/manage/ai/tags.js', {
            ...mocks,
            createAIContext: () => ({
                getConfig: async () => ({ enabled: true, capabilities: { 'image.tags': { enabled: true } }, execution: { maxBatchSize: 5, concurrency: 1, requestDeadlineMs: 10000 } }),
                invoke: async options => { calls.push(options); return { data: { tags: ['test'] } }; },
            }),
            validateFileId: () => {},
            fileIdentity: async () => 'identity',
        });
        for (const [original, preview, bytes, error] of [
            ['IMAGE/PNG; charset=binary', 'image/png; charset=binary', png(), null],
            ['image/svg+xml', 'image/png', png(), 'UNSUPPORTED_INPUT'],
            ['image/png', 'image/png', new Uint8Array(24), 'INVALID_IMAGE'],
            ['image/png', 'image/svg+xml', png(), 'INVALID_IMAGE'],
            ['image/png', 'image/png', new Uint8Array(256 * 1024 + 1), 'INVALID_IMAGE'],
        ]) {
            await db.put('photo.png', '', { metadata: { FileType: original } });
            const form = new FormData();
            form.set('items', JSON.stringify([{ fileId: 'photo.png' }]));
            form.set('image0', new File([bytes], 'preview.png', { type: preview }));
            const response = await route.onRequest(context('https://test/api/manage/ai/tags', form));
            const { results } = await response.json();
            assert.equal(results[0].error?.code ?? null, error);
        }
        assert.equal(calls.length, 1);
        assert.equal(calls[0].input.image.startsWith('data:image/png;base64,'), true);
    });

    it('keeps content= working through the random API for records without a known type', async () => {
        const previousCaches = globalThis.caches;
        const route = await loadFunction('functions/random/index.js', {
            ...adaptive,
            fetchOthersConfig: async () => ({ randomImageAPI: { enabled: true, allowedDir: '' } }),
        });
        try {
            globalThis.caches = { default: { match: async () => new Response(JSON.stringify([{ name: 'notes.unknown', FileType: '' }])) } };
            const response = await route.onRequest({ request: new Request('https://test/random?content='), env: {} });
            assert.deepEqual(await response.json(), { url: '/file/notes.unknown' });
            const filtered = await route.onRequest({ request: new Request('https://test/random'), env: {} });
            assert.deepEqual(await filtered.json(), {});
        } finally {
            if (previousCaches === undefined) delete globalThis.caches;
            else globalThis.caches = previousCaches;
        }
    });

    it('preserves GET/HEAD/Range response behavior and Content-Type parameters without historical inference', async () => {
        const route = await loadFunction('functions/file/[[path]].js', {
            ...mocks, ...fileTools, ...imageTransform,
            fetchSecurityConfig: async () => ({ access: { whiteListMode: false } }),
        });
        for (const [type, expected] of [[' Application/PDF ; name=Photo ', 'application/pdf; name=Photo'], ['application/octet-stream', 'application/octet-stream']]) {
            await db.put('photo.jpg', '', { metadata: { Channel: 'CloudflareR2', FileName: 'photo.jpg', FileType: type } });
            for (const [method, range] of [['GET', false], ['HEAD', false], ['GET', true]]) {
                const ctx = context('https://test/file/photo.jpg', '');
                ctx.request = new Request(ctx.url, { method, headers: range ? { Range: 'bytes=0-1' } : {} });
                ctx.params = { path: 'photo.jpg' };
                ctx.env.img_r2.get = async (id, options) => ({
                    body: new Response(range ? 'so' : 'source').body,
                    size: 6,
                    range: options?.range,
                    writeHttpMetadata(headers) { headers.set('Content-Type', 'application/octet-stream'); },
                });
                const response = await route.onRequest(ctx);
                assert.equal(response.status, range ? 206 : 200);
                assert.equal(response.headers.get('Content-Type'), expected);
                assert.equal(await response.text(), method === 'HEAD' ? '' : range ? 'so' : 'source');
                if (range) assert.equal(response.headers.get('Content-Range'), 'bytes 0-1/6');
            }
        }
    });
});
