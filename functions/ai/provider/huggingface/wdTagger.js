import { AIProvider } from '../index.js';
import { createAIResult } from '../../result/index.js';
import {
    AI_ERROR_CATEGORY,
    AI_RESULT_STATUS
} from '../../types/index.js';
import { ProviderError, errorFromStatus as sharedErrorFromStatus, normalizeNumber } from '../shared/errors.js';
import { createExecutionSignal, waitForAbort } from '../shared/execution.js';
import { readArtifactBytes } from '../shared/bytes.js';
import {
    requestGradioSpace,
    resolveHuggingFaceSpace
} from './gradioSpace.js';

const PROVIDER_NAME = 'wd_tagger';
const DEFAULT_MAX_INPUT_SIZE = 10 * 1024 * 1024;

/**
 * WD Tagger is a tagging Provider. It produces raw tags for the Tag Processor
 * and never writes metadata or the database itself.
 *
 * Following the environment-adapter architecture, the Provider receives the
 * AI adapter and routes inference by runtime:
 *
 *   - cf / cf-worker with a bound Workers AI model → env.AI.run(...)
 *   - every other runtime, or a configured HTTP / Hugging Face Space endpoint
 *     → the remote transport (raw / multipart HTTP, or a Gradio Space)
 *
 * The adapter is optional; without it the Provider degrades to the remote
 * transport so existing deployments keep working.
 */
export class WDTaggerProvider extends AIProvider {
    constructor(config = {}, options = {}) {
        super();
        this.config = normalizeConfig(config);
        this.adapter = options.adapter || null;
        this.logger = options.logger?.error ? options.logger : console;
    }

    getName() {
        return PROVIDER_NAME;
    }

    /** Ready with an HTTP endpoint or a bound Workers AI (@cf/...) model id. */
    isConfigured() {
        return Boolean(this.config.endpoint) || isWorkersAIModel(this.config.model);
    }

    getModelIdentity() {
        return {
            model: this.config.model,
            modelVersion: this.config.modelVersion
        };
    }

    getCapabilities() {
        return ['tagging'];
    }

    getInputRequirements() {
        return {
            acceptedMimeTypes: ['image/*'],
            maxInputSizeBytes: this.config.maxInputSizeBytes
        };
    }

    getExecutionPolicy() {
        return {
            timeoutMs: this.config.timeoutMs,
            maxRetries: 0
        };
    }

    classifyError(error) {
        if (error instanceof ProviderError) {
            return {
                category: error.category,
                retryable: error.retryable
            };
        }

        if (error?.name === 'AbortError') {
            return {
                category: AI_ERROR_CATEGORY.CANCELLED,
                retryable: false
            };
        }

        if (error?.retryable === true) {
            return {
                category: AI_ERROR_CATEGORY.STORAGE,
                retryable: true
            };
        }

        return {
            category: AI_ERROR_CATEGORY.PROVIDER,
            retryable: false
        };
    }

    async analyze(artifact, capability, context = {}) {
        const identity = this.getModelIdentity();

        try {
            validateRequest(artifact, capability, this.config);
            const execution = createExecutionSignal(
                context.signal,
                this.config.timeoutMs,
                'WD Tagger request timed out'
            );

            try {
                const bytes = await readArtifactBytes(
                    artifact,
                    execution.signal,
                    this.config.maxInputSizeBytes,
                    'WD Tagger'
                );
                const response = await this.infer(bytes, artifact, context, execution.signal);
                const tags = normalizeTags(
                    response,
                    this.config.threshold,
                    this.config.characterThreshold,
                    this.config.maxTags
                );

                return createAIResult({
                    status: AI_RESULT_STATUS.SUCCEEDED,
                    results: { tags },
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
            this.logger.error('[AI][WDTagger] analysis failed', {
                fileId: artifact?.fileId || '',
                category: classified.category,
                retryable: classified.retryable,
                status: error?.status || 0
            });

            return createAIResult({
                status: AI_RESULT_STATUS.FAILED,
                results: { tags: [] },
                provider: this.getName(),
                model: identity.model,
                modelVersion: identity.modelVersion,
                completedAt: new Date().toISOString(),
                error: {
                    category: classified.category,
                    retryable: classified.retryable,
                    message: safeErrorMessage(error)
                }
            });
        }
    }

    /**
     * Route inference to the environment-native backend when one is available,
     * otherwise fall back to the remote transport. WD Tagger has no first-party
     * Workers AI model, so the native path is only taken when the operator has
     * configured a `@cf/...` model id against a bound `env.AI` binding.
     */
    async infer(bytes, artifact, context, signal) {
        const binding = this.adapter?.env?.AI;
        if (isWorkersAIModel(this.config.model) && binding && typeof binding.run === 'function') {
            return this.inferOnWorkersAI(binding, bytes, signal);
        }
        return this.requestRemote(bytes, artifact, context, signal);
    }

    async inferOnWorkersAI(binding, bytes, signal) {
        try {
            const output = await waitForAbort(
                binding.run(this.config.model, { image: [...bytes] }),
                signal
            );
            return output;
        } catch (error) {
            if (signal.aborted) throw signal.reason || error;
            throw new WDTaggerProviderError('Workers AI inference failed', {
                category: AI_ERROR_CATEGORY.PROVIDER,
                retryable: true,
                cause: error
            });
        }
    }

    async requestRemote(bytes, artifact, context, signal) {
        const fetcher = context.fetch || this.adapter?.fetch || globalThis.fetch;
        if (typeof fetcher !== 'function') {
            throw new WDTaggerProviderError('Fetch API is unavailable', {
                category: AI_ERROR_CATEGORY.PROVIDER
            });
        }

        const headers = new Headers(this.config.headers);
        headers.set('accept', 'application/json');
        if (this.config.apiKey && !headers.has('authorization')) {
            headers.set('authorization', `Bearer ${this.config.apiKey}`);
        }

        const space = resolveHuggingFaceSpace(this.config.endpoint);
        if (space) {
            try {
                return await requestGradioSpace({
                    space,
                    bytes,
                    artifact,
                    config: this.config,
                    fetcher,
                    headers,
                    signal
                });
            } catch (error) {
                if (signal.aborted) throw signal.reason || error;
                throw new WDTaggerProviderError(error.message || 'WD Tagger Space request failed', {
                    category: AI_ERROR_CATEGORY.PROVIDER,
                    retryable: error.status === 429 || error.status >= 500,
                    status: error.status || 0,
                    cause: error
                });
            }
        }

        let body;
        if (this.config.requestFormat === 'multipart') {
            body = new FormData();
            body.set(
                this.config.fileField,
                new Blob([bytes], { type: artifact.mimeType || 'application/octet-stream' }),
                artifact.fileName || 'image'
            );
            body.set('model', this.config.model);
            body.set('threshold', String(this.config.threshold));
            body.set('general_threshold', String(this.config.threshold));
            body.set('character_threshold', String(this.config.characterThreshold));
        } else {
            headers.set('content-type', artifact.mimeType || 'application/octet-stream');
            body = bytes;
        }

        let response;
        try {
            response = await waitForAbort(
                fetcher(this.config.endpoint, {
                    method: 'POST',
                    headers,
                    body,
                    signal
                }),
                signal
            );
        } catch (error) {
            if (signal.aborted) throw signal.reason || error;
            throw new WDTaggerProviderError('WD Tagger request failed', {
                category: AI_ERROR_CATEGORY.PROVIDER,
                retryable: true,
                cause: error
            });
        }

        if (!response.ok) {
            throw sharedErrorFromStatus(response.status, {
                ErrorClass: WDTaggerProviderError,
                label: 'WD Tagger'
            });
        }

        try {
            return await response.json();
        } catch (error) {
            throw new WDTaggerProviderError('WD Tagger returned invalid JSON', {
                category: AI_ERROR_CATEGORY.PROVIDER,
                cause: error
            });
        }
    }
}

export class WDTaggerProviderError extends ProviderError {
    constructor(message, options = {}) {
        super(message, { ...options, name: 'WDTaggerProviderError' });
    }
}

// A `@cf/...` model id signals a Cloudflare Workers AI model bound to env.AI.
function isWorkersAIModel(model) {
    return typeof model === 'string' && model.startsWith('@cf/');
}

function normalizeConfig(config) {
    const requestFormat = config.requestFormat || 'raw';
    if (!['raw', 'multipart'].includes(requestFormat)) {
        throw new TypeError(`Invalid WD Tagger request format: ${requestFormat}`);
    }

    return {
        endpoint: config.endpoint || '',
        apiKey: config.apiKey || '',
        model: config.model || 'wd-tagger',
        modelVersion: config.modelVersion || '',
        timeoutMs: normalizeNumber(config.timeoutMs, 30000, 1),
        maxInputSizeBytes: normalizeNumber(
            config.maxInputSizeBytes,
            DEFAULT_MAX_INPUT_SIZE,
            1
        ),
        threshold: normalizeNumber(config.threshold, 0.35, 0, 1),
        characterThreshold: normalizeNumber(config.characterThreshold, 0.85, 0, 1),
        maxTags: Math.floor(normalizeNumber(config.maxTags, 100, 1)),
        requestFormat,
        fileField: config.fileField || 'image',
        headers: config.headers || {}
    };
}

function validateRequest(artifact, capability, config) {
    if (capability !== 'tagging') {
        throw new WDTaggerProviderError(`Unsupported capability: ${capability}`, {
            category: AI_ERROR_CATEGORY.UNSUPPORTED
        });
    }
    if (!config.endpoint && !isWorkersAIModel(config.model)) {
        throw new WDTaggerProviderError('WD Tagger endpoint is not configured', {
            category: AI_ERROR_CATEGORY.PROVIDER
        });
    }
    if (!artifact || typeof artifact.read !== 'function') {
        throw new WDTaggerProviderError('Invalid AI artifact', {
            category: AI_ERROR_CATEGORY.INVALID_INPUT
        });
    }
    if (!artifact.mimeType?.startsWith('image/')) {
        throw new WDTaggerProviderError('WD Tagger accepts image artifacts only', {
            category: AI_ERROR_CATEGORY.UNSUPPORTED
        });
    }
    if (artifact.size > config.maxInputSizeBytes) {
        throw new WDTaggerProviderError('AI artifact exceeds WD Tagger input limit', {
            category: AI_ERROR_CATEGORY.INVALID_INPUT
        });
    }
}

function normalizeTags(response, threshold, characterThreshold, maxTags) {
    const entries = extractTagEntries(response);
    const uniqueTags = new Map();

    for (const value of entries) {
        const tag = normalizeTag(value);
        const minimum = value?.category === 'character' ? characterThreshold : threshold;
        if (!tag || tag.confidence < minimum) continue;

        const current = uniqueTags.get(tag.name);
        if (!current || tag.confidence > current.confidence) {
            uniqueTags.set(tag.name, tag);
        }
    }

    return [...uniqueTags.values()]
        .sort((left, right) => right.confidence - left.confidence)
        .slice(0, maxTags);
}

function extractTagEntries(response) {
    if (Array.isArray(response)) {
        const structured = response.flatMap(value => {
            if (!value || typeof value !== 'object') return [];
            if (looksLikeTag(value)) return [value];
            // Skip the rating output (general/sensitive/questionable/explicit),
            // but keep character/general label→score maps that a WD Tagger
            // Space returns as separate array outputs.
            if (isRatingMap(value)) return [];
            const nested = extractTagEntries(value);
            return nested.length > 0 ? nested : toLabelScoreEntries(value);
        });
        if (structured.length > 0) return structured;
        return response.filter(value => typeof value === 'string').flatMap(captionToTagEntries);
    }
    if (!response || typeof response !== 'object') return [];
    if (response.data !== undefined) return extractTagEntries(response.data);
    if (response.confidences !== undefined) return toTagEntries(response.confidences);
    if (response.tags !== undefined) return toTagEntries(response.tags);

    const grouped = [
        ...toTagEntries(response.general).map(tag => withCategory(tag, 'general')),
        ...toTagEntries(response.character).map(tag => withCategory(tag, 'character'))
    ];
    if (grouped.length > 0) return grouped;

    return toTagEntries(
        response.predictions ?? response.result?.tags ?? response.caption ?? []
    );
}

function looksLikeTag(value) {
    return value.name !== undefined
        || value.label !== undefined && value.confidences === undefined
        || value.tag !== undefined
        || value.score !== undefined
        || value.probability !== undefined;
}

function captionToTagEntries(value) {
    return value.split(',').map(name => name.trim()).filter(Boolean).map(name => ({ name, confidence: 1 }));
}

function withCategory(tag, category) {
    if (typeof tag === 'string') return { name: tag, confidence: 1, category };
    return { ...tag, category };
}

function toTagEntries(source) {
    if (Array.isArray(source)) return source;
    if (source && typeof source === 'object') {
        return Object.entries(source).map(([name, confidence]) => ({ name, confidence }));
    }
    return [];
}

const RATING_MAP_LABELS = new Set(['general', 'sensitive', 'questionable', 'explicit']);

// A flat { label: score } object, such as a WD Tagger general/character/rating output.
function isLabelScoreMap(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
    const entries = Object.entries(value);
    return entries.length > 0 && entries.every(([, score]) => Number.isFinite(Number(score)));
}

// The rating output is not converted to tags; identified by every key being a rating label.
function isRatingMap(value) {
    if (!isLabelScoreMap(value)) return false;
    return Object.keys(value).every(key => RATING_MAP_LABELS.has(key.toLowerCase()));
}

// Convert a { label: score } map (e.g. the character output) into tag entries.
function toLabelScoreEntries(value) {
    if (!isLabelScoreMap(value)) return [];
    return Object.entries(value).map(([name, confidence]) => ({ name, confidence }));
}

function normalizeTag(value) {
    if (typeof value === 'string') {
        const name = value.trim().slice(0, 128);
        return name ? { name, confidence: 1 } : null;
    }
    if (!value || typeof value !== 'object') return null;

    const name = String(value.name ?? value.label ?? value.tag ?? '').trim().slice(0, 128);
    const rawConfidence = Number(value.confidence ?? value.score ?? value.probability ?? 0);
    if (!name || !Number.isFinite(rawConfidence)) return null;

    return {
        name,
        confidence: Math.max(0, Math.min(1, rawConfidence))
    };
}

function safeErrorMessage(error) {
    if (error instanceof WDTaggerProviderError) return error.message;
    if (error?.name === 'AbortError') return 'WD Tagger request cancelled';
    return 'WD Tagger analysis failed';
}
