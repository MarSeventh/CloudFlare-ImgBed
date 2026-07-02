/**
 * 获取指定目录下所有图片文件列表
 * GET /api/fetchImages?dir=emby
 */
import { fetchPageConfig } from '../utils/sysConfig.js';
import { readIndex } from '../utils/indexManager.js';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
};

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif', 'ico', 'tiff', 'tif'];

function sanitizeDir(dir) {
    return dir
        .replace(/\.\./g, '_')
        .replace(/\\/g, '/')
        .replace(/\/{2,}/g, '/')
        .replace(/^\/+/, '')
        .replace(/\/+$/, '');
}

function getFileExt(name) {
    const parts = name.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
}

function isImageFile(file) {
    const mimeType = file.metadata?.FileType || '';
    if (mimeType.startsWith('image/')) {
        return true;
    }
    return IMAGE_EXTENSIONS.includes(getFileExt(file.id));
}

function getFileName(fileId) {
    const parts = fileId.split('/');
    return parts[parts.length - 1] || fileId;
}

async function buildBaseUrl(context, url) {
    const pageConfig = await fetchPageConfig(context.env);
    const urlPrefixConfig = pageConfig.config?.find(c => c.id === 'urlPrefix');
    const urlPrefix = urlPrefixConfig?.value || '';

    if (urlPrefix) {
        return urlPrefix.replace(/\/+$/, '');
    }

    return `${url.origin}/file`;
}

export async function onRequest(context) {
    const { request } = context;
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: corsHeaders,
        });
    }

    if (request.method !== 'GET') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
    }

    try {
        const dirParam = url.searchParams.get('dir') || '';
        const dir = sanitizeDir(dirParam);
        const recursive = url.searchParams.get('recursive') === 'true';

        if (!dir) {
            return new Response(JSON.stringify({ error: 'Missing required parameter: dir' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
        }

        const directory = `${dir}/`;
        const result = await readIndex(context, {
            directory,
            start: 0,
            count: -1,
            includeSubdirFiles: recursive,
            accessStatus: 'normal',
        });

        if (!result.success) {
            return new Response(JSON.stringify({ error: 'Failed to read file index' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
        }

        const baseUrl = await buildBaseUrl(context, url);
        const icons = result.files
            .filter(isImageFile)
            .map(file => {
                const name = getFileName(file.id);
                return {
                    name,
                    url: `${baseUrl}/${file.id}`,
                };
            })
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));

        return new Response(JSON.stringify({
            dir,
            icons,
        }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
    } catch (error) {
        console.error('Error in fetchImages API:', error);
        return new Response(JSON.stringify({
            error: 'Internal server error',
            message: error.message,
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
    }
}
