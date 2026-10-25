/**
 * 用户端页面配置 API
 * 负责读取页面配置并转换为前端可直接使用的用户配置对象
 */
import { fetchPageConfig, fetchOthersConfig } from "../utils/sysConfig.js";

export async function onRequest(context) {
    const { env } = context;
    const PageConfig = await fetchPageConfig(env);
    const userConfigList = PageConfig.config;
    const userConfig = {};
    
    for (const config of userConfigList) {
        if (config.value !== undefined && config.value !== null && config.value !== '') {
            // 将config解析为JSON对象，若解析失败则返回原始字符串
            try {
                userConfig[config.id] = JSON.parse(config.value);
            } catch (error) {
                userConfig[config.id] = config.value;
            }
        } else if (config.default !== undefined) {
            // 未配置的项目使用其声明的默认值
            userConfig[config.id] = config.default;
        }
    }

    if (Number.isFinite(Number(PageConfig.announcementRefreshAt))) {
        userConfig.announcementRefreshAt = Number(PageConfig.announcementRefreshAt);
    }

    // 文件有效期：上传页和 API 用户据此展示可选项，最终仍由上传接口按设置校验
    const { fileExpiry } = await fetchOthersConfig(env);
    if (fileExpiry?.enabled) {
        userConfig.fileExpiry = {
            defaultExpire: fileExpiry.defaultExpire,
            allowCustom: fileExpiry.allowCustom,
            options: fileExpiry.allowCustom ? fileExpiry.options : [fileExpiry.defaultExpire],
        };
    }

    // 检查 USER_CONFIG 是否为空或未定义
    if (!userConfig) {
        return new Response(JSON.stringify({}), { status: 200 });
    }

    try {
        // 尝试解析 USER_CONFIG 为 JSON
        const parsedConfig = userConfig;
        // 检查解析后的结果是否为对象
        if (typeof parsedConfig === 'object' && parsedConfig !== null) {
            return new Response(JSON.stringify(parsedConfig), { status: 200 });
        } else {
            return new Response(JSON.stringify({}), { status: 200 });
        }
    } catch (error) {
        // 捕捉解析错误并返回空对象
        return new Response(JSON.stringify({}), { status: 200 });
    }
}
