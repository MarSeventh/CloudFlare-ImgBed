import assert from 'node:assert/strict';
import { loadFunction, memoryDatabase } from './loadFunction.js';
import * as metadataSecurity from '../../functions/utils/metadata/metadataSecurity.js';

// Keep the route, metadata cleaning and index operations real. Only storage,
// configuration access and cache invalidation are replaced at the boundary.
export async function managementFixture() {
    const db = memoryDatabase();
    const objects = new Map();
    const purges = [];
    const database = { getDatabase: () => db, checkDatabaseConfig: () => ({ usingD1: false }) };
    const index = await loadFunction('functions/utils/indexManager.js', database);
    const tools = await loadFunction('functions/upload/uploadTools.js', database);
    const view = await loadFunction('functions/utils/metadata/metadataView.js', {
        ...metadataSecurity,
        loadChannelConfig: async () => ({}),
        findConfiguredChannel: () => null,
    });
    const mocks = {
        ...database, ...index, ...tools, ...metadataSecurity, ...view,
        purgeCFCache: async (env, url) => { purges.push(['file', url]); },
        purgeRandomFileListCache: async (...args) => { purges.push(['random', ...args]); },
        purgePublicFileListCache: async (...args) => { purges.push(['public', ...args]); },
    };
    const env = { img_r2: {
        async get(id) { return objects.has(id) ? { body: new Response(objects.get(id)).body } : null; },
        async put(id, body) { objects.set(id, await new Response(body).text()); },
        async delete(id) { objects.delete(id); },
    } };

    async function seed(files) {
        for (const file of files) {
            await db.put(file.id, file.value ?? 'record-value', { metadata: file.metadata });
            if (file.metadata.Channel === 'CloudflareR2') objects.set(file.id, 'file-content');
        }
        await db.put('manage@index@meta', JSON.stringify({ chunkCount: 1, totalCount: files.length }));
        await db.put('manage@index_0', JSON.stringify(files.map(({ id, metadata }) => ({ id, metadata }))));
    }

    async function readFiles(context) {
        await Promise.all(context.backgroundTasks);
        const result = await index.readIndex(context, { count: -1, includeSubdirFiles: true });
        assert.equal(result.success, true, result.error);
        return result;
    }

    return { db, env, objects, purges, mocks, seed, readFiles };
}
