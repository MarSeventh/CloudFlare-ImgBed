import { mergeTags, sanitizeAITags } from '../../utils/tagHelpers.js';
import { addFileToIndex } from '../../utils/indexManager.js';

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

        // Persist description and ocr fields when the AI result contains them.
        // On KV backends, trim these to fit the 1024-byte metadata cap alongside
        // the tags already written above; on non-KV backends there's no cap so
        // we store the full string.
        const description = extractDescription(aiMetadata);
        let descriptionChanged = false;
        if (typeof description === 'string' && description) {
            const fitted = fitStringIntoMetadata(this.adapter.env, metadata, 'Description', description);
            if (fitted !== null) {
                metadata.Description = fitted;
                descriptionChanged = true;
                if (fitted.length < description.length) {
                    console.warn('[AI] Description truncated to fit KV metadata limit', {
                        fileId,
                        original: description.length,
                        stored: fitted.length
                    });
                }
            }
        }

        const ocr = extractOCR(aiMetadata);
        let ocrChanged = false;
        if (ocr !== null) {
            const fitted = fitStringIntoMetadata(this.adapter.env, metadata, 'OCR', ocr);
            if (fitted !== null) {
                metadata.OCR = fitted;
                ocrChanged = true;
                if (fitted.length < ocr.length) {
                    console.warn('[AI] OCR text truncated to fit KV metadata limit', {
                        fileId,
                        original: ocr.length,
                        stored: fitted.length
                    });
                }
            }
        }

        if (legacyAI !== undefined || tagsChanged || descriptionChanged || ocrChanged) {
            await db.put(fileId, current.value ?? '', { metadata });
        }
        await db.put(aiTaskKey(fileId), JSON.stringify({
            ...aiMetadata,
            metadataVersion: AI_METADATA_VERSION
        }));

        // 标签变更后同步搜索索引：画廊/列表/搜索/自动补全读的是预建索引快照，
        // 不写索引 AI 标签就不会出现在搜索里，直到下次重建。与既有标签 API
        // 一致，仅记录 add 操作，由后续 readIndex/merge 合入快照。AI 已在后台
        // 生命周期内执行，因此内联 await 而非再 fire-and-forget，避免响应结束
        // 后索引操作被中止而丢失。
        if (tagsChanged) {
            try {
                await addFileToIndex({ env: this.adapter.env }, fileId, metadata);
            } catch (error) {
                console.error('[AI] Failed to record index operation for AI tags', {
                    fileId,
                    message: error?.message || 'Unknown error'
                });
            }
        }
        return { updated: true };
    }
}

export async function readAIResultStateFrom(db, fileId) {
    return readAIState(db, fileId);
}

// --- helpers moved verbatim from integration/upload.js ---

// 从 AI 结果中取出标签名并清洗为合法 tag（角色标签含括号等会被转换而非丢弃）。
// 支持两种 results 形状：
//   - 独立模式: { tags: [{name, confidence}] }
//   - 统一模式: { tagging: { tags: [...] }, description: {...}, ocr: {...} }
function extractAITagNames(aiMetadata) {
    const results = aiMetadata?.results;
    const tags = results?.tags ?? results?.tagging?.tags;
    if (!Array.isArray(tags)) return [];

    const names = tags
        .map(tag => (typeof tag === 'string' ? tag : tag?.name))
        .filter(name => typeof name === 'string' && name.length > 0);

    return sanitizeAITags(names);
}

// Extracts an AI-generated description string from either result shape.
function extractDescription(aiMetadata) {
    const results = aiMetadata?.results;
    if (!results) return null;
    const caption = results.description?.caption ?? results.caption;
    return typeof caption === 'string' && caption.trim() ? caption.trim() : null;
}

// Extracts OCR text from either result shape. Returns null when no text was found.
function extractOCR(aiMetadata) {
    const results = aiMetadata?.results;
    if (!results) return null;
    const text = results.ocr?.text ?? results.text;
    if (text === null) return null;
    return typeof text === 'string' && text.trim() ? text.trim() : null;
}

// Returns the largest prefix of `value` such that setting metadata[field] to
// it keeps the JSON-encoded metadata within KV's 1024-byte cap. Returns null
// when even an empty string won't fit (extremely unlikely; the caller then
// skips the write). On non-KV backends there is no cap, so the full value is
// returned unchanged.
function fitStringIntoMetadata(env, metadata, field, value) {
    if (!isKVDatabase(env)) return value;

    const probe = { ...metadata, [field]: value };
    if (metadataSize(probe) <= KV_METADATA_MAX_BYTES) return value;

    let low = 0;
    let high = value.length;
    let best = null;
    while (low <= high) {
        const mid = (low + high) >> 1;
        const candidate = value.slice(0, mid);
        if (metadataSize({ ...metadata, [field]: candidate }) <= KV_METADATA_MAX_BYTES) {
            best = candidate;
            low = mid + 1;
        } else {
            high = mid - 1;
        }
    }
    return best;
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
