/**
 * Metadata 安全清理工具
 * 负责移除不应持久化或不应返回给前端的敏感 metadata 字段
 */
const SENSITIVE_METADATA_KEYS = [
  'S3AccessKeyId',
  'S3SecretAccessKey',
  'TgBotToken',
  'DiscordBotToken',
  'HfToken',
  'WebDAVUsername',
  'WebDAVPassword',
  'WebDAVHeaders',
];

const CONFIG_DERIVED_METADATA_KEYS = [
  'S3Location',
  'S3Endpoint',
  'S3PathStyle',
  'S3Region',
  'S3BucketName',
  'S3CdnFileUrl',
  'TgChatId',
  'TgProxyUrl',
  'DiscordChannelId',
  'DiscordProxyUrl',
  'HfRepo',
  'HfIsPrivate',
  'HfFileUrl',
  'WebDAVBaseUrl',
  'WebDAVPublicBaseUrl',
  'WebDAVPublicUrl',
];

/* ========== 主要函数 ========== */

// 返回移除敏感字段后的 metadata 副本
export function stripSensitiveMetadata(metadata = {}) {
  if (!metadata || typeof metadata !== 'object') {
    return metadata;
  }

  const stripped = { ...metadata };
  return stripSensitiveMetadataInPlace(stripped);
}

// 返回移除配置派生字段后的 metadata 副本
export function stripConfigDerivedMetadata(metadata = {}) {
  if (!metadata || typeof metadata !== 'object') {
    return metadata;
  }

  const stripped = { ...metadata };
  return stripConfigDerivedMetadataInPlace(stripped);
}

// 返回适合持久化保存的 metadata 副本
export function cleanPersistedMetadata(metadata = {}) {
  if (!metadata || typeof metadata !== 'object') {
    return metadata;
  }

  const cleaned = { ...metadata };
  return cleanPersistedMetadataInPlace(cleaned);
}

/* ========== 关键函数 ========== */

// 原地移除敏感字段，并清理 WebDAV URL 中的 userinfo
export function stripSensitiveMetadataInPlace(metadata = {}) {
  if (!metadata || typeof metadata !== 'object') {
    return metadata;
  }

  // 凭据字段不随管理端接口响应返回，也不重新写回 metadata
  for (const key of SENSITIVE_METADATA_KEYS) {
    delete metadata[key];
  }

  // WebDAV 地址可能包含 userinfo，保留地址本身但移除用户名和密码
  if (metadata.WebDAVBaseUrl) {
    const safeBaseUrl = stripUrlUserinfo(metadata.WebDAVBaseUrl);
    if (safeBaseUrl) {
      metadata.WebDAVBaseUrl = safeBaseUrl;
    } else {
      delete metadata.WebDAVBaseUrl;
    }
  }

  return metadata;
}

// 原地移除可由当前渠道配置重新计算的字段
export function stripConfigDerivedMetadataInPlace(metadata = {}) {
  if (!metadata || typeof metadata !== 'object') {
    return metadata;
  }

  // 由当前渠道配置可重新计算的字段不再持久化，避免配置修改后展示旧值
  for (const key of CONFIG_DERIVED_METADATA_KEYS) {
    delete metadata[key];
  }

  return metadata;
}

// 原地清理敏感字段和配置派生字段
export function cleanPersistedMetadataInPlace(metadata = {}) {
  stripSensitiveMetadataInPlace(metadata);
  stripConfigDerivedMetadataInPlace(metadata);
  return metadata;
}

/* ========== 工具函数 ========== */

// 移除 URL 中可能携带的用户名和密码
function stripUrlUserinfo(value) {
  try {
    const url = new URL(value);
    url.username = '';
    url.password = '';
    return url.toString();
  } catch {
    return '';
  }
}
