import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getDatabase } from './databaseAdapter.js';
import { getUploadConfig } from '../api/manage/sysConfig/upload.js';
import { findConfiguredChannel } from './metadata/channelConfig.js';
import { fetchSecurityConfig } from './sysConfig.js';
import { resolveS3Credentials, resolveWebDAVCredentials, resolveDiscordCredentials, resolveTelegramCredentials } from './metadata/channelCredentials.js';
import { WebDAVAPI } from './storage/webdavAPI.js';
import { DiscordAPI } from './storage/discordAPI.js';
import { TelegramAPI } from './storage/telegramAPI.js';
import { getImageDimensions, moderateContent } from '../upload/uploadTools.js';

export const RAW_REPLACEMENT_LIMIT = 20 * 1024 * 1024;
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const s3 = c => new S3Client({ region: c.region, endpoint: c.endpoint, forcePathStyle: c.pathStyle,
    credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey } });
const endpointIdentity = endpoint => new URL(endpoint).href.replace(/\/+$/, '');
const objectUrl = (base, key) => base ? base.replace(/\/+$/, '') + '/' + key.split('/').map(encodeURIComponent).join('/') : '';

// There is deliberately no call to /upload or endUpload: staging never registers
// a file, allocates an identity, indexes a source, or creates a trash entry.
export async function stageRawReplacement(env, path, target, file) {
    const db = getDatabase(env), old = target.metadata;
    const channel = old.Channel;
    if (!['CloudflareR2', 'S3', 'WebDAV', 'Discord', 'Telegram', 'TelegramNew'].includes(channel)) {
        throw fail('此渠道不支持本地文件直接替换（支持 R2、S3、WebDAV、Discord、Telegram）', 422);
    }
    const config = await getUploadConfig(db, env);
    let c, selectedChannel, api, publicUrl = '';
    if (channel === 'CloudflareR2') {
        c = config.cfr2.channels.find(ch => ch.name === old.ChannelName) || (!old.ChannelName ? config.cfr2.channels[0] : null);
        selectedChannel = c;
        if (!env.img_r2 || !c || c.enabled === false) throw fail('目标 R2 渠道未配置或已停用', 422);
    } else {
        const resolve = { S3: resolveS3Credentials, WebDAV: resolveWebDAVCredentials, Discord: resolveDiscordCredentials,
            Telegram: resolveTelegramCredentials, TelegramNew: resolveTelegramCredentials }[channel];
        c = await resolve(db, env, old);
        const group = { S3: 's3', WebDAV: 'webdav', Discord: 'discord', Telegram: 'telegram', TelegramNew: 'telegram' }[channel];
        selectedChannel = findConfiguredChannel(config, group, old);
        if (c.source === 'missing' || !selectedChannel || selectedChannel.enabled === false) {
            throw fail('目标存储渠道未配置或已停用', 422);
        }
    }
    // Never interpolate either filename into a storage path (including '.'/'..',
    // percent escapes and backslashes). Reject aliasing even if UUID is repeated.
    const key = `imgbed-raw-replacements/${crypto.randomUUID()}/content`;
    if ([path, old.R2FileKey, old.S3FileKey, old.WebDAVFilePath, old.HfFilePath].includes(key) ||
        (await db.getWithMetadata(key))?.metadata) throw fail('暂存路径冲突，请重试', 409);
    if (channel === 'CloudflareR2') publicUrl = objectUrl(c.publicUrl, key);
    if (channel === 'S3') publicUrl = objectUrl(c.cdnDomain, key);
    if (channel === 'WebDAV') { api = new WebDAVAPI(c); publicUrl = api.buildPublicUrl(key, c.publicUrl); }
    const moderate = (await fetchSecurityConfig(env)).upload.moderate;
    if (file.type.startsWith('image/') && moderate?.enabled && !publicUrl && channel !== 'Discord') {
        throw fail('启用图片审查时，此渠道需要可公开读取暂存内容的地址；目标未修改', 422);
    }
    const metadata = structuredClone(old);
    for (const field of ['Width', 'Height', 'Label', 'IsChunked', 'TotalChunks', 'chunkSize', 'ExternalLink',
        'R2FileKey', 'S3FileKey', 'WebDAVFilePath', 'HfFilePath', 'DiscordMessageId', 'TgFileId']) delete metadata[field];
    metadata.ChannelName = selectedChannel.name;
    metadata.FileType = file.type;
    metadata.FileSizeBytes = file.size;
    metadata.FileSize = (file.size / 1024 / 1024).toFixed(2);
    metadata.Label = 'None';
    if (file.type.startsWith('image/')) {
        const dimensions = getImageDimensions(await file.slice(0, 65536).arrayBuffer(), file.type);
        if (dimensions) { metadata.Width = dimensions.width; metadata.Height = dimensions.height; }
    }
    let remove = async () => {};
    const warnings = [];
    const rollback = async () => {
        try { await remove(); } catch { warnings.push('暂存内容清理失败，可能留有未引用对象'); }
        return warnings;
    };
    try {
        if (channel === 'CloudflareR2') {
            if (await env.img_r2.get(key)) throw fail('暂存对象已存在，请重试', 409);
            // Atomic create where supported. A failed/uncertain PUT never triggers
            // blind deletion of a key we have not positively acquired.
            const result = await env.img_r2.put(key, file, {
                onlyIf: { etagDoesNotMatch: '*' }, httpMetadata: { contentType: file.type }
            });
            if (result === null) throw fail('暂存对象已存在，请重试', 409);
            remove = () => env.img_r2.delete(key);
            metadata.R2FileKey = key;
        } else if (channel === 'S3') {
            const client = s3(c);
            await client.send(new PutObjectCommand({ Bucket: c.bucketName, Key: key, Body: new Uint8Array(await file.arrayBuffer()),
                ContentType: file.type, IfNoneMatch: '*' }));
            remove = () => client.send(new DeleteObjectCommand({ Bucket: c.bucketName, Key: key }));
            metadata.S3FileKey = key;
        } else if (channel === 'WebDAV') {
            await api.ensureDirectory(key);
            const response = await fetch(api.buildObjectUrl(key), { method: 'PUT', redirect: 'manual', body: file,
                headers: api.getRequestHeaders({ 'Content-Type': file.type, 'If-None-Match': '*' }) });
            if (!response.ok) throw fail(response.status === 412 ? '暂存对象冲突' : 'WebDAV 暂存上传失败', response.status === 412 ? 409 : 502);
            remove = () => api.deleteFile(key);
            metadata.WebDAVFilePath = key;
        } else if (channel === 'Discord') {
            api = new DiscordAPI(c.botToken);
            const result = await api.sendFile(file, c.channelId, 'content');
            const oldIds = old.IsChunked ? JSON.parse(target.value).map(part => part.messageId) : [c.messageId];
            if (!result?.id || oldIds.map(String).includes(String(result.id))) throw fail('Discord 未返回独立的新消息', 502);
            remove = async () => { if (!await api.deleteMessage(c.channelId, result.id)) throw new Error('Discord cleanup failed'); };
            const info = api.getFileInfo(result);
            if (!info) throw fail('Discord 未返回文件信息', 502);
            metadata.DiscordMessageId = info.message_id;
            publicUrl = info.url;
        } else {
            api = new TelegramAPI(c.botToken, c.proxyUrl);
            // sendDocument preserves the uploaded bytes; never sendPhoto/compress.
            const result = await api.sendFile(file, c.chatId, 'sendDocument', 'document', '', 'content');
            if (result?.ok && result.result?.message_id) {
                remove = async () => {
                    const response = await fetch(`${api.baseURL}/deleteMessage`, { method: 'POST',
                        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: c.chatId, message_id: result.result.message_id }) });
                    if (!response.ok || !(await response.json()).ok) throw new Error('Telegram cleanup failed');
                };
            }
            const info = api.getFileInfo(result);
            if (!info?.file_id) throw fail('Telegram 未返回文件信息', 502);
            metadata.Channel = 'TelegramNew'; metadata.TgFileId = info.file_id;
        }
        if (file.type.startsWith('image/')) {
            if (moderate?.enabled && !publicUrl) throw fail('暂存内容无法进行图片审查', 422);
            metadata.Label = await moderateContent(env, publicUrl);
        }
        return { value: '', metadata, rollback };
    } catch (error) {
        if (error.name === 'PreconditionFailed' || error.$metadata?.httpStatusCode === 412) {
            error.status = 409; error.message = '暂存对象冲突，请重试';
        }
        error.warnings = await rollback();
        throw error;
    }
}

// Cleanup must not delete an object still referenced by another active or
// trashed record. Resolve physical locations, not just display channel names.
async function locations(env, path, record) {
    const db = getDatabase(env), m = record.metadata;
    if (m.Channel === 'CloudflareR2') return [JSON.stringify(['r2', m.R2FileKey || path])];
    if (m.Channel === 'S3') {
        const c = await resolveS3Credentials(db, env, m);
        if (c.source === 'missing') throw new Error('Missing storage config');
        return [JSON.stringify(['s3', endpointIdentity(c.endpoint), c.bucketName, c.key])];
    }
    if (m.Channel === 'WebDAV') {
        const c = await resolveWebDAVCredentials(db, env, m);
        if (c.source === 'missing') throw new Error('Missing storage config');
        return [new WebDAVAPI(c).buildObjectUrl(c.filePath)];
    }
    if (m.Channel === 'Discord') {
        const c = await resolveDiscordCredentials(db, env, m);
        if (c.source === 'missing') throw new Error('Missing storage config');
        return (m.IsChunked ? JSON.parse(record.value).map(part => part.messageId) : [c.messageId])
            .map(id => JSON.stringify(['discord', String(c.channelId), String(id)]));
    }
    return []; // Telegram deletion in this app never removes file bytes.
}

export async function oldContentIsShared(env, path, old, staged) {
    const db = getDatabase(env), oldLocations = new Set(await locations(env, path, old));
    if (!oldLocations.size) return false;
    const aliases = async (p, r) => r?.metadata?.Channel === old.metadata.Channel && (await locations(env, p, r)).some(loc => oldLocations.has(loc));
    if (await aliases(path, staged)) return true;
    for (const prefix of ['', 'manage@trash@']) {
        let cursor;
        do {
            const page = await db.list({ prefix, limit: 1000, ...(cursor ? { cursor } : {}) });
            for (const key of page.keys || []) {
                if (prefix && key.name.startsWith('manage@trash@')) {
                    const entry = JSON.parse(key.value ?? await db.get(key.name));
                    if (entry?.record && entry.state !== 'purged' && await aliases(entry.path, entry.record)) return true;
                } else if (!key.name.startsWith('manage@') && !key.name.endsWith('/')) {
                    // Fetch values too: Discord chunk locations live in the value.
                    if (await aliases(key.name, await db.getWithMetadata(key.name))) return true;
                }
            }
            if (page.list_complete === false && !page.cursor) throw new Error('Incomplete storage reference scan');
            cursor = page.list_complete === false ? page.cursor : null;
        } while (cursor);
    }
    return false;
}
