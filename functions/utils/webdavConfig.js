import { getUploadConfig } from '../api/manage/sysConfig/upload.js';
import { getDatabase } from './databaseAdapter.js';
import { normalizeWebDAVHeaders } from './storage/webdavAPI.js';

export async function resolveWebDAVConfig(env, metadata = {}) {
    const channelName = metadata.ChannelName;
    const metadataBaseUrl = metadata.WebDAVBaseUrl;

    try {
        const db = getDatabase(env);
        const uploadConfig = await getUploadConfig(db, env);
        const channels = uploadConfig.webdav?.channels || [];

        const channel = channels.find((item) => item.name === channelName)
            || channels.find((item) => getWebDAVBaseUrl(item) === metadataBaseUrl);

        if (channel) {
            const config = normalizeWebDAVConfig(channel);
            return config ? { ...config, source: 'config' } : null;
        }
    } catch (error) {
        console.error('Failed to resolve WebDAV channel config:', error);
    }

    const config = normalizeWebDAVConfig({
        baseUrl: metadataBaseUrl,
        username: metadata.WebDAVUsername || '',
        password: metadata.WebDAVPassword || '',
        headers: metadata.WebDAVHeaders || {},
        createDirectory: metadata.WebDAVCreateDirectory !== false,
        publicUrl: metadata.WebDAVPublicBaseUrl || '',
    });
    return config ? { ...config, source: 'metadata' } : null;
}

function normalizeWebDAVConfig(config = {}) {
    const baseUrl = getWebDAVBaseUrl(config);
    if (!baseUrl) return null;

    return {
        baseUrl,
        username: config.username || '',
        password: config.password || '',
        headers: normalizeWebDAVHeaders(config.headers || config.customHeaders || {}),
        createDirectory: config.createDirectory !== false,
        publicUrl: config.publicUrl || '',
    };
}

function getWebDAVBaseUrl(config = {}) {
    return config.baseUrl || config.endpoint || config.url || '';
}
