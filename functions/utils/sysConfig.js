import { getUploadConfig } from '../api/manage/sysConfig/upload';
import { getSecurityConfig } from '../api/manage/sysConfig/security';
import { getPageConfig } from '../api/manage/sysConfig/page';
import { getOthersConfig } from '../api/manage/sysConfig/others';

export async function fetchUploadConfig(env) {
    const kv = env.img_url;
    const settings = await getUploadConfig(kv, env);
    // 去除 已禁用 的渠道
    settings.telegram.channels = settings.telegram.channels.filter((channel) => channel.enabled);
    settings.cfr2.channels = settings.cfr2.channels.filter((channel) => channel.enabled);
    settings.s3.channels = settings.s3.channels.filter((channel) => channel.enabled);

    return settings;
}

export async function fetchSecurityConfig(env) {
    const kv = env.img_url;
    const settings = await getSecurityConfig(kv, env);
    return settings;
}

export async function fetchPageConfig(env) {
    const kv = env.img_url;
    const settings = await getPageConfig(kv, env);
    return settings;
}

export async function fetchOthersConfig(env) {
    const kv = env.img_url;
    const settings = await getOthersConfig(kv, env);
    return settings;
}