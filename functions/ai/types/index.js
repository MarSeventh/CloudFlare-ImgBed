/**
 * Shared contracts for the optional AI subsystem.
 *
 * This module intentionally contains no provider or storage logic.
 */

export const AI_CAPABILITIES = Object.freeze([
    'tagging',
    'description',
    'ocr',
    'nsfw',
    'color',
    'exif',
    'object_detection',
    'embedding'
]);

export const AI_TASK_STATUS = Object.freeze({
    QUEUED: 'queued',
    RUNNING: 'running',
    SUCCEEDED: 'succeeded',
    PARTIALLY_SUCCEEDED: 'partially_succeeded',
    FAILED: 'failed',
    CANCELLED: 'cancelled'
});

export const AI_RESULT_STATUS = Object.freeze({
    UNPROCESSED: 'unprocessed',
    PROCESSING: 'processing',
    PARTIAL: 'partial',
    SUCCEEDED: 'succeeded',
    FAILED: 'failed'
});

export const AI_ERROR_CATEGORY = Object.freeze({
    INVALID_INPUT: 'invalid_input',
    UNSUPPORTED: 'unsupported',
    TIMEOUT: 'timeout',
    RATE_LIMITED: 'rate_limited',
    PROVIDER: 'provider',
    STORAGE: 'storage',
    UNKNOWN: 'unknown'
});

export const AI_TASK_TRANSITIONS = Object.freeze({
    [AI_TASK_STATUS.QUEUED]: Object.freeze([AI_TASK_STATUS.RUNNING]),
    [AI_TASK_STATUS.RUNNING]: Object.freeze([
        AI_TASK_STATUS.SUCCEEDED,
        AI_TASK_STATUS.PARTIALLY_SUCCEEDED,
        AI_TASK_STATUS.FAILED,
        AI_TASK_STATUS.CANCELLED
    ]),
    [AI_TASK_STATUS.SUCCEEDED]: Object.freeze([]),
    [AI_TASK_STATUS.PARTIALLY_SUCCEEDED]: Object.freeze([]),
    [AI_TASK_STATUS.FAILED]: Object.freeze([]),
    [AI_TASK_STATUS.CANCELLED]: Object.freeze([])
});

export function isValidTaskTransition(fromStatus, toStatus) {
    return AI_TASK_TRANSITIONS[fromStatus]?.includes(toStatus) === true;
}

export function isAICapability(capability) {
    return AI_CAPABILITIES.includes(capability);
}

export function isAITaskStatus(status) {
    return Object.values(AI_TASK_STATUS).includes(status);
}

export function isAIResultStatus(status) {
    return Object.values(AI_RESULT_STATUS).includes(status);
}

/** @typedef {Object} AIArtifactInput */
/** @property {string} fileId */
/** @property {string} [fileName] */
/** @property {string} [mimeType] */
/** @property {number} [size] */
/** @property {string} [channel] */
/** @property {function(Object): Promise<ReadableStream|ArrayBuffer|Uint8Array|null>} [reader] */

/** @typedef {Object} AIProviderContext */
/** @property {AbortSignal} [signal] */
/** @property {number} [timeoutMs] */
/** @property {Object} [config] */

/** @typedef {Object} AIResultEnvelope */
/** @property {string} status */
/** @property {Object} results */
/** @property {string} provider */
/** @property {string} model */
/** @property {string} modelVersion */
/** @property {string} completedAt */
/** @property {Object|null} error */

/** @typedef {Object} AITask */
/** @property {string} taskId */
/** @property {string} fileId */
/** @property {string} idempotencyKey */
/** @property {string} pipelineId */
/** @property {string} pipelineVersion */
/** @property {string} configVersion */
/** @property {string} configHash */
/** @property {string} status */
/** @property {number} attempts */
/** @property {string} createdAt */
/** @property {string} updatedAt */
