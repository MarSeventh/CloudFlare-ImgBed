import { getDatabase } from '../../../utils/databaseAdapter.js';
import { fetchAIConfig } from '../../../utils/sysConfig.js';

const API_KEY_MASK = '__stored__';

export async function onRequest(context) {
    const { request, env } = context;

    if (request.method === 'GET') {
        return json(maskSecrets(await fetchAIConfig(env)));
    }

    if (request.method !== 'POST') {
        return json({ error: 'Method not allowed' }, 405);
    }

    try {
        const input = await request.json();
        const current = await fetchAIConfig(env);
        const queue = input?.queue || {};

        const unifiedLLM = validateLLM(input?.unifiedLLM || {}, current.unifiedLLM || {});
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
            unifiedLLM,
            capabilities: {
                tagging: validateCapability(
                    'tagging',
                    input?.capabilities?.tagging || {},
                    current.capabilities?.tagging || {}
                ),
                description: validateCapability(
                    'description',
                    input?.capabilities?.description || {},
                    current.capabilities?.description || {}
                ),
                ocr: validateCapability(
                    'ocr',
                    input?.capabilities?.ocr || {},
                    current.capabilities?.ocr || {}
                )
            }
        };

        await getDatabase(env).put('manage@sysConfig@ai', JSON.stringify(settings));
        return json(maskSecrets(await fetchAIConfig(env)));
    } catch (error) {
        return json({ error: 'Invalid AI settings', message: error.message }, 400);
    }
}

// tagging supports both engines; description/ocr today only run through LLM but
// the structure is kept identical so future engines can be added the same way
// tagging did with WD Tagger.
function validateCapability(capName, capInput, currentCap) {
    const engine = capName === 'tagging'
        ? (capInput.engine === 'llm' ? 'llm' : 'wd_tagger')
        : 'llm';
    return {
        enabled: capInput.enabled === true,
        engine,
        wdTagger: validateWdTagger(capInput.wdTagger || {}, currentCap.wdTagger || {}),
        llmSource: capInput.llmSource === 'custom' ? 'custom' : 'unified',
        customLLM: validateLLM(capInput.customLLM || {}, currentCap.customLLM || {}),
        targetDirectories: normalizeDirectories(capInput.targetDirectories)
    };
}

function validateWdTagger(wdTagger, currentConfig) {
    return {
        endpoint: String(wdTagger.endpoint || '').trim(),
        apiKey: resolveSecret(wdTagger.apiKey, currentConfig.apiKey),
        model: String(wdTagger.model || 'SmilingWolf/wd-swinv2-tagger-v3').trim(),
        modelVersion: String(wdTagger.modelVersion || '').trim(),
        timeoutMs: numberInRange(wdTagger.timeoutMs, currentConfig.timeoutMs ?? 30000, 1000, 120000),
        maxInputSizeBytes: numberInRange(wdTagger.maxInputSizeBytes, currentConfig.maxInputSizeBytes ?? 10 * 1024 * 1024, 1, 100 * 1024 * 1024),
        threshold: numberInRange(wdTagger.threshold, 0.35, 0, 1),
        characterThreshold: numberInRange(wdTagger.characterThreshold, 0.85, 0, 1),
        maxTags: Math.floor(numberInRange(wdTagger.maxTags, currentConfig.maxTags ?? 100, 1, 1000)),
        requestFormat: wdTagger.requestFormat === 'raw' ? 'raw' : 'multipart',
        fileField: String(wdTagger.fileField || 'image').trim() || 'image',
        headers: sanitizeHeaders(wdTagger.headers)
    };
}

// Shared LLM validator used for both the top-level unifiedLLM block and each
// capability's independent `customLLM`. Field set matches the runtime shape
// produced by resolveLLMConfig() in utils/sysConfig.js.
function validateLLM(llm, currentConfig) {
    const apiKey = resolveSecret(llm.apiKey, currentConfig.apiKey);
    return {
        endpoint: requireHttpsWhenKeyed(String(llm.endpoint || '').trim(), apiKey),
        apiKey,
        model: String(llm.model || 'gpt-4o-mini').trim(),
        modelVersion: String(llm.modelVersion || '').trim(),
        engine: llm.engine === 'anthropic' ? 'anthropic' : 'openai',
        batchMode: llm.batchMode === 'unified' ? 'unified' : 'separate',
        anthropicVersion: String(llm.anthropicVersion || '2023-06-01').trim(),
        tokenField: llm.tokenField === 'max_completion_tokens' ? 'max_completion_tokens' : 'max_tokens',
        jsonMode: booleanValue(llm.jsonMode, currentConfig.jsonMode ?? false),
        temperature: numberInRange(llm.temperature, currentConfig.temperature ?? 0, 0, 2),
        maxTokens: Math.floor(numberInRange(llm.maxTokens, currentConfig.maxTokens ?? 2048, 1, 32000)),
        timeoutMs: numberInRange(llm.timeoutMs, currentConfig.timeoutMs ?? 60000, 1000, 120000),
        maxInputSizeBytes: numberInRange(llm.maxInputSizeBytes, currentConfig.maxInputSizeBytes ?? 5 * 1024 * 1024, 1, 100 * 1024 * 1024),
        maxTags: Math.floor(numberInRange(llm.maxTags, currentConfig.maxTags ?? 40, 1, 1000)),
        prompts: sanitizePrompts(llm.prompts),
        headers: sanitizeHeaders(llm.headers),
        targetDirectories: normalizeDirectories(llm.targetDirectories)
    };
}

// Preserve the stored key when the client sends nothing or the GET mask value.
function resolveSecret(incoming, stored) {
    if (incoming === undefined || incoming === null || incoming === '' || incoming === API_KEY_MASK) {
        return stored || '';
    }
    return String(incoming);
}

// When an API key is set, refuse a cleartext endpoint so the key and image are
// not sent over http. An empty endpoint is allowed (provider is simply not ready).
function requireHttpsWhenKeyed(endpoint, apiKey) {
    if (endpoint && apiKey && !/^https:\/\//i.test(endpoint)) {
        throw new Error('endpoint must use https when an API key is set');
    }
    return endpoint;
}

// Recursively replaces every apiKey field in the returned config with a mask,
// so the frontend can show "configured" without leaking the value.
function maskSecrets(config) {
    if (!config || typeof config !== 'object') return config;
    walkAndMask(config);
    return config;
}

function walkAndMask(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) {
        for (const item of node) walkAndMask(item);
        return;
    }
    if ('apiKey' in node && typeof node.apiKey === 'string') {
        node.apiKey = node.apiKey ? API_KEY_MASK : '';
    }
    for (const value of Object.values(node)) {
        if (value && typeof value === 'object') walkAndMask(value);
    }
}

function sanitizePrompts(prompts) {
    if (!prompts || typeof prompts !== 'object') return {};
    const clean = {};
    for (const [key, value] of Object.entries(prompts)) {
        if (typeof value === 'string' && value.trim()) clean[key] = value.trim();
    }
    return clean;
}

function sanitizeHeaders(headers) {
    return headers && typeof headers === 'object' && !Array.isArray(headers) ? headers : {};
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
