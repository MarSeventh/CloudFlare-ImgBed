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

  const sanitized = stripSensitiveMetadata(metadata);

  if (sanitized.WebDAVBaseUrl) {
    const safeBaseUrl = stripUrlUserinfo(sanitized.WebDAVBaseUrl);
    if (safeBaseUrl) {
      sanitized.WebDAVBaseUrl = safeBaseUrl;
    } else {
      delete sanitized.WebDAVBaseUrl;
    }
  }

  return sanitized;
}

export function stripSensitiveMetadata(metadata = {}) {
  if (!metadata || typeof metadata !== 'object') {
    return metadata;
  }

  const stripped = { ...metadata };
  for (const key of SENSITIVE_METADATA_KEYS) {
    delete stripped[key];
  }
  return stripped;
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
