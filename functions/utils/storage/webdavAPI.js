/**
 * WebDAV API helper
 *
 * Uses only Fetch/Web APIs so it works in Cloudflare Pages Functions,
 * Cloudflare Workers, and the local Node-based test/runtime paths.
 */
export class WebDAVAPI {
    constructor(config = {}) {
        const baseUrl = config.baseUrl;
        if (!baseUrl) {
            throw new Error('WebDAV baseUrl is required');
        }

        this.baseUrl = normalizeBaseUrl(baseUrl);
        this.username = config.username || '';
        this.password = config.password || '';
        this.headers = normalizeHeaders(config.headers || {});
        this.createDirectory = config.createDirectory !== false;
    }

    buildObjectUrl(path) {
        return buildWebDAVUrl(this.baseUrl, path);
    }

    buildPublicUrl(path, publicUrl = '') {
        if (!publicUrl) return '';
        return buildWebDAVUrl(normalizeBaseUrl(publicUrl), path);
    }

    getRequestHeaders(extraHeaders = {}) {
        const headers = new Headers(this.headers);

        if ((this.username || this.password) && !headers.has('Authorization')) {
            headers.set('Authorization', `Basic ${base64EncodeUtf8(`${this.username}:${this.password}`)}`);
        }

        for (const [key, value] of Object.entries(extraHeaders || {})) {
            if (value !== undefined && value !== null && value !== '') {
                headers.set(key, value);
            }
        }

        return headers;
    }

    async ensureDirectory(path) {
        if (!this.createDirectory) return;

        const dirParts = getDirectoryParts(path);
        if (dirParts.length === 0) return;

        let currentPath = '';
        for (const part of dirParts) {
            currentPath = currentPath ? `${currentPath}/${part}` : part;
            const response = await davFetch(this.buildObjectUrl(currentPath), {
                method: 'MKCOL',
                headers: this.getRequestHeaders(),
            });

            // 405 commonly means the collection already exists. Some servers return 200/204.
            if (![200, 201, 204, 405].includes(response.status)) {
                throw new Error(`WebDAV MKCOL failed for ${currentPath}: ${response.status} ${response.statusText}`);
            }
        }
    }

    async putFile(path, body, contentType = '') {
        await this.ensureDirectory(path);

        const headers = this.getRequestHeaders(contentType ? { 'Content-Type': contentType } : {});
        const response = await davFetch(this.buildObjectUrl(path), {
            method: 'PUT',
            headers,
            body,
        });

        if (!isSuccessStatus(response.status)) {
            const detail = await safeReadResponseText(response);
            throw new Error(`WebDAV PUT failed: ${response.status} ${response.statusText}${detail ? ` - ${detail}` : ''}`);
        }

        return response;
    }

    async getFile(path, options = {}) {
        const response = await davFetch(this.buildObjectUrl(path), {
            method: options.method || 'GET',
            headers: this.getRequestHeaders(options.headers || {}),
        });

        if (!isSuccessStatus(response.status) && response.status !== 304) {
            const detail = await safeReadResponseText(response);
            throw new Error(`WebDAV ${options.method || 'GET'} failed: ${response.status} ${response.statusText}${detail ? ` - ${detail}` : ''}`);
        }

        return response;
    }

    async moveFile(oldPath, newPath, overwrite = true) {
        await this.ensureDirectory(newPath);

        const response = await davFetch(this.buildObjectUrl(oldPath), {
            method: 'MOVE',
            headers: this.getRequestHeaders({
                Destination: this.buildObjectUrl(newPath),
                Overwrite: overwrite ? 'T' : 'F',
            }),
        });

        if (!isSuccessStatus(response.status)) {
            const detail = await safeReadResponseText(response);
            throw new Error(`WebDAV MOVE failed: ${response.status} ${response.statusText}${detail ? ` - ${detail}` : ''}`);
        }

        return true;
    }

    async deleteFile(path) {
        const response = await davFetch(this.buildObjectUrl(path), {
            method: 'DELETE',
            headers: this.getRequestHeaders(),
        });

        // DELETE is idempotent for app semantics; a missing remote object should not block DB cleanup.
        if (response.status === 404) return true;

        if (!isSuccessStatus(response.status)) {
            const detail = await safeReadResponseText(response);
            throw new Error(`WebDAV DELETE failed: ${response.status} ${response.statusText}${detail ? ` - ${detail}` : ''}`);
        }

        return true;
    }
}

export function normalizeBaseUrl(baseUrl) {
    const normalized = String(baseUrl || '').trim();
    if (!normalized) {
        throw new Error('WebDAV baseUrl is required');
    }

    const url = new URL(normalized);
    if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error('WebDAV baseUrl must use http or https');
    }

    if (!url.pathname.endsWith('/')) {
        url.pathname = `${url.pathname}/`;
    }

    return url.toString();
}

export function buildWebDAVUrl(baseUrl, path) {
    const cleanPath = String(path || '')
        .replace(/^\/+/, '')
        .split('/')
        .filter(Boolean)
        .map(encodeURIComponent)
        .join('/');

    return new URL(cleanPath, normalizeBaseUrl(baseUrl)).toString();
}

export function normalizeWebDAVHeaders(headers) {
    return normalizeHeaders(headers);
}

function getDirectoryParts(path) {
    const parts = String(path || '').replace(/^\/+/, '').split('/').filter(Boolean);
    parts.pop();
    return parts;
}

function normalizeHeaders(headers) {
    if (!headers) return {};

    if (typeof headers === 'string') {
        try {
            const parsed = JSON.parse(headers);
            return normalizeHeaders(parsed);
        } catch {
            return {};
        }
    }

    if (headers instanceof Headers) {
        const result = {};
        headers.forEach((value, key) => {
            result[key] = value;
        });
        return result;
    }

    if (typeof headers === 'object' && !Array.isArray(headers)) {
        const result = {};
        for (const [key, value] of Object.entries(headers)) {
            if (value !== undefined && value !== null && value !== '') {
                result[key] = String(value);
            }
        }
        return result;
    }

    return {};
}

/* ========== 重定向处理 ========== */

// WebDAV 服务端返回 3xx 是常见行为，而非异常：反向代理的 http→https 跳转、
// OpenList/AList 的 /dav 前缀与尾斜杠规范化、部分网盘驱动的预签名上传跳转。
// 若按 2xx 严格判定，putFile 会在远端已写入成功后抛错，导致数据库与索引均未更新。
const REDIRECT_STATUS = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 5;
const SENSITIVE_HEADERS = ['authorization', 'proxy-authorization', 'cookie'];

/**
 * 手动跟随 3xx：保留请求方法与请求体，跨主机时剥离认证信息。
 *
 * 不使用 fetch 的自动跟随，是为了在每一跳都重新校验目标主机，
 * 避免被服务端重定向带到任意第三方地址并泄露 Basic 凭据。
 */
async function davFetch(url, init, depth = 0) {
    const response = await fetch(url, { ...init, redirect: 'manual' });

    if (!REDIRECT_STATUS.has(response.status) || depth >= MAX_REDIRECTS) {
        return response;
    }

    const location = response.headers.get('Location');
    if (!location) return response;

    let nextUrl;
    try {
        nextUrl = new URL(location, url);
    } catch {
        return response;
    }

    if (nextUrl.protocol !== 'http:' && nextUrl.protocol !== 'https:') {
        return response;
    }

    const body = init.body;
    // 请求体无法重放（ReadableStream）时放弃跟随，交由调用方处理原响应
    if (body && typeof body.getReader === 'function') {
        return response;
    }

    try { await response.body?.cancel(); } catch { /* 忽略释放失败 */ }

    const method = String(init.method || 'GET').toUpperCase();
    // 303 语义要求改为 GET；301/302/307/308 保留原方法，否则 PUT 会被降级成 GET
    const nextMethod = response.status === 303 ? 'GET' : method;
    const nextBody = nextMethod === method ? body : undefined;

    const headers = new Headers(init.headers || {});
    // 仅比较 host（含端口），使同主机的 http→https 跳转仍能保留认证
    if (nextUrl.host !== new URL(url).host) {
        for (const name of SENSITIVE_HEADERS) {
            headers.delete(name);
        }
    }

    return davFetch(nextUrl, { ...init, method: nextMethod, headers, body: nextBody }, depth + 1);
}

function isSuccessStatus(status) {
    return status >= 200 && status < 300;
}

async function safeReadResponseText(response) {
    try {
        const text = await response.text();
        return text.slice(0, 500);
    } catch {
        return '';
    }
}

function base64EncodeUtf8(value) {
    const bytes = new TextEncoder().encode(value);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }

    if (typeof btoa === 'function') {
        return btoa(binary);
    }

    // Node-based local tests/runtimes.
    return Buffer.from(value, 'utf8').toString('base64');
}
