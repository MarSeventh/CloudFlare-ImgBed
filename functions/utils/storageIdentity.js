// Pure helpers describing where a record's bytes live. Kept free of storage SDK
// imports: trash.js (and through it indexManager.js) depends on this module.

export function storageIdentity(path, record) {
    const m = record.metadata;
    return JSON.stringify([m.Channel, m.ChannelName, m.R2FileKey || (m.Channel === 'CloudflareR2' ? path : ''),
        m.S3FileKey, m.WebDAVFilePath, m.HfFilePath, m.DiscordMessageId, m.IsChunked ? record.value : '']);
}

// Short digest of storageIdentity, small enough for KV list metadata. Equal
// digests are only a hint: callers must still compare the full identity.
export async function storageDigest(path, record) {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(storageIdentity(path, record)));
    return Array.from(new Uint8Array(bytes).slice(0, 16), byte => byte.toString(16).padStart(2, '0')).join('');
}
