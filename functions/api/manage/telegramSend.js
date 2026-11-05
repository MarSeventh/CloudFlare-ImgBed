import { createTelegramSendHandler } from '../../utils/telegramSend.js';
import { getDatabase } from '../../utils/databaseAdapter.js';
import { getUploadConfig } from './sysConfig/upload.js';
import { getSecurityConfig } from './sysConfig/security.js';
import { authenticate, AUTH_SCOPE } from '../../utils/auth/authCore.js';
import { TelegramAPI } from '../../utils/storage/telegramAPI.js';
import { onRequest as readFile } from '../../file/[[path]].js';

export const onRequest = createTelegramSendHandler({
    getDatabase, getUploadConfig, getSecurityConfig,
    async authorize({ env, request }) {
        return (await authenticate({ env, request, requiredPermission: 'manage', authScope: AUTH_SCOPE.ADMIN })).authorized;
    },
    async readFile(context, path) {
        const url = new URL(context.request.url); url.pathname = '/file/' + path.split('/').map(encodeURIComponent).join('/'); url.search = '?from=admin';
        const headers = new Headers({ Referer: url.origin + '/dashboard' });
        for (const key of ['Cookie', 'Authorization']) {
            const value = context.request.headers.get(key);
            if (value) headers.set(key, value);
        }
        return readFile({ ...context, request: new Request(url, { method: 'GET', headers }), params: { path: encodeURIComponent(path) } });
    },
    async call(channel, method, body) {
        const api = new TelegramAPI(channel.botToken, channel.proxyUrl || '');
        const multipart = body instanceof FormData;
        const response = await fetch(`${api.baseURL}/${method}`, {
            method: 'POST', headers: multipart ? {} : { 'Content-Type': 'application/json' },
            body: multipart ? body : JSON.stringify(body), signal: AbortSignal.timeout(25000)
        });
        const result = await response.json();
        const description = String(result.description || '').toLowerCase();
        return { ok: response.ok && result.ok, code: result.error_code || response.status,
            messageId: result.result?.message_id, retryAfter: result.parameters?.retry_after,
            mediaMismatch: /file type|file of type|can't use file|cannot use file|wrong file identifier|wrong type/.test(description),
            recipientUnavailable: /chat not found|user is deactivated|bot was blocked/.test(description) };
    }
});
