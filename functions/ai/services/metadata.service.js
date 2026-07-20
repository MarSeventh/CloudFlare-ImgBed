import { mergeTags, sanitizeAITags } from '../../utils/tagHelpers.js';

export const AI_METADATA_VERSION = 1;

const AI_TASK_KEY_PREFIX = 'manage@aiTask@';
const KV_METADATA_MAX_BYTES = 1024;

/**
 * The single writer of AI-derived metadata. Consumes a merged result/patch,
 * merges tags into the existing Tags array within KV limits, and stores the
 * bounded task-state envelope at manage@aiTask@<fileId>.
 */
export class MetadataService {
    constructor(adapter) {
        this.adapter = adapter;
        this.db = adapter.database;
    }

    async saveAIResult(fileId, aiMetadata, options = {}) {
        const db = this.db;
        const current = await db.getWithMetadata(fileId);
        if (!current?.metadata) {
            return { updated: false, reason: 'file_not_found' };
        }

        const currentAI = await readAIState(db, fileId) || current.metadata.ai;
        if (options.expectedTaskId && currentAI?.taskId !== options.expectedTaskId) {
            const currentCompletedAt = Date.parse(currentAI?.completedAt || '');
            const queuedAt = Date.parse(options.queuedAt || '');
            if (Number.isFinite(currentCompletedAt) && Number.isFinite(queuedAt) &&
                currentCompletedAt > queuedAt) {
                return { updated: false, reason: 'newer_result_exists' };
            }
        }

        const { ai: legacyAI, ...metadata } = current.metadata;

        // AI 标签并入既有 Tags，复用现有标签体系（搜索/展示/自动补全）。
        const aiTagNames = extractAITagNames(aiMetadata);
        let tagsChanged = false;
        if (aiTagNames.length) {
            const merged = mergeAITagsWithinMetadataLimit(this.adapter.env, metadata, aiTagNames);
            metadata.Tags = merged.tags;
            tagsChanged = merged.changed;
            if (merged.dropped > 0) {
                console.warn('[AI] Some tags were omitted to fit KV metadata limits', {
                    fileId,
                    dropped: merged.dropped
                });
            }
        }

        if (legacyAI !== undefined || tagsChanged) {
            await db.put(fileId, current.value ?? '', { metadata });
        }
        await db.put(aiTaskKey(fileId), JSON.stringify({
            ...aiMetadata,
            metadataVersion: AI_METADATA_VERSION
        }));
        return { updated: true };
    }
}

export async function readAIResultStateFrom(db, fileId) {
    return readAIState(db, fileId);
}

// --- helpers moved verbatim from integration/upload.js ---

// 从 AI 结果中取出标签名并清洗为合法 tag（角色标签含括号等会被转换而非丢弃）。
function extractAITagNames(aiMetadata) {
    const tags = aiMetadata?.results?.tags;
    if (!Array.isArray(tags)) return [];

    const names = tags
        .map(tag => (typeof tag === 'string' ? tag : tag?.name))
        .filter(name => typeof name === 'string' && name.length > 0);

    return sanitizeAITags(names);
}

function mergeAITagsWithinMetadataLimit(env, metadata, aiTagNames) {
    const existing = Array.isArray(metadata.Tags) ? metadata.Tags : [];
    if (!isKVDatabase(env)) {
        const tags = mergeTags(existing, aiTagNames, 'add');
        return { tags, changed: !sameTags(existing, tags), dropped: 0 };
    }

    let tags = [...existing];
    const newTags = aiTagNames.filter(tag => !mergeTags(existing, [tag], 'add')
        .every((item, index) => item === existing[index]));
    let added = 0;
    for (const tag of newTags) {
        const candidate = mergeTags(tags, [tag], 'add');
        if (sameTags(tags, candidate)) continue;
        if (metadataSize({ ...metadata, Tags: candidate }) > KV_METADATA_MAX_BYTES) continue;
        tags = candidate;
        added++;
    }
    return {
        tags,
        changed: !sameTags(existing, tags),
        dropped: newTags.length - added
    };
}

function isKVDatabase(env) {
    return typeof env.img_url?.get === 'function';
}

function metadataSize(metadata) {
    return new TextEncoder().encode(JSON.stringify(metadata)).byteLength;
}

function sameTags(left, right) {
    return left.length === right.length && left.every((tag, index) => tag === right[index]);
}

function aiTaskKey(fileId) {
    return `${AI_TASK_KEY_PREFIX}${fileId}`;
}

async function readAIState(db, fileId) {
    const value = await db.get(aiTaskKey(fileId));
    if (!value) return null;
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}
