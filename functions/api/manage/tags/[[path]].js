import { purgeCFCache } from "../../../utils/purgeCache.js";
import { addFileToIndex } from "../../../utils/indexManager.js";
import { getDatabase } from "../../../utils/databaseAdapter.js";
import { mergeTags, normalizeTags, validateTag } from "../../../utils/tagHelpers.js";

/**
 * Tag Management API for Single Files
 *
 * GET /api/manage/tags/{fileId} - Get tags for a file
 * POST /api/manage/tags/{fileId} - Update tags for a file
 *
 * POST body format:
 * {
 *   action: "set" | "add" | "remove",
 *   tags: ["tag1", "tag2", ...]
 * }
 */
export async function onRequest(context) {
    const {
        request,
        env,
        params,
        waitUntil,
    } = context;

    const url = new URL(request.url);

    // Parse file path
    if (params.path) {
        params.path = String(params.path).split(',').join('/');
    }

    // Decode file path
    const fileId = decodeURIComponent(params.path);

    const db = getDatabase(env);

    try {
        if (request.method === 'GET') {
            // Get tags for file
            return await handleGetTags(db, fileId);
        } else if (request.method === 'POST') {
            // Update tags for file
            return await handleUpdateTags(context, db, fileId, url.hostname);
        } else {
            return new Response(JSON.stringify({
                error: 'Method not allowed',
                allowedMethods: ['GET', 'POST']
            }), {
                status: 405,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    } catch (error) {
        console.error(`Error in tag management for ${fileId}:`, error);
        return new Response(JSON.stringify({
            error: 'Internal server error',
            message: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

/**
 * Handle GET request - Get tags for a file
 */
async function handleGetTags(db, fileId) {
    try {
        const fileData = await db.getWithMetadata(fileId);

        if (!fileData || !fileData.metadata) {
            return new Response(JSON.stringify({
                error: 'File not found',
                fileId: fileId
            }), {
                status: 404,
                headers: { 
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-store'
                }
            });
        }

        const tags = fileData.metadata.Tags || [];

        return new Response(JSON.stringify({
            success: true,
            fileId: fileId,
            tags: tags
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store'
            }
        });
    } catch (error) {
        throw new Error(`Failed to get tags: ${error.message}`);
    }
}

/**
 * Handle POST request - Update tags for a file
 */
async function handleUpdateTags(context, db, fileId, hostname) {
    const { request, waitUntil } = context;

    try {
        // Parse request body
        const body = await request.json();
        const { action = 'set', tags = [] } = body;

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

        // Get file metadata
        const fileData = await db.getWithMetadata(fileId);

        if (!fileData || !fileData.metadata) {
            return new Response(JSON.stringify({
                error: 'File not found',
                fileId: fileId
            }), {
                status: 404,
                headers: { 'Content-Type': 'application/json' }
            });
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

        // Clear CDN cache asynchronously (don't wait for it to complete)
        const cdnUrl = `https://${hostname}/file/${fileId}`;
        waitUntil(purgeCFCache(context.env, cdnUrl));

        // Update file index asynchronously
        waitUntil(addFileToIndex(context, fileId, fileData.metadata));

        return new Response(JSON.stringify({
            success: true,
            fileId: fileId,
            action: action,
            tags: updatedTags,
            metadata: fileData.metadata
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        throw new Error(`Failed to update tags: ${error.message}`);
    }
}
