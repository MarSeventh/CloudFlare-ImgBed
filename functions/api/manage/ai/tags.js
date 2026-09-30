import { createAIContext } from '../../../utils/ai/index.js';
import { getDatabase } from '../../../utils/databaseAdapter.js';
import { APIError, json, readBoundedBody, errorResult, errorResponse } from '../../../utils/apiResponse.js';
import { validateFileId, fileIdentity } from '../../../utils/tagService.js';

const MAX_IMAGE_BYTES = 256 * 1024;
const ORIGINAL_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']);
export async function onRequest(context) {
    try {
        const ai = createAIContext(context.env);
        const config = await ai.getConfig();
        const enabled = config.enabled && config.capabilities['image.tags']?.enabled;
        if (context.request.method === 'GET') return json({ enabled, maxBatchSize: config.execution.maxBatchSize, maxImageBytes: MAX_IMAGE_BYTES });
        if (context.request.method !== 'POST') return json({ error: { message: 'Use GET or POST.' } }, 405);
        if (!enabled) throw new APIError('AI_DISABLED', 'Enable AI tagging in AI settings first.', 503);
        const deadlineAt = Date.now() + config.execution.requestDeadlineMs;
        const bytes = await readBoundedBody(context.request, 3 * MAX_IMAGE_BYTES + 16 * 1024);
        let form, items;
        try {
            form = await new Response(bytes, { headers: { 'Content-Type': context.request.headers.get('Content-Type') || '' } }).formData();
            const serialized = form.get('items');
            if (typeof serialized !== 'string' || serialized.length > 8192) throw new Error();
            items = JSON.parse(serialized);
        } catch { throw new APIError('INVALID_INPUT', 'Invalid image form.'); }
        if (!Array.isArray(items) || !items.length || items.length > config.execution.maxBatchSize) throw new APIError('INVALID_INPUT', `Provide 1–${config.execution.maxBatchSize} images per request.`);
        const ids = new Set();
        for (const item of items) {
            validateFileId(item?.fileId);
            if (ids.has(item.fileId)) throw new APIError('INVALID_INPUT', 'Duplicate file IDs.');
            ids.add(item.fileId);
        }
        const results = new Array(items.length);
        let cursor = 0;
        const db = getDatabase(context.env);
        async function worker() {
            while (cursor < items.length) {
                const index = cursor++;
                const item = items[index];
                try {
                    if (deadlineAt - Date.now() < 1500) throw new APIError('TIMEOUT', 'Time budget exhausted. Retry this image.', 504);
                    const image = form.get(`image${index}`);
                    if (!image || typeof image.arrayBuffer !== 'function' || !image.size || image.size > MAX_IMAGE_BYTES || !['image/jpeg', 'image/webp', 'image/png'].includes(image.type)) throw new APIError('INVALID_IMAGE', 'Provide a JPEG, WebP or PNG preview up to 256 KB.');
                    const record = await db.getWithMetadata(item.fileId);
                    if (!record?.metadata) throw new APIError('FILE_NOT_FOUND', 'File no longer exists.', 404);
                    const type = String(record.metadata.FileType || '').toLowerCase();
                    if (!ORIGINAL_TYPES.has(type)) throw new APIError('UNSUPPORTED_INPUT', 'Only static image previews are supported.');
                    const signature = new Uint8Array(await image.slice(0, 12).arrayBuffer());
                    const matches = image.type === 'image/jpeg' ? signature[0] === 255 && signature[1] === 216 : image.type === 'image/png' ? signature[0] === 137 && signature[1] === 80 && signature[2] === 78 && signature[3] === 71 : String.fromCharCode(...signature.slice(0, 4)) === 'RIFF' && String.fromCharCode(...signature.slice(8, 12)) === 'WEBP';
                    if (!matches) throw new APIError('INVALID_IMAGE', 'Preview format does not match its content.');
                    const sourceIdentity = await fileIdentity(record.metadata);
                    const buffer = new Uint8Array(await image.arrayBuffer());
                    let binary = '';
                    for (let offset = 0; offset < buffer.length; offset += 8192) binary += String.fromCharCode(...buffer.subarray(offset, offset + 8192));
                    const result = await ai.invoke({ capability: 'image.tags', input: { image: `data:${image.type};base64,${btoa(binary)}` }, deadlineAt, signal: context.request.signal });
                    results[index] = { fileId: item.fileId, sourceIdentity, tags: result.data.tags, usage: result.usage, elapsedMs: result.elapsedMs };
                } catch (error) { results[index] = { fileId: item.fileId, error: errorResult(error) }; }
            }
        }
        await Promise.all(Array.from({ length: Math.min(items.length, config.execution.concurrency) }, worker));
        return json({ results }, results.every(item => !item.error) ? 200 : 207);
    } catch (error) { return errorResponse(error); }
}
