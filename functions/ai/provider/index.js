import { AI_ERROR_CATEGORY } from '../types/index.js';

/** Base provider contract. Concrete providers are added in later stages. */
export class AIProvider {
    /** @returns {string} */
    getName() {
        return '';
    }

    /** @returns {{ model: string, modelVersion: string }} */
    getModelIdentity() {
        return { model: '', modelVersion: '' };
    }

    /** @returns {ReadonlyArray<string>} */
    getCapabilities() {
        return [];
    }

    /** @returns {{ acceptedMimeTypes: string[], maxInputSizeBytes: number }} */
    getInputRequirements() {
        return { acceptedMimeTypes: [], maxInputSizeBytes: 0 };
    }

    /** @returns {{ timeoutMs: number, maxRetries: number }} */
    getExecutionPolicy() {
        return { timeoutMs: 0, maxRetries: 0 };
    }

    /** @returns {{ category: string, retryable: boolean }} */
    classifyError() {
        return { category: AI_ERROR_CATEGORY.UNKNOWN, retryable: false };
    }

    /**
     * @param {import('../types/index.js').AIArtifactInput} artifact
     * @param {string} capability
     * @param {import('../types/index.js').AIProviderContext} context
     * @returns {Promise<import('../types/index.js').AIResultEnvelope>}
     */
    async analyze(artifact, capability, context = {}) {
        throw new Error('AIProvider.analyze is not implemented');
    }
}
