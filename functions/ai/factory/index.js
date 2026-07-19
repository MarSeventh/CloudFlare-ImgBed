import { WDTaggerProvider } from '../provider/wdTagger.js';

export const AI_PROVIDER_NAMES = Object.freeze({
    WD_TAGGER: 'wd_tagger'
});

export class AIFactory {
    constructor(options = {}) {
        this.logger = options.logger || console;
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
    factory.register(
        AI_PROVIDER_NAMES.WD_TAGGER,
        config => new WDTaggerProvider(config, { logger: factory.logger })
    );
    return factory;
}
