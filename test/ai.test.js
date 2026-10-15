import assert from 'node:assert/strict';
import { File } from 'node:buffer';
import { loadFunction, memoryDatabase } from './helpers/loadFunction.js';
import * as responses from '../functions/utils/apiResponse.js';
import { createContext } from './helpers/context.js';
import { png } from './helpers/files.js';

describe('AI tagging', () => {
    let db, mocks;

    beforeEach(() => {
        db = memoryDatabase();
        mocks = { ...responses, getDatabase: () => db };
    });

    function context(url, body) { return createContext(url, { method: 'POST', body }); }

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

});
