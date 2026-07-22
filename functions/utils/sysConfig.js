import { getUploadConfig } from '../api/manage/sysConfig/upload.js';
import { getSecurityConfig } from '../api/manage/sysConfig/security.js';
import { getPageConfig } from '../api/manage/sysConfig/page.js';
import { getOthersConfig } from '../api/manage/sysConfig/others.js';
import { getDatabase } from './databaseAdapter.js';
import { getIndexMeta } from './indexManager.js';

/**
 * 根据容量限制过滤渠道
 * @param {Object} context - 上下文对象（包含 env）
 * @param {Array} channels - 渠道列表
 * @returns {Array} 过滤后的渠道列表
 */
async function filterChannelsByQuota(context, channels) {
    // 先检查是否有任何渠道启用了容量限制，如果都没启用则跳过 KV 读取
    const hasQuotaEnabled = channels.some(ch => ch.quota?.enabled && ch.quota?.limitGB);
    if (!hasQuotaEnabled) {
        return channels; // 无需读取 KV，直接返回所有渠道
    }

    // 获取索引元数据（只需 1 次读取）
    const indexMeta = await getIndexMeta(context);
    const channelStats = indexMeta.channelStats || {};

    const result = [];
    for (const channel of channels) {
        // 未启用容量限制，直接通过
        if (!channel.quota?.enabled || !channel.quota?.limitGB) {
            result.push(channel);
            continue;
        }

        try {
            // 从索引元数据中获取该渠道的容量统计
            const stats = channelStats[channel.name] || { usedMB: 0, fileCount: 0 };

            const usedGB = stats.usedMB / 1024;
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

export async function fetchUploadConfig(env, context = null) {
    try {
        const db = getDatabase(env);
        const settings = await getUploadConfig(db, env);
        // 去除 已禁用 的渠道
        settings.telegram.channels = settings.telegram.channels.filter((channel) => channel.enabled);
        settings.cfr2.channels = settings.cfr2.channels.filter((channel) => channel.enabled);
        settings.s3.channels = settings.s3.channels.filter((channel) => channel.enabled);
        settings.discord.channels = settings.discord.channels.filter((channel) => channel.enabled);
        settings.huggingface.channels = settings.huggingface.channels.filter((channel) => channel.enabled);
        settings.webdav.channels = settings.webdav.channels.filter((channel) => channel.enabled);

        // 根据容量限制过滤渠道（可用于 R2、S3、WebDAV）
        // 需要 context 来调用 getIndexMeta
        if (context) {
            settings.cfr2.channels = await filterChannelsByQuota(context, settings.cfr2.channels);
            settings.s3.channels = await filterChannelsByQuota(context, settings.s3.channels);
            settings.webdav.channels = await filterChannelsByQuota(context, settings.webdav.channels);
        }

        return settings;
    } catch (error) {
        console.error('Failed to fetch upload config:', error);
        // 返回默认配置
        return {
            telegram: { channels: [] },
            cfr2: { channels: [] },
            s3: { channels: [] },
            discord: { channels: [] },
            huggingface: { channels: [] },
            webdav: { channels: [] }
        };
    }
}

export async function fetchSecurityConfig(env, options = {}) {
    try {
        const db = getDatabase(env);
        const settings = await getSecurityConfig(db, env);
        return settings;
    } catch (error) {
        console.error('Failed to fetch security config:', error);
        if (options.throwOnError) {
            throw error;
        }
        // 返回默认配置
        return {
            auth: {
                user: { authCode: "" },
                admin: { adminUsername: "", adminPassword: "" }
            },
            upload: {
                moderate: { enabled: false, channel: "default", moderateContentApiKey: "", nsfwApiPath: "" },
                ipQuery: {
                    enabled: false,
                    channel: "customApi",
                    customApi: { url: "", params: [{ key: "ip", value: "{ip}" }], responseFields: [] }
                }
            },
            access: { allowedDomains: "", whiteListMode: false, sessionSecure: false, userSessionMaxAge: 14, adminSessionMaxAge: 14 }
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

export async function fetchAIConfig(env) {
    try {
        const db = getDatabase(env);
        const settingsStr = await db.get('manage@sysConfig@ai');
        const settings = settingsStr ? JSON.parse(settingsStr) : {};
        return resolveAIConfig(settings, env);
    } catch (error) {
        console.error('Failed to fetch AI config:', error);
        return resolveAIConfig({}, env);
    }
}

function resolveAIConfig(settings, env = {}) {
    const providers = settings.providers || {};
    const tagging = settings.capabilities?.tagging || {};
    const queue = settings.queue || {};
    const enabled = settings.enabled ?? env.AI_ENABLE === 'true';

    return {
        enabled,
        timeoutMs: configNumber(settings.timeoutMs, env.AI_TIMEOUT, 60000),
        parallel: Math.max(1, Math.min(10, Math.floor(configNumber(
            settings.parallel,
            env.AI_PARALLEL,
            1
        )))),
        queue: {
            enabled: configBoolean(queue.enabled, env.AI_QUEUE_ENABLE, true),
            fallbackToDirect: configBoolean(
                queue.fallbackToDirect,
                env.AI_QUEUE_FALLBACK_DIRECT,
                true
            ),
            maxRetries: Math.max(0, Math.min(10, Math.floor(configNumber(
                queue.maxRetries,
                env.AI_QUEUE_MAX_RETRIES,
                3
            )))),
            retryDelaysSeconds: normalizeRetryDelays(
                queue.retryDelaysSeconds,
                env.AI_QUEUE_RETRY_DELAYS
            ),
            staleAfterSeconds: Math.max(0, Math.min(604800, Math.floor(configNumber(
                queue.staleAfterSeconds,
                env.AI_QUEUE_STALE_AFTER,
                3600
            )))),
            bindingAvailable: typeof env.img_queue?.send === 'function'
        },
        capabilities: {
            tagging: {
                enabled: tagging.enabled ?? enabled,
                provider: tagging.provider || env.AI_TAGGING_PROVIDER || env.AI_PROVIDER || 'wd_tagger',
                targetDirectories: normalizeDirectories(tagging.targetDirectories)
            }
        },
        providers: {
            // Providers are keyed by canonical registry name. The legacy camelCase
            // `wdTagger` blob is still read for back-compat with configs saved
            // before this migration.
            wd_tagger: resolveWdTaggerConfig(providers.wd_tagger ?? providers.wdTagger ?? {}, env),
            openai: resolveOpenAIConfig(providers.openai ?? {}, env),
            anthropic: resolveAnthropicConfig(providers.anthropic ?? {}, env)
        }
    };
}

function resolveWdTaggerConfig(wdTagger, env) {
    return {
        endpoint: wdTagger.endpoint || env.WD_TAGGER_ENDPOINT || '',
        apiKey: wdTagger.apiKey || env.WD_TAGGER_API_KEY || '',
        model: wdTagger.model || env.WD_TAGGER_MODEL || 'wd-tagger',
        modelVersion: wdTagger.modelVersion || env.WD_TAGGER_MODEL_VERSION || '',
        timeoutMs: configNumber(wdTagger.timeoutMs, env.AI_TIMEOUT, 30000),
        maxInputSizeBytes: configNumber(
            wdTagger.maxInputSizeBytes,
            env.WD_TAGGER_MAX_INPUT_SIZE,
            10 * 1024 * 1024
        ),
        threshold: configNumber(wdTagger.threshold, env.WD_TAGGER_THRESHOLD, 0.35),
        characterThreshold: configNumber(
            wdTagger.characterThreshold,
            env.WD_TAGGER_CHARACTER_THRESHOLD,
            0.85
        ),
        maxTags: configNumber(wdTagger.maxTags, env.WD_TAGGER_MAX_TAGS, 100),
        requestFormat: wdTagger.requestFormat || env.WD_TAGGER_REQUEST_FORMAT || 'raw',
        fileField: wdTagger.fileField || env.WD_TAGGER_FILE_FIELD || 'image',
        headers: wdTagger.headers || {}
    };
}

function resolveOpenAIConfig(openai, env) {
    return {
        endpoint: openai.endpoint || env.AI_OPENAI_ENDPOINT || 'https://api.openai.com/v1/chat/completions',
        apiKey: openai.apiKey || env.AI_OPENAI_API_KEY || '',
        model: openai.model || env.AI_OPENAI_MODEL || 'gpt-4o-mini',
        modelVersion: openai.modelVersion || '',
        maxTokens: configNumber(openai.maxTokens, env.AI_OPENAI_MAX_TOKENS, 1024),
        temperature: configNumber(openai.temperature, env.AI_OPENAI_TEMPERATURE, 0),
        tokenField: openai.tokenField || env.AI_OPENAI_TOKEN_FIELD || 'max_tokens',
        jsonMode: configBoolean(openai.jsonMode, env.AI_OPENAI_JSON_MODE, false),
        timeoutMs: configNumber(openai.timeoutMs, env.AI_TIMEOUT, 60000),
        maxInputSizeBytes: configNumber(
            openai.maxInputSizeBytes,
            env.AI_OPENAI_MAX_INPUT_SIZE,
            5 * 1024 * 1024
        ),
        maxTags: configNumber(openai.maxTags, env.AI_OPENAI_MAX_TAGS, 40),
        prompts: openai.prompts && typeof openai.prompts === 'object' ? openai.prompts : {},
        headers: openai.headers && typeof openai.headers === 'object' ? openai.headers : {}
    };
}

function resolveAnthropicConfig(anthropic, env) {
    return {
        endpoint: anthropic.endpoint || env.AI_ANTHROPIC_ENDPOINT || 'https://api.anthropic.com/v1/messages',
        apiKey: anthropic.apiKey || env.AI_ANTHROPIC_API_KEY || '',
        model: anthropic.model || env.AI_ANTHROPIC_MODEL || 'claude-haiku-4-5',
        modelVersion: anthropic.modelVersion || '',
        anthropicVersion: anthropic.anthropicVersion || env.AI_ANTHROPIC_VERSION || '2023-06-01',
        maxTokens: configNumber(anthropic.maxTokens, env.AI_ANTHROPIC_MAX_TOKENS, 1024),
        timeoutMs: configNumber(anthropic.timeoutMs, env.AI_TIMEOUT, 60000),
        maxInputSizeBytes: configNumber(
            anthropic.maxInputSizeBytes,
            env.AI_ANTHROPIC_MAX_INPUT_SIZE,
            5 * 1024 * 1024
        ),
        maxTags: configNumber(anthropic.maxTags, env.AI_ANTHROPIC_MAX_TAGS, 40),
        prompts: anthropic.prompts && typeof anthropic.prompts === 'object' ? anthropic.prompts : {},
        headers: anthropic.headers && typeof anthropic.headers === 'object' ? anthropic.headers : {}
    };
}

function normalizeDirectories(value) {
    if (!Array.isArray(value)) return [];
    return [...new Set(value.map(directory => String(directory || '')
        .trim()
        .replace(/^\/+|\/+$/g, ''))
        .filter(Boolean))];
}

function configNumber(storedValue, environmentValue, fallback) {
    const value = storedValue ?? environmentValue;
    if (value === undefined || value === null || value === '') return fallback;

    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
}

function configBoolean(storedValue, environmentValue, fallback) {
    const value = storedValue ?? environmentValue;
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'boolean') return value;
    return String(value).toLowerCase() === 'true';
}

function normalizeRetryDelays(storedValue, environmentValue) {
    const value = storedValue ?? environmentValue;
    const values = Array.isArray(value)
        ? value
        : typeof value === 'string'
            ? value.split(',')
            : [];
    const normalized = values
        .map(item => Math.floor(Number(item)))
        .filter(item => Number.isFinite(item) && item >= 0 && item <= 43200)
        .slice(0, 10);
    return normalized.length ? normalized : [30, 120, 300];
}
