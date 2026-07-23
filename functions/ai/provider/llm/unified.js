import { LLMProvider, LLMProviderError, parseTags, parseCaption } from './base.js';
import { OpenAICompatibleProvider } from './openai.js';
import { AnthropicProvider } from './anthropic.js';
import { buildUnifiedPrompt, parseUnifiedResponse } from './prompts.js';
import { AI_ERROR_CATEGORY, AI_RESULT_STATUS } from '../../types/index.js';
import { createAIResult } from '../../result/index.js';
import { createExecutionSignal } from '../shared/execution.js';
import { readArtifactBytes, bytesToBase64 } from '../shared/bytes.js';

const PROVIDER_NAME = 'llm';
const SUPPORTED_ENGINES = ['openai', 'anthropic'];

/**
 * Unified LLM provider that supports two execution modes:
 *
 *   - separate (default): delegates each capability to the underlying engine
 *     provider individually — identical behaviour to using openai/anthropic
 *     directly, full failure isolation per capability.
 *
 *   - unified: merges all enabled capabilities into a single LLM request,
 *     parsing the structured JSON response into per-capability result objects.
 *     More efficient; a single call failure affects all capabilities together.
 *
 * The underlying HTTP transport is delegated to OpenAICompatibleProvider or
 * AnthropicProvider so transport logic is not duplicated.
 */
export class UnifiedLLMProvider extends LLMProvider {
    constructor(config = {}, options = {}) {
        super(config, options);
        this._engine = this._buildEngine(this.config, options);
    }

    getName() {
        return PROVIDER_NAME;
    }

    getCapabilities() {
        return ['tagging', 'description', 'ocr'];
    }

    isConfigured() {
        return Boolean(this.config.endpoint) && Boolean(this.config.model);
    }

    extendConfig(base, config) {
        return {
            ...base,
            engine: SUPPORTED_ENGINES.includes(config.engine) ? config.engine : 'openai',
            batchMode: config.batchMode === 'unified' ? 'unified' : 'separate',
            // anthropic-specific field forwarded when engine='anthropic'
            anthropicVersion: String(config.anthropicVersion || '2023-06-01'),
            // openai-specific fields forwarded when engine='openai'
            tokenField: config.tokenField === 'max_completion_tokens'
                ? 'max_completion_tokens'
                : 'max_tokens',
            jsonMode: config.jsonMode === true,
            temperature: Number.isFinite(Number(config.temperature))
                ? Number(config.temperature)
                : 0
        };
    }

    /**
     * analyze() override:
     * - capability='multi' with a capabilities array triggers unified mode
     * - any other capability falls through to the engine provider directly
     */
    async analyze(artifact, capability, context = {}) {
        if (capability === 'multi' && Array.isArray(context.capabilities)) {
            return this._analyzeUnified(artifact, context);
        }
        return this._engine.analyze(artifact, capability, context);
    }

    // -------------------------------------------------------------------------
    // Unified (batch) path
    // -------------------------------------------------------------------------

    async _analyzeUnified(artifact, context) {
        const capabilities = context.capabilities;
        const identity = this.getModelIdentity();

        try {
            this._engine.validateRequest(artifact, 'tagging');
            const execution = createExecutionSignal(
                context.signal,
                this.config.timeoutMs,
                'Unified LLM request timed out'
            );

            try {
                const bytes = await readArtifactBytes(
                    artifact,
                    execution.signal,
                    this.config.maxInputSizeBytes,
                    PROVIDER_NAME
                );
                const base64 = bytesToBase64(bytes);
                const prompt = buildUnifiedPrompt(capabilities, this.config.prompts);
                const text = await this._engine.callModel({
                    base64,
                    artifact,
                    prompt,
                    capability: 'multi',
                    context,
                    signal: execution.signal
                });
                const results = parseUnifiedResponse(text, capabilities, this.config.maxTags);

                return createAIResult({
                    status: AI_RESULT_STATUS.SUCCEEDED,
                    results,
                    provider: PROVIDER_NAME,
                    model: identity.model,
                    modelVersion: identity.modelVersion,
                    completedAt: new Date().toISOString(),
                    error: null
                });
            } finally {
                execution.dispose();
            }
        } catch (error) {
            const classified = context.signal?.aborted
                ? { category: AI_ERROR_CATEGORY.CANCELLED, retryable: false }
                : this.classifyError(error);
            this.logger.error('[AI][UnifiedLLM] unified analysis failed', {
                fileId: artifact?.fileId || '',
                capabilities,
                category: classified.category,
                retryable: classified.retryable
            });
            const emptyResults = {};
            if (capabilities.includes('tagging')) emptyResults.tagging = { tags: [] };
            if (capabilities.includes('description')) emptyResults.description = { caption: '' };
            if (capabilities.includes('ocr')) emptyResults.ocr = { text: null };
            return createAIResult({
                status: AI_RESULT_STATUS.FAILED,
                results: emptyResults,
                provider: PROVIDER_NAME,
                model: identity.model,
                modelVersion: identity.modelVersion,
                completedAt: new Date().toISOString(),
                error: {
                    category: classified.category,
                    retryable: classified.retryable,
                    message: this.safeErrorMessage(error)
                }
            });
        }
    }

    // Delegate transport hooks to the engine; never called directly for unified.
    buildTransportRequest(args) {
        return this._engine.buildTransportRequest(args);
    }

    extractText(json) {
        return this._engine.extractText(json);
    }

    _buildEngine(config, options) {
        const engine = config.engine === 'anthropic' ? 'anthropic' : 'openai';
        if (engine === 'anthropic') {
            return new AnthropicProvider(config, options);
        }
        return new OpenAICompatibleProvider(config, options);
    }
}
