/**
 * PicGo 兼容上传接口
 * 兼容 PicGo-Core 内置 Server 的 POST /upload 接口：https://github.com/PicGo/PicGo-Core
 *
 * 请求：
 * - multipart/form-data：`files` 字段（可多个）
 * - application/json：{ "list": ["https://example.com/a.png", ...] }（仅支持远程 URL，服务端无法读取客户端本地路径）
 * 鉴权：Authorization: Bearer <secret> / x-picgo-secret 头 / ?secret= 参数，secret 可为 API Token（需 upload 权限）或用户 authCode
 * 参数：uploader → uploadChannel，configName → channelName，其余参数与 /upload 一致
 * 响应：{ success, result: string[], items: [...], message? }
 */

import { onRequest as uploadOnRequest } from '../upload/index.js';
import { userAuthCheck } from '../utils/auth/userAuth';
import { getImageDimensions } from '../upload/uploadTools';
import { getFileTypeCategory, resolveFileType } from '../utils/mimeTypes.js';

const PICGO_PARAMS = ['secret', 'uploader', 'configName', 'configId'];

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, authCode, x-picgo-secret',
};

function picgoResponse(body, status = 200) {
    return new Response(JSON.stringify({ result: [], items: [], ...body }), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
}

export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);

    if (request.method !== 'POST') {
        return picgoResponse({ success: false, message: 'Method Not Allowed' }, 405);
    }

    // 将 PicGo 的 secret 映射为本项目的 API Token 与 authCode，两者任一有效即可
    const headers = buildAuthHeaders(request, url);
    if (!await userAuthCheck(env, url, new Request(url, { headers }), 'upload')) {
        return picgoResponse({ success: false, message: 'Unauthorized' }, 401);
    }

    // 解析待上传文件
    let sources;
    try {
        sources = await parseSources(request);
    } catch (error) {
        return picgoResponse({ success: false, message: error.message }, 400);
    }

    const uploadUrl = buildUploadUrl(url);
    const uploader = uploadUrl.searchParams.get('uploadChannel') || 'telegram';
    headers.delete('Content-Type');
    headers.delete('Content-Length');

    const items = [];
    const errors = [];
    // 逐个上传，复用 /upload 的完整上传流程（渠道选择、重试、审查、索引等）
    for (const source of sources) {
        try {
            const file = await source.load();
            const item = await uploadOne(context, uploadUrl, headers, file);
            items.push({ ...item, origin: source.origin, type: uploader });
        } catch (error) {
            errors.push({ origin: source.origin, message: error.message });
        }
    }

    const result = items.map(item => item.imgUrl);
    if (result.length === 0) {
        return picgoResponse({ success: false, message: errors[0]?.message || 'All uploads failed', errors }, 500);
    }
    return picgoResponse({ success: true, result, items, ...(errors.length ? { errors } : {}) });
}

function buildAuthHeaders(request, url) {
    const headers = new Headers(request.headers);
    const authorization = headers.get('Authorization') || '';
    const bearer = authorization.startsWith('Bearer ') ? authorization.substring(7) : '';
    const secret = headers.get('x-picgo-secret') || url.searchParams.get('secret') || bearer;
    if (secret) {
        if (!authorization) headers.set('Authorization', `Bearer ${secret}`);
        if (!headers.get('authCode')) headers.set('authCode', secret);
    }
    headers.delete('x-picgo-secret');
    return headers;
}

function buildUploadUrl(url) {
    const uploadUrl = new URL('/upload', url.origin);
    for (const [key, value] of url.searchParams) {
        if (!PICGO_PARAMS.includes(key)) uploadUrl.searchParams.append(key, value);
    }
    const uploader = url.searchParams.get('uploader');
    const configName = url.searchParams.get('configName');
    if (uploader && !uploadUrl.searchParams.has('uploadChannel')) uploadUrl.searchParams.set('uploadChannel', uploader);
    if (configName && !uploadUrl.searchParams.has('channelName')) uploadUrl.searchParams.set('channelName', configName);
    // PicGo 需要可直接使用的完整链接
    if (!uploadUrl.searchParams.has('returnFormat')) uploadUrl.searchParams.set('returnFormat', 'full');
    return uploadUrl;
}

async function parseSources(request) {
    const contentType = request.headers.get('Content-Type') || '';

    if (contentType.includes('multipart/form-data')) {
        const files = (await request.formData()).getAll('files');
        if (files.length === 0) {
            throw new Error('No files found in "files" field');
        }
        if (!files.every(file => typeof file?.arrayBuffer === 'function')) {
            throw new Error('"files" field must contain files');
        }
        return files.map(file => ({
            origin: file.name,
            load: async () => file.name ? file : new File([file], `${crypto.randomUUID()}.png`, { type: file.type }),
        }));
    }

    const bodyText = await request.text().catch(() => '');
    let body = {};
    if (bodyText.trim() !== '') {
        try {
            body = JSON.parse(bodyText);
        } catch {
            throw new Error('Invalid JSON body');
        }
    }
    if (typeof body !== 'object' || body === null) {
        throw new Error('Request body must contain a "list" array');
    }

    const list = body.list;
    if (list === undefined || (Array.isArray(list) && list.length === 0)) {
        // PicGo 在无 list 时上传剪贴板，服务端没有剪贴板
        throw new Error('Clipboard upload is not supported, provide "list" or multipart "files"');
    }
    if (!Array.isArray(list) || !list.every(item => typeof item === 'string' && item.trim() !== '')) {
        throw new Error('Request body must contain a "list" array');
    }

    return list.map(item => ({ origin: item, load: () => fetchRemoteFile(item) }));
}

async function fetchRemoteFile(source) {
    let remoteUrl;
    try {
        remoteUrl = new URL(source);
    } catch {
        throw new Error('Only http(s) URLs are supported, local file paths cannot be read by the server');
    }
    if (remoteUrl.protocol !== 'http:' && remoteUrl.protocol !== 'https:') {
        throw new Error('Only http(s) URLs are supported, local file paths cannot be read by the server');
    }

    const response = await fetch(remoteUrl, { redirect: 'follow' });
    if (!response.ok) {
        throw new Error(`Failed to fetch ${source}: HTTP ${response.status}`);
    }
    const blob = await response.blob();
    let fileName = '';
    try {
        fileName = decodeURIComponent(remoteUrl.pathname.split('/').pop() || '');
    } catch {
        fileName = '';
    }
    if (!fileName) fileName = `${crypto.randomUUID()}.png`;
    const contentType = (response.headers.get('Content-Type') || '').split(';')[0].trim();
    return new File([blob], fileName, { type: contentType || blob.type });
}

async function uploadOne(context, uploadUrl, headers, file) {
    const form = new FormData();
    form.set('file', file);
    const request = new Request(uploadUrl, { method: 'POST', headers, body: form });
    const response = await uploadOnRequest({ ...context, request, data: {} });

    const text = await response.text();
    if (response.status !== 200) {
        throw new Error(text || `Upload failed: HTTP ${response.status}`);
    }
    let src, publicUrl;
    try {
        [{ src, publicUrl }] = JSON.parse(text);
    } catch {
        throw new Error(`Unexpected upload response: ${text}`);
    }

    const contentType = resolveFileType(file.name, file.type);
    const dot = file.name.lastIndexOf('.');
    const item = {
        imgUrl: publicUrl || src,
        fileName: file.name,
        contentType,
        size: file.size,
        extname: dot > 0 ? file.name.slice(dot) : '',
    };
    if (getFileTypeCategory(contentType) === 'image') {
        try {
            const dimensions = getImageDimensions(await file.slice(0, 65536).arrayBuffer(), contentType);
            if (dimensions) {
                item.width = dimensions.width;
                item.height = dimensions.height;
            }
        } catch {
            // 尺寸为可选字段，读取失败忽略
        }
    }
    return item;
}
