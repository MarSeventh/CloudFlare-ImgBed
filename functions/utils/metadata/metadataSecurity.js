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

export function stripSensitiveMetadata(metadata = {}) {
  if (!metadata || typeof metadata !== 'object') {
    return metadata;
  }

  const stripped = { ...metadata };
  return stripSensitiveMetadataInPlace(stripped);
}

export function stripSensitiveMetadataInPlace(metadata = {}) {
  if (!metadata || typeof metadata !== 'object') {
    return metadata;
  }

  for (const key of SENSITIVE_METADATA_KEYS) {
    delete metadata[key];
  }

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

export function stripConfigDerivedMetadata(metadata = {}) {
  if (!metadata || typeof metadata !== 'object') {
    return metadata;
  }

  const stripped = { ...metadata };
  return stripConfigDerivedMetadataInPlace(stripped);
}

export function stripConfigDerivedMetadataInPlace(metadata = {}) {
  if (!metadata || typeof metadata !== 'object') {
    return metadata;
  }

  for (const key of CONFIG_DERIVED_METADATA_KEYS) {
    delete metadata[key];
  }

  return metadata;
}

export function cleanPersistedMetadata(metadata = {}) {
  if (!metadata || typeof metadata !== 'object') {
    return metadata;
  }

  const cleaned = { ...metadata };
  return cleanPersistedMetadataInPlace(cleaned);
}

export function cleanPersistedMetadataInPlace(metadata = {}) {
  stripSensitiveMetadataInPlace(metadata);
  stripConfigDerivedMetadataInPlace(metadata);
  return metadata;
}

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
