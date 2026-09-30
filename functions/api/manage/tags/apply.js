import { applyTagItems } from '../../../utils/tagService.js';
import { APIError, json, readJSON, errorResponse } from '../../../utils/apiResponse.js';

export async function onRequestPost(context) {
    try {
        const { items } = await readJSON(context.request);
        if (!Array.isArray(items) || !items.length || items.length > 50 || items.some(item => typeof item?.sourceIdentity !== 'string' || !/^[a-f0-9]{64}$/.test(item.sourceIdentity))) {
            throw new APIError('INVALID_INPUT', 'Each suggestion must include its source identity.');
        }
        const result = await applyTagItems(context, items, 'add', { maxItems: 50, maxTags: 30, maxTagLength: 24 });
        return json(result, result.success ? 200 : 207);
    } catch (error) { return errorResponse(error); }
}
