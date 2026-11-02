import { acquireFileLocks } from '../../../utils/replacementLock.js';
import { getDatabase } from '../../../utils/databaseAdapter.js';
import { buildFileMetadataForManagement } from '../../../utils/metadata/metadataView.js';

// Explicit authenticated initialization for legacy files; listing files stays read-only.
export async function onRequest(context) {
    if (context.request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    let path;
    try {
        path = decodeURIComponent(context.params.path).split(',').join('/');
    } catch { return new Response('Invalid path', { status: 400 }); }
    const db = getDatabase(context.env);
    let release;
    try {
        release = acquireFileLocks(context.env, [path]);
        const record = await db.ensureFileIdentity(path);
        if (!record?.metadata?.FixedId) return new Response('File not found or unsupported legacy record', { status: 404 });
        return Response.json({ fixedId: record.metadata.FixedId,
            permanentPath: `/file/${record.metadata.FixedId}`,
            metadata: await buildFileMetadataForManagement(db, context.env, record.metadata)
        }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
        return Response.json({ message: error.status ? error.message : 'Identity initialization failed' }, { status: error.status || 500 });
    } finally { release?.(); }
}
