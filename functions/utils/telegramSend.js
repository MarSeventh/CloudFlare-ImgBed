import { resolveFilePath } from './fileIdentity.js';
import { findConfiguredChannel } from './metadata/channelConfig.js';
import { telegramAllowedUsers } from './telegramAllowlist.js';

export const TELEGRAM_REUPLOAD_LIMIT = 20 * 1024 * 1024;
const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
const failure = (error, status = 400, extra = {}) => json({ success: false, error, ...extra }, status);

async function limitedBlob(response) {
    if (!response.ok || !response.body) throw new Error('file_unavailable');
    if (Number(response.headers.get('Content-Length')) > TELEGRAM_REUPLOAD_LIMIT) {
        await response.body.cancel(); throw new Error('file_too_large');
    }
    const reader = response.body.getReader(); const chunks = []; let size = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > TELEGRAM_REUPLOAD_LIMIT) throw new Error('file_too_large');
            chunks.push(value);
        }
    } finally { await reader.cancel().catch(() => {}); }
    return new Blob(chunks, { type: response.headers.get('Content-Type') || 'application/octet-stream' });
}

export function createTelegramSendHandler(services) {
    return async context => {
        const { request, env } = context;
        const auth = await services.authorize(context);
        if (!auth) return failure('unauthorized', 401);
        if (!['GET', 'POST'].includes(request.method)) return failure('method_not_allowed', 405);
        try {
            const db = services.getDatabase(env);
            const config = await services.getUploadConfig(db, env);
            const channels = (config.telegram?.channels || []).filter(c => c.enabled !== false && c.botToken);
            // Recipients are limited to the Telegram allowlist (env ∪ dashboard).
            const recipients = telegramAllowedUsers(env, await services.getSecurityConfig(db, env)).users
                .map(({ id, note }) => ({ id, note }));
            if (request.method === 'GET') return json({ channels: channels.map(c => ({ name: c.name })),
                recipients, reuploadLimit: TELEGRAM_REUPLOAD_LIMIT });
            let body;
            try {
                const raw = await request.text();
                if (raw.length > 4096) return failure('invalid_request');
                body = JSON.parse(raw);
            } catch { return failure('invalid_request'); }
            if (!body || typeof body.recipient !== 'string' || !/^[1-9]\d{0,15}$/.test(body.recipient) ||
                !Number.isSafeInteger(Number(body.recipient)) || typeof body.channel !== 'string' ||
                typeof body.fileId !== 'string' || !body.fileId || body.fileId.length > 700 ||
                body.fileId.startsWith('manage@') || body.fileId.startsWith('chunk_')) return failure('invalid_request');
            if (!recipients.some(user => user.id === body.recipient)) return failure('recipient_not_allowed', 403);
            const channel = channels.find(c => c.name === body.channel);
            if (!channel) return failure('bot_not_configured');
            const path = await resolveFilePath(db, body.fileId);
            if (!path || path.startsWith('manage@') || path.startsWith('chunk_')) return failure('file_not_found', 404);
            const record = await db.getWithMetadata(path);
            const metadata = record?.metadata;
            if (!metadata?.Channel || metadata.TimeStamp == null) return failure('file_not_found', 404);
            const name = (metadata.FileName || path.split('/').pop()).slice(0, 240);
            const caption = name;
            const tg = ['Telegram', 'TelegramNew'].includes(metadata.Channel);
            const source = tg ? findConfiguredChannel(config, 'telegram', metadata) : null;
            const fileId = metadata.TgFileId || (metadata.Channel === 'Telegram' ? path.split('/').pop().split('.')[0] : '');
            if (tg && !metadata.IsChunked && source?.botToken === channel.botToken && fileId) {
                let result = await services.call(channel, 'sendDocument', { chat_id: body.recipient, document: fileId, caption });
                // Telegram file IDs retain their original media type. A rejected
                // document request is safe to retry as that media type, not after a timeout.
                if (!result.ok && result.code === 400 && result.mediaMismatch) {
                    const mime = metadata.FileType || '';
                    const method = mime === 'image/gif' || mime === 'image/webp' ? ['sendAnimation','animation'] :
                        mime.startsWith('image/') ? ['sendPhoto','photo'] : mime.startsWith('video/') ? ['sendVideo','video'] :
                        mime.startsWith('audio/') ? ['sendAudio','audio'] : null;
                    if (method) result = await services.call(channel, method[0], { chat_id: body.recipient, [method[1]]: fileId, caption });
                }
                if (!result.ok) return telegramFailure(result);
                return json({ success: true, name, messageId: result.messageId });
            }
            // Read through the existing authenticated file handler. Never accept
            // a client URL, send credentials to Telegram, or follow external redirects.
            if (metadata.Channel === 'External') return failure('external_file_unsupported');
            if (Number(metadata.FileSizeBytes || Number(metadata.FileSize) * 1024 * 1024) > TELEGRAM_REUPLOAD_LIMIT) return failure('file_too_large');
            const response = await services.readFile(context, path);
            const blob = await limitedBlob(response);
            const form = new FormData(); form.set('chat_id', body.recipient); form.set('caption', caption); form.set('document', blob, name);
            const result = await services.call(channel, 'sendDocument', form);
            if (!result.ok) return telegramFailure(result);
            return json({ success: true, name, messageId: result.messageId });
        } catch (error) {
            // Bot URLs include credentials. Do not expose or log raw exceptions.
            const known = ['file_unavailable', 'file_too_large'].includes(error.message);
            return failure(known ? error.message : 'delivery_unknown', known ? 400 : 502);
        }
    };
}

function telegramFailure(result) {
    if (result.code === 429) return failure('rate_limited', 429, { retryAfter: result.retryAfter || 30 });
    if (result.code === 403 || result.recipientUnavailable) return failure('recipient_unavailable', 400);
    if (result.code === 401) return failure('bot_unavailable', 400);
    if (result.code >= 500) return failure('delivery_unknown', 502);
    return failure('telegram_rejected', 400);
}
