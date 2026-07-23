import { ProviderError } from './errors.js';
import { AI_ERROR_CATEGORY } from '../../types/index.js';

/**
 * Creates a child AbortSignal that aborts when the parent aborts or when the
 * timeout elapses. The timeout abort reason is a retryable timeout ProviderError.
 * Callers must call dispose() to clear the timer and detach the parent listener.
 */
export function createExecutionSignal(parentSignal, timeoutMs, timeoutMessage = 'Request timed out') {
    const controller = new AbortController();
    const abortFromParent = () => controller.abort(parentSignal.reason);
    let timeoutId;

    if (parentSignal?.aborted) abortFromParent();
    else parentSignal?.addEventListener('abort', abortFromParent, { once: true });

    if (timeoutMs > 0 && !controller.signal.aborted) {
        timeoutId = setTimeout(() => {
            controller.abort(new ProviderError(timeoutMessage, {
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

/**
 * Rejects as soon as the signal aborts, otherwise resolves/rejects with the
 * given promise. Used to stop awaiting an operation that ignores cancellation.
 */
export function waitForAbort(promise, signal, cancelMessage = 'Request cancelled') {
    if (signal.aborted) return Promise.reject(signal.reason || new Error(cancelMessage));

    return new Promise((resolve, reject) => {
        const abort = () => reject(signal.reason || new Error(cancelMessage));
        signal.addEventListener('abort', abort, { once: true });
        Promise.resolve(promise)
            .then(resolve, reject)
            .finally(() => signal.removeEventListener('abort', abort));
    });
}
