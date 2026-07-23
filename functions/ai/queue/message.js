import { isAICapability } from '../types/index.js';

export const AI_QUEUE_SCHEMA_VERSION = 1;
export const AI_QUEUE_MAX_RETRIES = 3;

export function createAIQueueMessage(input = {}) {
    assertString(input.taskId, 'AIQueueMessage.taskId');
    assertString(input.fileId, 'AIQueueMessage.fileId');
    assertString(input.pipelineId, 'AIQueueMessage.pipelineId');
    assertString(input.pipelineVersion, 'AIQueueMessage.pipelineVersion');
    if (!isAICapability(input.capability)) {
        throw new TypeError(`Invalid AI queue capability: ${input.capability}`);
    }

    const schemaVersion = Number(input.schemaVersion ?? AI_QUEUE_SCHEMA_VERSION);
    if (schemaVersion !== AI_QUEUE_SCHEMA_VERSION) {
        throw new TypeError(`Unsupported AI queue schema version: ${schemaVersion}`);
    }

    const queuedAt = String(input.queuedAt || '');
    if (!queuedAt || !Number.isFinite(Date.parse(queuedAt))) {
        throw new TypeError('AIQueueMessage.queuedAt must be an ISO timestamp');
    }

    return Object.freeze({
        schemaVersion,
        taskId: input.taskId,
        fileId: input.fileId,
        pipelineId: input.pipelineId,
        pipelineVersion: input.pipelineVersion,
        capability: input.capability,
        imageUrl: normalizeUrl(input.imageUrl),
        mimeType: String(input.mimeType || ''),
        fileSize: normalizeSize(input.fileSize),
        queuedAt
    });
}

export function parseAIQueueMessage(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new TypeError('AI queue message body must be an object');
    }
    return createAIQueueMessage(value);
}

function assertString(value, fieldName) {
    if (typeof value !== 'string' || value === '') {
        throw new TypeError(`${fieldName} is required`);
    }
}

function normalizeSize(value) {
    const size = Number(value ?? 0);
    if (!Number.isFinite(size) || size < 0) {
        throw new TypeError('AIQueueMessage.fileSize must be a non-negative number');
    }
    return size;
}

function normalizeUrl(value) {
    if (!value) return '';
    const url = new URL(String(value));
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new TypeError('AIQueueMessage.imageUrl must use HTTP or HTTPS');
    }
    return url.toString();
}
