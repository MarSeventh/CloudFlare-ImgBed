import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { SqliteD1 } from '../../deploy/server/sqliteD1.js';

// Drive the generated Worker entry with the production loader: real routes,
// middleware, Worker cache path and SQLite-backed D1. Only the Cache API and R2
// are doubles.
const worker = (await import('../../deploy/worker/index.js')).default;

const HOUR = 60 * 60 * 1000;
const entries = new Map();
globalThis.caches = { default: {
    async match(request) { return entries.get(request.url)?.clone(); },
    async put(request, response) { entries.set(request.url, response); },
    async delete(request) { return entries.delete(request.url); },
} };

const sqlite = new SqliteD1(':memory:');
sqlite.exec(await readFile(new URL('../../database/init.sql', import.meta.url), 'utf8'));
const objects = new Map();
const env = {
    img_d1: sqlite,
    img_r2: {
        async get(id) { return objects.has(id) ? { body: new Response(objects.get(id)).body, size: 1, writeHttpMetadata() {} } : null; },
        async delete(id) { objects.delete(id); },
    },
};

async function setFile(id, metadata) {
    await sqlite.prepare('INSERT OR REPLACE INTO files (id, value, metadata) VALUES (?, ?, ?)')
        .bind(id, '', JSON.stringify({ Channel: 'CloudflareR2', FileType: 'image/png', ...metadata })).run();
    objects.set(id, 'x');
}

async function call(path, method = 'GET', headers = {}) {
    const tasks = [];
    const response = await worker.fetch(new Request(`https://img.test${path}`, { method, headers }), env, {
        waitUntil: promise => tasks.push(promise),
    });
    await Promise.all(tasks);
    return response;
}

// Permanent file: cached publicly, then given an expiry, then due
await setFile('photo.png', {});
assert.equal((await call('/file/photo.png')).headers.get('Cache-Control'), 'public, max-age=2592000');
assert.equal(entries.size, 1);

await setFile('photo.png', { ExpiresAt: Date.now() + 7 * 24 * HOUR });
const limited = await call('/file/photo.png');
assert.equal(limited.status, 200);
assert.equal(limited.headers.get('Cache-Control'), 'private, max-age=3600');
assert.equal(entries.size, 0, 'stale public entry must be dropped');
const etag = limited.headers.get('ETag');
assert.equal((await call('/file/photo.png', 'GET', { 'If-None-Match': etag })).status, 304);

await setFile('photo.png', { ExpiresAt: Date.now() - 1 });
for (const method of ['GET', 'HEAD']) {
    assert.equal((await call('/file/photo.png', method)).status, 404, method);
}

// Scheduled cleanup removes files past the grace period
await setFile('old.png', { ExpiresAt: Date.now() - HOUR });
const tasks = [];
await worker.scheduled({}, env, { waitUntil: promise => tasks.push(promise) });
await Promise.all(tasks);
assert.equal(objects.has('old.png'), false);
assert.equal(await sqlite.prepare('SELECT id FROM files WHERE id = ?').bind('old.png').first(), null);

console.log('Worker entry passed: cache check, ETag revalidation and scheduled cleanup');
