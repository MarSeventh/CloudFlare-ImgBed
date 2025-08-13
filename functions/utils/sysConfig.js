import { getUploadConfig } from '../api/manage/sysConfig/upload';
import { getSecurityConfig } from '../api/manage/sysConfig/security';
import { getPageConfig } from '../api/manage/sysConfig/page';
import { getOthersConfig } from '../api/manage/sysConfig/others';
import { getDatabase } from './databaseAdapter.js';

export async function fetchUploadConfig(env) {
    const db = getDatabase(env);
    const settings = await getUploadConfig(db, env);
    // 去除 已禁用 的渠道
    settings.telegram.channels = settings.telegram.channels.filter((channel) => channel.enabled);
    settings.cfr2.channels = settings.cfr2.channels.filter((channel) => channel.enabled);
    settings.s3.channels = settings.s3.channels.filter((channel) => channel.enabled);

    return settings;
}

export async function fetchSecurityConfig(env) {
    const db = getDatabase(env);
    const settings = await getSecurityConfig(db, env);
    return settings;
}

export async function fetchPageConfig(env) {
    const db = getDatabase(env);
    const settings = await getPageConfig(db, env);
    return settings;
}

export async function fetchOthersConfig(env) {
    const db = getDatabase(env);
    const settings = await getOthersConfig(db, env);
    return settings;
}