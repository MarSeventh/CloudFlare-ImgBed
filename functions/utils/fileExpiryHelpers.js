/**
 * 文件有效期：纯函数工具
 *
 * 有效期只保存在文件元数据的 ExpiresAt（毫秒时间戳）中，这里不访问数据库或配置，
 * 供上传、文件访问、设置校验和清理任务共用。
 */

// 表示永久的可选项
export const EXPIRE_FOREVER = 'forever';

// KV 存储下的到期标记键前缀，D1 / SQLite 使用表达式索引，不写标记
export const EXPIRY_MARKER_PREFIX = 'manage@expiry@';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const MAX_EXPIRE_MS = 3650 * DAY_MS;
const MAX_EXPIRE_OPTIONS = 20;
// 时间戳补零到 13 位，保证标记键按字典序排列即按到期时间排列
const MARKER_TIME_WIDTH = 13;
// 带有效期的文件浏览器最多缓存 1 小时，到期时间被提前后最迟 1 小时生效
export const MAX_EXPIRING_CACHE_SECONDS = 3600;

export const DEFAULT_FILE_EXPIRY_CONFIG = {
    enabled: false,
    defaultExpire: EXPIRE_FOREVER,
    allowCustom: false,
    options: ['1d', '7d', '30d', EXPIRE_FOREVER],
};

/**
 * 解析有效期选项
 * @param {string} option - 如 '12h'、'7d' 或 'forever'
 * @returns {number|null} 毫秒数；永久返回 0；格式不合法或超出范围返回 null
 */
export function parseExpireOption(option) {
    if (option === EXPIRE_FOREVER) {
        return 0;
    }
    const match = typeof option === 'string' ? /^([1-9]\d{0,5})([hd])$/.exec(option) : null;
    if (!match) {
        return null;
    }
    const duration = Number(match[1]) * (match[2] === 'h' ? HOUR_MS : DAY_MS);
    return duration <= MAX_EXPIRE_MS ? duration : null;
}

/**
 * 读取设置时补齐默认值，历史配置中没有 fileExpiry 时等同于关闭
 */
export function normalizeFileExpiryConfig(raw = {}) {
    const config = raw && typeof raw === 'object' ? raw : {};
    const options = Array.isArray(config.options)
        ? config.options.filter(option => parseExpireOption(option) !== null)
        : DEFAULT_FILE_EXPIRY_CONFIG.options;
    const requestedDefault = config.defaultExpire ?? DEFAULT_FILE_EXPIRY_CONFIG.defaultExpire;
    const defaultExpire = options.includes(requestedDefault)
        ? requestedDefault
        : (options[0] ?? EXPIRE_FOREVER);

    return {
        enabled: config.enabled === true,
        defaultExpire,
        allowCustom: config.allowCustom === true,
        options: options.length > 0 ? options : [EXPIRE_FOREVER],
    };
}

/**
 * 保存设置前校验并整理有效期配置
 * @returns {{config: Object}|{error: string}}
 */
export function validateFileExpiryConfig(raw) {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.options)) {
        return { error: 'fileExpiry.options must be an array' };
    }

    const durations = new Map();
    for (const option of raw.options) {
        const duration = parseExpireOption(option);
        if (duration === null) {
            return { error: `Invalid expire option: ${option}. Use a positive integer with h or d (up to 3650d), or forever` };
        }
        durations.set(option, duration);
    }
    if (durations.size === 0) {
        return { error: 'fileExpiry.options must not be empty' };
    }
    if (durations.size > MAX_EXPIRE_OPTIONS) {
        return { error: `fileExpiry.options allows at most ${MAX_EXPIRE_OPTIONS} items` };
    }
    if (!durations.has(raw.defaultExpire)) {
        return { error: 'fileExpiry.defaultExpire must be one of fileExpiry.options' };
    }

    // 按时长排序，永久放在最后
    const options = [...durations.keys()].sort((a, b) =>
        (durations.get(a) || Infinity) - (durations.get(b) || Infinity));

    return {
        config: {
            enabled: raw.enabled === true,
            defaultExpire: raw.defaultExpire,
            allowCustom: raw.allowCustom === true,
            options,
        },
    };
}

/**
 * 按配置和客户端请求计算上传文件的到期时间
 * 最终决定权在后端：不允许自选时忽略客户端参数，允许时只接受配置中的选项
 * @param {Object} config - normalizeFileExpiryConfig 的结果
 * @param {string|null} requested - 客户端传入的 expire 参数
 * @returns {{expiresAt: number|null}|{error: string}}
 */
export function resolveExpiresAt(config, requested, now = Date.now()) {
    if (!config?.enabled) {
        return { expiresAt: null };
    }

    let option = config.defaultExpire;
    if (config.allowCustom && requested) {
        if (!config.options.includes(requested)) {
            return { error: `Error: expire must be one of ${config.options.join(', ')}` };
        }
        option = requested;
    }

    const duration = parseExpireOption(option);
    return { expiresAt: duration ? now + duration : null };
}

// 元数据中的到期时间，没有或不合法时返回 null
export function getExpiresAt(metadata) {
    const expiresAt = Number(metadata?.ExpiresAt);
    return metadata?.ExpiresAt != null && Number.isFinite(expiresAt) ? expiresAt : null;
}

// 原生 KV 的 getWithMetadata 在键不存在时返回 { value: null, metadata: null }，D1 和测试替身返回 null
export function isMissingRecord(record) {
    return !record || record.value === null || record.value === undefined;
}

export function isExpired(metadata, now = Date.now()) {
    const expiresAt = getExpiresAt(metadata);
    return expiresAt !== null && expiresAt <= now;
}

/**
 * 带有效期的文件只允许浏览器私有缓存，缓存时长不超过剩余有效时间和 1 小时
 * 不进入 Worker / CDN 共享缓存；浏览器缓存过期后凭 ETag 向服务端确认，见 buildExpiringFileEtag
 */
export function capCacheControl(cacheControl, expiresAt, now = Date.now()) {
    if (!cacheControl || expiresAt === null || expiresAt === undefined) {
        return cacheControl;
    }
    const match = /max-age=(\d+)/.exec(cacheControl);
    if (!match) {
        return cacheControl;
    }
    const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));
    return cacheControl
        .replace(/\bpublic\b/, 'private')
        .replace(match[0], `max-age=${Math.min(remaining, Number(match[1]), MAX_EXPIRING_CACHE_SECONDS)}`);
}

/**
 * 带有效期文件的 ETag：内容（上传时间）或响应头相关字段（文件名、类型）变化时随之变化
 * 有效期不参与计算，修改有效期不会让浏览器重新下载；到期后服务端直接返回 404
 */
export function buildExpiringFileEtag(metadata) {
    const source = [metadata?.TimeStamp, metadata?.FileSizeBytes ?? metadata?.FileSize, metadata?.FileName, metadata?.FileType].join('\n');
    // FNV-1a 32 位，只用于区分版本
    let hash = 0x811c9dc5;
    for (let i = 0; i < source.length; i++) {
        hash ^= source.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return `"exp-${(hash >>> 0).toString(36)}"`;
}

// If-None-Match 可能带多个值或弱校验前缀 W/
export function etagMatches(ifNoneMatch, etag) {
    if (!ifNoneMatch || !etag) {
        return false;
    }
    return ifNoneMatch.split(',').some(value => {
        const candidate = value.trim().replace(/^W\//, '');
        return candidate === '*' || candidate === etag;
    });
}

export function buildExpiryMarkerKey(expiresAt, fileId) {
    return `${EXPIRY_MARKER_PREFIX}${String(expiresAt).padStart(MARKER_TIME_WIDTH, '0')}@${fileId}`;
}

// 解析到期标记键，格式不符时返回 null
export function parseExpiryMarkerKey(key) {
    if (!key.startsWith(EXPIRY_MARKER_PREFIX)) {
        return null;
    }
    const rest = key.slice(EXPIRY_MARKER_PREFIX.length);
    const separator = rest.indexOf('@');
    const expiresAt = Number(rest.slice(0, separator));
    const fileId = rest.slice(separator + 1);
    if (separator !== MARKER_TIME_WIDTH || !Number.isFinite(expiresAt) || !fileId) {
        return null;
    }
    return { expiresAt, fileId };
}
