import { getUploadConfig } from '../api/manage/sysConfig/upload';
import { getSecurityConfig } from '../api/manage/sysConfig/security';
import { getPageConfig } from '../api/manage/sysConfig/page';
import { getOthersConfig } from '../api/manage/sysConfig/others';
import { getDatabase } from './databaseAdapter.js';

/**
 * 根据容量限制过滤渠道
 * @param {Object} db - 数据库实例
 * @param {Array} channels - 渠道列表
 * @returns {Array} 过滤后的渠道列表
 */
async function filterChannelsByQuota(db, channels) {
    const result = [];
    for (const channel of channels) {
        // 未启用容量限制，直接通过
        if (!channel.quota?.enabled || !channel.quota?.limitGB) {
            result.push(channel);
            continue;
        }

        try {
            const quotaKey = `manage@quota@${channel.name}`;
            const quotaData = await db.get(quotaKey);
            const quota = quotaData ? JSON.parse(quotaData) : { usedMB: 0, fileCount: 0 };

            const usedGB = quota.usedMB / 1024;
            const limitGB = channel.quota.limitGB;
            const threshold = channel.quota.threshold || 95;

            // 未超过阈值，渠道可用
            if ((usedGB / limitGB) * 100 < threshold) {
                result.push(channel);
            } else {
                console.log(`Channel ${channel.name} quota exceeded: ${usedGB.toFixed(2)}GB / ${limitGB}GB (${threshold}% threshold)`);
            }
        } catch (error) {
            console.error(`Failed to check quota for channel ${channel.name}:`, error);
            // 检查失败时保守处理，允许使用该渠道
            result.push(channel);
        }
    }
    return result;
}

export async function fetchUploadConfig(env) {
    try {
        const db = getDatabase(env);
        const settings = await getUploadConfig(db, env);
        // 去除 已禁用 的渠道
        settings.telegram.channels = settings.telegram.channels.filter((channel) => channel.enabled);
        settings.cfr2.channels = settings.cfr2.channels.filter((channel) => channel.enabled);
        settings.s3.channels = settings.s3.channels.filter((channel) => channel.enabled);

        // 根据容量限制过滤渠道（仅 R2 和 S3）
        settings.cfr2.channels = await filterChannelsByQuota(db, settings.cfr2.channels);
        settings.s3.channels = await filterChannelsByQuota(db, settings.s3.channels);

        return settings;
    } catch (error) {
        console.error('Failed to fetch upload config:', error);
        // 返回默认配置
        return {
            telegram: { channels: [] },
            cfr2: { channels: [] },
            s3: { channels: [] }
        };
    }
}

export async function fetchSecurityConfig(env) {
    try {
        const db = getDatabase(env);
        const settings = await getSecurityConfig(db, env);
        return settings;
    } catch (error) {
        console.error('Failed to fetch security config:', error);
        // 返回默认配置
        return {
            auth: {
                user: { authCode: "" },
                admin: { adminUsername: "", adminPassword: "" }
            },
            upload: {
                moderate: { enabled: false, channel: "default", moderateContentApiKey: "", nsfwApiPath: "" }
            },
            access: { allowedDomains: "", whiteListMode: false }
        };
    }
}

export async function fetchPageConfig(env) {
    try {
        const db = getDatabase(env);
        const settings = await getPageConfig(db, env);
        return settings;
    } catch (error) {
        console.error('Failed to fetch page config:', error);
        // 返回默认配置
        return { config: [] };
    }
}

export async function fetchOthersConfig(env) {
    try {
        const db = getDatabase(env);
        const settings = await getOthersConfig(db, env);
        return settings;
    } catch (error) {
        console.error('Failed to fetch others config:', error);
        // 返回默认配置
        return {
            telemetry: { enabled: false }
        };
    }
}