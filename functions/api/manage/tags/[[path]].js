import { getDatabase } from "../../../utils/databaseAdapter.js";
import { applyTagItems, validateFileId } from "../../../utils/tagService.js";
import { APIError, json, readJSON, errorResponse } from "../../../utils/apiResponse.js";

export async function onRequest(context) {
    try {
        const fileId = decodeURIComponent((context.params.path || []).join('/'));
        validateFileId(fileId);
        if (context.request.method === 'GET') {
            const record = await getDatabase(context.env).getWithMetadata(fileId);
            if (!record?.metadata) return json({ error: 'File not found' }, 404);
            return json({ success: true, fileId, tags: record.metadata.Tags || [] });
        }
        if (context.request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
        const body = await readJSON(context.request);
        const result = await applyTagItems(context, [{ fileId, tags: body.tags, repairIndex: body.repairIndex }], body.action ?? 'set');
        const item = result.results[0];
        if (!item.saved) return errorResponse(new APIError(item.error.code, item.error.message, item.error.code === 'FILE_NOT_FOUND' ? 404 : 400));
        return json({ success: result.success, fileId, tags: item.tags, action: body.action ?? 'set', indexPending: item.indexPending });
    } catch (error) { return errorResponse(error); }
}
