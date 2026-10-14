/**
 * MIME 类型工具
 *
 * 部分客户端（同步工具、脚本、curl -T 等）上传时不会提供有效的 Content-Type，
 * 服务端拿到的是空值或 application/octet-stream。若不处理，图片会被记成通用类型，
 * 进而导致随机图 API 的类型过滤、图片尺寸提取、图片处理校验全部失效。
 */

// 扩展名 -> MIME（图片）
export const IMAGE_TYPES_BY_EXTENSION = new Map([
    ['jpg', 'image/jpeg'],
    ['jpeg', 'image/jpeg'],
    ['jpe', 'image/jpeg'],
    ['jfif', 'image/jpeg'],
    ['png', 'image/png'],
    ['webp', 'image/webp'],
    ['avif', 'image/avif'],
    ['gif', 'image/gif'],
    ['svg', 'image/svg+xml'],
    ['svgz', 'image/svg+xml'],
]);

// 视为「客户端未提供有效 MIME」的取值
export const GENERIC_FILE_TYPES = new Set([
    '',
    'application/octet-stream',
    'binary/octet-stream',
    'application/x-www-form-urlencoded',
]);

/**
 * 提取小写扩展名（不含点），文件名或含路径的文件 id 均可
 * @param {string} fileName
 * @returns {string}
 */
export function getFileExtension(fileName) {
    if (typeof fileName !== 'string') return '';
    const match = /\.([^.\/\\]+)$/.exec(fileName.trim());
    return match ? match[1].toLowerCase() : '';
}

/**
 * 归一化 MIME 类型：客户端给了有效值就沿用，否则按扩展名推断
 * @param {string} fileName - 文件名或含路径的文件 id
 * @param {string} clientType - 客户端提供的 MIME
 * @returns {string}
 */
export function resolveFileType(fileName, clientType = '') {
    const type = String(clientType || '').trim().toLowerCase();
    if (type && !GENERIC_FILE_TYPES.has(type)) {
        return type;
    }

    const inferred = IMAGE_TYPES_BY_EXTENSION.get(getFileExtension(fileName));
    return inferred || type || 'application/octet-stream';
}

/**
 * 判断记录是否符合期望的类型：优先看 MIME，MIME 缺失或为通用类型时按扩展名兜底。
 * 用于兼容历史记录中被记成 application/octet-stream 的图片。
 *
 * @param {string} fileType - 记录中的 FileType
 * @param {string} fileName - 文件名或含路径的文件 id
 * @param {string[]} wantedTypes - 期望的类型关键词，如 ['image']
 * @returns {boolean}
 */
export function matchesFileType(fileType, fileName, wantedTypes) {
    const type = String(fileType || '').trim().toLowerCase();
    const wanted = Array.isArray(wantedTypes) ? wantedTypes : [];

    if (type && wanted.some(t => type.includes(t))) return true;
    // 记录中有明确类型时不做兜底，避免误判
    if (type && !GENERIC_FILE_TYPES.has(type)) return false;

    const inferred = IMAGE_TYPES_BY_EXTENSION.get(getFileExtension(fileName));
    return Boolean(inferred) && wanted.some(t => inferred.includes(t));
}
