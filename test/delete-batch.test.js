import assert from 'node:assert/strict';
import { mapConcurrent, normalizeBatchFileIds } from '../functions/utils/deleteBatch.js';

describe('delete batch helpers', function () {
    it('normalizes and deduplicates file ids', function () {
        assert.deepEqual(normalizeBatchFileIds([' /a.png ', 'a.png', 'folder/b.png', ''], 500), [
            'a.png',
            'folder/b.png',
        ]);
    });

    it('rejects more than 500 file ids', function () {
        assert.throws(
            () => normalizeBatchFileIds(Array.from({ length: 501 }, (_, index) => `${index}.png`), 500),
            /500/,
        );
    });

    it('keeps result ordering while bounding concurrency', async function () {
        let active = 0;
        let maxActive = 0;
        const results = await mapConcurrent([3, 1, 2, 4], 2, async (value) => {
            active += 1;
            maxActive = Math.max(maxActive, active);
            await new Promise((resolve) => setTimeout(resolve, value));
            active -= 1;
            return value * 2;
        });
        assert.deepEqual(results, [6, 2, 4, 8]);
        assert.equal(maxActive, 2);
    });
});
