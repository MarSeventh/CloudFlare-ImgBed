/**
 * Tag Management Helper Functions
 * Provides utilities for validating, normalizing, and managing tags
 */

/**
 * Validate tag format
 * Tags must contain only alphanumeric characters, underscores, and hyphens
 * @param {string} tag - The tag to validate
 * @returns {boolean} - Whether the tag is valid
 */
export function validateTag(tag) {
    if (!tag || typeof tag !== 'string') {
        return false;
    }

    // Allow alphanumeric, underscore, hyphen, and Chinese/Japanese/Korean characters
    return /^[\w\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af-]+$/.test(tag);
}

/**
 * Normalize tags
 * - Convert to lowercase
 * - Trim whitespace
 * - Remove duplicates
 * - Filter out invalid tags
 * @param {string[]} tags - Array of tags to normalize
 * @returns {string[]} - Normalized array of unique tags
 */
export function normalizeTags(tags) {
    if (!Array.isArray(tags)) {
        return [];
    }

    const normalized = tags
        .filter(tag => tag && typeof tag === 'string')
        .map(tag => tag.toLowerCase().trim())
        .filter(tag => validateTag(tag));

    // Remove duplicates while preserving order
    return [...new Set(normalized)];
}

/**
 * Merge tags based on action
 * @param {string[]} existingTags - Current tags on the file
 * @param {string[]} newTags - Tags to add/remove/set
 * @param {string} action - 'set', 'add', or 'remove'
 * @returns {string[]} - Merged tags array
 */
export function mergeTags(existingTags, newTags, action) {
    const existing = Array.isArray(existingTags) ? existingTags : [];
    const normalized = normalizeTags(newTags);

    switch (action) {
        case 'set':
            // Replace all tags with new tags
            return normalized;

        case 'add':
            // Add new tags to existing, remove duplicates
            return normalizeTags([...existing, ...normalized]);

        case 'remove':
            // Remove specified tags from existing
            const toRemove = new Set(normalized);
            return existing.filter(tag => !toRemove.has(tag.toLowerCase()));

        default:
            throw new Error(`Invalid action: ${action}. Must be 'set', 'add', or 'remove'`);
    }
}

/**
 * Parse search query to extract tags and keywords
 * Input: "vacation #photo #2024"
 * Output: { keywords: "vacation", tags: ["photo", "2024"] }
 * @param {string} searchString - The search query string
 * @returns {Object} - Object with keywords and tags arrays
 */
export function parseSearchQuery(searchString) {
    if (!searchString || typeof searchString !== 'string') {
        return { keywords: '', tags: [] };
    }

    const tags = [];

    const tagRegex = /#([\w\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af\.\+\-]+)/g;

    const keywords = searchString.replace(tagRegex, (match, tagContent) => {
        tags.push(tagContent.toLowerCase()); // 收集 tag
        return ' '; // 用一个空格替换 tag，避免粘连，稍后统一清洗
    })
    .replace(/\s+/g, ' ') // 将中间所有的连续空格合并为一个
    .trim();

    return { 
        keywords, 
        tags: normalizeTags(tags)
    };
}

/**
 * Check if a file matches tag filter
 * @param {string[]} fileTags - Tags on the file
 * @param {string[]} requiredTags - Tags that must be present
 * @returns {boolean} - Whether file has all required tags
 */
export function matchesTags(fileTags, requiredTags) {
    if (!Array.isArray(requiredTags) || requiredTags.length === 0) {
        return true; // No tag filter
    }

    if (!Array.isArray(fileTags) || fileTags.length === 0) {
        return false; // File has no tags but filter requires tags
    }

    const fileTagsLower = fileTags.map(t => t.toLowerCase());
    return requiredTags.every(tag => fileTagsLower.includes(tag.toLowerCase()));
}

/**
 * Extract all unique tags from an array of files
 * @param {Array} files - Array of file objects with metadata.Tags
 * @returns {string[]} - Sorted array of unique tags
 */
export function extractUniqueTags(files) {
    if (!Array.isArray(files)) {
        return [];
    }

    const allTags = new Set();

    files.forEach(file => {
        if (file && file.metadata && Array.isArray(file.metadata.Tags)) {
            file.metadata.Tags.forEach(tag => {
                if (tag && typeof tag === 'string') {
                    allTags.add(tag.toLowerCase().trim());
                }
            });
        }
    });

    return Array.from(allTags).sort();
}

/**
 * Filter tags by prefix (for autocomplete)
 * @param {string[]} tags - Array of all available tags
 * @param {string} prefix - Prefix to filter by
 * @param {number} limit - Maximum number of results
 * @returns {string[]} - Filtered tags
 */
export function filterTagsByPrefix(tags, prefix, limit = 20) {
    if (!Array.isArray(tags) || !prefix || typeof prefix !== 'string') {
        return [];
    }

    const prefixLower = prefix.toLowerCase().trim();

    return tags
        .filter(tag => tag.toLowerCase().startsWith(prefixLower))
        .slice(0, limit);
}
