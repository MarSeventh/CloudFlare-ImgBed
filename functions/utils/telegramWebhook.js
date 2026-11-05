import { chooseFilePath, uploadFileName } from './fileNaming.js';
import { resolveFilePath, isFixedId } from './fileIdentity.js';
import { telegramAllowedUsers } from './telegramAllowlist.js';

const MAX_FILE_SIZE = 20 * 1024 * 1024;
const SECRET_HEADER = 'X-Telegram-Bot-Api-Secret-Token';

function response(text, status = 200) {
    return new Response(text, { status, headers: { 'Cache-Control': 'no-store' } });
}

function selectFile(message) {
    if (message.photo?.length) {
        const photo = message.photo.reduce((a, b) =>
            (a.file_size || a.width * a.height) > (b.file_size || b.width * b.height) ? a : b);
        return { ...photo, file_name: 'photo.jpg', mime_type: 'image/jpeg' };
    }
    for (const type of ['document', 'animation', 'video', 'audio', 'voice']) {
        if (message[type]) {
            const file = message[type];
            const extension = { animation: 'mp4', video: 'mp4', audio: 'mp3', voice: 'ogg', document: 'bin' }[type];
            return { ...file, file_name: file.file_name || `${type}.${extension}`,
                mime_type: file.mime_type || 'application/octet-stream' };
        }
    }
    return null;
}

// Keep the handler independent of storage implementations for focused integration tests.
export function createTelegramWebhookHandler(services) {
    return async function handle(context) {
        const { request, env } = context;
        if (request.method !== 'POST') return response('Method not allowed', 405);
        const secret = env.TG_WEBHOOK_SECRET || '';
        if (!/^[A-Za-z0-9_-]{32,256}$/.test(secret)) return response('Webhook not configured', 503);
        // Compare fixed-size digests so the secret comparison does not reveal a prefix.
        const supplied = request.headers.get(SECRET_HEADER) || '';
        const digest = value => crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
        const [expectedHash, suppliedHash] = await Promise.all([digest(secret), digest(supplied)]);
        let mismatch = 0;
        new Uint8Array(expectedHash).forEach((byte, i) => { mismatch |= byte ^ new Uint8Array(suppliedHash)[i]; });
        if (mismatch) return response('Unauthorized', 401);

        // Union of TG_UPLOAD_ALLOWED_USER_IDS and the dashboard list. A malformed
        // environment entry still closes the entrance instead of being ignored.
        const allowlist = telegramAllowedUsers(env, await services.fetchSecurityConfig(env));
        const allowedIds = allowlist.users.map(user => user.id);
        if (!allowedIds.length || allowlist.misconfigured) {
            return response('Upload allowlist not configured', 503);
        }
        // Validate configuration before any side effect, and without letting a
        // missing value surface as a generic "temporarily failed" error.
        let publicURL = null;
        try { publicURL = new URL(env.TG_UPLOAD_PUBLIC_URL || ''); } catch { /* reported below */ }
        if (!publicURL || publicURL.protocol !== 'https:' || publicURL.username || publicURL.password ||
            publicURL.pathname !== '/' || publicURL.search || publicURL.hash) {
            return response('Public URL must be an HTTPS origin', 503);
        }
        let update;
        try {
            // Telegram updates contain metadata only, never the uploaded binary file.
            const body = await request.text();
            if (body.length > 256 * 1024) return response('Update too large', 413);
            update = JSON.parse(body);
        } catch { return response('Invalid JSON', 400); }
        const message = update?.message;
        if (!message || message.chat?.type !== 'private' || message.from?.is_bot ||
            !allowedIds.includes(String(message.from?.id)) ||
            !Number.isSafeInteger(message.message_id) || message.message_id <= 0 ||
            !Number.isSafeInteger(message.chat.id) || message.chat.id !== message.from.id) {
            return response('Ignored');
        }

        try {
            const config = await services.fetchUploadConfig(env, context);
            const channels = config.telegram.channels;
            const channelName = env.TG_UPLOAD_CHANNEL_NAME;
            // Ambiguous channel selection must be resolved explicitly.
            const channel = channelName ? channels.find(item => item.name === channelName) :
                (channels.length === 1 ? channels[0] : null);
            if (!channel?.botToken || !channel.chatId) return response('Telegram channel not configured', 503);
            const api = services.createAPI(channel);
            const reply = async text => {
                try {
                    await api.call('sendMessage', { chat_id: message.chat.id, text,
                        reply_parameters: { message_id: message.message_id, allow_sending_without_reply: true },
                        link_preview_options: { is_disabled: true } });
                } catch {
                    // Do not replay a completed upload just because a notification failed.
                    console.error('Telegram upload reply failed');
                }
            };
            if (/^\/(start|help|id)(?:@\w+)?(?:\s|$)/.test(message.text || '')) {
                await reply(`你的 Telegram ID：${message.from.id}\n直接发送图片或文件即可上传图床（最大 20 MB）。原图请作为文件发送。`);
                return response('OK');
            }
            const file = selectFile(message);
            if (!file) {
                await reply('请发送图片、文件、视频或音频。原图请作为文件发送。');
                return response('OK');
            }
            if (!Number.isFinite(file.file_size) || file.file_size <= 0 || file.file_size > MAX_FILE_SIZE) {
                await reply('此文件无法通过 Bot 导入：单个文件需不超过 20 MB。较大文件请通过图床网页上传。');
                return response('OK');
            }
            const folder = services.sanitizeUploadFolder(env.TG_UPLOAD_FOLDER || 'Telegram');
            let name = uploadFileName(file.file_name || 'file.bin');
            // The same bot/chat/message always maps to one record on Telegram retries.
            const botId = channel.botToken.split(':')[0];
            // Keep the storage key ASCII-safe: the existing file route decodes IDs
            // and treats commas as path separators. Preserve the original name in metadata.
            const extension = name.match(/\.([a-zA-Z0-9]{1,12})$/)?.[1].toLowerCase() || 'bin';
            const legacyFileId = `${folder ? folder + '/' : ''}tg_${botId}_${message.chat.id}_${message.message_id}.${extension}`;
            const db = services.getDatabase(env);
            const receiptKey = `manage@telegramImport@${botId}_${message.chat.id}_${message.message_id}`;
            let receipt = await db.get(receiptKey);
            let fileId = receipt ? await resolveFilePath(db, receipt) : await resolveFilePath(db, legacyFileId) || legacyFileId;
            if (!fileId) return response('Previously imported file was deleted');
            let existing = await db.getWithMetadata(fileId);
            // A receipt that is still a plain path was reserved before its record was
            // written. Reuse it only while it is empty or holds this same upload.
            const reservedPathTaken = receipt && !isFixedId(receipt) && existing?.metadata &&
                existing.metadata.TgFileId !== file.file_id;
            if ((!receipt && !existing?.metadata) || reservedPathTaken) {
                fileId = await chooseFilePath(db, folder, name);
                // Reserve the chosen path before any side effect, so a retry after a
                // partial failure reuses it instead of allocating "name (2)".
                receipt = fileId;
                await db.put(receiptKey, receipt);
                existing = null;
            }
            let metadata = existing?.metadata;
            if (!metadata) {
                const telegramFile = await api.call('getFile', { file_id: file.file_id });
                if (!telegramFile.file_path || telegramFile.file_size > MAX_FILE_SIZE) {
                    await reply('此文件无法读取，请使用图床网页上传。');
                    return response('OK');
                }
                // Copy within Telegram; no binary download/re-upload or image recompression.
                await api.call('copyMessage', { chat_id: channel.chatId,
                    from_chat_id: message.chat.id, message_id: message.message_id });
                metadata = {
                    FileName: fileId.split('/').pop(), FileType: file.mime_type,
                    FileSize: (file.file_size / 1024 / 1024).toFixed(2), FileSizeBytes: file.file_size,
                    UploadIP: null, UploadAddress: 'Telegram Bot', ListType: 'None',
                    TimeStamp: Date.now(), Label: 'None', Directory: folder ? folder + '/' : '', Tags: [],
                    Channel: 'TelegramNew', ChannelName: channel.name, TgFileId: file.file_id,
                    TgImportIndexed: false, NamePolicyVersion: 1,
                    ...(file.width && file.height ? { Width: file.width, Height: file.height } : {})
                };
                await db.put(fileId, '', { metadata });
            }
            // Point the receipt at the immutable ID once the record exists.
            const finalReceipt = metadata.FixedId || fileId;
            if (receipt !== finalReceipt) await db.put(receiptKey, finalReceipt);
            if (!metadata.TgImportIndexed) {
                const url = new URL(request.url);
                const cacheUrl = `${publicURL.origin}/file/${fileId}`;
                // Moderate through this site's own file route (as upstream does for S3
                // and HuggingFace) instead of a Bot API URL, which embeds the bot token
                // and would hand it to the third-party moderation service.
                await services.purgeCDNCache(env, cacheUrl, url, folder).catch(() => {});
                const label = await services.moderateContent(env,
                    `${publicURL.origin}/file/${fileId.split('/').map(encodeURIComponent).join('/')}`);
                metadata = { ...metadata, Label: label };
                const indexResult = await services.addFileToIndex(context, fileId, metadata);
                if (!indexResult.success) throw new Error('Index write failed');
                metadata = { ...metadata, TgImportIndexed: true };
                await db.put(fileId, '', { metadata });
                context.waitUntil(services.purgeCDNCache(env, cacheUrl, url, folder).catch(() => {
                    console.error('Telegram upload cache refresh failed');
                }));
            }
            const link = `${publicURL.origin}/file/${(metadata.FixedId || fileId).split('/').map(encodeURIComponent).join('/')}`;
            await reply(`上传成功：${metadata.FileName}\n${link}`);
            return response('OK');
        } catch {
            // Never log Bot API request URLs, credentials, or full incoming updates.
            console.error('Telegram import failed; Telegram may retry the update');
            return response('Import temporarily failed', 503);
        }
    };
}
