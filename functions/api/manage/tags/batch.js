import { purgeCFCache } from "../../../utils/purgeCache.js";
import { batchAddFilesToIndex } from "../../../utils/indexManager.js";
import { getDatabase } from "../../../utils/databaseAdapter.js";
import { mergeTags, validateTag } from "../../../utils/tagHelpers.js";

/**
 * Batch Tag Management API
 *
 * POST /api/manage/tags/batch - Update tags for multiple files
 *
 * Request body format:
 * {
 *   fileIds: ["file1", "file2", ...],
 *   action: "set" | "add" | "remove",
 *   tags: ["tag1", "tag2", ...]
 * }
 */
export async function onRequest(context) {
    const {
        request,
        env,
        waitUntil,
    } = context;

    const url = new URL(request.url);

    if (request.method !== 'POST') {
        return new Response(JSON.stringify({
            error: 'Method not allowed',
            allowedMethods: ['POST']
        }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const db = getDatabase(env);

    try {
        // Parse request body
        const body = await request.json();
        const { fileIds = [], action = 'set', tags = [] } = body;

        // Validate fileIds
        if (!Array.isArray(fileIds) || fileIds.length === 0) {
            return new Response(JSON.stringify({
                error: 'Invalid fileIds',
                message: 'fileIds must be a non-empty array of file identifiers'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Validate action
        if (!['set', 'add', 'remove'].includes(action)) {
            return new Response(JSON.stringify({
                error: 'Invalid action',
                message: 'Action must be one of: set, add, remove'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Validate tags array
        if (!Array.isArray(tags)) {
            return new Response(JSON.stringify({
                error: 'Invalid tags format',
                message: 'Tags must be an array of strings'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Validate each tag
        const invalidTags = tags.filter(tag => !validateTag(tag));
        if (invalidTags.length > 0) {
            return new Response(JSON.stringify({
                error: 'Invalid tag format',
                message: 'Tags must contain only alphanumeric characters, underscores, hyphens, and CJK characters',
                invalidTags: invalidTags
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Process files in batch
        const results = {
            success: true,
            total: fileIds.length,
            updated: 0,
            errors: []
        };

        const updatedFiles = [];

        for (const fileId of fileIds) {
            try {
                // Get file metadata
                const fileData = await db.getWithMetadata(fileId);

                if (!fileData || !fileData.metadata) {
                    results.errors.push({
                        fileId: fileId,
                        error: 'File not found'
                    });
                    continue;
                }

                // Get existing tags
                const existingTags = fileData.metadata.Tags || [];

                // Merge tags based on action
                const updatedTags = mergeTags(existingTags, tags, action);

                // Update metadata
                fileData.metadata.Tags = updatedTags;

                // Save to database
                await db.put(fileId, fileData.value, {
                    metadata: fileData.metadata
                });

                // Clear CDN cache (async)
                const cdnUrl = `https://${url.hostname}/file/${fileId}`;
                waitUntil(purgeCFCache(env, cdnUrl));

                // Track updated file for batch index update
                updatedFiles.push({
                    fileId: fileId,
                    metadata: fileData.metadata
                });

                results.updated++;

            } catch (error) {
                results.errors.push({
                    fileId: fileId,
                    error: error.message
                });
            }
        }

        // Batch update file index asynchronously
        if (updatedFiles.length > 0) {
            waitUntil(batchAddFilesToIndex(context, updatedFiles, { skipExisting: false }));
        }

        // Set success to false if there were any errors
        if (results.errors.length > 0) {
            results.success = false;
        }

        return new Response(JSON.stringify(results), {
            status: results.success ? 200 : 207, // 207 = Multi-Status (partial success)
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('Error in batch tag update:', error);
        return new Response(JSON.stringify({
            error: 'Internal server error',
            message: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
