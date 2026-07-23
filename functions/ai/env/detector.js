/**
 * Best-effort AI runtime detection.
 *
 * CF Worker and CF Pages share the same runtime globals and cannot be told
 * apart reliably; both return 'cf'. Queue-consumer capability (which Pages
 * lacks) is a deployment binding, surfaced by the adapter's hasQueue flag.
 */
export function detectAIRuntime() {
    if (typeof process !== 'undefined' && process.versions?.node) {
        return 'node';
    }
    if (typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers') {
        return 'cf';
    }
    if (typeof caches !== 'undefined') {
        return 'cf';
    }
    return 'unknown';
}
