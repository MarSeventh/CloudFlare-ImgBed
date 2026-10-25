import assert from 'node:assert/strict';
import { loadFunction } from './helpers/loadFunction.js';
import { createContext } from './helpers/context.js';
import { managementFixture } from './helpers/management.js';

describe('duplicate scan (read-only, Node-only)', () => {
    let fixture, scan;

    beforeEach(async () => {
        fixture = await managementFixture();
        scan = await loadFunction('functions/api/manage/dedup/scan.js', fixture.mocks);
    });

    function ctx(extra = {}) {
        return createContext('https://test/api/manage/dedup/scan', {
            method: 'POST',
            env: { ...fixture.env, SERVER_RUNTIME: 'node' },
            ...extra,
        });
    }

    function seedWithChunks(files, { corruptChunk = false, chunkCount = 1 } = {}) {
        return (async () => {
            await fixture.db.put('manage@index@meta', JSON.stringify({ chunkCount, totalCount: files.length }));
            const chunk = JSON.stringify(files.map(({ id, metadata }) => ({ id, metadata })));
            if (corruptChunk) {
                // 存一个无法 JSON.parse 的损坏分片
                await fixture.db.put('manage@index_0', '{corrupted');
            } else {
                await fixture.db.put('manage@index_0', chunk);
            }
            // 每个文件同时写记录(fixture.seed 语义)并放 R2 对象内容;真实上传管线都会写 FileSizeBytes
            for (const file of files) {
                const meta = { ...file.metadata };
                if (meta.FileSizeBytes === undefined && !file.noSize) meta.FileSizeBytes = (file.content ?? 'file-content').length;
                await fixture.db.put(file.id, '', { metadata: meta });
                fixture.objects.set(file.id, file.content ?? 'file-content');
            }
        })();
    }

    it('returns 501 when SERVER_RUNTIME is absent (Workers/Pages even with D1 bound)', async () => {
        const env = { ...fixture.env, SERVER_RUNTIME: undefined, img_d1: { prepare: () => {} } };
        const c = createContext('https://test/api/manage/dedup/scan', { method: 'POST', env });
        const response = await scan.onRequest(c);
        assert.equal(response.status, 501);
        assert.equal((await response.json()).supported, false);
    });

    it('groups identical content and keeps the earliest record regardless of index order', async () => {
        // 索引故意倒序写入(最新在前),keep 仍应为时间戳最早的 old.png
        await seedWithChunks([
            { id: 'new.png', metadata: { FileName: 'new.png', Channel: 'CloudflareR2', TimeStamp: 300 }, content: 'same' },
            { id: 'mid.png', metadata: { FileName: 'mid.png', Channel: 'CloudflareR2', TimeStamp: 200 }, content: 'same' },
            { id: 'old.png', metadata: { FileName: 'old.png', Channel: 'CloudflareR2', TimeStamp: 100 }, content: 'same' },
            { id: 'unique.png', metadata: { FileName: 'unique.png', Channel: 'CloudflareR2', TimeStamp: 50 }, content: 'other' },
        ]);
        const body = await (await scan.onRequest(ctx())).json();
        assert.equal(body.complete, true);
        assert.equal(body.scanned, 4);
        assert.equal(body.duplicateGroups.length, 1);
        const group = body.duplicateGroups[0];
        assert.equal(group.keep.id, 'old.png');
        assert.deepEqual(group.duplicates.map(d => d.id), ['mid.png', 'new.png']);
        assert.equal(body.redundantCopies, 2);
    });

    it('also keeps the earliest under shuffled timestamps', async () => {
        await seedWithChunks([
            { id: 'a.png', metadata: { FileName: 'a.png', Channel: 'CloudflareR2', TimeStamp: 900 }, content: 'x' },
            { id: 'b.png', metadata: { FileName: 'b.png', Channel: 'CloudflareR2', TimeStamp: 100 }, content: 'x' },
            { id: 'c.png', metadata: { FileName: 'c.png', Channel: 'CloudflareR2', TimeStamp: 500 }, content: 'x' },
        ]);
        const body = await (await scan.onRequest(ctx())).json();
        assert.equal(body.duplicateGroups[0].keep.id, 'b.png');
    });

    it('reports incompleteness with chunk error details when a chunk fails to parse', async () => {
        await seedWithChunks([], { corruptChunk: true });
        const body = await (await scan.onRequest(ctx())).json();
        assert.equal(body.complete, false);
        assert.equal(body.chunkErrors.length, 1);
        assert.equal(body.chunkErrors[0].chunk, 0);
    });

    it('counts unreadable channels as readErrors instead of hashing fallbacks', async () => {
        // 非 R2 渠道无本地绑定 → readErrors,不产生假分组
        await seedWithChunks([
            { id: 'tg1.png', metadata: { FileName: 'tg1.png', Channel: 'TelegramNew', TimeStamp: 1 }, content: 'same' },
            { id: 'tg2.png', metadata: { FileName: 'tg2.png', Channel: 'TelegramNew', TimeStamp: 2 }, content: 'same' },
        ]);
        const body = await (await scan.onRequest(ctx())).json();
        assert.equal(body.readErrors.length, 2);
        assert.equal(body.duplicateGroups.length, 0);
    });

    it('skips oversized files and reports them separately', async () => {
        await seedWithChunks([
            { id: 'big.png', metadata: { FileName: 'big.png', Channel: 'CloudflareR2', TimeStamp: 1, FileSizeBytes: 500 * 1024 * 1024 }, content: 'big' },
        ]);
        const c = createContext('https://test/api/manage/dedup/scan?maxFileMB=100', { method: 'POST', env: { ...fixture.env, SERVER_RUNTIME: 'node' } });
        const body = await (await scan.onRequest(c)).json();
        assert.deepEqual(body.skippedOversized, ['big.png']);
        assert.equal(body.duplicateGroups.length, 0);
    });

    it('GET probes deployment capability without scanning', async () => {
        await seedWithChunks([
            { id: 'a.png', metadata: { FileName: 'a.png', Channel: 'CloudflareR2', TimeStamp: 1 }, content: 'x' },
        ]);
        const c = createContext('https://test/api/manage/dedup/scan', { method: 'GET', env: { ...fixture.env, SERVER_RUNTIME: 'node' } });
        const res = await scan.onRequest(c);
        assert.equal(res.status, 200);
        assert.deepEqual(await res.json(), { supported: true });
    });

    it('GET also reports unsupported on Workers-like runtimes', async () => {
        const env = { ...fixture.env, SERVER_RUNTIME: undefined, img_d1: { prepare: () => {} } };
        const c = createContext('https://test/api/manage/dedup/scan', { method: 'GET', env });
        const res = await scan.onRequest(c);
        assert.equal(res.status, 501);
        assert.equal((await res.json()).supported, false);
    });

    it('reports a missing chunk as incomplete instead of silently skipping it', async () => {
        await seedWithChunks([
            { id: 'a.png', metadata: { FileName: 'a.png', Channel: 'CloudflareR2', TimeStamp: 1 }, content: 'x' },
        ]);
        // chunkCount 宣称 2,chunk_1 从未写入 → 必须计入 chunkErrors 并 complete:false
        await fixture.db.put('manage@index@meta', JSON.stringify({ chunkCount: 2, totalCount: 1 }));
        const body = await (await scan.onRequest(ctx())).json();
        assert.equal(body.complete, false);
        assert.ok(body.chunkErrors.some(e => e.chunk === 1 && /missing/.test(e.error)));
    });

    it('reports corrupt index meta as incomplete with a meta chunk error', async () => {
        await seedWithChunks([]);
        await fixture.db.put('manage@index@meta', '{corrupted-meta');
        const body = await (await scan.onRequest(ctx())).json();
        assert.equal(body.complete, false);
        assert.ok(body.chunkErrors.some(e => e.chunk === 'meta'));
    });

    it('stops within the time budget and marks the report timedOut and incomplete', async () => {
        await seedWithChunks([
            { id: 'a.png', metadata: { FileName: 'a.png', Channel: 'CloudflareR2', TimeStamp: 1 }, content: 'x' },
            { id: 'b.png', metadata: { FileName: 'b.png', Channel: 'CloudflareR2', TimeStamp: 2 }, content: 'y' },
        ]);
        const c = createContext('https://test/api/manage/dedup/scan?timeoutMs=0', { method: 'POST', env: { ...fixture.env, SERVER_RUNTIME: 'node' } });
        const body = await (await scan.onRequest(c)).json();
        assert.equal(body.complete, false);
        assert.equal(body.timedOut, true);
    });

    it('treats an invalid maxFileMB parameter as the default cap instead of disabling it', async () => {
        await seedWithChunks([
            { id: 'big.png', metadata: { FileName: 'big.png', Channel: 'CloudflareR2', TimeStamp: 1, FileSizeBytes: 500 * 1024 * 1024 }, content: 'big' },
        ]);
        const c = createContext('https://test/api/manage/dedup/scan?maxFileMB=abc', { method: 'POST', env: { ...fixture.env, SERVER_RUNTIME: 'node' } });
        const body = await (await scan.onRequest(c)).json();
        // 非法参数回退默认 100MB → 该文件仍按超限跳过,而不是被 NaN 绕过
        assert.deepEqual(body.skippedOversized, ['big.png']);
    });

    it('fail-closed: records without a trustworthy FileSizeBytes are skipped, not read unbounded', async () => {
        await seedWithChunks([
            { id: 'unknown.png', metadata: { FileName: 'unknown.png', Channel: 'CloudflareR2', TimeStamp: 1 }, content: 'mystery-bytes', noSize: true },
            { id: 'known.png', metadata: { FileName: 'known.png', Channel: 'CloudflareR2', TimeStamp: 2 }, content: 'known' },
        ]);
        const body = await (await scan.onRequest(ctx())).json();
        assert.deepEqual(body.skippedOversized, ['unknown.png']);
        // 缺尺寸的记录不参与分组,scanned 只统计已处理条目
        assert.equal(body.duplicateGroups.length, 0);
        assert.equal(body.scanned, 2);
    });

    it('does not overcount scanned records after the time budget stops the scan', async () => {
        await seedWithChunks([
            { id: 'a.png', metadata: { FileName: 'a.png', Channel: 'CloudflareR2', TimeStamp: 1 }, content: 'x' },
            { id: 'b.png', metadata: { FileName: 'b.png', Channel: 'CloudflareR2', TimeStamp: 2 }, content: 'y' },
        ]);
        const c = createContext('https://test/api/manage/dedup/scan?timeoutMs=0', { method: 'POST', env: { ...fixture.env, SERVER_RUNTIME: 'node' } });
        const body = await (await scan.onRequest(c)).json();
        assert.equal(body.timedOut, true);
        // scanned 只统计已处理条目,超时后剩余的不计入
        assert.equal(body.scanned, 0);
    });
});
