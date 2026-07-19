import { runManualAI } from '../../../ai/integration/upload.js';
import { onRequest as serveFile } from '../../../file/[[path]].js';
import { readIndex } from '../../../utils/indexManager.js';
import { fetchAIConfig } from '../../../utils/sysConfig.js';

export async function onRequestPost(context) {
    let body;
    try {
        body = await context.request.json();
    } catch {
        body = {};
    }

    const config = await fetchAIConfig(context.env);
    if (!config.enabled || !config.providers.wdTagger.endpoint) {
        return json({ error: 'WD Tagger is not configured' }, 400);
    }

    const directories = normalizeDirectories(
        body.directories ?? config.capabilities.tagging.targetDirectories
    );
    const offset = Math.max(0, Math.floor(Number(body.offset) || 0));
    const limit = Math.min(5, Math.max(1, Math.floor(Number(body.limit) || 3)));

    try {
        const files = await listTargetImages(context, directories);
        const batch = files.slice(offset, offset + limit);
        const settled = await Promise.all(batch.map(file => tagStoredFile(context, file)));
        const summary = settled.reduce((result, item) => {
            result.processed++;
            if (item.status === 'succeeded') result.succeeded++;
            else if (item.status === 'failed') result.failed++;
            else result.skipped++;
            return result;
        }, { processed: 0, succeeded: 0, failed: 0, skipped: 0 });
        const nextOffset = offset + batch.length;

        return json({
            ...summary,
            total: files.length,
            nextOffset: nextOffset < files.length ? nextOffset : null
        });
    } catch (error) {
        console.error('[AI] Manual tagging failed', { message: error.message });
        return json({ error: 'Manual tagging failed', message: error.message }, 500);
    }
}

async function listTargetImages(context, directories) {
    const selected = directories.length ? directories : [''];
    const files = new Map();

    for (const directory of selected) {
        const result = await readIndex(context, {
            directory,
            count: -1,
            fileType: ['image'],
            includeSubdirFiles: true
        });
        for (const file of result.files || []) files.set(file.id, file);
    }

    return [...files.values()].sort((left, right) => left.id.localeCompare(right.id));
}

async function tagStoredFile(context, file) {
    try {
        const url = new URL(context.request.url);
        url.pathname = `/file/${encodeURIComponent(file.id)}`;
        url.search = '?from=admin';
        const request = new Request(url.toString(), {
            method: 'GET',
            headers: context.request.headers
        });
        const response = await serveFile({
            ...context,
            request,
            params: { path: encodeURIComponent(file.id) }
        });
        if (!response.ok) throw new Error(`Unable to read image (${response.status})`);

        const aiFile = new Blob([await response.arrayBuffer()], {
            type: file.metadata?.FileType || response.headers.get('content-type') || 'application/octet-stream'
        });
        return await runManualAI({ fileId: file.id, metadata: file.metadata || {} }, {
            ...context,
            aiFile
        });
    } catch (error) {
        console.error('[AI] Failed to tag stored file', { fileId: file.id, message: error.message });
        return { status: 'failed', reason: error.message };
    }
}

function normalizeDirectories(value) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.map(directory => String(directory || '')
        .trim()
        .replace(/\\/g, '/')
        .replace(/^\/+|\/+$/g, ''))
        .filter(Boolean))];
}

function json(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });
}
