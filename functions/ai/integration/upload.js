import { createArtifact } from '../artifact/index.js';
import { AI_PROVIDER_NAMES, createAIFactory } from '../factory/index.js';
import { AI_HOOKS, createAIHookRegistry } from '../hooks/index.js';
import { createAIPipeline } from '../pipeline/index.js';
import { createAIResult } from '../result/index.js';
import { AI_RESULT_STATUS } from '../types/index.js';
import { getDatabase } from '../../utils/databaseAdapter.js';
import { fetchAIConfig } from '../../utils/sysConfig.js';

const UPLOAD_PIPELINE_ID = 'upload_ai';
const UPLOAD_PIPELINE_VERSION = '1';
const uploadHooks = createAIHookRegistry();

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

async function executeAI(payload, context, config, taggingConfig, artifact) {
    const factory = createAIFactory({ logger: console });
    const providerName = taggingConfig.provider || AI_PROVIDER_NAMES.WD_TAGGER;
    const providerConfig = providerName === AI_PROVIDER_NAMES.WD_TAGGER
        ? config.providers.wdTagger
        : {};
    const provider = factory.create(providerName, providerConfig);
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
            execute: ({ artifact: stepArtifact, capability, signal }) =>
                provider.analyze(stepArtifact, capability, { signal, fetch: context.aiFetch })
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
        const mergeResult = await mergeAIResult(context.env, payload.fileId, {
            ...result,
            pipelineId: execution.pipelineId,
            pipelineVersion: execution.pipelineVersion
        });
        return {
            status: mergeResult.updated ? result.status : 'skipped',
            reason: mergeResult.reason || ''
        };
    } finally {
        await artifact.dispose();
    }
}

export async function mergeAIResult(env, fileId, aiMetadata) {
    const db = getDatabase(env);
    const current = await db.getWithMetadata(fileId);
    if (!current?.metadata) {
        return { updated: false, reason: 'file_not_found' };
    }

    const metadata = {
        ...current.metadata,
        ai: aiMetadata
    };
    await db.put(fileId, current.value ?? '', { metadata });
    return { updated: true };
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
