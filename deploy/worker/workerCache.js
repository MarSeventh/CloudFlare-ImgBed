/**
 * Worker Cache：按业务代码返回的 Cache-Control 缓存完整 GET 响应
 * 由 generate-routes.js 生成的 Worker 入口引用；单独成模块便于测试实际缓存路径
 */

// 统一缓存键，HEAD 与 GET 共用完整 GET 响应缓存
function createCacheKeyRequest(request) {
    return new Request(request.url, {
        method: 'GET',
        headers: request.headers,
    });
}

// 解析 Cache-Control 指令，支持 max-age/s-maxage 等数值字段
function parseCacheDirective(cacheControl, directive) {
    if (!cacheControl) return null;

    const directives = cacheControl.split(',');
    for (const rawDirective of directives) {
        const part = rawDirective.trim();
        const eqIndex = part.indexOf('=');
        const name = (eqIndex === -1 ? part : part.slice(0, eqIndex)).trim().toLowerCase();

        if (name !== directive) continue;
        if (eqIndex === -1) return true;

        const value = part.slice(eqIndex + 1).trim().replace(/^"|"$/g, '');
        const seconds = Number.parseInt(value, 10);
        return Number.isFinite(seconds) ? seconds : null;
    }

    return null;
}

function responseHasCacheDirective(cacheControl, directive) {
    return parseCacheDirective(cacheControl, directive) !== null;
}

function getResponseCacheTtl(response) {
    const cacheControl = response.headers.get('Cache-Control') || '';
    const sMaxAge = parseCacheDirective(cacheControl, 's-maxage');
    if (typeof sMaxAge === 'number') return sMaxAge;

    const maxAge = parseCacheDirective(cacheControl, 'max-age');
    if (typeof maxAge === 'number') return maxAge;

    return null;
}

function isCacheLookupRequest(request) {
    return request.method === 'GET' || request.method === 'HEAD';
}

// 只写入完整 GET 响应，Range 请求仅尝试命中已有完整缓存
function isCacheStoreRequest(request) {
    return request.method === 'GET' && !request.headers.has('Range');
}

function isCacheableResponse(request, response) {
    if (!isCacheStoreRequest(request)) return false;
    if (response.status !== 200) return false;
    if (response.headers.has('Set-Cookie')) return false;

    const cacheControl = response.headers.get('Cache-Control') || '';
    if (!responseHasCacheDirective(cacheControl, 'public')) return false;
    if (responseHasCacheDirective(cacheControl, 'private')) return false;
    if (responseHasCacheDirective(cacheControl, 'no-store')) return false;
    if (responseHasCacheDirective(cacheControl, 'no-cache')) return false;

    const ttl = getResponseCacheTtl(response);
    return ttl !== null && ttl > 0;
}

function responseFromHeadCache(cachedResponse) {
    return new Response(null, {
        status: cachedResponse.status,
        statusText: cachedResponse.statusText,
        headers: cachedResponse.headers,
    });
}

/**
 * @param {Function} [isCachedServable] 命中缓存后、返回前调用；返回 false 时丢弃该缓存并重新执行业务代码。
 *   缓存写入后文件可能已被删除或改为有期限，Cache API 只能清除当前数据中心的副本，因此在命中时确认
 */
export async function maybeServeFromCache(request, ctx, producer, isCachedServable = null) {
    if (!isCacheLookupRequest(request)) {
        return await producer();
    }

    const cache = caches.default;
    const cacheKey = createCacheKeyRequest(request);
    const cachedResponse = await cache.match(cacheKey);

    if (cachedResponse && isCachedServable && !(await isCachedServable())) {
        ctx.waitUntil(cache.delete(cacheKey).catch(error => {
            console.warn('Failed to drop stale Worker cache entry:', error.message);
        }));
    } else if (cachedResponse) {
        return request.method === 'HEAD'
            ? responseFromHeadCache(cachedResponse)
            : cachedResponse;
    }

    const response = await producer();

    // 按业务代码返回的 Cache-Control 决定是否写入 Worker Cache
    if (isCacheableResponse(request, response)) {
        ctx.waitUntil(cache.put(cacheKey, response.clone()).catch(error => {
            console.warn('Failed to store response in Worker cache:', error.message);
        }));
    }

    return response;
}
