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
        const tagging = input?.capabilities?.tagging || {};
        const queue = input?.queue || {};
        const provider = normalizeProviderName(tagging.provider, current);

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
                    provider,
                    targetDirectories: normalizeDirectories(tagging.targetDirectories)
                }
            },
            providers: buildProvidersConfig(input?.providers, current)
        };

        await getDatabase(env).put('manage@sysConfig@ai', JSON.stringify(settings));
        return json(maskSecrets(await fetchAIConfig(env)));
    } catch (error) {
        return json({ error: 'Invalid AI settings', message: error.message }, 400);
    }
}

// Each entry validates and persists one provider's config. Adding a provider is
// a matter of registering it here plus in the AI factory.
const PROVIDER_VALIDATORS = {
    wd_tagger: validateWdTagger,
    openai: validateOpenAI,
    anthropic: validateAnthropic
};

function buildProvidersConfig(input, current) {
    const providers = {};
    for (const [name, validate] of Object.entries(PROVIDER_VALIDATORS)) {
        providers[name] = validate(input?.[name] || {}, current.providers[name] || {});
    }
    return providers;
}

function normalizeProviderName(provider, current) {
    const name = String(provider || '').trim();
    if (PROVIDER_VALIDATORS[name]) return name;
    return current.capabilities?.tagging?.provider || 'wd_tagger';
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

function validateOpenAI(openai, currentConfig) {
    const apiKey = resolveSecret(openai.apiKey, currentConfig.apiKey);
    return {
        endpoint: requireHttpsWhenKeyed(String(openai.endpoint || '').trim(), apiKey),
        apiKey,
        model: String(openai.model || 'gpt-4o-mini').trim(),
        modelVersion: String(openai.modelVersion || '').trim(),
        maxTokens: Math.floor(numberInRange(openai.maxTokens, currentConfig.maxTokens ?? 1024, 1, 32000)),
        temperature: numberInRange(openai.temperature, currentConfig.temperature ?? 0, 0, 2),
        tokenField: openai.tokenField === 'max_completion_tokens' ? 'max_completion_tokens' : 'max_tokens',
        jsonMode: booleanValue(openai.jsonMode, currentConfig.jsonMode ?? false),
        timeoutMs: numberInRange(openai.timeoutMs, currentConfig.timeoutMs ?? 60000, 1000, 120000),
        maxInputSizeBytes: numberInRange(openai.maxInputSizeBytes, currentConfig.maxInputSizeBytes ?? 5 * 1024 * 1024, 1, 100 * 1024 * 1024),
        maxTags: Math.floor(numberInRange(openai.maxTags, currentConfig.maxTags ?? 40, 1, 1000)),
        prompts: sanitizePrompts(openai.prompts),
        headers: sanitizeHeaders(openai.headers)
    };
}

function validateAnthropic(anthropic, currentConfig) {
    const apiKey = resolveSecret(anthropic.apiKey, currentConfig.apiKey);
    return {
        endpoint: requireHttpsWhenKeyed(String(anthropic.endpoint || '').trim(), apiKey),
        apiKey,
        model: String(anthropic.model || 'claude-haiku-4-5').trim(),
        modelVersion: String(anthropic.modelVersion || '').trim(),
        anthropicVersion: String(anthropic.anthropicVersion || '2023-06-01').trim(),
        maxTokens: Math.floor(numberInRange(anthropic.maxTokens, currentConfig.maxTokens ?? 1024, 1, 32000)),
        timeoutMs: numberInRange(anthropic.timeoutMs, currentConfig.timeoutMs ?? 60000, 1000, 120000),
        maxInputSizeBytes: numberInRange(anthropic.maxInputSizeBytes, currentConfig.maxInputSizeBytes ?? 5 * 1024 * 1024, 1, 100 * 1024 * 1024),
        maxTags: Math.floor(numberInRange(anthropic.maxTags, currentConfig.maxTags ?? 40, 1, 1000)),
        prompts: sanitizePrompts(anthropic.prompts),
        headers: sanitizeHeaders(anthropic.headers)
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

// Never return stored API keys to the client; replace non-empty keys with a
// sentinel so the frontend can show "configured" without leaking the value.
function maskSecrets(config) {
    if (!config?.providers) return config;
    for (const provider of Object.values(config.providers)) {
        if (provider && typeof provider === 'object' && 'apiKey' in provider) {
            provider.apiKey = provider.apiKey ? API_KEY_MASK : '';
        }
    }
    return config;
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
