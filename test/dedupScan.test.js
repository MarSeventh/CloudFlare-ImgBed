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
        // 有内容读取失败就不算「完整扫描」
        assert.equal(body.complete, false);
    });

    it('skips oversized files and reports them separately', async () => {
        await seedWithChunks([
            { id: 'big.png', metadata: { FileName: 'big.png', Channel: 'CloudflareR2', TimeStamp: 1, FileSizeBytes: 500 * 1024 * 1024 }, content: 'big' },
        ]);
        const c = createContext('https://test/api/manage/dedup/scan?maxFileMB=100', { method: 'POST', env: { ...fixture.env, SERVER_RUNTIME: 'node' } });
        const body = await (await scan.onRequest(c)).json();
        assert.deepEqual(body.skippedOversized, ['big.png']);
        assert.equal(body.duplicateGroups.length, 0);
        // 超限跳过也是「部分扫描」:不算完整成功
        assert.equal(body.complete, false);
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
            { id: 'unknown.png', metadata: { FileName: 'unknown.png', Channel: 'CloudflareR2', TimeStamp: 1 }, content: 'same-bytes', noSize: true },
            { id: 'known.png', metadata: { FileName: 'known.png', Channel: 'CloudflareR2', TimeStamp: 2 }, content: 'same-bytes' },
        ]);
        const body = await (await scan.onRequest(ctx())).json();
        assert.deepEqual(body.skippedOversized, ['unknown.png']);
        // 判别性:两条内容相同,若 fail-closed 失效而读入 unknown.png,会形成重复组
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

    it('rejects malformed index shapes and repeated IDs without inventing duplicate copies', async () => {
        for (const chunkCount of [null, -1, 1.5, '1']) {
            await fixture.db.put('manage@index@meta', JSON.stringify({ chunkCount }));
            const report = await (await scan.onRequest(ctx())).json();
            assert.equal(report.complete, false);
            assert.equal(report.chunkErrors.length, 1);
        }
        await seedWithChunks([{ id: 'a.png', metadata: { Channel: 'CloudflareR2' }, content: 'x' }]);
        await fixture.db.put('manage@index_0', JSON.stringify([null, { id: 'a.png' }, { id: 'a.png' }]));
        const report = await (await scan.onRequest(ctx())).json();
        assert.equal(report.complete, false);
        assert.equal(report.recordErrors.length, 2);
        assert.equal(report.scanned, 1);
        assert.equal(report.redundantCopies, 0);
    });

    it('does not read storage for a missing KV record with stale index metadata', async () => {
        await seedWithChunks([{ id: 'gone.png', metadata: { Channel: 'CloudflareR2' } }]);
        fixture.db.getWithMetadata = async () => ({ value: null, metadata: null });
        fixture.env.img_r2.get = () => { throw new Error('must not read orphan storage'); };
        const report = await (await scan.onRequest(ctx())).json();
        assert.equal(report.recordErrors.length, 1);
        assert.equal(report.readErrors.length, 0);
        assert.equal(report.complete, false);
    });

    it('marks pending or concurrent index changes incomplete without merging them', async () => {
        await seedWithChunks([{ id: 'a.png', metadata: { Channel: 'CloudflareR2' } }]);
        const operationKey = 'manage@index@operation_pending';
        await fixture.db.put(operationKey, JSON.stringify({ type: 'add' }));
        const before = structuredClone(fixture.db.records);
        let report = await (await scan.onRequest(ctx())).json();
        assert.equal(report.complete, false);
        assert.equal(report.indexChanged, true);
        assert.deepEqual(fixture.db.records, before);

        await fixture.db.delete(operationKey);
        const originalGet = fixture.env.img_r2.get;
        fixture.env.img_r2.get = async id => {
            await fixture.db.put('manage@index@meta', JSON.stringify({ chunkCount: 1, totalCount: 2 }));
            return originalGet(id);
        };
        report = await (await scan.onRequest(ctx())).json();
        assert.equal(report.complete, false);
        assert.equal(report.indexChanged, true);
    });

    it('cancels oversized object streams before consuming content', async () => {
        await seedWithChunks([{ id: 'big.png', metadata: { Channel: 'CloudflareR2', FileSizeBytes: 1 } }]);
        let cancelled = false;
        fixture.env.img_r2.get = async () => ({
            size: 200 * 1024 * 1024,
            body: new ReadableStream({ cancel() { cancelled = true; } }),
        });
        const report = await (await scan.onRequest(ctx())).json();
        assert.equal(cancelled, true);
        assert.deepEqual(report.skippedOversized, ['big.png']);
    });

    it('cancels an object that arrives after the scan timed out', async () => {
        await seedWithChunks([{ id: 'late.png', metadata: { Channel: 'CloudflareR2' } }]);
        let release;
        let cancelled = false;
        fixture.env.img_r2.get = () => new Promise(resolve => { release = resolve; });
        const c = ctx();
        c.request = new Request('https://test/api/manage/dedup/scan?timeoutMs=20', { method: 'POST' });
        const report = await (await scan.onRequest(c)).json();
        assert.equal(report.timedOut, true);
        release({ body: new ReadableStream({ cancel() { cancelled = true; } }) });
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(cancelled, true);
    });

    it('includes the final hash operation in the scan deadline', async () => {
        await seedWithChunks([{ id: 'a.png', metadata: { Channel: 'CloudflareR2' } }]);
        scan = await loadFunction('functions/api/manage/dedup/scan.js', fixture.mocks, {
            crypto: { subtle: { digest: () => new Promise(() => {}) } },
        });
        const c = ctx();
        c.request = new Request('https://test/api/manage/dedup/scan?timeoutMs=20', { method: 'POST' });
        const report = await (await scan.onRequest(c)).json();
        assert.equal(report.timedOut, true);
        assert.equal(report.complete, false);
    });

    it('releases late storage results when the timeout fires before the wall clock reaches the deadline', async () => {
        await seedWithChunks([{ id: 'late.png', metadata: { Channel: 'CloudflareR2' } }]);
        scan = await loadFunction('functions/api/manage/dedup/scan.js', fixture.mocks, {
            Date: class extends Date { static now() { return 1000; } },
        });
        let release;
        let cancelled = false;
        fixture.env.img_r2.get = () => new Promise(resolve => { release = resolve; });
        const c = ctx();
        c.request = new Request('https://test/api/manage/dedup/scan?timeoutMs=20', { method: 'POST' });
        const report = await (await scan.onRequest(c)).json();
        assert.equal(report.timedOut, true);
        assert.equal(report.complete, false);
        release({ body: new ReadableStream({ cancel() { cancelled = true; } }) });
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(cancelled, true);
    });

    it('bounds reads by the actual stored object size even when metadata lies smaller', async () => {
        // 作者复现:元数据 FileSizeBytes=1,存储对象实际 1.5MB > maxFileMB=1
        // → 不得整读,以存储返回的 obj.size 为准计入 skippedOversized
        const big = 'x'.repeat(1500 * 1024);
        await seedWithChunks([
            { id: 'liar.png', metadata: { FileName: 'liar.png', Channel: 'CloudflareR2', TimeStamp: 1, FileSizeBytes: 1 }, content: big },
        ]);
        const origGet = fixture.env.img_r2.get;
        fixture.env.img_r2.get = async (id) => {
            const obj = await origGet(id);
            if (!obj) return null;
            return { body: obj.body, size: fixture.objects.get(id)?.length ?? 0 };
        };
        const c = createContext('https://test/api/manage/dedup/scan?maxFileMB=1', { method: 'POST', env: { ...fixture.env, SERVER_RUNTIME: 'node' } });
        const body = await (await scan.onRequest(c)).json();
        assert.deepEqual(body.skippedOversized, ['liar.png']);
        assert.equal(body.duplicateGroups.length, 0);
        assert.equal(body.complete, false);
    });

    it('aborts stream reads past the cap even when the adapter reports no object size', async () => {
        // obj.size 缺失的适配层:靠有界读取兜底,实际消费字节数不得超过 cap 越过一个 chunk
        const chunkSize = 64 * 1024;
        const totalBytes = 24 * chunkSize; // 1.5MB,24 个 64KB chunk
        let pulled = 0;
        const payload = new TextEncoder().encode('y'.repeat(chunkSize));
        const stream = new ReadableStream({
            pull(controller) {
                if (pulled >= totalBytes) { controller.close(); return; }
                pulled += payload.length;
                controller.enqueue(payload.slice());
            },
        });
        await seedWithChunks([
            { id: 'nostreamsize.png', metadata: { FileName: 'nostreamsize.png', Channel: 'CloudflareR2', TimeStamp: 1, FileSizeBytes: 1 }, content: '' },
        ]);
        const origGet = fixture.env.img_r2.get;
        fixture.env.img_r2.get = async (id) => id === 'nostreamsize.png'
            ? { body: stream }
            : await origGet(id);
        const c = createContext('https://test/api/manage/dedup/scan?maxFileMB=1', { method: 'POST', env: { ...fixture.env, SERVER_RUNTIME: 'node' } });
        const body = await (await scan.onRequest(c)).json();
        assert.deepEqual(body.skippedOversized, ['nostreamsize.png']);
        // 有界:cap 1MiB,越过即止;吞完 1.5MB 会突破此断言
        assert.ok(pulled <= 1024 * 1024 + 2 * chunkSize, `read too much: ${pulled} bytes`);
        assert.equal(body.complete, false);
    });

    it('marks the scan timedOut when the last content read crosses the deadline', async () => {
        // 作者复现:最后一项存储读取跨过预算返回,旧实现仍报 timedOut:false + complete:true
        await seedWithChunks([
            { id: 'fast.png', metadata: { FileName: 'fast.png', Channel: 'CloudflareR2', TimeStamp: 1 }, content: 'x' },
            { id: 'slow.png', metadata: { FileName: 'slow.png', Channel: 'CloudflareR2', TimeStamp: 2 }, content: 'y' },
        ]);
        const origGet = fixture.env.img_r2.get;
        fixture.env.img_r2.get = async (id) => {
            if (id === 'slow.png') await new Promise(r => setTimeout(r, 80));
            return origGet(id);
        };
        const c = createContext('https://test/api/manage/dedup/scan?timeoutMs=20', { method: 'POST', env: { ...fixture.env, SERVER_RUNTIME: 'node' } });
        const body = await (await scan.onRequest(c)).json();
        assert.equal(body.timedOut, true);
        assert.equal(body.complete, false);
    });

    it('never reports complete when any record or content read failed', async () => {
        // complete 语义收严:recordError/readError 任一存在即非完整
        await seedWithChunks([
            { id: 'tg.png', metadata: { FileName: 'tg.png', Channel: 'TelegramNew', TimeStamp: 1 }, content: 'x' },
            { id: 'gone.png', metadata: { FileName: 'gone.png', Channel: 'TelegramNew', TimeStamp: 2 }, content: 'x' },
        ]);
        await fixture.db.delete('gone.png'); // 记录缺失 → recordError
        const body = await (await scan.onRequest(ctx())).json();
        assert.ok(body.recordErrors.length >= 1);
        assert.ok(body.readErrors.length >= 1);
        assert.equal(body.complete, false);
    });

    it('keeps the earliest valid timestamp and never treats unknown time as earliest', async () => {
        await seedWithChunks([
            { id: 'unknown.png', metadata: { FileName: 'unknown.png', Channel: 'CloudflareR2' }, content: 'same' },
            { id: 'later.png', metadata: { FileName: 'later.png', Channel: 'CloudflareR2', TimeStamp: 300 }, content: 'same' },
            { id: 'earliest.png', metadata: { FileName: 'earliest.png', Channel: 'CloudflareR2', TimeStamp: 100 }, content: 'same' },
            { id: 'negative.png', metadata: { FileName: 'negative.png', Channel: 'CloudflareR2', TimeStamp: -5 }, content: 'same' },
        ]);
        const body = await (await scan.onRequest(ctx())).json();
        assert.equal(body.duplicateGroups.length, 1);
        const group = body.duplicateGroups[0];
        assert.equal(group.count, 4);
        // 缺失/非法(负数)时间戳不参与「最早」:有效时间戳里最小的才可保留
        assert.equal(group.keep.id, 'earliest.png');
        assert.equal(group.keepTimestampUnknown, undefined);
    });

    it('flags the group when no member has a usable timestamp', async () => {
        await seedWithChunks([
            { id: 'a.png', metadata: { FileName: 'a.png', Channel: 'CloudflareR2' }, content: 'same' },
            { id: 'b.png', metadata: { FileName: 'b.png', Channel: 'CloudflareR2', TimeStamp: 0 }, content: 'same' },
        ]);
        const body = await (await scan.onRequest(ctx())).json();
        const group = body.duplicateGroups[0];
        assert.equal(group.keepTimestampUnknown, true);
        assert.ok(['a.png', 'b.png'].includes(group.keep.id));
    });

    it('declares which channels the scan can actually read', async () => {
        const body = await (await scan.onRequest(ctx())).json();
        assert.deepEqual(body.readableChannels, ['CloudflareR2']);
    });
});
