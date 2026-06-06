import { getUploadConfig } from '../../api/manage/sysConfig/upload.js';

const CHANNEL_IDENTITY_RULES = {
  telegram: [
    [
      ['botToken', 'TgBotToken'],
      ['chatId', 'TgChatId'],
    ],
  ],
  s3: [
    [
      ['accessKeyId', 'S3AccessKeyId'],
      ['endpoint', 'S3Endpoint'],
      ['bucketName', 'S3BucketName'],
    ],
    [
      ['endpoint', 'S3Endpoint'],
      ['bucketName', 'S3BucketName'],
      ['pathStyle', 'S3PathStyle'],
    ],
    [
      ['endpoint', 'S3Endpoint'],
      ['bucketName', 'S3BucketName'],
    ],
  ],
  discord: [
    [
      ['botToken', 'DiscordBotToken'],
      ['channelId', 'DiscordChannelId'],
    ],
  ],
  huggingface: [
    [
      ['repo', 'HfRepo'],
      ['isPrivate', 'HfIsPrivate'],
    ],
    [
      ['repo', 'HfRepo'],
    ],
  ],
  webdav: [
    [
      ['baseUrl', 'WebDAVBaseUrl'],
      ['username', 'WebDAVUsername'],
    ],
    [
      ['baseUrl', 'WebDAVBaseUrl'],
    ],
  ],
};

const URL_IDENTITY_FIELDS = new Set([
  'endpoint',
  'S3Endpoint',
  'baseUrl',
  'WebDAVBaseUrl',
]);

const BOOLEAN_IDENTITY_FIELDS = new Set([
  'pathStyle',
  'S3PathStyle',
  'isPrivate',
  'HfIsPrivate',
]);

export async function loadChannelConfig(db, env, logContext = 'channel config') {
  try {
    return await getUploadConfig(db, env);
  } catch (error) {
    console.warn(`Failed to load upload config for ${logContext}:`, error.message);
    return null;
  }
}

export function findConfiguredChannel(uploadConfig, groupName, metadata = {}) {
  if (!uploadConfig) return null;

  const channels = uploadConfig[groupName]?.channels || [];
  if (metadata?.ChannelName) {
    const namedChannel = channels.find((channel) => channel.name === metadata.ChannelName);
    if (namedChannel) return namedChannel;
  }

  const identityChannel = findChannelByPersistedIdentity(channels, groupName, metadata);
  if (identityChannel) return identityChannel;

  return findLegacyTelegramEnvChannel(channels, groupName, metadata);
}

function findLegacyTelegramEnvChannel(channels, groupName, metadata = {}) {
  if (groupName === 'telegram' && (metadata.Channel === 'Telegram' || metadata.Channel === 'TelegramNew')) {
    return channels.find((channel) => channel.name === 'Telegram_env') || null;
  }

  return null;
}

function findChannelByPersistedIdentity(channels, groupName, metadata = {}) {
  const ruleGroups = CHANNEL_IDENTITY_RULES[groupName] || [];

  for (const fields of ruleGroups) {
    if (!hasAllMetadataFields(metadata, fields)) continue;

    const matches = channels.filter((channel) => fieldsMatch(channel, metadata, fields));
    if (matches.length === 1) {
      return matches[0];
    }
  }

  return null;
}

function hasAllMetadataFields(metadata, fields) {
  return fields.every(([, metadataKey]) => hasIdentityValue(metadata?.[metadataKey]));
}

function fieldsMatch(channel, metadata, fields) {
  return fields.every(([channelKey, metadataKey]) => {
    const channelValue = channel?.[channelKey];
    const metadataValue = metadata?.[metadataKey];

    if (!hasIdentityValue(channelValue) || !hasIdentityValue(metadataValue)) {
      return false;
    }

    return normalizeIdentityValue(channelValue, channelKey) === normalizeIdentityValue(metadataValue, metadataKey);
  });
}

function hasIdentityValue(value) {
  return value !== undefined && value !== null && value !== '';
}

function normalizeIdentityValue(value, fieldName = '') {
  const text = String(value).trim();

  if (URL_IDENTITY_FIELDS.has(fieldName)) {
    return normalizeUrlIdentityValue(text);
  }

  if (BOOLEAN_IDENTITY_FIELDS.has(fieldName)) {
    return normalizeBooleanIdentityValue(value);
  }

  return text;
}

function normalizeBooleanIdentityValue(value) {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value).trim().toLowerCase() === 'true' ? 'true' : 'false';
}

function normalizeUrlIdentityValue(value) {
  try {
    const url = new URL(ensureUrlProtocol(value));
    url.username = '';
    url.password = '';
    url.hash = '';
    url.search = '';
    if (url.pathname.endsWith('/')) {
      url.pathname = url.pathname.replace(/\/+$/, '/');
    }
    return url.toString()
      .replace(/^https?:\/\//i, '')
      .replace(/\/+$/, '');
  } catch {
    return value
      .replace(/^https?:\/\//i, '')
      .replace(/\/+$/, '');
  }
}

function ensureUrlProtocol(value) {
  if (/^[a-z][a-z\d+.-]*:\/\//i.test(value)) {
    return value;
  }

  return `https://${value}`;
}
