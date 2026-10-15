/**
 * MIME 类型工具
 *
 * 部分客户端（同步工具、脚本、curl -T 等）上传时不会提供有效的 Content-Type，
 * 服务端拿到的是空值或 application/octet-stream。若不处理，图片会被记成通用类型，
 * 进而导致随机图 API 的类型过滤、图片尺寸提取、图片处理校验全部失效。
 */

// 类型识别与各功能的处理能力分开维护；识别为图片不代表可以缩放或提交给 AI。
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
    ['bmp', 'image/bmp'],
    ['ico', 'image/x-icon'],
    ['tif', 'image/tiff'],
    ['tiff', 'image/tiff'],
    ['heic', 'image/heic'],
    ['heif', 'image/heif'],
]);

export const FILE_TYPES_BY_EXTENSION = new Map([
    ...IMAGE_TYPES_BY_EXTENSION,
    ['mp4', 'video/mp4'],
    ['m4v', 'video/mp4'],
    ['webm', 'video/webm'],
    ['mov', 'video/quicktime'],
    ['avi', 'video/x-msvideo'],
    ['mkv', 'video/x-matroska'],
    ['mp3', 'audio/mpeg'],
    ['m4a', 'audio/mp4'],
    ['ogg', 'audio/ogg'],
    ['oga', 'audio/ogg'],
    ['wav', 'audio/wav'],
    ['flac', 'audio/flac'],
    ['aac', 'audio/aac'],
    ['opus', 'audio/ogg'],
    ['pdf', 'application/pdf'],
    ['doc', 'application/msword'],
    ['docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    ['xls', 'application/vnd.ms-excel'],
    ['xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    ['ppt', 'application/vnd.ms-powerpoint'],
    ['pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
    ['txt', 'text/plain'],
    ['md', 'text/markdown'],
    ['json', 'application/json'],
    ['xml', 'application/xml'],
    ['html', 'text/html'],
    ['css', 'text/css'],
    ['js', 'text/javascript'],
    ['zip', 'application/zip'],
    ['rar', 'application/vnd.rar'],
    ['7z', 'application/x-7z-compressed'],
    ['tar', 'application/x-tar'],
    ['gz', 'application/gzip'],
    ['bz2', 'application/x-bzip2'],
    ['xz', 'application/x-xz'],
]);

// 保留原有文件命名允许的扩展名，包括无法可靠推断 MIME 的扩展名。
const VALID_FILE_EXTENSIONS = new Set([
    ...FILE_TYPES_BY_EXTENSION.keys(),
    'ts', 'go', 'java', 'php', 'py', 'rb', 'sh', 'bat', 'cmd', 'ps1', 'psm1',
    'psd', 'ai', 'sketch', 'fig', 'eps', 'apk', 'exe', 'msi', 'dmg', 'iso', 'torrent',
    'ttf', 'otf', 'woff', 'woff2', 'eot', 'crx', 'xpi', 'deb', 'rpm', 'jar', 'war', 'ear',
    'img', 'vdi', 'ova', 'ovf', 'qcow2', 'vmdk', 'vhd', 'vhdx', 'pvm', 'dsk', 'hdd',
    'bin', 'cue', 'mds', 'mdf', 'nrg', 'ccd', 'cif', 'c2d', 'daa', 'b6t', 'b5t', 'bwt',
    'isz', 'cdi', 'flp', 'uif', 'xdi', 'sdi',
]);

// 优先采用每种 MIME 的第一个扩展名，再指定兼容旧命名规则的首选值。
const EXTENSIONS_BY_FILE_TYPE = new Map();
for (const [extension, type] of FILE_TYPES_BY_EXTENSION) {
    if (!EXTENSIONS_BY_FILE_TYPE.has(type)) EXTENSIONS_BY_FILE_TYPE.set(type, extension);
}
EXTENSIONS_BY_FILE_TYPE.set('image/jpeg', 'jpeg');
EXTENSIONS_BY_FILE_TYPE.set('image/jpg', 'jpg');
EXTENSIONS_BY_FILE_TYPE.set('application/octet-stream', 'bin');
EXTENSIONS_BY_FILE_TYPE.set('binary/octet-stream', 'bin');

// 视为「客户端未提供有效 MIME」的取值
export const GENERIC_FILE_TYPES = new Set([
    '',
    'application/octet-stream',
    'binary/octet-stream',
    'application/x-www-form-urlencoded',
]);

/** MIME 主类型，仅用于比较；Content-Type 参数不参与分类。 */
export function normalizeMimeType(fileType) {
    return String(fileType || '').split(';', 1)[0].trim().toLowerCase();
}

/** 用于存储和响应的 Content-Type，保留 charset、boundary 等参数及其大小写。 */
export function normalizeFileType(fileType) {
    const value = String(fileType || '').trim();
    const type = normalizeMimeType(value);
    if (!type) return '';
    const separator = value.indexOf(';');
    return type + (separator === -1 ? '' : value.slice(separator));
}

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

export function inferFileType(fileName) {
    return FILE_TYPES_BY_EXTENSION.get(getFileExtension(fileName)) || '';
}

export function isExtValid(fileExt) {
    return typeof fileExt === 'string' && VALID_FILE_EXTENSIONS.has(fileExt.toLowerCase());
}

/** 保留有效文件名后缀；缺失或无效时，从 MIME 推断可用后缀。 */
export function resolveFileExt(fileName, fileType = 'application/octet-stream') {
    const extension = getFileExtension(fileName);
    if (isExtValid(extension)) return extension;
    const type = normalizeMimeType(fileType);
    return EXTENSIONS_BY_FILE_TYPE.get(type) || type.split('/')[1] || 'bin';
}

/** 严格按 MIME 前缀分类，供管理列表使用；不修改或推断历史记录。 */
export function getFileTypeCategory(fileType) {
    const type = normalizeMimeType(fileType);
    for (const category of ['image', 'video', 'audio']) {
        if (type.startsWith(`${category}/`)) return category;
    }
    return 'other';
}

/**
 * 归一化 MIME 类型：客户端给了有效值就沿用，否则按扩展名推断
 * @param {string} fileName - 文件名或含路径的文件 id
 * @param {string} clientType - 客户端提供的 MIME
 * @returns {string}
 */
export function resolveFileType(fileName, clientType = '') {
    const type = normalizeFileType(clientType);
    if (type && !GENERIC_FILE_TYPES.has(normalizeMimeType(type))) {
        return type;
    }

    const inferred = inferFileType(fileName);
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
    const type = normalizeMimeType(fileType);
    const wanted = Array.isArray(wantedTypes) ? wantedTypes : [];

    // content= 表示关闭类型过滤，与扩展名、是否提供 FileType 无关。
    if (wanted.includes('')) return true;
    if (type && wanted.some(t => type.includes(t))) return true;
    // 记录中有明确类型时不做兜底，避免误判
    if (type && !GENERIC_FILE_TYPES.has(type)) return false;

    const inferred = inferFileType(fileName);
    return Boolean(inferred) && wanted.some(t => inferred.includes(t));
}
