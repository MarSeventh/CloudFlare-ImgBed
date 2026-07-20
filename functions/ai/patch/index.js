/**
 * A MetadataPatch is an incremental, provider-neutral update produced by one
 * Processor. Processors never write the database; the Metadata Service merges
 * patches and performs the single write.
 */
export const METADATA_PATCH_FIELDS = Object.freeze(['tags', 'caption', 'dominantColor', 'rating']);

export function createMetadataPatch(input = {}) {
    const patch = {};
    for (const field of METADATA_PATCH_FIELDS) {
        if (input[field] !== undefined) patch[field] = input[field];
    }
    return Object.freeze(patch);
}

export function mergeMetadataPatches(patches = []) {
    const merged = {};
    for (const patch of patches) {
        if (!patch) continue;
        for (const field of METADATA_PATCH_FIELDS) {
            if (patch[field] === undefined) continue;
            if (field === 'tags') {
                merged.tags = unionTags(Array.isArray(merged.tags) ? merged.tags : [], patch.tags);
            } else {
                merged[field] = patch[field];
            }
        }
    }
    return Object.freeze(merged);
}

function unionTags(existing, incoming) {
    const seen = new Set(existing.map(tagName).filter(Boolean));
    const result = [...existing];
    for (const tag of incoming || []) {
        const name = tagName(tag);
        if (!name || seen.has(name)) continue;
        seen.add(name);
        result.push(tag);
    }
    return result;
}

function tagName(tag) {
    return typeof tag === 'string' ? tag : tag?.name || '';
}
