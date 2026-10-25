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
                const result = await deleteFile(context.env, fileId, cdnUrl, url);
                const success = !!(result && result.deleted);
                return { fileId, success, existed: !!(result && result.existed), error: success ? '' : 'Delete file failed' };
            } catch (err) {
                return { fileId, success: false, existed: false, error: String(err?.message || err) };
            }
        });

        // 兼容:deleted/failed 保持旧形态;新增 missing(幂等成功但记录本不存在)与逐项 details
        const deleted = results.filter((item) => item.success && item.existed).map((item) => item.fileId);
        const missing = results.filter((item) => item.success && !item.existed).map((item) => item.fileId);
        const failed = results.filter((item) => !item.success).map(({ fileId, error }) => ({ fileId, error }));
        const indexCleanup = results.filter((item) => item.success).map((item) => item.fileId);
        if (indexCleanup.length > 0) {
            context.waitUntil(batchRemoveFilesFromIndex(context, indexCleanup));
        }
        return jsonResponse({ success: failed.length === 0, deleted, missing, failed, details: results });
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
