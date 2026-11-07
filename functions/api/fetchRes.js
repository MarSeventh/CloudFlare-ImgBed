/**
 * 远程资源代理读取 API
 * 负责在鉴权后拉取请求体中指定 URL 的资源并透传响应内容
 */
import { dualAuthCheck } from '../utils/auth/dualAuth.js';

const IS_NODE_RUNTIME = typeof process !== 'undefined' && Boolean(process.versions?.node);
const HOP_BY_HOP_HEADERS = [
    'connection',
    'keep-alive',
    'proxy-authenticate',
    'proxy-authorization',
    'te',
    'trailer',
    'transfer-encoding',
    'upgrade'
];

/**
 * Build response headers that are safe to send on a new proxy response.
 * Node's fetch transparently decompresses upstream bodies while retaining
 * Content-Encoding/Content-Length, so those headers must be removed there.
 *
 * @param {Headers} responseHeaders - headers returned by the upstream server
 * @returns {Headers}
 */
function createProxyHeaders(responseHeaders) {
    const headers = new Headers(responseHeaders);

    for (const name of HOP_BY_HOP_HEADERS) {
        headers.delete(name);
    }

    if (IS_NODE_RUNTIME) {
        headers.delete('content-encoding');
        headers.delete('content-length');
    }

    return headers;
}

function fetchTarget(url) {
    const options = { redirect: 'manual' };
    if (IS_NODE_RUNTIME) {
        options.headers = { 'Accept-Encoding': 'identity' };
    }
    return fetch(url.toString(), options);
}

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

/**
 * Check whether a target hostname may be fetched. Its name must not be
 * internal (isPrivateHostname), and where the runtime provides a resolver
 * (env.DNS_LOOKUP, set by the Node.js/Docker server) every address it
 * resolves to must not be internal either: a wildcard DNS name such as
 * 192.168.0.1.nip.io passes the name check but reaches the LAN (#746).
 * Cloudflare Pages/Workers have no resolver here; their fetch does not
 * reach the deployment's private network.
 *
 * @param {string} hostname - hostname from a parsed URL
 * @param {Function} [lookup] - async (hostname) => [{ address, family }] | string[]
 * @returns {Promise<null|'internal'|'unresolved'>} null when allowed
 */
async function checkTarget(hostname, lookup) {
    if (isPrivateHostname(hostname)) return 'internal';
    if (typeof lookup !== 'function') return null;

    let h = hostname.toLowerCase();
    if (h.startsWith('[') && h.endsWith(']')) {
        h = h.slice(1, -1);
    }
    // An IP literal was fully checked above; nothing to resolve.
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h) || h.includes(':')) return null;

    let resolved;
    try {
        resolved = await lookup(h);
    } catch (e) {
        return 'unresolved';
    }
    const addresses = (Array.isArray(resolved) ? resolved : [resolved])
        .map(entry => (typeof entry === 'string' ? entry : entry?.address));
    if (addresses.length === 0) return 'unresolved';
    if (addresses.some(address => !address || isPrivateHostname(address))) return 'internal';
    return null;
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

    // Block private / loopback / link-local / metadata targets, by name and,
    // where a resolver is available, by the addresses the name resolves to.
    const lookup = env?.DNS_LOOKUP;
    const blocked = await checkTarget(parsed.hostname, lookup);
    if (blocked) {
        const error = blocked === 'unresolved'
            ? 'Unable to resolve target host'
            : 'Access to internal addresses is not allowed';
        return new Response(JSON.stringify({ error }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    // Follow redirects manually so a permitted host cannot redirect us onto
    // an internal address without re-validation.
    let currentUrl = parsed;
    let response = await fetchTarget(currentUrl);
    let hops = 0;
    while (response.status >= 300 && response.status < 400 && response.headers.get('location') && hops < 5) {
        const next = new URL(response.headers.get('location'), currentUrl);
        if ((next.protocol !== 'http:' && next.protocol !== 'https:') ||
            next.username || next.password ||
            await checkTarget(next.hostname, lookup)) {
            return new Response(JSON.stringify({ error: 'Redirect to disallowed target' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        currentUrl = next;
        response = await fetchTarget(currentUrl);
        hops++;
    }

    const headers = createProxyHeaders(response.headers);
    return new Response(response.body, {
        headers: headers,
        status: response.status
    })
}
