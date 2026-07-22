export function normalizeBatchFileIds(values, maxBatchSize) {
    if (!Array.isArray(values)) return [];
    const normalized = [...new Set(values
        .map((value) => String(value || '').trim().replace(/^\/+|\/+$/g, ''))
        .filter(Boolean))];
    if (normalized.length > maxBatchSize) {
        throw new Error(`A maximum of ${maxBatchSize} files can be deleted at once`);
    }
    return normalized;
}

export async function mapConcurrent(values, concurrency, operation) {
    const results = new Array(values.length);
    let nextIndex = 0;
    const workers = Array.from({ length: Math.min(concurrency, values.length) }, async () => {
        while (nextIndex < values.length) {
            const index = nextIndex++;
            results[index] = await operation(values[index]);
        }
    });
    await Promise.all(workers);
    return results;
}
