import { getUploadConfig } from '../../api/manage/sysConfig/upload.js';
import { normalizeWebDAVHeaders } from '../storage/webdavAPI.js';

export async function resolveS3Credentials(db, env, metadata = {}) {
  const channel = await findChannel(db, env, 's3', metadata);
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
    source: 'missing',
    endpoint: '',
    region: 'auto',
    bucketName: '',
    pathStyle: false,
    accessKeyId: '',
    secretAccessKey: '',
    cdnDomain: '',
    key: metadata.S3FileKey,
  };
}

export async function resolveTelegramCredentials(db, env, metadata = {}) {
  const channel = await findChannel(db, env, 'telegram', metadata);
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
    source: 'missing',
    botToken: '',
    chatId: '',
    proxyUrl: '',
    fileId: metadata.TgFileId,
  };
}

export async function resolveDiscordCredentials(db, env, metadata = {}) {
  const channel = await findChannel(db, env, 'discord', metadata);
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
    source: 'missing',
    botToken: '',
    channelId: '',
    proxyUrl: '',
    messageId: metadata.DiscordMessageId,
  };
}

export async function resolveHuggingFaceCredentials(db, env, metadata = {}) {
  const channel = await findChannel(db, env, 'huggingface', metadata);
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
    source: 'missing',
    token: '',
    repo: '',
    isPrivate: false,
    filePath: metadata.HfFilePath,
    fileUrl: '',
  };
}

export async function resolveWebDAVCredentials(db, env, metadata = {}) {
  const channel = await findChannel(db, env, 'webdav', metadata);
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
      publicFileUrl: '',
    };
  }

  return {
    source: 'missing',
    baseUrl: '',
    username: '',
    password: '',
    headers: {},
    createDirectory: true,
    publicUrl: '',
    filePath: metadata.WebDAVFilePath,
    publicFileUrl: '',
  };
}

async function findChannel(db, env, groupName, metadata = {}) {
  const channelName = getEffectiveChannelName(groupName, metadata);
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

function getEffectiveChannelName(groupName, metadata = {}) {
  if (metadata.ChannelName) return metadata.ChannelName;

  if (groupName === 'telegram' && (metadata.Channel === 'Telegram' || metadata.Channel === 'TelegramNew')) {
    return 'Telegram_env';
  }

  return '';
}
