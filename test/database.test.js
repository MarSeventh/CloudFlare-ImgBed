import assert from 'node:assert/strict';
import { sqliteDatabase } from './helpers/database.js';

describe('D1 database adapter', () => {
    it('pages through settings with a cursor instead of stopping at the limit', async () => {
        const { db } = await sqliteDatabase();
        // Session keys sort before sysConfig keys, so a single capped page would miss them.
        for (let i = 0; i < 5; i++) {
            await db.put(`manage@session@${i}`, '{}');
        }
        await db.put('manage@sysConfig@upload', '{"ok":true}');

        const names = [];
        let cursor = null;
        let pages = 0;
        do {
            const result = await db.list({ prefix: 'manage@', limit: 2, cursor });
            names.push(...result.keys.map(key => key.name));
            assert.equal(result.list_complete, !result.cursor);
            cursor = result.cursor;
            pages++;
        } while (cursor);

        assert.equal(pages, 3);
        assert.deepEqual(names.slice(-1), ['manage@sysConfig@upload']);
        assert.equal(new Set(names).size, 6);
    });

    it('keeps a single page complete when the settings fit within the limit', async () => {
        const { db } = await sqliteDatabase();
        await db.put('manage@sysConfig@upload', '{}');
        const result = await db.list({ prefix: 'manage@', limit: 1000 });
        assert.deepEqual(result.keys.map(key => key.name), ['manage@sysConfig@upload']);
        assert.equal(result.cursor, null);
        assert.equal(result.list_complete, true);
    });
});
