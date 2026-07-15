/**
 * 远程资源代理读取 API
 * 负责在鉴权后拉取请求体中指定 URL 的资源并透传响应内容
 */
import { dualAuthCheck } from '../utils/auth/dualAuth.js';

/**
 * Determine whether a hostname refers to a private, loopback, link-local,
 * cloud-metadata, or otherwise internal network address. Used to prevent
 * SSRF against internal services from the proxy endpoint.
 *
 * @param {string} hostname - hostname or IP literal from a parsed URL
 * @returns {boolean}
 */
function isPrivateHostname(hostname) {
    if (!hostname) return true;
    let h = hostname.toLowerCase();
    // Strip IPv6 brackets
    if (h.startsWith('[') && h.endsWith(']')) {
        h = h.slice(1, -1);
    }

    // Obvious local names
    if (h === 'localhost' || h === 'ip6-localhost' || h === 'ip6-loopback') return true;
    if (h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true;

    // Cloud metadata service hostnames
    if (h === 'metadata.google.internal' || h === 'metadata.goog') return true;

    // IPv4 literal check
    const ipv4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
    if (ipv4) {
        const [a, b] = [parseInt(ipv4[1], 10), parseInt(ipv4[2], 10)];
        if (a === 10) return true;                              // 10.0.0.0/8
        if (a === 127) return true;                             // loopback
        if (a === 0) return true;                               // 0.0.0.0/8
        if (a === 169 && b === 254) return true;                // link-local / AWS metadata 169.254.169.254
        if (a === 172 && b >= 16 && b <= 31) return true;       // 172.16.0.0/12
        if (a === 192 && b === 168) return true;                // 192.168.0.0/16
        if (a === 100 && b >= 64 && b <= 127) return true;      // CGNAT 100.64.0.0/10
        if (a >= 224) return true;                              // multicast / reserved
        return false;
    }

    // IPv6 literal check (basic)
    if (h.includes(':')) {
        if (h === '::' || h === '::1') return true;
        if (h.startsWith('fe80:') || h.startsWith('fe80::')) return true;   // link-local
        if (h.startsWith('fc') || h.startsWith('fd')) return true;          // unique local fc00::/7
        // IPv4-mapped IPv6 (::ffff:a.b.c.d)
        const mapped = h.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
        if (mapped) return isPrivateHostname(mapped[1]);
        return false;
    }

    return false;
}

export async function onRequest(context) {
    // 获取请求体中URL的内容
    const {
        request,
        env,
        params,
        waitUntil,
        next,
        data
    } = context;

    // 双重鉴权检查
    const url = new URL(request.url);
    const { authorized } = await dualAuthCheck(env, url, request);
    if (!authorized) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const jsonRequest = await request.json();
    const targetUrl = jsonRequest.url;
    if (targetUrl === undefined) {
        return new Response('URL is required', { status: 400 })
    }

    // Validate the target URL to mitigate SSRF (CWE-918).
    let parsed;
    try {
        parsed = new URL(targetUrl);
    } catch (e) {
        return new Response(JSON.stringify({ error: 'Invalid URL' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // Only allow http(s); block file:, gopher:, data:, ftp:, blob:, etc.
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        return new Response(JSON.stringify({ error: 'Only http(s) URLs are allowed' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // Refuse embedded credentials (used to smuggle auth into internal targets).
    if (parsed.username || parsed.password) {
        return new Response(JSON.stringify({ error: 'Credentials in URL are not allowed' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // Block private / loopback / link-local / metadata targets.
    if (isPrivateHostname(parsed.hostname)) {
        return new Response(JSON.stringify({ error: 'Access to internal addresses is not allowed' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // Follow redirects manually so a permitted host cannot redirect us onto
    // an internal address without re-validation.
    let response = await fetch(parsed.toString(), { redirect: 'manual' });
    let hops = 0;
    while (response.status >= 300 && response.status < 400 && response.headers.get('location') && hops < 5) {
        const next = new URL(response.headers.get('location'), parsed);
        if ((next.protocol !== 'http:' && next.protocol !== 'https:') ||
            next.username || next.password ||
            isPrivateHostname(next.hostname)) {
            return new Response(JSON.stringify({ error: 'Redirect to disallowed target' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        response = await fetch(next.toString(), { redirect: 'manual' });
        hops++;
    }

    const headers = new Headers(response.headers);
    return new Response(response.body, {
        headers: headers,
        status: response.status
    })
}
