import { getDatabase } from "../../../utils/databaseAdapter.js";
import { extractUniqueTags, filterTagsByPrefix } from "../../../utils/tagHelpers.js";

/**
 * Tag Autocomplete API
 *
 * GET /api/manage/tags/autocomplete?prefix=ph - Get tag suggestions
 *
 * Returns all tags matching the given prefix, useful for autocomplete functionality
 */
export async function onRequest(context) {
    const { request, env } = context;

    const url = new URL(request.url);

    if (request.method !== 'GET') {
        return new Response(JSON.stringify({
            error: 'Method not allowed',
            allowedMethods: ['GET']
        }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const db = getDatabase(env);

    try {
        // Get prefix from query parameters
        const prefix = url.searchParams.get('prefix') || '';
        const limit = parseInt(url.searchParams.get('limit') || '20', 10);

        // Validate limit
        if (limit < 1 || limit > 100) {
            return new Response(JSON.stringify({
                error: 'Invalid limit',
                message: 'Limit must be between 1 and 100'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Get all files from database
        const allTags = new Set();
        let cursor = null;

        while (true) {
            const response = await db.list({
                limit: 1000,
                cursor: cursor
            });

            for (const item of response.keys) {
                // Skip non-file entries
                if (item.name.startsWith('manage@') || item.name.startsWith('chunk_')) {
                    continue;
                }

                // Extract tags from metadata
                if (item.metadata && Array.isArray(item.metadata.Tags)) {
                    item.metadata.Tags.forEach(tag => {
                        if (tag && typeof tag === 'string') {
                            allTags.add(tag.toLowerCase().trim());
                        }
                    });
                }
            }

            cursor = response.cursor;
            if (!cursor) break;

            // Limit iterations for performance
            if (allTags.size > 10000) break;
        }

        // Convert to array and sort
        const tagsArray = Array.from(allTags).sort();

        // Filter by prefix
        const filteredTags = prefix
            ? filterTagsByPrefix(tagsArray, prefix, limit)
            : tagsArray.slice(0, limit);

        return new Response(JSON.stringify({
            success: true,
            prefix: prefix,
            tags: filteredTags,
            total: filteredTags.length,
            hasMore: tagsArray.length > filteredTags.length
        }), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=60' // Cache for 1 minute
            }
        });

    } catch (error) {
        console.error('Error in tag autocomplete:', error);
        return new Response(JSON.stringify({
            error: 'Internal server error',
            message: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
