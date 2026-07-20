import { MetadataProcessor } from '../index.js';
import { createMetadataPatch } from '../../patch/index.js';
import { AI_RESULT_STATUS } from '../../types/index.js';

/** Produces metadata.tags from a tagging Provider (e.g. WD Tagger). */
export class TagProcessor extends MetadataProcessor {
    constructor(provider) {
        super();
        this.provider = provider;
    }

    get field() {
        return 'tags';
    }

    get capability() {
        return 'tagging';
    }

    async process({ artifact, signal, fetch } = {}) {
        const result = await this.provider.analyze(artifact, this.capability, { signal, fetch });
        if (result.status === AI_RESULT_STATUS.FAILED) {
            return { patch: createMetadataPatch({}), result };
        }
        const tags = Array.isArray(result.results?.tags) ? result.results.tags : [];
        return { patch: createMetadataPatch({ tags }), result };
    }
}
