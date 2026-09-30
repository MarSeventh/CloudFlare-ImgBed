export class APIError extends Error {
    constructor(code, message, status = 400, details) {
        super(message);
        this.code = code;
        this.status = status;
        this.details = details;
    }
}

export function json(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' }
    });
}

export function errorResult(error) {
    return error instanceof APIError
        ? { code: error.code, message: error.message, ...(error.details ? { details: error.details } : {}) }
        : { code: 'INTERNAL_ERROR', message: 'Operation failed. Please try again.' };
}

export function errorResponse(error) {
    const result = errorResult(error);
    return json({ error: result, message: result.message }, error instanceof APIError ? error.status : 500);
}

export async function readBoundedBody(source, limit) {
    const length = source.headers.get('Content-Length');
    if (length && Number(length) > limit) throw new APIError('INPUT_TOO_LARGE', 'Input exceeds the size limit.', 413);
    if (!source.body) return new Uint8Array();
    const reader = source.body.getReader();
    const chunks = [];
    let size = 0;
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > limit) {
                await reader.cancel();
                throw new APIError('INPUT_TOO_LARGE', 'Input exceeds the size limit.', 413);
            }
            chunks.push(value);
        }
    } finally {
        reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return bytes;
}

export async function readJSON(request, limit = 64 * 1024) {
    try {
        const body = JSON.parse(new TextDecoder().decode(await readBoundedBody(request, limit)));
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new APIError('INVALID_INPUT', 'Request must be a JSON object.');
        return body;
    } catch (error) {
        if (error instanceof APIError) throw error;
        throw new APIError('INVALID_INPUT', 'Invalid JSON request.');
    }
}
