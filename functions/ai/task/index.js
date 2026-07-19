import { AI_TASK_STATUS, isAITaskStatus } from '../types/index.js';

/** Task status contract. Persistence and execution are intentionally deferred. */
export function createAITask(input = {}) {
    for (const field of ['taskId', 'fileId', 'idempotencyKey', 'pipelineId', 'pipelineVersion']) {
        if (typeof input[field] !== 'string' || input[field] === '') {
            throw new TypeError(`AITask.${field} is required`);
        }
    }

    const status = input.status ?? AI_TASK_STATUS.QUEUED;
    if (!isAITaskStatus(status)) {
        throw new TypeError(`Invalid AI task status: ${status}`);
    }

    return {
        taskId: input.taskId,
        fileId: input.fileId,
        idempotencyKey: input.idempotencyKey,
        pipelineId: input.pipelineId,
        pipelineVersion: input.pipelineVersion,
        configVersion: input.configVersion ?? '',
        configHash: input.configHash ?? '',
        status,
        attempts: input.attempts ?? 0,
        createdAt: input.createdAt ?? '',
        updatedAt: input.updatedAt ?? ''
    };
}
