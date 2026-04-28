/**
 * WebDAV API helper
 *
 * Uses only Fetch/Web APIs so it works in Cloudflare Pages Functions,
 * Cloudflare Workers, and the local Node-based test/runtime paths.
 */
export class WebDAVAPI {
    constructor(config = {}) {
        const baseUrl = config.baseUrl || config.endpoint || config.url;
        if (!baseUrl) {
            throw new Error('WebDAV baseUrl is required');
        }

        this.baseUrl = normalizeBaseUrl(baseUrl);
        this.username = config.username || '';
        this.password = config.password || '';
        this.headers = normalizeHeaders(config.headers || config.customHeaders || {});
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
            const response = await fetch(this.buildObjectUrl(currentPath), {
                method: 'MKCOL',
                headers: this.getRequestHeaders(),
                redirect: 'manual',
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
        const response = await fetch(this.buildObjectUrl(path), {
            method: 'PUT',
            headers,
            body,
            redirect: 'manual',
        });

        if (!isSuccessStatus(response.status)) {
            const detail = await safeReadResponseText(response);
            throw new Error(`WebDAV PUT failed: ${response.status} ${response.statusText}${detail ? ` - ${detail}` : ''}`);
        }

        return response;
    }

    async getFile(path, options = {}) {
        const response = await fetch(this.buildObjectUrl(path), {
            method: options.method || 'GET',
            headers: this.getRequestHeaders(options.headers || {}),
            redirect: 'manual',
        });

        if (!isSuccessStatus(response.status) && response.status !== 304) {
            const detail = await safeReadResponseText(response);
            throw new Error(`WebDAV ${options.method || 'GET'} failed: ${response.status} ${response.statusText}${detail ? ` - ${detail}` : ''}`);
        }

        return response;
    }

    async moveFile(oldPath, newPath, overwrite = true) {
        await this.ensureDirectory(newPath);

        const response = await fetch(this.buildObjectUrl(oldPath), {
            method: 'MOVE',
            headers: this.getRequestHeaders({
                Destination: this.buildObjectUrl(newPath),
                Overwrite: overwrite ? 'T' : 'F',
            }),
            redirect: 'manual',
        });

        if (!isSuccessStatus(response.status)) {
            const detail = await safeReadResponseText(response);
            throw new Error(`WebDAV MOVE failed: ${response.status} ${response.statusText}${detail ? ` - ${detail}` : ''}`);
        }

        return true;
    }

    async deleteFile(path) {
        const response = await fetch(this.buildObjectUrl(path), {
            method: 'DELETE',
            headers: this.getRequestHeaders(),
            redirect: 'manual',
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
