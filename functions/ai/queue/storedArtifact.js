import { onRequest as serveFile } from '../../file/[[path]].js';
import { createArtifact } from '../artifact/index.js';

export function createStoredAIArtifact(message, metadata, context) {
    return createArtifact({
        fileId: message.fileId,
        fileName: metadata.FileName || message.fileId,
        mimeType: metadata.FileType || message.mimeType,
        size: Number(metadata.FileSizeBytes ?? message.fileSize ?? 0),
        channel: metadata.Channel || '',
        reader: ({ maxBytes } = {}) => readStoredFile(message, context, maxBytes)
    });
}

async function readStoredFile(message, context, maxBytes) {
    let response;
    try {
        response = await readThroughFileRoute(message, context);
    } catch (error) {
        if (!message.imageUrl) throw error;
        response = await fetch(message.imageUrl, { redirect: 'follow' });
    }

    if (!response.ok) {
        const error = new Error(`Unable to read queued AI image (${response.status})`);
        error.status = response.status;
        error.retryable = response.status >= 500 || response.status === 429;
        throw error;
    }

    const bytes = await response.arrayBuffer();
    if (Number.isFinite(maxBytes) && bytes.byteLength > maxBytes) {
        return bytes.slice(0, maxBytes + 1);
    }
    return bytes;
}

function readThroughFileRoute(message, context) {
    const baseUrl = message.imageUrl || 'https://internal.invalid/';
    const url = new URL(baseUrl);
    url.pathname = `/file/${encodeURIComponent(message.fileId)}`;
    url.search = '';

    return serveFile({
        request: new Request(url.toString(), { method: 'GET' }),
        env: context.env,
        params: { path: encodeURIComponent(message.fileId) },
        waitUntil: context.waitUntil || (() => {}),
        next: async () => new Response('Not Found', { status: 404 }),
        data: {},
        internalAIRequest: true
    });
}
