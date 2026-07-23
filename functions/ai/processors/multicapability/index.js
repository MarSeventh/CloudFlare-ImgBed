import { MetadataProcessor } from '../index.js';
import { createMetadataPatch } from '../../patch/index.js';
import { AI_RESULT_STATUS } from '../../types/index.js';

/**
 * Handles unified-mode LLM execution: one provider.analyze('multi') call that
 * returns results for all requested capabilities at once.
 *
 * The returned result.results object is keyed by capability name:
 *   { tagging: { tags: [...] }, description: { caption: '...' }, ocr: { text: '...' } }
 *
 * Each key is extracted into a patch that MetadataService merges into the file
 * metadata, matching the same path that per-capability processors produce.
 */
export class MultiCapabilityProcessor extends MetadataProcessor {
    /**
     * @param {import('../../provider/index.js').AIProvider} provider - UnifiedLLMProvider
     * @param {string[]} capabilities - e.g. ['tagging', 'description', 'ocr']
     */
    constructor(provider, capabilities) {
        super();
        this.provider = provider;
        this.capabilities = capabilities;
    }

    get field() {
        return 'multi';
    }

    get capability() {
        return 'multi';
    }

    async process({ artifact, signal, fetch } = {}) {
        const result = await this.provider.analyze(artifact, 'multi', {
            signal,
            fetch,
            capabilities: this.capabilities
        });

        if (result.status === AI_RESULT_STATUS.FAILED) {
            return { patch: createMetadataPatch({}), result };
        }

        // Build a merged patch from all returned capability results
        const patchData = {};
        const capResults = result.results || {};

        if (this.capabilities.includes('tagging')) {
            const tags = Array.isArray(capResults.tagging?.tags) ? capResults.tagging.tags : [];
            patchData.tags = tags;
        }
        if (this.capabilities.includes('description')) {
            const caption = typeof capResults.description?.caption === 'string'
                ? capResults.description.caption
                : '';
            patchData.description = caption;
        }
        if (this.capabilities.includes('ocr')) {
            patchData.ocr = capResults.ocr?.text ?? null;
        }

        return { patch: createMetadataPatch(patchData), result };
    }
}
