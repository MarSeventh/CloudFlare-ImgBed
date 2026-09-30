import { getDatabase } from '../databaseAdapter.js';
import { APIError } from '../apiResponse.js';
import { DEFAULT_TAG_PROMPT, TAG_PROMPT_ID } from './capabilities.js';

export const AI_CONFIG_KEY = 'manage@sysConfig@ai';
const encoder = new TextEncoder();
const fail = message => { throw new APIError('INVALID_CONFIG', message); };
const text = (value, max = 200) => typeof value === 'string' && value.length <= max ? value.trim() : fail('Invalid configuration text.');
const integer = (value, min, max, fallback) => {
    value = value ?? fallback;
    if (!Number.isInteger(value) || value < min || value > max) fail(`Expected a number between ${min} and ${max}.`);
    return value;
};

export function defaultAIConfig() {
    return {
        schemaVersion: 1, revision: 0, enabled: false,
        providers: [], models: [], promptOverrides: {},
        capabilities: { 'image.tags': { enabled: true, modelId: '', promptId: TAG_PROMPT_ID, language: 'zh-CN', maxTags: 6, preferredTags: [] } },
        execution: { requestDeadlineMs: 25000, providerTimeoutMs: 20000, maxBatchSize: 3, concurrency: 2 }
    };
}

export function validateProviderURL(value, env = {}) {
    let url;
    try { url = new URL(value); } catch { fail('Invalid provider Base URL.'); }
    if (url.username || url.password || url.search || url.hash) fail('Base URL cannot contain credentials, query parameters or fragments.');
    const host = url.hostname.toLowerCase();
    const local = host === 'localhost' || host.endsWith('.localhost') || !host.includes('.') ||
        host.startsWith('[') || /^(?:0\.|10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(host);
    if (env.AI_ALLOW_PRIVATE_ENDPOINTS !== 'true' && (local || url.protocol !== 'https:')) fail('Use a public HTTPS provider URL.');
    if (!['http:', 'https:'].includes(url.protocol)) fail('Unsupported provider URL protocol.');
    return url.toString().replace(/\/$/, '');
}

export function normalizeAIConfig(input, env = {}) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) fail('Invalid AI settings.');
    const config = defaultAIConfig();
    config.enabled = input.enabled === true;
    config.revision = integer(input.revision, 0, Number.MAX_SAFE_INTEGER, 0);
    if (!Array.isArray(input.providers) || input.providers.length > 8 || !Array.isArray(input.models) || input.models.length > 16) fail('Too many providers or models.');
    const ids = new Set();
    function id(value) {
        const result = text(value, 64);
        if (!/^[a-zA-Z0-9_-]+$/.test(result) || ids.has(result)) fail('Provider and model IDs must be unique.');
        ids.add(result);
        return result;
    }
    config.providers = input.providers.map(provider => {
        if (!provider || provider.protocol !== 'openai-compatible') fail('Unsupported provider protocol.');
        if (provider.credential?.source && provider.credential.source !== 'stored') fail('API Keys must be encrypted using AI_CONFIG_SECRET.');
        const credential = { source: 'stored' };
        return { id: id(provider.id), name: text(provider.name), protocol: provider.protocol,
            baseUrl: validateProviderURL(text(provider.baseUrl, 500), env), enabled: provider.enabled !== false, credential };
    });
    config.models = input.models.map(model => {
        if (!model || !config.providers.some(provider => provider.id === model.providerId)) fail('Model refers to a missing provider.');
        if (!['none', 'json'].includes(model.structuredOutput)) fail('Invalid structured output mode.');
        const modelName = text(model.model);
        if (!modelName) fail('Model name is required.');
        return { id: id(model.id), providerId: model.providerId, model: modelName, vision: model.vision === true,
            structuredOutput: model.structuredOutput, maxOutputTokens: integer(model.maxOutputTokens, 64, 2048, 256) };
    });
    const options = input.capabilities?.['image.tags'] || {};
    const modelId = text(options.modelId ?? '', 64);
    if (modelId && !config.models.some(model => model.id === modelId)) fail('Tagging refers to a missing model.');
    if (!['zh-CN', 'en'].includes(options.language ?? 'zh-CN')) fail('Unsupported tag language.');
    const preferredTags = options.preferredTags ?? [];
    if (!Array.isArray(preferredTags) || preferredTags.length > 100 || preferredTags.some(tag => typeof tag !== 'string' || Array.from(tag).length > 24)) fail('Invalid preferred tags.');
    config.capabilities['image.tags'] = { enabled: options.enabled !== false, modelId, promptId: TAG_PROMPT_ID,
        language: options.language ?? 'zh-CN', maxTags: integer(options.maxTags, 1, 10, 6), preferredTags: preferredTags.map(tag => tag.trim()).filter(Boolean) };
    const override = input.promptOverrides?.[TAG_PROMPT_ID];
    if (override) {
        const template = text(override.template, 8000);
        if (!template) fail('Prompt cannot be empty.');
        config.promptOverrides[TAG_PROMPT_ID] = { template };
    }
    const execution = input.execution ?? {};
    config.execution = {
        requestDeadlineMs: integer(execution.requestDeadlineMs, 5000, 25000, 25000),
        providerTimeoutMs: integer(execution.providerTimeoutMs, 1000, 20000, 20000),
        maxBatchSize: integer(execution.maxBatchSize, 1, 3, 3), concurrency: integer(execution.concurrency, 1, 2, 2)
    };
    if (config.enabled && options.enabled !== false) {
        const model = config.models.find(item => item.id === modelId);
        if (!model?.vision || !config.providers.find(item => item.id === model.providerId)?.enabled) fail('Choose an enabled vision model for tagging.');
    }
    return config;
}

export async function getAIConfig(env) {
    const value = await getDatabase(env).get(AI_CONFIG_KEY);
    if (!value) return defaultAIConfig();
    try { return JSON.parse(value); }
    catch { throw new APIError('INVALID_CONFIG', 'Saved AI settings are invalid.', 503); }
}

export function maskAPIKey(apiKey) {
    return apiKey.length > 6 ? `${apiKey.slice(0, 2)}******${apiKey.slice(-4)}` : '******';
}

export function publicAIConfig(config, env) {
    return { ...config,
        providers: config.providers.map(provider => {
            const { apiKey, clearApiKey, ...publicProvider } = provider;
            const configured = provider.credential.source === 'stored' && !!provider.credential.encrypted;
            const maskedKey = configured ? provider.credential.maskedKey || '******' : '';
            return { ...publicProvider, credential: { source: 'stored', configured, maskedKey } };
        }),
        defaults: { tagPrompt: DEFAULT_TAG_PROMPT }, canStoreCredentials: typeof env.AI_CONFIG_SECRET === 'string' && env.AI_CONFIG_SECRET.length >= 32
    };
}

function toBase64(bytes) { return btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join('')); }
function fromBase64(value) { return Uint8Array.from(atob(value), char => char.charCodeAt(0)); }
async function masterKey(env) {
    if (typeof env.AI_CONFIG_SECRET !== 'string' || env.AI_CONFIG_SECRET.length < 32) throw new APIError('CREDENTIAL_CONFIG', 'Set AI_CONFIG_SECRET to at least 32 characters.', 503);
    const hash = await crypto.subtle.digest('SHA-256', encoder.encode(env.AI_CONFIG_SECRET));
    return crypto.subtle.importKey('raw', hash, 'AES-GCM', false, ['encrypt', 'decrypt']);
}
export async function prepareAIConfig(input, old, env, temporary = false) {
    const config = normalizeAIConfig(input, env);
    for (const provider of config.providers) {
        const submitted = input.providers.find(item => item.id === provider.id);
        const previous = old.providers.find(item => item.id === provider.id)?.credential;
        if (submitted.clearApiKey === true) continue;
        const apiKey = submitted.apiKey === undefined ? '' : text(submitted.apiKey, 2048);
        if (apiKey) {
            const key = await masterKey(env);
            if (temporary) { provider.credential.temporaryKey = apiKey; continue; }
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const bytes = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: encoder.encode(provider.id) }, key, encoder.encode(apiKey));
            provider.credential.encrypted = { iv: toBase64(iv), value: toBase64(new Uint8Array(bytes)) };
            provider.credential.maskedKey = maskAPIKey(apiKey);
        } else if (previous?.source === 'stored' && previous.encrypted) {
            provider.credential.encrypted = previous.encrypted;
            if (previous.maskedKey) provider.credential.maskedKey = previous.maskedKey;
        }
    }
    if (config.enabled) {
        const model = config.models.find(item => item.id === config.capabilities['image.tags'].modelId);
        const provider = config.providers.find(item => item.id === model?.providerId);
        if (config.capabilities['image.tags'].enabled && !provider?.credential.encrypted && !provider?.credential.temporaryKey) fail('The tagging provider has no API Key.');
    }
    return config;
}

export async function resolveAPIKey(provider, env) {
    if (provider.credential.source !== 'stored') throw new APIError('CREDENTIAL_CONFIG', 'Enter the API Key in AI settings to encrypt it using AI_CONFIG_SECRET.', 503);
    if (provider.credential.temporaryKey) return provider.credential.temporaryKey;
    try {
        const encrypted = provider.credential.encrypted;
        const bytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(encrypted.iv), additionalData: encoder.encode(provider.id) }, await masterKey(env), fromBase64(encrypted.value));
        return new TextDecoder().decode(bytes);
    } catch { throw new APIError('CREDENTIAL_CONFIG', 'Cannot decrypt the API Key. Check AI_CONFIG_SECRET or enter the Key again.', 503); }
}
