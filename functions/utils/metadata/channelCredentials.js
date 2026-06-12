import { findConfiguredChannel, loadChannelConfig } from './channelConfig.js';
import { normalizeWebDAVHeaders } from '../storage/webdavAPI.js';

export async function resolveS3Credentials(db, env, metadata = {}) {
  const channel = await loadConfiguredChannel(db, env, 's3', metadata);
  if (channel) {
    return {
      source: 'config',
      endpoint: channel.endpoint,
      region: channel.region || 'auto',
      bucketName: channel.bucketName,
      pathStyle: channel.pathStyle || false,
      accessKeyId: channel.accessKeyId,
      secretAccessKey: channel.secretAccessKey,
      cdnDomain: channel.cdnDomain || '',
      key: metadata.S3FileKey,
    };
  }

  return missingCredentials({
    endpoint: '',
    region: 'auto',
    bucketName: '',
    pathStyle: false,
    accessKeyId: '',
    secretAccessKey: '',
    cdnDomain: '',
    key: metadata.S3FileKey,
  });
}

export async function resolveTelegramCredentials(db, env, metadata = {}) {
  const channel = await loadConfiguredChannel(db, env, 'telegram', metadata);
  if (channel) {
    return {
      source: 'config',
      botToken: channel.botToken,
      chatId: channel.chatId,
      proxyUrl: channel.proxyUrl || '',
      fileId: metadata.TgFileId,
    };
  }

  return missingCredentials({
    botToken: '',
    chatId: '',
    proxyUrl: '',
    fileId: metadata.TgFileId,
  });
}

export async function resolveDiscordCredentials(db, env, metadata = {}) {
  const channel = await loadConfiguredChannel(db, env, 'discord', metadata);
  if (channel) {
    return {
      source: 'config',
      botToken: channel.botToken,
      channelId: channel.channelId,
      proxyUrl: channel.proxyUrl || '',
      messageId: metadata.DiscordMessageId,
    };
  }

  return missingCredentials({
    botToken: '',
    channelId: '',
    proxyUrl: '',
    messageId: metadata.DiscordMessageId,
  });
}

export async function resolveHuggingFaceCredentials(db, env, metadata = {}) {
  const channel = await loadConfiguredChannel(db, env, 'huggingface', metadata);
  if (channel) {
    return {
      source: 'config',
      token: channel.token,
      repo: channel.repo,
      isPrivate: channel.isPrivate || false,
      filePath: metadata.HfFilePath,
    };
  }

  return missingCredentials({
    token: '',
    repo: '',
    isPrivate: false,
    filePath: metadata.HfFilePath,
  });
}

export async function resolveWebDAVCredentials(db, env, metadata = {}) {
  const channel = await loadConfiguredChannel(db, env, 'webdav', metadata);
  if (channel) {
    return {
      source: 'config',
      baseUrl: channel.baseUrl || '',
      username: channel.username || '',
      password: channel.password || '',
      headers: normalizeWebDAVHeaders(channel.headers || {}),
      createDirectory: channel.createDirectory !== false,
      publicUrl: channel.publicUrl || '',
      filePath: metadata.WebDAVFilePath,
    };
  }

  return missingCredentials({
    baseUrl: '',
    username: '',
    password: '',
    headers: {},
    createDirectory: true,
    publicUrl: '',
    filePath: metadata.WebDAVFilePath,
  });
}

async function loadConfiguredChannel(db, env, groupName, metadata = {}) {
  const uploadConfig = await loadChannelConfig(db, env, `${groupName} credentials`);
  return findConfiguredChannel(uploadConfig, groupName, metadata);
}

function missingCredentials(fields) {
  return {
    source: 'missing',
    ...fields,
  };
}
