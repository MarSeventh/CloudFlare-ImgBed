export function normalizeBatchFileIds(values, maxBatchSize) {
    if (!Array.isArray(values)) return [];
    const normalized = [];
    const seen = new Set();

    for (const value of values) {
        if (typeof value !== 'string') {
            throw new Error('fileIds must be an array of strings');
        }

        const fileId = value.trim().replace(/^\/+|\/+$/g, '');
        if (fileId && !seen.has(fileId)) {
            seen.add(fileId);
            normalized.push(fileId);
        }
    }

    if (normalized.length > maxBatchSize) {
        throw new Error(`A maximum of ${maxBatchSize} files can be deleted at once`);
    }
    return normalized;
}

export async function mapConcurrent(values, concurrency, operation) {
    const results = new Array(values.length);
    if (values.length === 0) return results;

    const workerCount = Math.min(
        Math.max(1, Math.floor(Number(concurrency) || 1)),
        values.length
    );
    let nextIndex = 0;
    const workers = Array.from({ length: workerCount }, async () => {
        while (nextIndex < values.length) {
            const index = nextIndex++;
            results[index] = await operation(values[index]);
        }
    });
    await Promise.all(workers);
    return results;
}
