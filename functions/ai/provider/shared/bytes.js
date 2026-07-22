import { ProviderError } from './errors.js';
import { waitForAbort } from './execution.js';
import { AI_ERROR_CATEGORY } from '../../types/index.js';

/**
 * Reads an artifact into a bounded Uint8Array. Accepts ArrayBuffer, typed array
 * views, Blob, or ReadableStream from the artifact reader. Enforces maxBytes and
 * observes the abort signal. Never buffers more than maxBytes for a stream.
 */
export async function readArtifactBytes(artifact, signal, maxBytes, label = 'Provider') {
    const value = await waitForAbort(artifact.read({ signal, maxBytes }), signal);

    if (value instanceof ArrayBuffer) {
        return assertByteLimit(new Uint8Array(value), maxBytes, label);
    }
    if (ArrayBuffer.isView(value)) {
        return assertByteLimit(
            new Uint8Array(value.buffer, value.byteOffset, value.byteLength),
            maxBytes,
            label
        );
    }
    if (typeof Blob !== 'undefined' && value instanceof Blob) {
        return assertByteLimit(new Uint8Array(await value.arrayBuffer()), maxBytes, label);
    }
    if (typeof ReadableStream !== 'undefined' && value instanceof ReadableStream) {
        return readStream(value, maxBytes, signal, label);
    }

    throw new ProviderError(`${label} artifact did not provide readable bytes`, {
        category: AI_ERROR_CATEGORY.INVALID_INPUT
    });
}

async function readStream(stream, maxBytes, signal, label) {
    const reader = stream.getReader();
    const chunks = [];
    let size = 0;
    const cancel = () => {
        reader.cancel(signal.reason).catch(() => {});
    };

    if (signal.aborted) cancel();
    else signal.addEventListener('abort', cancel, { once: true });

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
            size += chunk.byteLength;
            if (size > maxBytes) throw inputLimitError(label);
            chunks.push(chunk);
        }
    } finally {
        signal.removeEventListener('abort', cancel);
        try {
            reader.releaseLock();
        } catch {
            // A pending read keeps the lock until the underlying source settles.
        }
    }

    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }
    return bytes;
}

export function assertByteLimit(bytes, maxBytes, label = 'Provider') {
    if (bytes.byteLength > maxBytes) throw inputLimitError(label);
    return bytes;
}

function inputLimitError(label) {
    return new ProviderError(`${label} artifact exceeds input limit`, {
        category: AI_ERROR_CATEGORY.INVALID_INPUT
    });
}

/**
 * Encodes bytes to a base64 string in fixed-size chunks so a multi-megabyte
 * image does not overflow the call stack via String.fromCharCode(...spread).
 * Returns raw base64 with no data: prefix; callers add the prefix if needed.
 */
export function bytesToBase64(bytes) {
    let binary = '';
    const chunkSize = 0x8000;
    for (let offset = 0; offset < bytes.byteLength; offset += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
    }
    return btoa(binary);
}
