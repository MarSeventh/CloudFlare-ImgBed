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

/**
 * Resolves the persisted AI settings blob into a fully-materialized runtime
 * config. Also migrates the legacy shape (`providers.wd_tagger/openai/anthropic/llm`
 * plus `capabilities.X.provider`) into the new shape:
 *
 *   {
 *     unifiedLLM: {...},
 *     capabilities: {
 *       tagging:     { enabled, engine: 'wd_tagger'|'llm', wdTagger, llmSource: 'unified'|'custom', customLLM },
 *       description: { enabled, engine: 'llm',              llmSource, customLLM },
 *       ocr:         { enabled, engine: 'llm',              llmSource, customLLM }
 *     }
 *   }
 *
 * Each capability also carries a computed `resolved` field describing the
 * concrete { providerName, providerConfig, groupKey } the pipeline should run.
 * `groupKey` is 'unified_llm' when the capability follows the shared LLM
 * config, so multiple capabilities can be batched by UnifiedLLMProvider.
 */
function resolveAIConfig(settings, env = {}) {
    const enabled = settings.enabled ?? env.AI_ENABLE === 'true';
    const queue = settings.queue || {};

    // Legacy top-level directories are used only as the migration fallback for
    // each capability that didn't have its own directories saved yet.
    const legacyTargetDirectories = normalizeDirectories(settings.targetDirectories);

    const migrated = migrateAISettings(settings, legacyTargetDirectories);
    const unifiedLLM = resolveLLMConfig(migrated.unifiedLLM, env, legacyTargetDirectories);
    const capabilities = {
        tagging: resolveCapability('tagging', migrated.capabilities.tagging, unifiedLLM, env),
        description: resolveCapability('description', migrated.capabilities.description, unifiedLLM, env),
        ocr: resolveCapability('ocr', migrated.capabilities.ocr, unifiedLLM, env)
    };

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
        unifiedLLM,
        capabilities
    };
}

/**
 * Reads the raw persisted blob and returns a normalized-but-not-resolved
 * settings shape. Prefers new-schema fields; falls back to legacy fields so
 * existing installs read cleanly and rewrite the new shape on the next save.
 */
function migrateAISettings(settings = {}, legacyTargetDirectories = []) {
    const providers = settings.providers || {};
    const unifiedLLM = settings.unifiedLLM
        ?? providers.llm
        ?? {};

    return {
        unifiedLLM,
        capabilities: {
            tagging: migrateCapability(settings.capabilities?.tagging, providers, 'tagging', legacyTargetDirectories),
            description: migrateCapability(settings.capabilities?.description, providers, 'description', legacyTargetDirectories),
            ocr: migrateCapability(settings.capabilities?.ocr, providers, 'ocr', legacyTargetDirectories)
        }
    };
}

function migrateCapability(rawCap, providers, capName, legacyTargetDirectories) {
    const cap = rawCap || {};
    const legacyWDTagger = providers.wd_tagger || providers.wdTagger || {};
    // Per-cap directories: prefer the cap's own value; fall back to the legacy
    // top-level `settings.targetDirectories` so existing installs keep the same
    // filter until the user re-saves.
    const targetDirectories = Array.isArray(cap.targetDirectories)
        ? cap.targetDirectories
        : legacyTargetDirectories;

    // Already new-schema (has engine field): pass through, only fill in defaults.
    if (typeof cap.engine === 'string') {
        return {
            enabled: cap.enabled === true,
            engine: cap.engine,
            wdTagger: cap.wdTagger || (capName === 'tagging' ? legacyWDTagger : {}),
            llmSource: cap.llmSource === 'custom' ? 'custom' : 'unified',
            customLLM: cap.customLLM || {},
            targetDirectories
        };
    }

    // Legacy migration: map `capabilities.<cap>.provider` to the new shape.
    const legacyProvider = String(cap.provider || '').trim();
    const enabled = cap.enabled === true;

    if (capName === 'tagging' && (legacyProvider === '' || legacyProvider === 'wd_tagger')) {
        return {
            enabled,
            engine: 'wd_tagger',
            wdTagger: legacyWDTagger,
            llmSource: 'unified',
            customLLM: {},
            targetDirectories
        };
    }
    if (legacyProvider === 'openai' || legacyProvider === 'anthropic') {
        const source = providers[legacyProvider] || {};
        return {
            enabled,
            engine: 'llm',
            wdTagger: capName === 'tagging' ? legacyWDTagger : {},
            llmSource: 'custom',
            customLLM: { ...source, engine: legacyProvider },
            targetDirectories
        };
    }
    // Default: LLM engine, unified source (covers legacyProvider === 'llm' or
    // an unrecognised value for description/ocr).
    return {
        enabled,
        engine: 'llm',
        wdTagger: capName === 'tagging' ? legacyWDTagger : {},
        llmSource: 'unified',
        customLLM: {},
        targetDirectories
    };
}

/**
 * Turns a migrated capability into the runtime shape. `resolved.groupKey`
 * decides how the pipeline groups steps — capabilities sharing 'unified_llm'
 * can be batched into a single UnifiedLLMProvider call when batchMode='unified'.
 */
function resolveCapability(capName, cap, unifiedLLM, env) {
    const engine = capName === 'tagging'
        ? (cap.engine === 'llm' ? 'llm' : 'wd_tagger')
        : 'llm';
    const wdTagger = resolveWdTaggerConfig(cap.wdTagger || {}, env);
    const llmSource = cap.llmSource === 'custom' ? 'custom' : 'unified';
    const customLLM = resolveLLMConfig(cap.customLLM || {}, env);
    const targetDirectories = normalizeDirectories(cap.targetDirectories);

    // Effective directories: capabilities that follow the unified LLM inherit
    // the unified LLM's directory scope; other engines/sources use their own.
    const effectiveTargetDirectories = (engine === 'llm' && llmSource === 'unified')
        ? unifiedLLM.targetDirectories
        : targetDirectories;

    let resolved;
    if (engine === 'wd_tagger') {
        resolved = {
            providerName: 'wd_tagger',
            providerConfig: wdTagger,
            groupKey: `wd_tagger:${capName}`
        };
    } else if (llmSource === 'custom') {
        resolved = {
            providerName: 'llm',
            providerConfig: customLLM,
            groupKey: `custom_llm:${capName}`
        };
    } else {
        resolved = {
            providerName: 'llm',
            providerConfig: unifiedLLM,
            groupKey: 'unified_llm'
        };
    }

    return {
        enabled: cap.enabled === true,
        engine,
        wdTagger,
        llmSource,
        customLLM,
        targetDirectories,
        effectiveTargetDirectories,
        resolved
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

function resolveLLMConfig(llm, env, legacyTargetDirectories = []) {
    const targetDirectories = Array.isArray(llm.targetDirectories)
        ? normalizeDirectories(llm.targetDirectories)
        : normalizeDirectories(legacyTargetDirectories);
    return {
        endpoint: llm.endpoint || env.AI_LLM_ENDPOINT || '',
        apiKey: llm.apiKey || env.AI_LLM_API_KEY || '',
        model: llm.model || env.AI_LLM_MODEL || 'gpt-4o-mini',
        modelVersion: llm.modelVersion || '',
        engine: llm.engine === 'anthropic' ? 'anthropic' : 'openai',
        batchMode: llm.batchMode === 'unified' ? 'unified' : 'separate',
        anthropicVersion: llm.anthropicVersion || env.AI_ANTHROPIC_VERSION || '2023-06-01',
        tokenField: llm.tokenField === 'max_completion_tokens' ? 'max_completion_tokens' : 'max_tokens',
        jsonMode: configBoolean(llm.jsonMode, env.AI_LLM_JSON_MODE, false),
        temperature: configNumber(llm.temperature, env.AI_LLM_TEMPERATURE, 0),
        maxTokens: configNumber(llm.maxTokens, env.AI_LLM_MAX_TOKENS, 2048),
        timeoutMs: configNumber(llm.timeoutMs, env.AI_TIMEOUT, 60000),
        maxInputSizeBytes: configNumber(
            llm.maxInputSizeBytes,
            env.AI_LLM_MAX_INPUT_SIZE,
            5 * 1024 * 1024
        ),
        maxTags: configNumber(llm.maxTags, env.AI_LLM_MAX_TAGS, 40),
        prompts: llm.prompts && typeof llm.prompts === 'object' ? llm.prompts : {},
        headers: llm.headers && typeof llm.headers === 'object' ? llm.headers : {},
        targetDirectories
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
