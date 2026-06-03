import { getUploadConfig } from '../../api/manage/sysConfig/upload.js';
import { normalizeWebDAVHeaders } from '../storage/webdavAPI.js';

export async function resolveS3Credentials(db, env, metadata = {}) {
  const channel = await findChannel(db, env, 's3', metadata.ChannelName);
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

  return {
    source: 'metadata',
    endpoint: metadata.S3Endpoint,
    region: metadata.S3Region || 'auto',
    bucketName: metadata.S3BucketName,
    pathStyle: metadata.S3PathStyle || false,
    accessKeyId: metadata.S3AccessKeyId,
    secretAccessKey: metadata.S3SecretAccessKey,
    cdnDomain: metadata.S3CdnDomain || '',
    key: metadata.S3FileKey,
  };
}

export async function resolveTelegramCredentials(db, env, metadata = {}) {
  const channel = await findChannel(db, env, 'telegram', metadata.ChannelName);
  if (channel) {
    return {
      source: 'config',
      botToken: channel.botToken,
      chatId: channel.chatId,
      proxyUrl: channel.proxyUrl || '',
      fileId: metadata.TgFileId,
    };
  }

  return {
    source: 'metadata',
    botToken: metadata.TgBotToken || env.TG_BOT_TOKEN,
    chatId: metadata.TgChatId || env.TG_CHAT_ID,
    proxyUrl: metadata.TgProxyUrl || '',
    fileId: metadata.TgFileId,
  };
}

export async function resolveDiscordCredentials(db, env, metadata = {}) {
  const channel = await findChannel(db, env, 'discord', metadata.ChannelName);
  if (channel) {
    return {
      source: 'config',
      botToken: channel.botToken,
      channelId: channel.channelId,
      proxyUrl: channel.proxyUrl || '',
      messageId: metadata.DiscordMessageId,
    };
  }

  return {
    source: 'metadata',
    botToken: metadata.DiscordBotToken,
    channelId: metadata.DiscordChannelId,
    proxyUrl: metadata.DiscordProxyUrl || '',
    messageId: metadata.DiscordMessageId,
  };
}

export async function resolveHuggingFaceCredentials(db, env, metadata = {}) {
  const channel = await findChannel(db, env, 'huggingface', metadata.ChannelName);
  if (channel) {
    return {
      source: 'config',
      token: channel.token,
      repo: channel.repo,
      isPrivate: channel.isPrivate || false,
      filePath: metadata.HfFilePath,
      fileUrl: '',
    };
  }

  return {
    source: 'metadata',
    token: metadata.HfToken,
    repo: metadata.HfRepo,
    isPrivate: metadata.HfIsPrivate || false,
    filePath: metadata.HfFilePath,
    fileUrl: metadata.HfFileUrl,
  };
}

export async function resolveWebDAVCredentials(db, env, metadata = {}) {
  const channel = await findChannel(db, env, 'webdav', metadata.ChannelName);
  if (channel) {
    return normalizeWebDAVCredentials({
      source: 'config',
      baseUrl: getWebDAVBaseUrl(channel),
      username: channel.username || '',
      password: channel.password || '',
      headers: channel.headers || channel.customHeaders || {},
      createDirectory: channel.createDirectory !== false,
      publicUrl: channel.publicUrl || '',
      filePath: metadata.WebDAVFilePath,
      publicFileUrl: '',
    });
  }

  return normalizeWebDAVCredentials({
    source: 'metadata',
    baseUrl: metadata.WebDAVBaseUrl,
    username: metadata.WebDAVUsername || '',
    password: metadata.WebDAVPassword || '',
    headers: metadata.WebDAVHeaders || {},
    createDirectory: metadata.WebDAVCreateDirectory !== false,
    publicUrl: metadata.WebDAVPublicBaseUrl || '',
    filePath: metadata.WebDAVFilePath,
    publicFileUrl: metadata.WebDAVPublicUrl,
  });
}

async function findChannel(db, env, groupName, channelName) {
  if (!channelName) return null;

  try {
    const uploadConfig = await getUploadConfig(db, env);
    const channels = uploadConfig[groupName]?.channels || [];
    return channels.find((channel) => channel.name === channelName) || null;
  } catch (error) {
    console.error(`Failed to resolve ${groupName} channel credentials:`, error);
    return null;
  }
}

function normalizeWebDAVCredentials(config = {}) {
  return {
    source: config.source || 'metadata',
    baseUrl: getWebDAVBaseUrl(config),
    username: config.username || '',
    password: config.password || '',
    headers: normalizeWebDAVHeaders(config.headers || config.customHeaders || {}),
    createDirectory: config.createDirectory !== false,
    publicUrl: config.publicUrl || '',
    filePath: config.filePath || '',
    publicFileUrl: config.publicFileUrl || '',
  };
}

function getWebDAVBaseUrl(config = {}) {
  return config.baseUrl || config.endpoint || config.url || '';
}
