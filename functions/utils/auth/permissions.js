export const PERMISSIONS = ['list', 'organize', 'replace', 'delete', 'purge', 'upload', 'manage'];
export const PERMISSION_VERSION = 2;

export function validPermissions(value) {
    return Array.isArray(value) && value.length > 0 && value.every(p => PERMISSIONS.includes(p));
}

// Interpret existing tokens without rewriting secrets or expiration dates.
// New/edited tokens store explicit grants using version 2. Purge is never implied.
export function effectivePermissions(token) {
    const permissions = new Set(Array.isArray(token.permissions) ? token.permissions.filter(p => PERMISSIONS.includes(p)) : []);
    if (token.permissionVersion !== PERMISSION_VERSION) {
        if (permissions.has('organize')) permissions.add('list');
        if (permissions.has('manage')) {
            permissions.add('organize');
            permissions.add('replace');
        }
    }
    return PERMISSIONS.filter(p => permissions.has(p));
}

// Match the route, never a segment in the user-controlled file path.
export function managePermission(request) {
    const url = new URL(request.url);
    const route = url.pathname.replace(/^\/api\/manage\//, '').split('/');
    const read = request.method === 'GET' || request.method === 'HEAD';
    if (route[0] === 'trash') return read ? 'list' : request.method === 'DELETE' ? 'purge' : 'delete';
    if (route[0] === 'delete') return 'delete';
    if (route[0] === 'replace' || route[0] === 'replace-file') return 'replace';
    if (route[0] === 'rename' || route[0] === 'move') return 'organize';
    if (route[0] === 'tags' || route[0] === 'notes') return read ? 'list' : 'organize';
    if (route[0] === 'list' && read) {
        return url.searchParams.has('action') && url.searchParams.get('action') !== '' ? 'manage' : 'list';
    }
    return 'manage';
}
