import { getAIConfig, resolveAPIKey } from './config.js';
import { capabilities, assemblePrompt } from './capabilities.js';
import { APIError } from '../apiResponse.js';
import { callOpenAICompatible } from './providers/openaiCompatible.js';

export function createAIContext(env, { config, fetcher } = {}) {
    let configPromise;
    const load = () => configPromise ??= Promise.resolve(config ?? getAIConfig(env));
    const keyPromises = new Map();
    return {
        getConfig: load,
        async invoke({ capability, input = {}, modelId, signal, deadlineAt = Date.now() + 25000 }) {
            const settings = await load();
            const test = capability === 'connection.test';
            const definition = capabilities[capability];
            const options = settings.capabilities[capability];
            if (!test && (!settings.enabled || !options?.enabled)) throw new APIError('AI_DISABLED', 'AI tagging is disabled.', 503);
            if (!test && !definition) throw new APIError('UNSUPPORTED_CAPABILITY', 'Unsupported AI capability.');
            const model = settings.models.find(item => item.id === (modelId ?? options?.modelId));
            const provider = settings.providers.find(item => item.id === model?.providerId);
            if (!model || !provider?.enabled) throw new APIError('INVALID_CONFIG', 'No enabled provider/model is selected.', 503);
            if (!test && definition.vision && (!model.vision || !input.image)) throw new APIError('UNSUPPORTED_INPUT', 'A vision model and an image are required.');
            const timeout = Math.min(settings.execution.providerTimeoutMs, deadlineAt - Date.now());
            if (timeout < 1000) throw new APIError('TIMEOUT', 'Request time budget exhausted. Retry this image.', 504);
            const controller = new AbortController();
            const abort = () => controller.abort();
            if (signal?.aborted) abort();
            signal?.addEventListener('abort', abort, { once: true });
            const timer = setTimeout(abort, timeout);
            const started = Date.now();
            try {
                if (!keyPromises.has(provider.id)) keyPromises.set(provider.id, resolveAPIKey(provider, env));
                const apiKey = await keyPromises.get(provider.id);
                const template = test ? '' : settings.promptOverrides[definition.promptId]?.template ?? definition.defaultPrompt;
                const prompt = test ? 'Reply with the word OK.' : assemblePrompt(definition, template, {
                    language: options.language === 'en' ? 'English' : 'Simplified Chinese', maxTags: options.maxTags,
                    preferredTags: JSON.stringify(options.preferredTags)
                });
                const response = await callOpenAICompatible({ provider, model, apiKey, prompt, image: input.image, signal: controller.signal, env, fetcher });
                const data = test ? { connected: true } : definition.parse(response.text, options);
                return { data, modelId: model.id, usage: response.usage, elapsedMs: Date.now() - started };
            } catch (error) {
                if (controller.signal.aborted) throw new APIError('TIMEOUT', 'AI request timed out or was cancelled.', 504);
                if (error instanceof APIError) throw error;
                throw new APIError('PROVIDER_UNAVAILABLE', 'Cannot reach the AI provider.', 502);
            } finally {
                clearTimeout(timer);
                signal?.removeEventListener('abort', abort);
            }
        }
    };
}
