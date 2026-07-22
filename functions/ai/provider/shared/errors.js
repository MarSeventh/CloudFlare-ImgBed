import { AI_ERROR_CATEGORY } from '../../types/index.js';

/**
 * Base error for every AI provider transport. Carries a stable error category
 * and a retryable flag so the queue consumer and pipeline can decide whether to
 * retry without knowing the concrete provider.
 */
export class ProviderError extends Error {
    constructor(message, options = {}) {
        super(message, options.cause ? { cause: options.cause } : undefined);
        this.name = options.name || 'ProviderError';
        this.category = options.category || AI_ERROR_CATEGORY.PROVIDER;
        this.retryable = options.retryable === true;
        this.status = options.status || 0;
    }
}

/**
 * Maps an HTTP status to a provider error with the correct category and
 * retryable flag. Shared by every remote provider transport so 408/429/5xx are
 * classified identically.
 */
export function errorFromStatus(status, options = {}) {
    const ErrorClass = options.ErrorClass || ProviderError;
    const label = options.label || 'Provider';
    const build = (message, fields) => new ErrorClass(message, { status, ...fields });

    if (status === 408 || status === 504) {
        return build(`${label} request timed out`, {
            category: AI_ERROR_CATEGORY.TIMEOUT,
            retryable: true
        });
    }
    if (status === 429) {
        return build(`${label} rate limit exceeded`, {
            category: AI_ERROR_CATEGORY.RATE_LIMITED,
            retryable: true
        });
    }
    return build(`${label} request failed with status ${status}`, {
        category: AI_ERROR_CATEGORY.PROVIDER,
        retryable: status >= 500
    });
}

/**
 * Clamps a numeric config value to [minimum, maximum], falling back when the
 * value is missing or out of range.
 */
export function normalizeNumber(value, fallback, minimum, maximum = Number.POSITIVE_INFINITY) {
    const number = Number(value ?? fallback);
    if (!Number.isFinite(number) || number < minimum || number > maximum) return fallback;
    return number;
}
