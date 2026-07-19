/** Storage-neutral input contract for AI providers. */
export class AIArtifact {
    constructor(input = {}) {
        const {
            fileId = '',
            fileName = '',
            mimeType = '',
            size = 0,
            channel = '',
            reader = null
        } = input;

        this.fileId = fileId;
        this.fileName = fileName;
        this.mimeType = mimeType;
        this.size = size;
        this.channel = channel;
        this.reader = reader;
    }

    /**
     * @param {{ signal?: AbortSignal, maxBytes?: number, offset?: number }} options
     * @returns {Promise<ReadableStream|ArrayBuffer|Uint8Array|null>}
     */
    async read(options = {}) {
        if (typeof this.reader !== 'function') return null;
        return this.reader(options);
    }

    /** @returns {Promise<void>} */
    async dispose() {
        return undefined;
    }
}

export function createArtifact(input = {}) {
    if (typeof input.fileId !== 'string' || input.fileId === '') {
        throw new TypeError('AIArtifact.fileId is required');
    }

    if (input.reader !== undefined && typeof input.reader !== 'function') {
        throw new TypeError('AIArtifact.reader must be a function');
    }

    return new AIArtifact(input);
}
