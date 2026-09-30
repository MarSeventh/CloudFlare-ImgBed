import { applyTagItems } from "../../../utils/tagService.js";
import { APIError, json, readJSON, errorResponse } from "../../../utils/apiResponse.js";

export async function onRequestPost(context) {
    try {
        const { fileIds, tags, action = 'set', repairIndexIds = [] } = await readJSON(context.request);
        if (!Array.isArray(fileIds)) throw new APIError('INVALID_INPUT', 'fileIds must be an array.');
        const ids = new Set(fileIds);
        if (!Array.isArray(repairIndexIds) || repairIndexIds.length > fileIds.length || repairIndexIds.some(id => !ids.has(id))) throw new APIError('INVALID_INPUT', 'Invalid index repair file IDs.');
        const repairs = new Set(repairIndexIds);
        const result = await applyTagItems(context, fileIds.map(fileId => ({ fileId, tags, repairIndex: repairs.has(fileId) })), action);
        return json(result, result.success ? 200 : 207);
    } catch (error) { return errorResponse(error); }
}
