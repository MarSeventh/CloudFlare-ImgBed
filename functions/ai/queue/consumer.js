import { fetchAIConfig } from '../../utils/sysConfig.js';
import {
    executeQueuedAI,
    finalizeQueuedAIFailure
} from '../integration/upload.js';
import {
    AI_QUEUE_MAX_RETRIES,
    parseAIQueueMessage
} from './message.js';

const RETRY_DELAYS_SECONDS = Object.freeze([30, 120, 300]);

export async function consumeAIQueue(batch, env, executionContext = {}) {
    const messages = Array.isArray(batch?.messages) ? batch.messages : [];
    const config = await fetchAIConfig(env);
    const parallel = Math.max(1, Math.min(10, Number(config.parallel) || 1));
    const queueConfig = config.queue || {};
    let nextIndex = 0;

    const consumeNext = async () => {
        while (nextIndex < messages.length) {
            const message = messages[nextIndex++];
            await consumeMessage(message, env, executionContext, queueConfig);
        }
    };

    await Promise.all(Array.from(
        { length: Math.min(parallel, messages.length) },
        consumeNext
    ));
}

async function consumeMessage(queueMessage, env, executionContext, queueConfig) {
    let task;
    try {
        task = parseAIQueueMessage(queueMessage.body);
    } catch (error) {
        console.error('[AI][Queue] Invalid message', { message: error.message });
        queueMessage.ack();
        return;
    }

    const attempts = Math.max(1, Number(queueMessage.attempts) || 1);
    const maxRetries = normalizeMaxRetries(queueConfig.maxRetries);
    try {
        const outcome = await executeQueuedAI(task, {
            env,
            waitUntil: executionContext.waitUntil?.bind(executionContext),
            aiFetch: executionContext.aiFetch,
            aiArtifactFactory: executionContext.aiArtifactFactory
        });

        if (outcome.retryable) {
            if (attempts <= maxRetries) {
                queueMessage.retry({
                    delaySeconds: retryDelay(attempts, queueConfig.retryDelaysSeconds)
                });
                return;
            }
            await finalizeQueuedAIFailure(task, { env }, outcome.error, outcome.result);
        }
        queueMessage.ack();
    } catch (error) {
        console.error('[AI][Queue] Consumer failed', {
            taskId: task.taskId,
            fileId: task.fileId,
            attempts,
            message: error?.message || 'Unknown error'
        });

        if (attempts <= maxRetries) {
            queueMessage.retry({
                delaySeconds: retryDelay(attempts, queueConfig.retryDelaysSeconds)
            });
            return;
        }

        try {
            await finalizeQueuedAIFailure(task, { env }, {
                category: 'unknown',
                retryable: true,
                message: error?.message || 'AI queue consumer failed'
            });
        } catch (persistError) {
            console.error('[AI][Queue] Failed to persist terminal error', {
                taskId: task.taskId,
                fileId: task.fileId,
                message: persistError?.message || 'Unknown error'
            });
        }
        queueMessage.ack();
    }
}

function retryDelay(attempts, configuredDelays) {
    const delays = Array.isArray(configuredDelays) && configuredDelays.length
        ? configuredDelays
        : RETRY_DELAYS_SECONDS;
    return delays[Math.min(attempts - 1, delays.length - 1)];
}

function normalizeMaxRetries(value) {
    const retries = Number(value);
    if (!Number.isInteger(retries) || retries < 0) return AI_QUEUE_MAX_RETRIES;
    return Math.min(10, retries);
}
