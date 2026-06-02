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

export function sanitizeFileMetadata(metadata = {}) {
  if (!metadata || typeof metadata !== 'object') {
    return metadata;
  }

  return stripSensitiveMetadata(metadata);
}

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
