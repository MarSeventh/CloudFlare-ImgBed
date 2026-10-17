/**
 * Import files that were posted MANUALLY into the Telegram channel
 * (from the Telegram app) into AnimeLK Storage's index, so they show
 * up in the web manager and get normal /file/... links.
 *
 * How it works:
 *  - The bot is an admin of the channel, so Telegram reports every new
 *    channel post to the bot through getUpdates.
 *  - This endpoint scans those pending posts, registers every
 *    document/video/audio as a regular TelegramNew file record
 *    (same metadata shape as a normal upload) and acknowledges the
 *    processed updates so they are not imported twice.
 *
 * Notes:
 *  - Serving files over ~20 MB requires the self-hosted Bot API server
 *    (local mode) as the channel's proxy URL - on the standard cloud
 *    Bot API the bot cannot download big files back.
 *  - POST /api/manage/telegramImport
 *    body (all optional): { "channelName": "...", "uploadFolder": "..." }
 */

import { getDatabase } from '../../utils/databaseAdapter.js';
import { fetchUploadConfig } from '../../utils/sysConfig.js';
import { TelegramAPI } from '../../utils/storage/telegramAPI.js';
import { buildUniqueFileId, endUpload, sanitizeUploadFolder } from '../../upload/uploadTools.js';
import { resolveFileType } from '../../utils/mimeTypes.js';

function jsonResponse(obj, status = 200) {
    return new Response(JSON.stringify(obj), {
        status,
        headers: { 'Content-Type': 'application/json' }
    });
}

/**
 * Match a Telegram chat object against a configured channel chatId.
 * Accepts numeric ids with or without the -100 prefix and @usernames.
 */
export function chatIdMatches(chat, configuredChatId) {
    if (!chat || !configuredChatId) return false;
    const wanted = String(configuredChatId).trim();
    const id = String(chat.id ?? '');
    if (id === wanted) return true;
    if (wanted && !wanted.startsWith('@') && !wanted.startsWith('-') && `-100${wanted}` === id) return true;
    if (wanted.startsWith('@') && chat.username && `@${chat.username}`.toLowerCase() === wanted.toLowerCase()) return true;
    return false;
}

/** Extract importable media (document/video/audio/animation) from getUpdates results. */
export function extractChannelMedia(updates, configuredChatId) {
    const out = [];
    for (const update of Array.isArray(updates) ? updates : []) {
        const post = update?.channel_post;
        if (!post) continue;
        if (!chatIdMatches(post.chat, configuredChatId)) continue;
        const media = post.document || post.video || post.animation || post.audio || null;
        if (!media || !media.file_id) continue;
        out.push({
            fileId: media.file_id,
            fileName: media.file_name || post.video?.file_name || `telegram_file_${post.message_id || Date.now()}`,
            mimeType: media.mime_type || 'application/octet-stream',
            fileSizeBytes: Number(media.file_size) || 0,
            timeStamp: post.date ? post.date * 1000 : Date.now(),
            updateId: update.update_id ?? 0,
        });
    }
    return out;
}

export async function onRequest(context) {
    const { request, env, waitUntil } = context;

    if (request.method !== 'POST') {
        return jsonResponse({ success: false, error: 'Use POST' }, 405);
    }

    // Auth is enforced by functions/api/manage/_middleware.js (manage permission).
    let body = {};
    try { body = await request.json(); } catch { /* empty body is fine */ }

    const url = new URL(request.url);
    const db = getDatabase(env);

    // Naming / folder options can come from the body or the query string.
    const bodyFolder = typeof body.uploadFolder === 'string' ? body.uploadFolder : (url.searchParams.get('uploadFolder') || '');
    const normalizedFolder = sanitizeUploadFolder(bodyFolder);
    url.searchParams.set('uploadNameType', typeof body.uploadNameType === 'string' && body.uploadNameType ? body.uploadNameType : (url.searchParams.get('uploadNameType') || 'default'));
    url.searchParams.set('uploadFolder', normalizedFolder);

    const uploadConfig = await fetchUploadConfig(env, context);
    const channels = uploadConfig?.telegram?.channels || [];
    if (!channels.length) {
        return jsonResponse({ success: false, error: 'No Telegram channel is configured in upload settings' }, 400);
    }
    const wantedChannel = typeof body.channelName === 'string' ? body.channelName : (url.searchParams.get('channelName') || '');
    const selected = wantedChannel ? channels.filter(ch => ch.name === wantedChannel) : channels;
    if (!selected.length) {
        return jsonResponse({ success: false, error: `Channel not found: ${wantedChannel}` }, 404);
    }

    const fakeUploadContext = { env, url, waitUntil };
    let imported = 0;
    const files = [];
    const errors = [];

    for (const channel of selected) {
        try {
            const api = new TelegramAPI(channel.botToken, channel.proxyUrl || '');

            const updatesUrl = `${api.baseURL}/getUpdates?limit=100&allowed_updates=${encodeURIComponent(JSON.stringify(['channel_post']))}`;
            const updatesRes = await fetch(updatesUrl, { headers: api.defaultHeaders });
            if (!updatesRes.ok) {
                errors.push(`[${channel.name}] getUpdates failed with HTTP ${updatesRes.status}`);
                continue;
            }
            const updatesData = await updatesRes.json().catch(() => null);
            if (!updatesData?.ok) {
                errors.push(`[${channel.name}] getUpdates returned an error: ${JSON.stringify(updatesData?.description || '').slice(0, 200)}`);
                continue;
            }

            const mediaItems = extractChannelMedia(updatesData.result, channel.chatId);
            let maxUpdateId = 0;

            for (const item of mediaItems) {
                maxUpdateId = Math.max(maxUpdateId, item.updateId);
                try {
                    const fileType = resolveFileType(item.fileName, item.mimeType) || item.mimeType || 'application/octet-stream';
                    const fullId = await buildUniqueFileId(fakeUploadContext, item.fileName, fileType);
                    const metadata = {
                        FileName: item.fileName,
                        FileType: fileType,
                        FileSize: (item.fileSizeBytes / 1024 / 1024).toFixed(2),
                        FileSizeBytes: item.fileSizeBytes,
                        UploadIP: 'telegram-import',
                        UploadAddress: 'Telegram channel import',
                        ListType: 'None',
                        TimeStamp: item.timeStamp,
                        Label: 'None',
                        Directory: normalizedFolder === '' ? '' : normalizedFolder + '/',
                        Tags: [],
                        Channel: 'TelegramNew',
                        ChannelName: channel.name,
                        TgFileId: item.fileId,
                    };
                    await db.put(fullId, '', { metadata });
                    await endUpload(fakeUploadContext, fullId, metadata);
                    imported++;
                    files.push({ name: item.fileName, id: fullId, size: metadata.FileSize + ' MB', channel: channel.name });
                } catch (itemError) {
                    errors.push(`[${channel.name}] failed to import "${item.fileName}": ${itemError.message}`);
                }
            }

            // Acknowledge the processed updates so they are not imported twice.
            if (maxUpdateId > 0) {
                await fetch(`${api.baseURL}/getUpdates?offset=${maxUpdateId + 1}&limit=1&allowed_updates=${encodeURIComponent(JSON.stringify(['channel_post']))}`, { headers: api.defaultHeaders }).catch(() => {});
            }
        } catch (channelError) {
            errors.push(`[${channel.name}] ${channelError.message}`);
        }
    }

    return jsonResponse({ success: true, imported, files, errors });
}
