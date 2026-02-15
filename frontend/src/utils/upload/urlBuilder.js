/**
 * URL 构建工具函数
 * 用于生成各种格式的文件链接（原始链接、Markdown、HTML、BBCode）
 */

/**
 * 根据 srcID 和文件名生成所有格式的 URL
 * @param {string} srcID - 文件资源 ID
 * @param {string} name - 文件名
 * @param {string} rootUrl - 链接前缀
 * @returns {{ finalURL: string, mdURL: string, htmlURL: string, ubbURL: string }}
 */
export function buildFileUrls(srcID, name, rootUrl) {
    const url = rootUrl + srcID
    return {
        finalURL: url,
        mdURL: `![${name}](${url})`,
        htmlURL: `<img src="${url}" alt="${name}" width=100% />`,
        ubbURL: `[img]${url}[/img]`
    }
}

/**
 * 根据 selectedUrlForm 获取对应格式的 URL 值
 * @param {object} file - 文件对象，包含 finalURL/mdURL/htmlURL/ubbURL
 * @param {string} format - 格式类型：'url' | 'md' | 'html' | 'ubb'
 * @returns {string}
 */
export function getUrlByFormat(file, format) {
    const map = {
        url: file.finalURL,
        md: file.mdURL,
        html: file.htmlURL,
        ubb: file.ubbURL
    }
    return map[format] || file.finalURL
}

/**
 * 批量更新文件列表中的 URL（当自定义链接前缀变化时）
 * @param {Array} fileList - 文件列表
 * @param {string} rootUrl - 新的链接前缀
 */
export function updateFileListUrls(fileList, rootUrl) {
    fileList.forEach(item => {
        if (item.uploadChannel === 'external') {
            return
        }
        const urls = buildFileUrls(item.srcID, item.name, rootUrl)
        Object.assign(item, urls)
    })
}
