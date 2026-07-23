import { batchRemoveFilesFromIndex } from '../../../utils/indexManager.js';
import { mapConcurrent, normalizeBatchFileIds } from '../../../utils/deleteBatch.js';
import { deleteFile } from './[[path]].js';

const MAX_BATCH_SIZE = 500;
const DELETE_CONCURRENCY = 10;

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
};

export async function onRequest(context) {
    if (context.request.method !== 'POST') {
        return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
    }

    try {
        const payload = await context.request.json();
        const fileIds = normalizeBatchFileIds(payload?.fileIds, MAX_BATCH_SIZE);
        if (fileIds.length === 0) {
            return jsonResponse({ success: false, error: 'fileIds is required' }, 400);
        }
        const url = new URL(context.request.url);
        const results = await mapConcurrent(fileIds, DELETE_CONCURRENCY, async (fileId) => {
            try {
                const cdnUrl = `${url.origin}/file/${fileId.split('/').map(encodeURIComponent).join('/')}`;
                const success = await deleteFile(context.env, fileId, cdnUrl, url);
                return { fileId, success, error: success ? '' : 'Delete file failed' };
            } catch (err) {
                return { fileId, success: false, error: String(err?.message || err) };
            }
        });

        const deleted = results.filter((item) => item.success).map((item) => item.fileId);
        const failed = results.filter((item) => !item.success).map(({ fileId, error }) => ({ fileId, error }));
        if (deleted.length > 0) {
            context.waitUntil(batchRemoveFilesFromIndex(context, deleted));
        }
        return jsonResponse({ success: failed.length === 0, deleted, failed });
    } catch (error) {
        return jsonResponse({ success: false, error: error.message }, 400);
    }
}

function jsonResponse(payload, status = 200) {
    return new Response(JSON.stringify(payload), {
        status,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
}
