import { getUploadConfig } from '../../api/manage/sysConfig/upload.js';

export async function loadChannelConfig(db, env, logContext = 'channel config') {
  try {
    return await getUploadConfig(db, env);
  } catch (error) {
    console.warn(`Failed to load upload config for ${logContext}:`, error.message);
    return null;
  }
}

export function findConfiguredChannel(uploadConfig, groupName, metadata = {}) {
  const channelName = getEffectiveChannelName(groupName, metadata);
  if (!channelName || !uploadConfig) return null;

  const channels = uploadConfig[groupName]?.channels || [];
  return channels.find((channel) => channel.name === channelName) || null;
}

export function getEffectiveChannelName(groupName, metadata = {}) {
  if (metadata.ChannelName) return metadata.ChannelName;

  if (groupName === 'telegram' && (metadata.Channel === 'Telegram' || metadata.Channel === 'TelegramNew')) {
    return 'Telegram_env';
  }

  return '';
}
