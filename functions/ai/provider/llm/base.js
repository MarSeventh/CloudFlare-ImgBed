import { AIProvider } from '../index.js';
import { createAIResult } from '../../result/index.js';
import { AI_ERROR_CATEGORY, AI_RESULT_STATUS } from '../../types/index.js';
import { ProviderError, errorFromStatus, normalizeNumber } from '../shared/errors.js';
import { createExecutionSignal, waitForAbort } from '../shared/execution.js';
import { readArtifactBytes, bytesToBase64 } from '../shared/bytes.js';
import { resolvePrompt } from './prompts.js';

const DEFAULT_MAX_INPUT_SIZE = 5 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 60000;
const DEFAULT_MAX_TAGS = 40;
const DEFAULT_MAX_TOKENS = 1024;
const TAG_NAME_MAX_LENGTH = 128;

// Vision APIs accept a small, fixed set of image types. Returning image/* would
// let the pipeline hand svg/bmp/tiff to the vendor and fail with a 400; instead
// these concrete types make an unsupported artifact a clean pipeline skip.
const SUPPORTED_IMAGE_TYPES = Object.freeze([
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp'
]);

export class LLMProviderError extends ProviderError {
    constructor(message, options = {}) {
        super(message, { ...options, name: options.name || 'LLMProviderError' });
    }
}

/**
 * Base class for large-language-model vision providers. It owns the entire
 * analyze() flow — validation, bounded reading, base64 encoding, prompt
 * resolution, the HTTP call, status→error mapping, tolerant JSON parsing, and
 * mapping to the shared result envelope — so a concrete provider only implements
 * request building and text extraction.
 *
 * The envelope it returns is identical in shape to WD Tagger's, so tags flow
 * through the same Processor → MetadataService → sanitize → KV-limit → index
 * path with no downstream changes.
 */
export class LLMProvider extends AIProvider {
    constructor(config = {}, options = {}) {
        super();
        this.config = this.normalizeConfig(config);
        this.adapter = options.adapter || null;
        this.logger = options.logger?.error ? options.logger : console;
    }

    /** Subclasses override with their canonical registry name. */
    getName() {
        return 'llm';
    }

    /** Subclasses may override to declare more capabilities (e.g. description). */
    getCapabilities() {
        return ['tagging'];
    }

    getModelIdentity() {
        return {
            model: this.config.model,
            modelVersion: this.config.modelVersion
        };
    }

    getInputRequirements() {
        return {
            acceptedMimeTypes: [...SUPPORTED_IMAGE_TYPES],
            maxInputSizeBytes: this.config.maxInputSizeBytes
        };
    }

    getExecutionPolicy() {
        return {
            timeoutMs: this.config.timeoutMs,
            maxRetries: 0
        };
    }

    /** True when the provider has everything it needs to run. */
    isConfigured() {
        return Boolean(this.config.endpoint) && Boolean(this.config.model);
    }

    classifyError(error) {
        if (error instanceof ProviderError) {
            return { category: error.category, retryable: error.retryable };
        }
        if (error?.name === 'AbortError') {
            return { category: AI_ERROR_CATEGORY.CANCELLED, retryable: false };
        }
        if (error?.retryable === true) {
            return { category: AI_ERROR_CATEGORY.STORAGE, retryable: true };
        }
        return { category: AI_ERROR_CATEGORY.PROVIDER, retryable: false };
    }

    async analyze(artifact, capability, context = {}) {
        const identity = this.getModelIdentity();

        try {
            this.validateRequest(artifact, capability);
            const execution = createExecutionSignal(
                context.signal,
                this.config.timeoutMs,
                `${this.getName()} request timed out`
            );

            try {
                const bytes = await readArtifactBytes(
                    artifact,
                    execution.signal,
                    this.config.maxInputSizeBytes,
                    this.getName()
                );
                const base64 = bytesToBase64(bytes);
                const prompt = resolvePrompt(capability, this.config.prompts);
                const text = await this.callModel({
                    base64,
                    artifact,
                    prompt,
                    capability,
                    context,
                    signal: execution.signal
                });
                const results = this.mapText(text, capability);

                return createAIResult({
                    status: AI_RESULT_STATUS.SUCCEEDED,
                    results,
                    provider: this.getName(),
                    model: identity.model,
                    modelVersion: identity.modelVersion,
                    completedAt: new Date().toISOString(),
                    error: null
                });
            } finally {
                execution.dispose();
            }
        } catch (error) {
            const classified = context.signal?.aborted
                ? { category: AI_ERROR_CATEGORY.CANCELLED, retryable: false }
                : this.classifyError(error);
            this.logger.error(`[AI][${this.getName()}] analysis failed`, {
                fileId: artifact?.fileId || '',
                category: classified.category,
                retryable: classified.retryable,
                status: error?.status || 0
            });

            return createAIResult({
                status: AI_RESULT_STATUS.FAILED,
                results: capability === 'description' ? { caption: '' } : { tags: [] },
                provider: this.getName(),
                model: identity.model,
                modelVersion: identity.modelVersion,
                completedAt: new Date().toISOString(),
                error: {
                    category: classified.category,
                    retryable: classified.retryable,
                    message: this.safeErrorMessage(error)
                }
            });
        }
    }

    /**
     * Runs the HTTP request through the subclass transport and returns the raw
     * model text. Shared: fetcher resolution (same order as WD Tagger so tests
     * inject aiFetch), status→error mapping, JSON parsing.
     */
    async callModel({ base64, artifact, prompt, signal, context }) {
        const fetcher = context.fetch || this.adapter?.fetch || globalThis.fetch;
        if (typeof fetcher !== 'function') {
            throw new LLMProviderError('Fetch API is unavailable', {
                category: AI_ERROR_CATEGORY.PROVIDER
            });
        }

        const request = this.buildTransportRequest({
            base64,
            mimeType: artifact.mimeType || 'image/png',
            prompt,
            model: this.config.model,
            maxTokens: this.config.maxTokens,
            config: this.config
        });

        let response;
        try {
            response = await waitForAbort(
                fetcher(request.url, {
                    method: 'POST',
                    headers: request.headers,
                    body: typeof request.body === 'string'
                        ? request.body
                        : JSON.stringify(request.body),
                    signal
                }),
                signal,
                `${this.getName()} request cancelled`
            );
        } catch (error) {
            if (signal.aborted) throw signal.reason || error;
            throw new LLMProviderError(`${this.getName()} request failed`, {
                category: AI_ERROR_CATEGORY.PROVIDER,
                retryable: true,
                cause: error
            });
        }

        if (!response.ok) {
            throw errorFromStatus(response.status, {
                ErrorClass: LLMProviderError,
                label: this.getName()
            });
        }

        let json;
        try {
            json = await response.json();
        } catch (error) {
            throw new LLMProviderError(`${this.getName()} returned invalid JSON`, {
                category: AI_ERROR_CATEGORY.PROVIDER,
                cause: error
            });
        }

        return this.extractText(json);
    }

    /**
     * Subclass hook: build { url, headers, body }. body may be a plain object
     * (base serializes it) or a pre-serialized string.
     */
    buildTransportRequest() {
        throw new Error('LLMProvider.buildTransportRequest is not implemented');
    }

    /** Subclass hook: pull the assistant text out of the vendor response. */
    extractText() {
        throw new Error('LLMProvider.extractText is not implemented');
    }

    validateRequest(artifact, capability) {
        if (!this.getCapabilities().includes(capability)) {
            throw new LLMProviderError(`Unsupported capability: ${capability}`, {
                category: AI_ERROR_CATEGORY.UNSUPPORTED
            });
        }
        if (!this.config.endpoint) {
            throw new LLMProviderError(`${this.getName()} endpoint is not configured`, {
                category: AI_ERROR_CATEGORY.PROVIDER
            });
        }
        if (!this.config.model) {
            throw new LLMProviderError(`${this.getName()} model is not configured`, {
                category: AI_ERROR_CATEGORY.PROVIDER
            });
        }
        if (!artifact || typeof artifact.read !== 'function') {
            throw new LLMProviderError('Invalid AI artifact', {
                category: AI_ERROR_CATEGORY.INVALID_INPUT
            });
        }
        if (!SUPPORTED_IMAGE_TYPES.includes(artifact.mimeType)) {
            throw new LLMProviderError(`${this.getName()} does not accept ${artifact.mimeType || 'this type'}`, {
                category: AI_ERROR_CATEGORY.UNSUPPORTED
            });
        }
        if (artifact.size > this.config.maxInputSizeBytes) {
            throw new LLMProviderError('AI artifact exceeds input limit', {
                category: AI_ERROR_CATEGORY.INVALID_INPUT
            });
        }
    }

    /** Maps raw model text to a capability-specific result payload. */
    mapText(text, capability) {
        if (capability === 'description') {
            return { caption: parseCaption(text) };
        }
        return { tags: parseTags(text, this.config.maxTags) };
    }

    safeErrorMessage(error) {
        if (error instanceof ProviderError) return error.message;
        if (error?.name === 'AbortError') return `${this.getName()} request cancelled`;
        return `${this.getName()} analysis failed`;
    }

    /**
     * Shared, tolerant config normalization. MUST NOT throw on {} so the API
     * layer can construct every provider to enumerate capabilities. Subclasses
     * extend via extendConfig().
     */
    normalizeConfig(config = {}) {
        const base = {
            endpoint: String(config.endpoint || '').trim(),
            apiKey: String(config.apiKey || ''),
            model: String(config.model || '').trim(),
            modelVersion: String(config.modelVersion || '').trim(),
            maxTokens: Math.floor(normalizeNumber(config.maxTokens, DEFAULT_MAX_TOKENS, 1, 32000)),
            timeoutMs: normalizeNumber(config.timeoutMs, DEFAULT_TIMEOUT_MS, 1),
            maxInputSizeBytes: normalizeNumber(
                config.maxInputSizeBytes,
                DEFAULT_MAX_INPUT_SIZE,
                1
            ),
            maxTags: Math.floor(normalizeNumber(config.maxTags, DEFAULT_MAX_TAGS, 1)),
            prompts: config.prompts && typeof config.prompts === 'object' ? config.prompts : {},
            headers: config.headers && typeof config.headers === 'object' ? config.headers : {}
        };
        return this.extendConfig(base, config);
    }

    /** Subclass hook to add provider-specific normalized fields. */
    extendConfig(base) {
        return base;
    }
}

// --- shared parsing helpers (tolerant of markdown fences and shape variance) ---

function stripCodeFences(text) {
    const trimmed = String(text || '').trim();
    // ```json ... ``` or ``` ... ```
    const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    return fenced ? fenced[1].trim() : trimmed;
}

function tryParseJSON(text) {
    const cleaned = stripCodeFences(text);
    try {
        return JSON.parse(cleaned);
    } catch {
        // Fall back to the first {...} or [...] block the model may have wrapped
        // in prose despite instructions.
        const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
        if (!match) return null;
        try {
            return JSON.parse(match[1]);
        } catch {
            return null;
        }
    }
}

/**
 * Parses model output into a bounded, deduplicated tag list matching WD Tagger's
 * shape ([{ name, confidence }]). Confidence defaults to 1 since LLM scores are
 * unreliable. Names are trimmed and length-capped; cleaning/lowercasing is left
 * to the downstream sanitizeAITags so LLM tags share WD Tagger's exact path.
 */
export function parseTags(text, maxTags = DEFAULT_MAX_TAGS) {
    const parsed = tryParseJSON(text);
    const container = extractTagContainer(parsed, text);

    const seen = new Set();
    const tags = [];
    for (const entry of container) {
        const name = tagNameOf(entry);
        if (!name) continue;
        const key = name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        tags.push({ name, confidence: confidenceOf(entry) });
        if (tags.length >= maxTags) break;
    }
    return tags;
}

function extractTagContainer(parsed, rawText) {
    if (Array.isArray(parsed)) return parsed;
    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.tags)) return parsed.tags;
    // Last resort: a bare comma-separated string.
    if (typeof rawText === 'string' && !parsed) {
        return rawText.split(',').map(part => part.trim()).filter(Boolean);
    }
    return [];
}

function tagNameOf(entry) {
    const raw = typeof entry === 'string'
        ? entry
        : entry?.name ?? entry?.tag ?? entry?.label ?? '';
    return String(raw).trim().slice(0, TAG_NAME_MAX_LENGTH);
}

function confidenceOf(entry) {
    if (entry && typeof entry === 'object') {
        const raw = Number(entry.confidence ?? entry.score ?? entry.probability ?? 1);
        if (Number.isFinite(raw)) return Math.max(0, Math.min(1, raw));
    }
    return 1;
}

export function parseCaption(text) {
    const parsed = tryParseJSON(text);
    if (parsed && typeof parsed === 'object' && typeof parsed.caption === 'string') {
        return parsed.caption.trim();
    }
    if (typeof parsed === 'string') return parsed.trim();
    return String(text || '').trim();
}
