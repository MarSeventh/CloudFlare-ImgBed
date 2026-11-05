// One column definition keeps headers, rows and saved preferences aligned.
export const optionalListColumns = [
    { key: 'preview', label: 'preview', width: 60 },
    { key: 'tags', label: 'tags', width: 130 },
    { key: 'channel', label: 'channelType', width: 100 },
    { key: 'channel-name', label: 'channelNameCol', width: 110 },
    { key: 'address', label: 'uploadAddress', width: 130 },
    { key: 'size', label: 'fileSize', width: 80 },
    { key: 'date', label: 'uploadTime', width: 100 }
];
export const defaultListColumns = optionalListColumns.map(column => column.key);
export function normalizeListColumns(value) {
    return Array.isArray(value) ? defaultListColumns.filter(key => value.includes(key)) : [...defaultListColumns];
}
export function loadListColumns(storage) {
    try { return normalizeListColumns(JSON.parse(storage.getItem('dashboardListColumns'))); }
    catch { return [...defaultListColumns]; }
}
export function listColumnLayout(value) {
    const selected = normalizeListColumns(value);
    const widths = optionalListColumns.filter(column => selected.includes(column.key));
    const preview = selected.includes('preview') ? ['60px'] : [];
    return {
        '--list-columns': ['50px', ...preview, 'minmax(180px, 1fr)', ...widths.filter(c => c.key !== 'preview').map(c => `${c.width}px`), '320px'].join(' '),
        '--list-min-width': `${50 + 180 + 320 + 40 + widths.reduce((sum, column) => sum + column.width, 0)}px`
    };
}
export function validOverviewFileName(name) {
    return typeof name === 'string' && name.length > 0 && name === name.trim() &&
        name !== '.' && name !== '..' && !/[\\/,:*?"<>|#%\u0000-\u001f\u007f]/.test(name) &&
        !name.endsWith('.') && new TextEncoder().encode(name).length <= 180;
}
