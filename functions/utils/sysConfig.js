import { getUploadConfig } from '../api/manage/sysConfig/upload';
import { getSecurityConfig } from '../api/manage/sysConfig/security';
import { getPageConfig } from '../api/manage/sysConfig/page';
import { getOthersConfig } from '../api/manage/sysConfig/others';
import { getDatabase } from './databaseAdapter.js';

export async function fetchUploadConfig(env) {
    try {
        const db = getDatabase(env);
        const settings = await getUploadConfig(db, env);
        // 去除 已禁用 的渠道
        settings.telegram.channels = settings.telegram.channels.filter((channel) => channel.enabled);
        settings.cfr2.channels = settings.cfr2.channels.filter((channel) => channel.enabled);
        settings.s3.channels = settings.s3.channels.filter((channel) => channel.enabled);

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