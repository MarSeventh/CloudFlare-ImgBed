import { tagCatalog } from '../../../utils/tagCatalog.js';
import { getDatabase } from '../../../utils/databaseAdapter.js';
import { readIndex } from "../../../utils/indexManager.js";
import { filterTagsByPrefix } from "../../../utils/tagHelpers.js";

/**
 * Tag Autocomplete API
 *
 * GET /api/manage/tags/autocomplete?prefix=ph - Get tag suggestions
 *
 * Returns all tags matching the given prefix, useful for autocomplete functionality
 */
export async function onRequest(context) {
    const { request } = context;

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

        const tagsArray = (await tagCatalog(getDatabase(context.env))).map(tag => tag.name);

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
                'Cache-Control': 'no-store'
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
