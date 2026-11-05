import { getDatabase } from '../../../utils/databaseAdapter.js';
import { validateSession } from '../../../utils/auth/sessionManager.js';
import { isExpired } from '../../../utils/auth/tokenExpiration.js';

const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store, max-age=0', 'Pragma': 'no-cache' };
const json = (body, status = 200) => Response.json(body, { status, headers });
export async function onRequest({ request, env }) {
    // Revealing a stored secret requires an interactive administrator session.
    // A delegated API Token must never retrieve other credentials.
    const session = await validateSession(env, request, 'admin');
    if (!session.valid) return json({ error: 'admin_session_required' }, 403);
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
    let body;
    try { body = await request.json(); } catch { return json({ error: 'invalid_request' }, 400); }
    if (typeof body?.tokenId !== 'string' || !body.tokenId || body.tokenId.length > 128) return json({ error: 'invalid_request' }, 400);
    const db = getDatabase(env);
    const settings = JSON.parse(await db.get('manage@sysConfig@security') || '{}');
    const tokens = settings.apiTokens?.tokens || {};
    const token = Object.hasOwn(tokens, body.tokenId) ? tokens[body.tokenId] : null;
    if (!token || token.type === 'internal' || typeof token.token !== 'string' ||
        (token.autoDelete === true && isExpired(token.expiresAt))) return json({ error: 'token_not_found' }, 404);
    return json({ token: token.token });
}
