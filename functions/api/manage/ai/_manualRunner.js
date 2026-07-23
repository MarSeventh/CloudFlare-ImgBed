import { runManualAI } from '../../../ai/integration/upload.js';
import { onRequest as serveFile } from '../../../file/[[path]].js';
import { readIndex } from '../../../utils/indexManager.js';
import { fetchAIConfig } from '../../../utils/sysConfig.js';
import { createAIFactory } from '../../../ai/factory/index.js';

/**
 * Manual re-run helper shared by /api/manage/ai/{tag,description,ocr}. It walks
 * the file index in the requested directories, skips files that already have
 * the target output unless `force` is true, and invokes runManualAI for the
 * single capability requested.
 *
 * Each capability plugs in a small `spec` describing how to check its
 * readiness and its "already done" signal on file metadata:
 *
 *   {
 *     capability: 'tagging' | 'description' | 'ocr',
 *     hasResult(metadata) => boolean,   // used to skip already-processed files
 *   }
 */
export async function runManualBatch(context, body, spec) {
    const config = await fetchAIConfig(context.env);
    if (!config.enabled) {
        return json({ error: 'AI is not enabled' }, 400);
    }
    if (!isCapabilityProviderReady(config, spec.capability)) {
        return json({ error: `The ${spec.capability} provider is not configured` }, 400);
    }

    const directories = normalizeDirectories(
        body.directories ?? config.capabilities?.[spec.capability]?.effectiveTargetDirectories ?? []
    );
    const offset = Math.max(0, Math.floor(Number(body.offset) || 0));
    const limit = Math.min(5, Math.max(1, Math.floor(Number(body.limit) || 3)));
    const force = body.force === true;

    try {
        const files = await listTargetImages(context, directories);
        const batch = files.slice(offset, offset + limit);
        const settled = await Promise.all(batch.map(file =>
            runCapability(context, file, spec, force)
        ));
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
        console.error(`[AI] Manual ${spec.capability} failed`, { message: error.message });
        return json({ error: `Manual ${spec.capability} failed`, message: error.message }, 500);
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

async function runCapability(context, file, spec, force) {
    if (!force && spec.hasResult(file.metadata)) {
        return { status: 'skipped', reason: 'already_processed' };
    }
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
        return await runManualAI(
            { fileId: file.id, metadata: file.metadata || {} },
            { ...context, aiFile },
            { capability: spec.capability }
        );
    } catch (error) {
        console.error(`[AI] Failed to run ${spec.capability} on stored file`, { fileId: file.id, message: error.message });
        return { status: 'failed', reason: error.message };
    }
}

// Uses each capability's resolved provider + config to answer readiness. LLM
// providers expose isConfigured(); WD Tagger is ready with an endpoint or a
// bound Workers AI (@cf/...) model.
function isCapabilityProviderReady(config, capability) {
    const cap = config.capabilities?.[capability];
    if (!cap?.resolved) return false;
    const { providerName, providerConfig } = cap.resolved;
    try {
        const provider = createAIFactory().create(providerName, providerConfig);
        if (typeof provider.isConfigured === 'function') {
            return provider.isConfigured();
        }
    } catch {
        return false;
    }
    return Boolean(providerConfig.endpoint) ||
        (typeof providerConfig.model === 'string' && providerConfig.model.startsWith('@cf/'));
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
