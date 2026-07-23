import {
    AI_ERROR_CATEGORY,
    AI_RESULT_STATUS,
    isAICapability
} from '../types/index.js';

export const AI_PIPELINE_FAILURE_POLICY = Object.freeze({
    CONTINUE: 'continue',
    STOP: 'stop'
});

export const AI_PIPELINE_STEP_STATUS = Object.freeze({
    SUCCEEDED: 'succeeded',
    FAILED: 'failed',
    CANCELLED: 'cancelled',
    SKIPPED: 'skipped'
});

export class AIPipelineTimeoutError extends Error {
    constructor(message) {
        super(message);
        this.name = 'AIPipelineTimeoutError';
    }
}

export function createAIPipelineStep(input = {}) {
    if (typeof input.id !== 'string' || input.id === '') {
        throw new TypeError('Pipeline step id is required');
    }
    if (!isAICapability(input.capability)) {
        throw new TypeError(`Invalid AI capability: ${input.capability}`);
    }
    if (typeof input.execute !== 'function') {
        throw new TypeError('Pipeline step execute must be a function');
    }

    return Object.freeze({
        id: input.id,
        capability: input.capability,
        timeoutMs: normalizeTimeout(input.timeoutMs, 'Pipeline step timeoutMs'),
        execute: input.execute
    });
}

export class AIPipeline {
    constructor(options = {}) {
        assertRequiredString(options.pipelineId, 'AIPipeline.pipelineId');
        assertRequiredString(options.pipelineVersion, 'AIPipeline.pipelineVersion');

        if (options.steps !== undefined && !Array.isArray(options.steps)) {
            throw new TypeError('AIPipeline.steps must be an array');
        }

        this.pipelineId = options.pipelineId;
        this.pipelineVersion = options.pipelineVersion;
        this.steps = Object.freeze((options.steps || []).map(createAIPipelineStep));
        this.maxParallel = normalizeParallel(options.maxParallel);
        this.timeoutMs = normalizeTimeout(options.timeoutMs, 'Pipeline timeoutMs');
        this.failurePolicy = normalizeFailurePolicy(options.failurePolicy);

        const stepIds = new Set(this.steps.map(step => step.id));
        if (stepIds.size !== this.steps.length) {
            throw new TypeError('Pipeline step ids must be unique');
        }
    }

    async run(input = {}) {
        if (!input.artifact || typeof input.artifact.fileId !== 'string' || input.artifact.fileId === '') {
            throw new TypeError('Pipeline artifact is required');
        }

        const execution = createExecutionSignal(input.signal, this.timeoutMs, 'Pipeline timed out');
        const stepResults = new Array(this.steps.length);
        let nextIndex = 0;
        let stopped = false;

        const runNext = async () => {
            while (!stopped && !execution.signal.aborted) {
                const index = nextIndex++;
                if (index >= this.steps.length) return;

                const step = this.steps[index];
                const result = await executeStep(step, {
                    artifact: input.artifact,
                    context: input.context || {},
                    signal: execution.signal
                });
                stepResults[index] = result;

                if (this.failurePolicy === AI_PIPELINE_FAILURE_POLICY.STOP &&
                    result.status !== AI_PIPELINE_STEP_STATUS.SUCCEEDED) {
                    stopped = true;
                }
            }
        };

        try {
            const workerCount = Math.min(this.maxParallel, this.steps.length);
            await Promise.all(Array.from({ length: workerCount }, runNext));
        } finally {
            execution.dispose();
        }

        for (let index = 0; index < this.steps.length; index++) {
            if (stepResults[index]) continue;
            stepResults[index] = createSkippedResult(
                this.steps[index],
                execution.signal.aborted ? 'pipeline_cancelled' : 'failure_policy'
            );
        }

        return {
            pipelineId: this.pipelineId,
            pipelineVersion: this.pipelineVersion,
            status: resolvePipelineStatus(stepResults),
            steps: stepResults
        };
    }
}

export function createAIPipeline(options = {}) {
    return new AIPipeline(options);
}

async function executeStep(step, input) {
    const startedAt = new Date().toISOString();
    const execution = createExecutionSignal(input.signal, step.timeoutMs, `Pipeline step timed out: ${step.id}`);

    try {
        const output = await waitForAbort(
            Promise.resolve().then(() => step.execute({
                artifact: input.artifact,
                capability: step.capability,
                context: input.context,
                signal: execution.signal,
                stepId: step.id
            })),
            execution.signal
        );

        return {
            stepId: step.id,
            capability: step.capability,
            status: AI_PIPELINE_STEP_STATUS.SUCCEEDED,
            output,
            error: null,
            startedAt,
            completedAt: new Date().toISOString()
        };
    } catch (error) {
        const timedOut = error instanceof AIPipelineTimeoutError;
        return {
            stepId: step.id,
            capability: step.capability,
            status: timedOut
                ? AI_PIPELINE_STEP_STATUS.FAILED
                : execution.signal.aborted
                    ? AI_PIPELINE_STEP_STATUS.CANCELLED
                    : AI_PIPELINE_STEP_STATUS.FAILED,
            output: null,
            error: toPipelineError(error, timedOut, execution.signal.aborted),
            startedAt,
            completedAt: new Date().toISOString()
        };
    } finally {
        execution.dispose();
    }
}

function createSkippedResult(step, reason) {
    return {
        stepId: step.id,
        capability: step.capability,
        status: AI_PIPELINE_STEP_STATUS.SKIPPED,
        output: null,
        error: { category: AI_ERROR_CATEGORY.CANCELLED, retryable: false, reason },
        startedAt: '',
        completedAt: ''
    };
}

function resolvePipelineStatus(stepResults) {
    if (stepResults.length === 0) return AI_RESULT_STATUS.UNPROCESSED;

    const succeeded = stepResults.filter(result =>
        result.status === AI_PIPELINE_STEP_STATUS.SUCCEEDED
    ).length;

    if (succeeded === stepResults.length) return AI_RESULT_STATUS.SUCCEEDED;
    if (succeeded > 0) return AI_RESULT_STATUS.PARTIAL;
    return AI_RESULT_STATUS.FAILED;
}

function createExecutionSignal(parentSignal, timeoutMs, timeoutMessage) {
    const controller = new AbortController();
    const abortFromParent = () => controller.abort(parentSignal.reason);
    let timeoutId;

    if (parentSignal?.aborted) {
        abortFromParent();
    } else if (parentSignal) {
        parentSignal.addEventListener('abort', abortFromParent, { once: true });
    }

    if (timeoutMs > 0 && !controller.signal.aborted) {
        timeoutId = setTimeout(() => {
            controller.abort(new AIPipelineTimeoutError(timeoutMessage));
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

function waitForAbort(promise, signal) {
    if (signal.aborted) return Promise.reject(signal.reason || new Error('Pipeline cancelled'));

    return new Promise((resolve, reject) => {
        const abort = () => reject(signal.reason || new Error('Pipeline cancelled'));
        signal.addEventListener('abort', abort, { once: true });
        promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
    });
}

function toPipelineError(error, timedOut, cancelled) {
    return {
        category: timedOut
            ? AI_ERROR_CATEGORY.TIMEOUT
            : cancelled
                ? AI_ERROR_CATEGORY.CANCELLED
                : AI_ERROR_CATEGORY.UNKNOWN,
        retryable: false,
        name: error?.name || 'Error',
        message: error?.message || String(error)
    };
}

function normalizeFailurePolicy(policy = AI_PIPELINE_FAILURE_POLICY.CONTINUE) {
    if (!Object.values(AI_PIPELINE_FAILURE_POLICY).includes(policy)) {
        throw new TypeError(`Invalid pipeline failure policy: ${policy}`);
    }
    return policy;
}

function normalizeParallel(value = 1) {
    if (!Number.isInteger(value) || value < 1) {
        throw new TypeError('Pipeline maxParallel must be a positive integer');
    }
    return value;
}

function normalizeTimeout(value = 0, fieldName) {
    if (!Number.isFinite(value) || value < 0) {
        throw new TypeError(`${fieldName} must be a non-negative number`);
    }
    return value;
}

function assertRequiredString(value, fieldName) {
    if (typeof value !== 'string' || value === '') {
        throw new TypeError(`${fieldName} is required`);
    }
}
