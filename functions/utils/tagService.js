import { getDatabase } from './databaseAdapter.js';
import { batchAddFilesToIndex } from './indexManager.js';
import { cleanPersistedMetadata } from './metadata/metadataSecurity.js';
import { mergeTags, validateTag } from './tagHelpers.js';
import { purgePublicFileListCache, purgeRandomFileListCache } from './purgeCache.js';
import { APIError, errorResult } from './apiResponse.js';

const encoder = new TextEncoder();
export function validateFileId(fileId) {
    if (typeof fileId !== 'string' || !fileId || encoder.encode(fileId).length > 512 ||
        fileId.startsWith('manage@') || fileId.startsWith('/') || fileId.includes('\\') ||
        fileId.split('/').some(part => !part || part === '.' || part === '..') || /[\u0000-\u001f]/.test(fileId)) {
        throw new APIError('INVALID_FILE', 'Invalid file ID.');
    }
}

// Detect replacement/rename while retaining tags edited during inference.
export async function fileIdentity(metadata) {
    const fields = ['TimeStamp', 'FileName', 'FileType', 'FileSizeBytes', 'FileSize', 'Channel', 'ChannelName', 'TgFileId', 'S3FileKey', 'HfFilePath', 'WebDAVFilePath', 'ExternalLink'];
    const bytes = await crypto.subtle.digest('SHA-256', encoder.encode(JSON.stringify(fields.map(key => metadata[key] ?? null))));
    return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function validateTagItems(items, { maxItems = 1000, maxTags = 1000, maxTagLength = 512 } = {}) {
    if (!Array.isArray(items) || !items.length || items.length > maxItems) throw new APIError('INVALID_INPUT', `Provide between 1 and ${maxItems} files.`);
    const ids = new Set();
    for (const item of items) {
        validateFileId(item?.fileId);
        if (ids.has(item.fileId)) throw new APIError('INVALID_INPUT', 'Duplicate file IDs.');
        ids.add(item.fileId);
        if (!Array.isArray(item.tags) || item.tags.length > maxTags || item.tags.some(tag => !validateTag(tag) || Array.from(tag).length > maxTagLength)) {
            throw new APIError('INVALID_TAGS', `Tags must be valid strings, at most ${maxTagLength} characters each and ${maxTags} per file.`);
        }
    }
}

export async function applyTagItems(context, items, action = 'add', limits = {}) {
    validateTagItems(items, limits);
    if (!['add', 'set', 'remove'].includes(action)) throw new APIError('INVALID_ACTION', 'Use add, set or remove.');
    const db = getDatabase(context.env);
    const files = [];
    const results = [];
    const dirs = new Set();
    for (const item of items) {
        try {
            const record = await db.getWithMetadata(item.fileId);
            if (!record?.metadata) throw new APIError('FILE_NOT_FOUND', 'File no longer exists.', 404);
            if (item.sourceIdentity && await fileIdentity(record.metadata) !== item.sourceIdentity) throw new APIError('FILE_CHANGED', 'File changed. Generate suggestions again.', 409);
            const tags = mergeTags(record.metadata.Tags || [], item.tags, action);
            const metadata = cleanPersistedMetadata({ ...record.metadata, Tags: tags });
            const changed = JSON.stringify(record.metadata.Tags || []) !== JSON.stringify(tags);
            if (context.env.img_url && encoder.encode(JSON.stringify(metadata)).length > 1024) throw new APIError('METADATA_TOO_LARGE', 'File metadata exceeds the KV 1 KB limit. Reduce the selected tags.', 413);
            if (changed) {
                await db.put(item.fileId, record.value, { metadata });
                const dir = metadata.Directory || item.fileId.slice(0, Math.max(0, item.fileId.lastIndexOf('/')));
                dirs.add(dir);
                dirs.add('');
                const segments = dir.split('/').filter(Boolean);
                while (segments.length > 1) { segments.pop(); dirs.add(segments.join('/')); }
            }
            // A retry after an index-log failure must also repair unchanged tags.
            if (changed || item.repairIndex === true) files.push({ fileId: item.fileId, metadata });
            results.push({ fileId: item.fileId, tags, saved: true, changed, indexPending: false });
        } catch (error) { results.push({ fileId: item.fileId, saved: false, error: errorResult(error) }); }
    }
    if (files.length) {
        const indexed = await batchAddFilesToIndex(context, files, { skipExisting: false });
        if (!indexed.success) {
            const affected = new Set(files.map(file => file.fileId));
            for (const result of results) if (affected.has(result.fileId)) result.indexPending = true;
        }
    }
    if (dirs.size) {
        const origin = new URL(context.request.url).origin;
        const invalidation = Promise.all([purgePublicFileListCache(origin, ...dirs), purgeRandomFileListCache(origin, ...dirs)]);
        if (context.waitUntil) context.waitUntil(invalidation); else await invalidation;
    }
    return {
        success: results.every(result => result.saved && !result.indexPending), total: items.length,
        updated: results.filter(result => result.saved && result.changed).length, results,
        errors: results.filter(result => !result.saved || result.indexPending).map(result => ({ fileId: result.fileId, error: result.error?.message || 'Tags saved; index synchronization needs retry.' }))
    };
}
