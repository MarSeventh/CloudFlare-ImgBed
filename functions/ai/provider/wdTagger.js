import { AIProvider } from './index.js';
import { createAIResult } from '../result/index.js';
import {
    AI_ERROR_CATEGORY,
    AI_RESULT_STATUS
} from '../types/index.js';
import {
    requestGradioSpace,
    resolveHuggingFaceSpace
} from './gradioSpace.js';

const PROVIDER_NAME = 'wd_tagger';
const DEFAULT_MAX_INPUT_SIZE = 10 * 1024 * 1024;

export class WDTaggerProvider extends AIProvider {
    constructor(config = {}, options = {}) {
        super();
        this.config = normalizeConfig(config);
        this.logger = options.logger?.error ? options.logger : console;
    }

    getName() {
        return PROVIDER_NAME;
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
        if (error instanceof WDTaggerProviderError) {
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

        return {
            category: AI_ERROR_CATEGORY.PROVIDER,
            retryable: false
        };
    }

    async analyze(artifact, capability, context = {}) {
        const identity = this.getModelIdentity();

        try {
            validateRequest(artifact, capability, this.config);
            const execution = createExecutionSignal(context.signal, this.config.timeoutMs);

            try {
                const bytes = await readArtifactBytes(
                    artifact,
                    execution.signal,
                    this.config.maxInputSizeBytes
                );
                const response = await this.request(bytes, artifact, context, execution.signal);
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

    async request(bytes, artifact, context, signal) {
        const fetcher = context.fetch || globalThis.fetch;
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
                cause: error
            });
        }

        if (!response.ok) {
            throw errorFromStatus(response.status);
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

export class WDTaggerProviderError extends Error {
    constructor(message, options = {}) {
        super(message, options.cause ? { cause: options.cause } : undefined);
        this.name = 'WDTaggerProviderError';
        this.category = options.category || AI_ERROR_CATEGORY.PROVIDER;
        this.retryable = options.retryable === true;
        this.status = options.status || 0;
    }
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
    if (!config.endpoint) {
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

async function readArtifactBytes(artifact, signal, maxBytes) {
    const value = await waitForAbort(artifact.read({ signal, maxBytes }), signal);

    if (value instanceof ArrayBuffer) {
        return assertByteLimit(new Uint8Array(value), maxBytes);
    }
    if (ArrayBuffer.isView(value)) {
        return assertByteLimit(
            new Uint8Array(value.buffer, value.byteOffset, value.byteLength),
            maxBytes
        );
    }
    if (typeof Blob !== 'undefined' && value instanceof Blob) {
        return assertByteLimit(new Uint8Array(await value.arrayBuffer()), maxBytes);
    }
    if (typeof ReadableStream !== 'undefined' && value instanceof ReadableStream) {
        return readStream(value, maxBytes, signal);
    }

    throw new WDTaggerProviderError('AI artifact did not provide readable bytes', {
        category: AI_ERROR_CATEGORY.INVALID_INPUT
    });
}

async function readStream(stream, maxBytes, signal) {
    const reader = stream.getReader();
    const chunks = [];
    let size = 0;
    const cancel = () => {
        reader.cancel(signal.reason).catch(() => {});
    };

    if (signal.aborted) cancel();
    else signal.addEventListener('abort', cancel, { once: true });

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
            size += chunk.byteLength;
            if (size > maxBytes) throw inputLimitError();
            chunks.push(chunk);
        }
    } finally {
        signal.removeEventListener('abort', cancel);
        try {
            reader.releaseLock();
        } catch {
            // A pending read keeps the lock until the underlying source settles.
        }
    }

    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return bytes;
}

function assertByteLimit(bytes, maxBytes) {
    if (bytes.byteLength > maxBytes) throw inputLimitError();
    return bytes;
}

function inputLimitError() {
    return new WDTaggerProviderError('AI artifact exceeds WD Tagger input limit', {
        category: AI_ERROR_CATEGORY.INVALID_INPUT
    });
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
            return looksLikeTag(value) ? [value] : extractTagEntries(value);
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

function createExecutionSignal(parentSignal, timeoutMs) {
    const controller = new AbortController();
    const abortFromParent = () => controller.abort(parentSignal.reason);
    let timeoutId;

    if (parentSignal?.aborted) abortFromParent();
    else parentSignal?.addEventListener('abort', abortFromParent, { once: true });

    if (!controller.signal.aborted) {
        timeoutId = setTimeout(() => {
            controller.abort(new WDTaggerProviderError('WD Tagger request timed out', {
                category: AI_ERROR_CATEGORY.TIMEOUT,
                retryable: true
            }));
        }, timeoutMs);
    }

    return {
        signal: controller.signal,
        dispose() {
            if (timeoutId !== undefined) clearTimeout(timeoutId);
            parentSignal?.removeEventListener('abort', abortFromParent);
        }
    };
}

function errorFromStatus(status) {
    if (status === 408 || status === 504) {
        return new WDTaggerProviderError('WD Tagger request timed out', {
            category: AI_ERROR_CATEGORY.TIMEOUT,
            retryable: true,
            status
        });
    }
    if (status === 429) {
        return new WDTaggerProviderError('WD Tagger rate limit exceeded', {
            category: AI_ERROR_CATEGORY.RATE_LIMITED,
            retryable: true,
            status
        });
    }
    return new WDTaggerProviderError(`WD Tagger request failed with status ${status}`, {
        category: AI_ERROR_CATEGORY.PROVIDER,
        retryable: status >= 500,
        status
    });
}

function safeErrorMessage(error) {
    if (error instanceof WDTaggerProviderError) return error.message;
    if (error?.name === 'AbortError') return 'WD Tagger request cancelled';
    return 'WD Tagger analysis failed';
}

function waitForAbort(promise, signal) {
    if (signal.aborted) return Promise.reject(signal.reason || new Error('WD Tagger request cancelled'));

    return new Promise((resolve, reject) => {
        const abort = () => reject(signal.reason || new Error('WD Tagger request cancelled'));
        signal.addEventListener('abort', abort, { once: true });
        Promise.resolve(promise)
            .then(resolve, reject)
            .finally(() => signal.removeEventListener('abort', abort));
    });
}

function normalizeNumber(value, fallback, minimum, maximum = Number.POSITIVE_INFINITY) {
    const number = Number(value ?? fallback);
    if (!Number.isFinite(number) || number < minimum || number > maximum) return fallback;
    return number;
}
