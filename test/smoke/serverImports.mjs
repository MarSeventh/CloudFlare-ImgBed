import assert from 'node:assert/strict';

// Use the production server loader, without source rewriting or test mocks.
// This catches extensionless imports and runtime dependencies missed by unit tests.
const routes = [
    ['../../functions/upload/index.js', 'onRequest'],
    ['../../functions/upload/chunkUpload.js', 'handleChunkUpload'],
    ['../../functions/upload/chunkMerge.js', 'handleChunkMerge'],
    ['../../functions/upload/huggingface/getUploadUrl.js', 'onRequestPost'],
    ['../../functions/upload/huggingface/commitUpload.js', 'onRequestPost'],
    ['../../functions/file/[[path]].js', 'onRequest'],
    ['../../functions/dav/[[path]].js', 'onRequest'],
    ['../../functions/api/manage/ai/tags.js', 'onRequest'],
    ['../../functions/api/manage/list.js', 'onRequest'],
    ['../../functions/api/manage/delete/[[path]].js', 'onRequest'],
    ['../../functions/api/manage/delete/batch.js', 'onRequest'],
    ['../../functions/api/manage/metadata/[[path]].js', 'onRequest'],
    ['../../functions/api/manage/rename/[[path]].js', 'onRequest'],
    ['../../functions/api/manage/move/[[path]].js', 'onRequest'],
];

for (const [path, handler] of routes) {
    const module = await import(new URL(path, import.meta.url));
    assert.equal(typeof module[handler], 'function', `${path} must export ${handler}`);
}

const middleware = await import('../../functions/api/manage/_middleware.js');
assert.ok(Array.isArray(middleware.onRequest));
assert.ok(middleware.onRequest.length > 0);
assert.ok(middleware.onRequest.every(handler => typeof handler === 'function'));
console.log(`Server imports passed: ${routes.length} routes and management middleware`);
