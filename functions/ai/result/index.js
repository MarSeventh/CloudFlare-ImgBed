import { AI_RESULT_STATUS, isAIResultStatus } from '../types/index.js';

/** Creates the bounded result envelope used by future pipeline steps. */
export function createAIResult(input = {}) {
    const status = input.status ?? AI_RESULT_STATUS.UNPROCESSED;
    if (!isAIResultStatus(status)) {
        throw new TypeError(`Invalid AI result status: ${status}`);
    }

    return {
        status,
        results: input.results ?? {},
        provider: input.provider ?? '',
        model: input.model ?? '',
        modelVersion: input.modelVersion ?? '',
        completedAt: input.completedAt ?? '',
        error: input.error ?? null
    };
}
