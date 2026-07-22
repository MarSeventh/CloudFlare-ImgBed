import { LLMProvider, LLMProviderError } from './base.js';
import { AI_ERROR_CATEGORY } from '../../types/index.js';

const PROVIDER_NAME = 'anthropic';
const DEFAULT_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-haiku-4-5';
const DEFAULT_ANTHROPIC_VERSION = '2023-06-01';

/**
 * Anthropic native Messages API vision provider. Auth differs from OpenAI:
 * x-api-key + anthropic-version headers instead of Authorization: Bearer.
 * The prompt is placed in the top-level system field; the image is a base64
 * source block.
 */
export class AnthropicProvider extends LLMProvider {
    getName() {
        return PROVIDER_NAME;
    }

    extendConfig(base, config) {
        return {
            ...base,
            endpoint: base.endpoint || DEFAULT_ENDPOINT,
            model: base.model || DEFAULT_MODEL,
            anthropicVersion: String(config.anthropicVersion || DEFAULT_ANTHROPIC_VERSION)
        };
    }

    buildTransportRequest({ base64, mimeType, prompt, model, maxTokens, config }) {
        const headers = new Headers(config.headers);
        headers.set('content-type', 'application/json');
        headers.set('accept', 'application/json');
        headers.set('anthropic-version', config.anthropicVersion);
        if (config.apiKey && !headers.has('x-api-key')) {
            headers.set('x-api-key', config.apiKey);
        }

        const body = {
            model,
            max_tokens: maxTokens,
            system: prompt,
            messages: [{
                role: 'user',
                content: [
                    {
                        type: 'image',
                        source: {
                            type: 'base64',
                            media_type: mimeType,
                            data: base64
                        }
                    },
                    { type: 'text', text: 'Analyze the image per the system instructions.' }
                ]
            }]
        };

        return { url: config.endpoint, headers, body };
    }

    extractText(json) {
        // A refusal returns HTTP 200 with stop_reason "refusal" and no usable text.
        if (json?.stop_reason === 'refusal') {
            throw new LLMProviderError('Anthropic refused the request', {
                category: AI_ERROR_CATEGORY.PROVIDER
            });
        }
        const blocks = Array.isArray(json?.content) ? json.content : [];
        const text = blocks
            .filter(block => block?.type === 'text' && typeof block.text === 'string')
            .map(block => block.text)
            .join('')
            .trim();
        if (!text) {
            throw new LLMProviderError('Anthropic response contained no text', {
                category: AI_ERROR_CATEGORY.PROVIDER
            });
        }
        return text;
    }
}
