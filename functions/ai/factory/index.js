import { WDTaggerProvider } from '../provider/huggingface/wdTagger.js';
import { OpenAICompatibleProvider } from '../provider/llm/openai.js';
import { AnthropicProvider } from '../provider/llm/anthropic.js';
import { UnifiedLLMProvider } from '../provider/llm/unified.js';

export const AI_PROVIDER_NAMES = Object.freeze({
    WD_TAGGER: 'wd_tagger',
    OPENAI: 'openai',
    ANTHROPIC: 'anthropic',
    LLM: 'llm'
});

export class AIFactory {
    constructor(options = {}) {
        this.logger = options.logger || console;
        this.adapter = options.adapter || null;
        this.providers = new Map();
    }

    register(name, creator) {
        if (typeof name !== 'string' || name === '') {
            throw new TypeError('AI provider name is required');
        }
        if (typeof creator !== 'function') {
            throw new TypeError('AI provider creator must be a function');
        }
        if (this.providers.has(name)) {
            throw new TypeError(`AI provider is already registered: ${name}`);
        }

        this.providers.set(name, creator);
        return this;
    }

    has(name) {
        return this.providers.has(name);
    }

    list() {
        return [...this.providers.keys()];
    }

    create(name, config = {}) {
        const creator = this.providers.get(name);
        if (!creator) {
            throw new TypeError(`Unknown AI provider: ${name}`);
        }
        return creator(config);
    }
}

export function createAIFactory(options = {}) {
    const factory = new AIFactory(options);
    const providerOptions = () => ({
        logger: factory.logger,
        adapter: factory.adapter
    });
    factory.register(
        AI_PROVIDER_NAMES.WD_TAGGER,
        config => new WDTaggerProvider(config, providerOptions())
    );
    factory.register(
        AI_PROVIDER_NAMES.OPENAI,
        config => new OpenAICompatibleProvider(config, providerOptions())
    );
    factory.register(
        AI_PROVIDER_NAMES.ANTHROPIC,
        config => new AnthropicProvider(config, providerOptions())
    );
    factory.register(
        AI_PROVIDER_NAMES.LLM,
        config => new UnifiedLLMProvider(config, providerOptions())
    );
    return factory;
}

/**
 * Enumerates registered providers with their declared capabilities. Each is
 * constructed with an empty config, so provider normalizeConfig MUST NOT throw
 * on {}. Used by the management API to validate a chosen provider and, later, to
 * drive a dynamic configuration form in the frontend.
 */
export function describeProviders(options = {}) {
    const factory = createAIFactory(options);
    return factory.list().map(name => {
        const provider = factory.create(name, {});
        return {
            name,
            capabilities: [...provider.getCapabilities()]
        };
    });
}
