export const MAX_UPLOAD_EXTENSIONS = 200;

export function normalizeUploadExtension(value) {
    return typeof value === 'string' ? value.trim().toLowerCase().replace(/^\./, '') : '';
}

export function isValidUploadExtension(value) {
    return typeof value === 'string' && value.length <= 32 &&
        /^[a-z0-9][a-z0-9+_-]*(?:\.[a-z0-9][a-z0-9+_-]*)*$/.test(value);
}

export function normalizeUploadFormatConfig(raw) {
    return {
        enabled: raw?.enabled === true,
        mode: raw?.mode === 'blacklist' ? 'blacklist' : 'whitelist',
        extensions: [...new Set((Array.isArray(raw?.extensions) ? raw.extensions : [])
            .map(normalizeUploadExtension).filter(isValidUploadExtension))],
    };
}

export function validateUploadFormatConfig(raw) {
    if (!raw || typeof raw.enabled !== 'boolean' ||
        !['whitelist', 'blacklist'].includes(raw.mode) || !Array.isArray(raw.extensions)) {
        return { error: 'Invalid fileFormat configuration' };
    }
    const extensions = raw.extensions.map(normalizeUploadExtension);
    if (extensions.some(extension => !isValidUploadExtension(extension))) {
        return { error: 'Invalid file extension' };
    }
    const config = normalizeUploadFormatConfig(raw);
    if (config.extensions.length > MAX_UPLOAD_EXTENSIONS) {
        return { error: `At most ${MAX_UPLOAD_EXTENSIONS} file extensions are allowed` };
    }
    if (config.enabled && config.mode === 'whitelist' && config.extensions.length === 0) {
        return { error: 'Select at least one allowed file extension' };
    }
    return { config };
}

export function isUploadFormatAllowed(fileName, raw) {
    const config = normalizeUploadFormatConfig(raw);
    if (!config.enabled) return true;
    const basename = typeof fileName === 'string' ? fileName.split(/[\\/]/).pop().toLowerCase() : '';
    const matched = config.extensions.some(extension =>
        basename.length > extension.length + 1 && basename.endsWith(`.${extension}`));
    return config.mode === 'whitelist' ? matched : !matched;
}
