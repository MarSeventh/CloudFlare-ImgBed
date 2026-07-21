import { getDatabase } from '../../../utils/databaseAdapter.js';
import { fetchAIConfig } from '../../../utils/sysConfig.js';

export async function onRequest(context) {
    const { request, env } = context;

    if (request.method === 'GET') {
        return json(await fetchAIConfig(env));
    }

    if (request.method !== 'POST') {
        return json({ error: 'Method not allowed' }, 405);
    }

    try {
        const input = await request.json();
        const current = await fetchAIConfig(env);
        const tagging = input?.capabilities?.tagging || {};
        const wdTagger = input?.providers?.wdTagger || {};
        const queue = input?.queue || {};
        const settings = {
            enabled: input?.enabled ?? true,
            timeoutMs: numberInRange(input?.timeoutMs, current.timeoutMs, 1000, 120000),
            parallel: Math.floor(numberInRange(input?.parallel, current.parallel, 1, 10)),
            queue: {
                enabled: booleanValue(queue.enabled, current.queue.enabled),
                fallbackToDirect: booleanValue(
                    queue.fallbackToDirect,
                    current.queue.fallbackToDirect
                ),
                maxRetries: Math.floor(numberInRange(
                    queue.maxRetries,
                    current.queue.maxRetries,
                    0,
                    10
                )),
                retryDelaysSeconds: normalizeRetryDelays(
                    queue.retryDelaysSeconds,
                    current.queue.retryDelaysSeconds
                ),
                staleAfterSeconds: Math.floor(numberInRange(
                    queue.staleAfterSeconds,
                    current.queue.staleAfterSeconds,
                    0,
                    604800
                ))
            },
            capabilities: {
                tagging: {
                    enabled: tagging.enabled === true,
                    provider: 'wd_tagger',
                    targetDirectories: normalizeDirectories(tagging.targetDirectories)
                }
            },
            providers: {
                wdTagger: {
                    endpoint: String(wdTagger.endpoint || '').trim(),
                    apiKey: String(wdTagger.apiKey || ''),
                    model: String(wdTagger.model || 'SmilingWolf/wd-swinv2-tagger-v3').trim(),
                    modelVersion: String(wdTagger.modelVersion || '').trim(),
                    timeoutMs: numberInRange(wdTagger.timeoutMs, current.providers.wdTagger.timeoutMs, 1000, 120000),
                    maxInputSizeBytes: numberInRange(wdTagger.maxInputSizeBytes, current.providers.wdTagger.maxInputSizeBytes, 1, 100 * 1024 * 1024),
                    threshold: numberInRange(wdTagger.threshold, 0.35, 0, 1),
                    characterThreshold: numberInRange(wdTagger.characterThreshold, 0.85, 0, 1),
                    maxTags: Math.floor(numberInRange(wdTagger.maxTags, current.providers.wdTagger.maxTags, 1, 1000)),
                    requestFormat: wdTagger.requestFormat === 'raw' ? 'raw' : 'multipart',
                    fileField: String(wdTagger.fileField || 'image').trim() || 'image',
                    headers: wdTagger.headers && typeof wdTagger.headers === 'object' ? wdTagger.headers : {}
                }
            }
        };

        await getDatabase(env).put('manage@sysConfig@ai', JSON.stringify(settings));
        return json(await fetchAIConfig(env));
    } catch (error) {
        return json({ error: 'Invalid AI settings', message: error.message }, 400);
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

function numberInRange(value, fallback, min, max) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
}

function booleanValue(value, fallback) {
    return typeof value === 'boolean' ? value : fallback;
}

function normalizeRetryDelays(value, fallback) {
    if (!Array.isArray(value)) return fallback;
    const normalized = value
        .map(item => Math.floor(Number(item)))
        .filter(item => Number.isFinite(item) && item >= 0 && item <= 43200)
        .slice(0, 10);
    return normalized.length ? normalized : fallback;
}

function json(body, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });
}
