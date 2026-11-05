import { S3Client, CopyObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getDatabase } from './databaseAdapter.js';
import { DiscordAPI } from './storage/discordAPI.js';
import { HuggingFaceAPI } from './storage/huggingfaceAPI.js';
import { WebDAVAPI } from './storage/webdavAPI.js';
import { resolveS3Credentials, resolveWebDAVCredentials, resolveDiscordCredentials, resolveHuggingFaceCredentials } from './metadata/channelCredentials.js';

function s3Client(c) {
    return new S3Client({ region: c.region, endpoint: c.endpoint, forcePathStyle: c.pathStyle,
        credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey } });
}

// These channels require a buffered re-upload. Bound each part, including when
// upstream omits Content-Length, rather than exhausting a Worker's memory.
async function boundedBlob(response, limit = 20 * 1024 * 1024) {
    if (!response.ok) throw new Error('无法读取源文件内容');
    const reader = response.body.getReader();
    const parts = []; let size = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            size += value.byteLength;
            if (size > limit) throw new Error('此存储渠道暂仅支持每个文件或分片不超过 20 MB 的替换');
            parts.push(value);
        }
    } catch (error) { await reader.cancel().catch(() => {}); throw error; }
    return new Blob(parts);
}

export function supportsReplacement(metadata) {
    return ['Telegram', 'TelegramNew', 'CloudflareR2', 'S3', 'WebDAV', 'Discord', 'HuggingFace'].includes(metadata?.Channel);
}

// Prepare an independent snapshot before publishing the new target record.
// Telegram file IDs are immutable and app deletion never deletes their bytes.
export async function cloneReplacementContent(env, path, record) {
    const db = getDatabase(env);
    const metadata = structuredClone(record.metadata);
    let value = record.value;
    const key = `imgbed-replacements/${crypto.randomUUID()}/${String(metadata.FileName || path.split('/').pop()).split('/').pop()}`;
    const rollback = [];
    try {
        if (metadata.Channel === 'Telegram') {
            metadata.TgFileId = path.split('.')[0];
            metadata.Channel = 'TelegramNew';
        } else if (metadata.Channel === 'CloudflareR2') {
            const object = await env.img_r2.get(metadata.R2FileKey || path);
            if (!object) throw new Error('源文件的 R2 内容不存在');
            rollback.push(() => env.img_r2.delete(key));
            await env.img_r2.put(key, object.body, { httpMetadata: object.httpMetadata, customMetadata: object.customMetadata });
            metadata.R2FileKey = key;
        } else if (metadata.Channel === 'S3') {
            const c = await resolveS3Credentials(db, env, metadata);
            if (c.source === 'missing') throw new Error('源文件存储渠道未配置');
            const client = s3Client(c);
            rollback.push(() => client.send(new DeleteObjectCommand({ Bucket: c.bucketName, Key: key })));
            await client.send(new CopyObjectCommand({ Bucket: c.bucketName, Key: key,
                CopySource: [c.bucketName, ...c.key.split('/')].map(encodeURIComponent).join('/') }));
            metadata.S3FileKey = key;
        } else if (metadata.Channel === 'WebDAV') {
            const c = await resolveWebDAVCredentials(db, env, metadata);
            const api = new WebDAVAPI(c);
            await api.ensureDirectory(key);
            rollback.push(() => api.deleteFile(key));
            const response = await fetch(api.buildObjectUrl(c.filePath), { method: 'COPY', redirect: 'manual',
                headers: api.getRequestHeaders({ Destination: api.buildObjectUrl(key), Overwrite: 'F' }) });
            if (!response.ok) throw new Error('WebDAV 服务未能复制源文件');
            metadata.WebDAVFilePath = key;
        } else if (metadata.Channel === 'Discord') {
            const c = await resolveDiscordCredentials(db, env, metadata);
            if (c.source === 'missing') throw new Error('源文件存储渠道未配置');
            const api = new DiscordAPI(c.botToken);
            const copy = async (messageId, name) => {
                const blob = await boundedBlob(await api.getFileContent(c.channelId, messageId));
                const result = await api.sendFile(blob, c.channelId, name);
                if (result?.id) rollback.push(() => api.deleteMessage(c.channelId, result.id));
                const info = api.getFileInfo(result);
                if (!info) throw new Error('Discord 未返回复制文件');
                return info.message_id;
            };
            if (metadata.IsChunked) {
                const chunks = JSON.parse(value);
                for (const chunk of chunks) chunk.messageId = await copy(chunk.messageId, chunk.fileName || metadata.FileName);
                value = JSON.stringify(chunks);
            } else {
                metadata.DiscordMessageId = await copy(c.messageId, metadata.FileName);
            }
        } else if (metadata.Channel === 'HuggingFace') {
            const c = await resolveHuggingFaceCredentials(db, env, metadata);
            if (c.source === 'missing') throw new Error('源文件存储渠道未配置');
            const api = new HuggingFaceAPI(c.token, c.repo, c.isPrivate);
            const blob = await boundedBlob(await api.getFileContent(c.filePath));
            rollback.push(() => api.deleteFile(key));
            const result = await api.uploadFile(blob, key, 'Copy file for replacement');
            if (!result.success) throw new Error('HuggingFace 文件复制失败');
            metadata.HfFilePath = key;
        } else if (metadata.Channel !== 'TelegramNew') {
            throw new Error('此源文件渠道暂不支持替换，请使用已上传的文件');
        }
        return { value, metadata, rollback: async () => {
            for (const remove of rollback.reverse()) await remove().catch(() => {});
        } };
    } catch (error) {
        for (const remove of rollback.reverse()) await remove().catch(() => {});
        throw error;
    }
}

// Remove only the old backing content; never delete a freshly published DB record.
export async function removeStoredContent(env, path, record) {
    const db = getDatabase(env); const m = record.metadata;
    if (m.Channel === 'CloudflareR2') await env.img_r2.delete(m.R2FileKey || path);
    else if (m.Channel === 'S3') {
        const c = await resolveS3Credentials(db, env, m);
        await s3Client(c).send(new DeleteObjectCommand({ Bucket: c.bucketName, Key: c.key }));
    } else if (m.Channel === 'WebDAV') {
        const c = await resolveWebDAVCredentials(db, env, m);
        if (!await new WebDAVAPI(c).deleteFile(c.filePath)) throw new Error('WebDAV 清理失败');
    } else if (m.Channel === 'Discord') {
        const c = await resolveDiscordCredentials(db, env, m);
        const api = new DiscordAPI(c.botToken);
        const messages = m.IsChunked ? JSON.parse(record.value).map(chunk => chunk.messageId) : [c.messageId];
        for (const id of messages) if (!await api.deleteMessage(c.channelId, id)) throw new Error('Discord 清理失败');
    } else if (m.Channel === 'HuggingFace') {
        const c = await resolveHuggingFaceCredentials(db, env, m);
        if (!await new HuggingFaceAPI(c.token, c.repo, c.isPrivate).deleteFile(c.filePath)) throw new Error('HuggingFace 清理失败');
    }
}

export function storageIdentity(path, record) {
    const m = record.metadata;
    return JSON.stringify([m.Channel, m.ChannelName, m.R2FileKey || (m.Channel === 'CloudflareR2' ? path : ''),
        m.S3FileKey, m.WebDAVFilePath, m.HfFilePath, m.DiscordMessageId, m.IsChunked ? record.value : '']);
}
