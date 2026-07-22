import { createArtifact } from '../artifact/index.js';
import { AI_PROVIDER_NAMES, createAIFactory } from '../factory/index.js';
import { AI_HOOKS, createAIHookRegistry } from '../hooks/index.js';
import { createAIPipeline } from '../pipeline/index.js';
import { createAIResult } from '../result/index.js';
import { AI_RESULT_STATUS } from '../types/index.js';
import { createAIQueueMessage } from '../queue/message.js';
import { getDatabase } from '../../utils/databaseAdapter.js';
import { fetchAIConfig } from '../../utils/sysConfig.js';
import { createAIAdapter } from '../env/adapter.js';
import { MetadataService, readAIResultStateFrom } from '../services/metadata.service.js';
import { TagProcessor } from '../processors/tag/index.js';

export const UPLOAD_PIPELINE_ID = 'upload_ai';
export const UPLOAD_PIPELINE_VERSION = '1';
const uploadHooks = createAIHookRegistry();
const AI_TASK_KEY_PREFIX = 'manage@aiTask@';

uploadHooks.register(AI_HOOKS.AFTER_METADATA_PERSISTED, runUploadAI);

export async function dispatchAfterMetadataPersisted(payload, context) {
    return uploadHooks.dispatch(AI_HOOKS.AFTER_METADATA_PERSISTED, payload, context);
}

export async function runUploadAI(payload, context) {
    const config = await fetchAIConfig(context.env);
    const taggingConfig = config.capabilities?.tagging;
    if (!config.enabled || !taggingConfig?.enabled) {
        return { status: 'skipped', reason: 'disabled' };
    }

    if (!isDirectorySelected(payload.metadata?.Directory, taggingConfig.targetDirectories)) {
        return { status: 'skipped', reason: 'directory_not_selected' };
    }

    if (config.queue?.enabled) {
        if (typeof context.env?.img_queue?.send === 'function') {
            return enqueueUploadAI(payload, context, config);
        }
        if (config.queue.fallbackToDirect === false) {
            console.warn('[AI][Queue] Binding unavailable; direct fallback disabled', {
                fileId: payload.fileId
            });
            return { status: 'skipped', reason: 'queue_unavailable' };
        }
    }
    return runConfiguredAI(payload, context, config);
}

export async function runManualAI(payload, context) {
    const config = await fetchAIConfig(context.env);
    if (!config.enabled) return { status: 'skipped', reason: 'disabled' };

    const originalEnabled = config.capabilities.tagging.enabled;
    config.capabilities.tagging.enabled = true;
    try {
        return await runConfiguredAI(payload, context, config);
    } finally {
        config.capabilities.tagging.enabled = originalEnabled;
    }
}

async function runConfiguredAI(payload, context, config) {
    const taggingConfig = config.capabilities?.tagging;
    if (!config.enabled || !taggingConfig?.enabled) {
        return { status: 'skipped', reason: 'disabled' };
    }

    const artifact = createUploadArtifact(payload, context);
    if (!artifact) return { status: 'skipped', reason: 'artifact_unavailable' };

    return executeAI(payload, context, config, taggingConfig, artifact);
}

async function executeAI(payload, context, config, taggingConfig, artifact, options = {}) {
    const factory = createAIFactory({
        logger: console,
        adapter: createAIAdapter(context.env, context)
    });
    const providerName = taggingConfig.provider || AI_PROVIDER_NAMES.WD_TAGGER;
    if (!factory.has(providerName)) {
        await artifact.dispose();
        return { status: 'skipped', reason: 'unknown_provider' };
    }
    const providerConfig = config.providers?.[providerName] || {};
    const provider = factory.create(providerName, providerConfig);
    if (!provider.getCapabilities().includes('tagging')) {
        await artifact.dispose();
        return { status: 'skipped', reason: 'provider_capability_unsupported' };
    }
    if (!providerAcceptsArtifact(provider, artifact)) {
        await artifact.dispose();
        return { status: 'skipped', reason: 'provider_unsupported_input' };
    }
    const policy = provider.getExecutionPolicy();
    const pipeline = createAIPipeline({
        pipelineId: UPLOAD_PIPELINE_ID,
        pipelineVersion: UPLOAD_PIPELINE_VERSION,
        maxParallel: 1,
        timeoutMs: config.timeoutMs,
        steps: [{
            id: 'tagging',
            capability: 'tagging',
            timeoutMs: policy.timeoutMs,
            execute: async ({ artifact: stepArtifact, signal }) => {
                const processor = new TagProcessor(provider);
                const { result } = await processor.process({
                    artifact: stepArtifact,
                    signal,
                    fetch: context.aiFetch
                });
                return result;
            }
        }]
    });

    try {
        const execution = await pipeline.run({ artifact });
        const step = execution.steps[0];
        const result = step?.output || createAIResult({
            status: AI_RESULT_STATUS.FAILED,
            results: { tags: [] },
            completedAt: new Date().toISOString(),
            error: step?.error || {
                category: 'unknown',
                retryable: false,
                message: 'AI pipeline did not return a provider result'
            }
        });
        const aiMetadata = {
            ...result,
            pipelineId: execution.pipelineId,
            pipelineVersion: execution.pipelineVersion
        };
        if (options.task) Object.assign(aiMetadata, taskMetadata(options.task));
        if (options.merge === false) {
            return { status: result.status, reason: '', result: aiMetadata };
        }

        const mergeResult = await mergeAIResult(context.env, payload.fileId, aiMetadata);
        return {
            status: mergeResult.updated ? result.status : 'skipped',
            reason: mergeResult.reason || '',
            result: aiMetadata
        };
    } finally {
        await artifact.dispose();
    }
}

export async function mergeAIResult(env, fileId, aiMetadata, options = {}) {
    const service = new MetadataService(createAIAdapter(env));
    return service.saveAIResult(fileId, aiMetadata, options);
}

export async function readAIResultState(env, fileId) {
    return readAIResultStateFrom(getDatabase(env), fileId);
}

function aiTaskKey(fileId) {
    return `${AI_TASK_KEY_PREFIX}${fileId}`;
}

async function readAIState(db, fileId) {
    const value = await db.get(aiTaskKey(fileId));
    if (!value) return null;
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

async function enqueueUploadAI(payload, context, config) {
    const queuedAt = new Date().toISOString();
    const task = createAIQueueMessage({
        taskId: crypto.randomUUID(),
        fileId: payload.fileId,
        pipelineId: UPLOAD_PIPELINE_ID,
        pipelineVersion: UPLOAD_PIPELINE_VERSION,
        capability: 'tagging',
        imageUrl: resolveImageUrl(payload.fileId, context),
        mimeType: payload.metadata?.FileType || '',
        fileSize: payload.metadata?.FileSizeBytes || 0,
        queuedAt
    });

    try {
        await mergeAIResult(context.env, payload.fileId, {
            status: AI_RESULT_STATUS.PROCESSING,
            results: {},
            provider: '',
            model: '',
            modelVersion: '',
            completedAt: '',
            error: null,
            ...taskMetadata(task)
        });
        await context.env.img_queue.send(task);
        return { status: 'queued', taskId: task.taskId };
    } catch (error) {
        console.error('[AI][Queue] Enqueue failed', {
            taskId: task.taskId,
            fileId: task.fileId,
            message: error?.message || 'Unknown error'
        });
    }

    if (config.queue?.fallbackToDirect === false) {
        await mergeAIResult(context.env, payload.fileId, createSkippedMetadata(task, 'enqueue_failed'), {
            expectedTaskId: task.taskId,
            queuedAt: task.queuedAt
        });
        return { status: 'skipped', reason: 'enqueue_failed' };
    }

    const outcome = await runConfiguredAI(payload, context, config);
    if (outcome.status === 'skipped') {
        await mergeAIResult(context.env, payload.fileId, createSkippedMetadata(task, outcome.reason), {
            expectedTaskId: task.taskId,
            queuedAt: task.queuedAt
        });
    }
    return outcome;
}

export async function executeQueuedAI(task, context) {
    const db = getDatabase(context.env);
    const current = await db.getWithMetadata(task.fileId);
    if (!current?.metadata) return { status: 'skipped', reason: 'file_not_found' };

    const currentAI = await readAIState(db, task.fileId) || current.metadata.ai;
    if (currentAI?.taskId === task.taskId &&
        currentAI.completedAt && currentAI.status !== AI_RESULT_STATUS.PROCESSING) {
        return { status: 'duplicate', reason: 'already_completed' };
    }
    if (hasNewerResult(currentAI, task)) {
        return { status: 'skipped', reason: 'newer_result_exists' };
    }

    if (task.pipelineId !== UPLOAD_PIPELINE_ID ||
        task.pipelineVersion !== UPLOAD_PIPELINE_VERSION) {
        await mergeQueuedResult(context.env, task, createSkippedMetadata(task, 'unsupported_pipeline'));
        return { status: 'skipped', reason: 'unsupported_pipeline' };
    }

    const config = await fetchAIConfig(context.env);
    if (!config.queue?.enabled) {
        await mergeQueuedResult(context.env, task, createSkippedMetadata(task, 'queue_disabled'));
        return { status: 'skipped', reason: 'queue_disabled' };
    }
    if (isTaskStale(task, config.queue.staleAfterSeconds)) {
        await mergeQueuedResult(context.env, task, createSkippedMetadata(task, 'task_expired'));
        return { status: 'skipped', reason: 'task_expired' };
    }

    const metadata = current.metadata;
    if (metadata.Channel === 'External') {
        await mergeQueuedResult(context.env, task, createSkippedMetadata(task, 'external_unsupported'));
        return { status: 'skipped', reason: 'external_unsupported' };
    }

    const taggingConfig = config.capabilities?.tagging;
    if (!config.enabled || !taggingConfig?.enabled) {
        await mergeQueuedResult(context.env, task, createSkippedMetadata(task, 'disabled'));
        return { status: 'skipped', reason: 'disabled' };
    }
    if (task.capability !== 'tagging') {
        await mergeQueuedResult(context.env, task, createSkippedMetadata(task, 'unsupported_capability'));
        return { status: 'skipped', reason: 'unsupported_capability' };
    }
    if (!isDirectorySelected(metadata.Directory, taggingConfig.targetDirectories)) {
        await mergeQueuedResult(context.env, task, createSkippedMetadata(task, 'directory_not_selected'));
        return { status: 'skipped', reason: 'directory_not_selected' };
    }

    let artifact;
    if (typeof context.aiArtifactFactory === 'function') {
        artifact = await context.aiArtifactFactory(task, metadata, context);
    } else {
        const { createStoredAIArtifact } = await import('../queue/storedArtifact.js');
        artifact = createStoredAIArtifact(task, metadata, context);
    }
    let outcome;
    try {
        outcome = await executeAI(
            { fileId: task.fileId, metadata },
            context,
            config,
            taggingConfig,
            artifact,
            { merge: false, task }
        );
    } catch (error) {
        const result = createFailureMetadata(task, {
            category: 'provider',
            retryable: error?.retryable === true,
            message: error?.message || 'AI queue execution failed'
        });
        if (!result.error.retryable) await mergeQueuedResult(context.env, task, result);
        return { status: 'failed', retryable: result.error.retryable, error: result.error };
    }

    if (outcome.status === 'skipped') {
        await mergeQueuedResult(context.env, task, createSkippedMetadata(task, outcome.reason));
        return outcome;
    }

    if (outcome.result?.status === AI_RESULT_STATUS.FAILED && outcome.result.error?.retryable) {
        return {
            status: 'failed',
            retryable: true,
            error: outcome.result.error,
            result: outcome.result
        };
    }

    const mergeResult = await mergeQueuedResult(context.env, task, outcome.result);
    return mergeResult.updated
        ? { status: outcome.status, retryable: false }
        : { status: 'skipped', reason: mergeResult.reason, retryable: false };
}

export async function finalizeQueuedAIFailure(task, context, error = {}, result = null) {
    const terminalResult = result ? {
        ...result,
        status: AI_RESULT_STATUS.FAILED,
        completedAt: new Date().toISOString(),
        error: {
            ...result.error,
            ...error,
            retryable: error.retryable === true
        },
        ...taskMetadata(task)
    } : createFailureMetadata(task, {
        category: error.category || 'unknown',
        retryable: error.retryable === true,
        message: error.message || 'AI queue task failed after retries'
    });
    return mergeQueuedResult(context.env, task, terminalResult);
}

function mergeQueuedResult(env, task, aiMetadata) {
    return mergeAIResult(env, task.fileId, aiMetadata, {
        expectedTaskId: task.taskId,
        queuedAt: task.queuedAt
    });
}

function createSkippedMetadata(task, reason) {
    return {
        status: AI_RESULT_STATUS.UNPROCESSED,
        results: {},
        provider: '',
        model: '',
        modelVersion: '',
        completedAt: new Date().toISOString(),
        error: null,
        reason: reason || 'skipped',
        ...taskMetadata(task)
    };
}

function createFailureMetadata(task, error) {
    return {
        status: AI_RESULT_STATUS.FAILED,
        results: { tags: [] },
        provider: '',
        model: '',
        modelVersion: '',
        completedAt: new Date().toISOString(),
        error,
        ...taskMetadata(task)
    };
}

function taskMetadata(task) {
    return {
        taskId: task.taskId,
        queuedAt: task.queuedAt,
        capability: task.capability,
        pipelineId: task.pipelineId,
        pipelineVersion: task.pipelineVersion
    };
}

function hasNewerResult(currentAI, task) {
    if (!currentAI?.completedAt || currentAI.taskId === task.taskId) return false;
    return Date.parse(currentAI.completedAt) > Date.parse(task.queuedAt);
}

function isTaskStale(task, staleAfterSeconds) {
    if (!Number.isFinite(staleAfterSeconds) || staleAfterSeconds <= 0) return false;
    const queuedAt = Date.parse(task.queuedAt);
    return Number.isFinite(queuedAt) && Date.now() - queuedAt > staleAfterSeconds * 1000;
}

function resolveImageUrl(fileId, context) {
    if (context.publicUrl) return context.publicUrl;
    const url = new URL(context.request?.url || context.url?.toString() || 'https://internal.invalid/');
    url.pathname = `/file/${encodeURIComponent(fileId)}`;
    url.search = '';
    return url.toString();
}

function createUploadArtifact(payload, context) {
    const metadata = payload.metadata || {};
    if (!context.aiFile && (metadata.Channel === 'External' || metadata.IsChunked)) return null;

    const file = context.aiFile || context.formdata?.get?.('file');
    if (!file || typeof file.arrayBuffer !== 'function') return null;

    return createArtifact({
        fileId: payload.fileId,
        fileName: metadata.FileName || file.name || '',
        mimeType: metadata.FileType || file.type || '',
        size: metadata.FileSizeBytes ?? file.size ?? 0,
        channel: metadata.Channel || '',
        reader: async ({ maxBytes }) => {
            if (Number.isFinite(maxBytes) && file.size > maxBytes) {
                return file.slice(0, maxBytes + 1).arrayBuffer();
            }
            return file.arrayBuffer();
        }
    });
}

function isDirectorySelected(directory, selectedDirectories = []) {
    if (!selectedDirectories.length) return true;
    const normalized = String(directory || '').replace(/^\/+|\/+$/g, '');
    return selectedDirectories.some(selected =>
        normalized === selected || normalized.startsWith(`${selected}/`)
    );
}

function providerAcceptsArtifact(provider, artifact) {
    const requirements = provider.getInputRequirements();
    if (artifact.size > requirements.maxInputSizeBytes) return false;

    return requirements.acceptedMimeTypes.some(acceptedType => {
        if (acceptedType.endsWith('/*')) {
            return artifact.mimeType.startsWith(acceptedType.slice(0, -1));
        }
        return artifact.mimeType === acceptedType;
    });
}
