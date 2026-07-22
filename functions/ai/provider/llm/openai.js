import { LLMProvider, LLMProviderError } from './base.js';
import { AI_ERROR_CATEGORY } from '../../types/index.js';

const PROVIDER_NAME = 'openai';
const DEFAULT_ENDPOINT = 'https://api.openai.com/v1/chat/completions';

/**
 * OpenAI-compatible /chat/completions vision provider. The full endpoint URL is
 * operator-supplied, so the same provider covers OpenAI, OpenRouter, local
 * gateways, and Azure. Non-Bearer auth (Azure api-key, OpenRouter extra headers)
 * is expressed through config.headers.
 */
export class OpenAICompatibleProvider extends LLMProvider {
    getName() {
        return PROVIDER_NAME;
    }

    extendConfig(base, config) {
        return {
            ...base,
            endpoint: base.endpoint || DEFAULT_ENDPOINT,
            // Newer OpenAI models reject max_tokens and require
            // max_completion_tokens; make the field name configurable.
            tokenField: config.tokenField === 'max_completion_tokens'
                ? 'max_completion_tokens'
                : 'max_tokens',
            // response_format is not universally supported; opt in only.
            jsonMode: config.jsonMode === true,
            temperature: Number.isFinite(Number(config.temperature))
                ? Number(config.temperature)
                : 0
        };
    }

    buildTransportRequest({ base64, mimeType, prompt, model, maxTokens, config }) {
        const headers = new Headers(config.headers);
        headers.set('content-type', 'application/json');
        headers.set('accept', 'application/json');
        if (config.apiKey && !headers.has('authorization')) {
            headers.set('authorization', `Bearer ${config.apiKey}`);
        }

        const body = {
            model,
            [config.tokenField]: maxTokens,
            temperature: config.temperature,
            messages: [{
                role: 'user',
                content: [
                    { type: 'text', text: prompt },
                    {
                        type: 'image_url',
                        image_url: { url: `data:${mimeType};base64,${base64}` }
                    }
                ]
            }]
        };
        if (config.jsonMode) {
            body.response_format = { type: 'json_object' };
        }

        return { url: config.endpoint, headers, body };
    }

    extractText(json) {
        const choice = Array.isArray(json?.choices) ? json.choices[0] : null;
        const content = choice?.message?.content;
        const text = typeof content === 'string'
            ? content
            : extractFromContentArray(content);
        if (!text) {
            throw new LLMProviderError('OpenAI response contained no text', {
                category: AI_ERROR_CATEGORY.PROVIDER
            });
        }
        return text;
    }
}

// Some gateways return content as an array of parts rather than a string.
function extractFromContentArray(content) {
    if (!Array.isArray(content)) return '';
    return content
        .map(part => (typeof part === 'string' ? part : part?.text || ''))
        .join('')
        .trim();
}
