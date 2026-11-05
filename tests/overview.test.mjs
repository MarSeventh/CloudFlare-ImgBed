import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source = readFileSync(new URL('../frontend/src/utils/overviewHelpers.js', import.meta.url), 'utf8');
const { defaultListColumns, normalizeListColumns, loadListColumns, listColumnLayout, validOverviewFileName } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
test('column preferences handle unavailable storage, corrupt data and obsolete columns', () => {
    assert.deepEqual(loadListColumns({ getItem() { throw Error('blocked'); } }), defaultListColumns);
    for (const data of [null, '{', '{}']) assert.deepEqual(loadListColumns({ getItem: () => data }), defaultListColumns);
    assert.deepEqual(normalizeListColumns(['date', 'gone', 'tags', 'tags']), ['tags', 'date']);
    assert.deepEqual(normalizeListColumns([]), []);
});
test('layout keeps mandatory columns and allocates exactly the selected optional fields', () => {
    assert.equal(listColumnLayout([])['--list-columns'], '50px minmax(180px, 1fr) 320px');
    assert.equal(listColumnLayout([])['--list-min-width'], '590px');
    assert.equal(listColumnLayout(['date','preview'])['--list-columns'], '50px 60px minmax(180px, 1fr) 100px 320px');
    assert.equal(listColumnLayout(defaultListColumns)['--list-min-width'], '1300px');
});
test('quick rename accepts basenames and rejects paths, reserved characters and excessive byte length', () => {
    for (const value of ['照片 001.PNG', 'name.txt', '无扩展名', 'a'.repeat(180)]) assert.equal(validOverviewFileName(value), true, value);
    for (const value of ['', '.', '..', ' a.png', 'a.png ', 'a.', 'folder/a.png', 'folder\\a.png', 'a#b.png', 'a%b.png', 'a\u0000b', 'a'.repeat(181), '图'.repeat(61)]) assert.equal(validOverviewFileName(value), false, value);
});
