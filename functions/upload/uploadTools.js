import { fetchSecurityConfig } from "../utils/sysConfig";
import { purgeCFCache, purgeRandomFileListCache, purgePublicFileListCache } from "../utils/purgeCache";
import { addFileToIndex } from "../utils/indexManager.js";
import { getDatabase } from '../utils/databaseAdapter.js';

// 统一的响应创建函数
export function createResponse(body, options = {}) {
    const defaultHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, authCode',
        'Access-Control-Max-Age': '86400',
    };

    return new Response(body, {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers
        }
    });
}

// 生成短链接
export function generateShortId(length = 8) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// 获取IP地址
export async function getIPAddress(ip) {
    let address = '未知';
    try {
        const ipInfo = await fetch(`https://apimobile.meituan.com/locate/v2/ip/loc?rgeo=true&ip=${ip}`);
        const ipData = await ipInfo.json();

        if (ipInfo.ok && ipData.data) {
            const lng = ipData.data?.lng || 0;
            const lat = ipData.data?.lat || 0;

            // 读取具体地址
            const addressInfo = await fetch(`https://apimobile.meituan.com/group/v1/city/latlng/${lat},${lng}?tag=0`);
            const addressData = await addressInfo.json();

            if (addressInfo.ok && addressData.data) {
                // 根据各字段是否存在，拼接地址
                address = [
                    addressData.data.detail,
                    addressData.data.city,
                    addressData.data.province,
                    addressData.data.country
                ].filter(Boolean).join(', ');
            }
        }
    } catch (error) {
        console.error('Error fetching IP address:', error);
    }
    return address;
}

// 处理文件名中的特殊字符
export function sanitizeFileName(fileName) {
    fileName = decodeURIComponent(fileName);
    fileName = fileName.split('/').pop();

    const unsafeCharsRe = /[\\\/:\*\?"'<>\| \(\)\[\]\{\}#%\^`~;@&=\+\$,]/g;
    return fileName.replace(unsafeCharsRe, '_');
}

/**
 * 上传路径安全处理：防止路径穿越，标准化特殊字符
 * @param {string} folder - 原始上传路径
 * @returns {string} 安全处理后的路径
 */
export function sanitizeUploadFolder(folder) {
    if (!folder || folder.trim() === '') {
        return '';
    }

    // 防止编码绕过：如果检测到 URL 编码字符（%XX），先解码再处理
    // 注意：url.searchParams.get() 已经做过一次解码，这里是为了防御双重编码攻击（如 %252e%252e）
    if (/%[0-9a-fA-F]{2}/.test(folder)) {
        try {
            folder = decodeURIComponent(folder);
        } catch (e) {
            // 解码失败（如 %zz 等非法编码）则使用原始值
        }
    }

    // 移除路径穿越字符 ..
    // 将 .. 替换为 _（无论是否在路径段中）
    folder = folder.replace(/\.\./g, '_');

    // 将单独的 . 路径段替换为 _（例如 /./）
    // 处理方式：按 / 分割后，将纯 . 的段替换为 _
    folder = folder.split('/').map(seg => seg === '.' ? '_' : seg).join('/');

    // 替换反斜杠为正斜杠
    folder = folder.replace(/\\/g, '/');

    // 将连续斜杠替换为单个斜杠
    folder = folder.replace(/\/{2,}/g, '/');

    // 移除开头的 /
    folder = folder.replace(/^\/+/, '');

    // 移除末尾的 /
    folder = folder.replace(/\/+$/, '');

    // 对每个路径段进行特殊字符处理
    const segments = folder.split('/');
    const sanitizedSegments = segments
        .map(seg => {
            // 将路径段中的特殊字符替换为 _
            // 特殊字符包括: \ : * ? " ' < > | 空格 ( ) [ ] { } # % ^ ` ~ ; @ & = + $ ,
            return seg.replace(/[\\:\*\?"'<>\| \(\)\[\]\{\}#%\^`~;@&=\+\$,]/g, '_');
        })
        .filter(seg => seg.length > 0); // 过滤空段

    return sanitizedSegments.join('/');
}

// 检查文件扩展名是否有效
export function isExtValid(fileExt) {
    return ['jpeg', 'jpg', 'png', 'gif', 'webp',
        'mp4', 'mp3', 'ogg',
        'mp3', 'wav', 'flac', 'aac', 'opus',
        'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'pdf',
        'txt', 'md', 'json', 'xml', 'html', 'css', 'js', 'ts', 'go', 'java', 'php', 'py', 'rb', 'sh', 'bat', 'cmd', 'ps1', 'psm1', 'psd', 'ai', 'sketch', 'fig', 'svg', 'eps', 'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'apk', 'exe', 'msi', 'dmg', 'iso', 'torrent', 'webp', 'ico', 'svg', 'ttf', 'otf', 'woff', 'woff2', 'eot', 'apk', 'crx', 'xpi', 'deb', 'rpm', 'jar', 'war', 'ear', 'img', 'iso', 'vdi', 'ova', 'ovf', 'qcow2', 'vmdk', 'vhd', 'vhdx', 'pvm', 'dsk', 'hdd', 'bin', 'cue', 'mds', 'mdf', 'nrg', 'ccd', 'cif', 'c2d', 'daa', 'b6t', 'b5t', 'bwt', 'isz', 'isz', 'cdi', 'flp', 'uif', 'xdi', 'sdi'
    ].includes(fileExt);
}
/**
 * 从文件名和文件类型中解析出有效的文件扩展名
 * @param {string} fileName - 文件名
 * @param {string} fileType - MIME 类型，如 'image/png'
 * @returns {string} 文件扩展名
 */
export function resolveFileExt(fileName, fileType = 'application/octet-stream') {
    let fileExt = fileName.split('.').pop();
    if (fileExt && fileExt !== fileName && isExtValid(fileExt)) {
        return fileExt;
    }
    // 文件名中无有效扩展名，尝试从 MIME 类型中提取
    const typePart = fileType.split('/').pop();
    if (typePart && typePart !== fileType) {
        return typePart;
    }
    return 'bin';
}



/**
 * 从图片文件头部提取尺寸信息
 * 支持 JPEG, PNG, GIF, WebP, BMP 格式
 * 优先通过文件头魔数检测格式，不依赖 MIME 类型
 * @param {ArrayBuffer} buffer - 文件的 ArrayBuffer
 * @param {string} fileType - 文件 MIME 类型（仅作参考）
 * @returns {Object|null} { width, height } 或 null
 */
export function getImageDimensions(buffer, fileType) {
    try {
        const view = new DataView(buffer);
        const uint8 = new Uint8Array(buffer);

        // 通过文件头魔数检测格式（不依赖 MIME 类型）

        // PNG 签名: 89 50 4E 47
        if (uint8[0] === 0x89 && uint8[1] === 0x50 && uint8[2] === 0x4E && uint8[3] === 0x47) {
            const width = view.getUint32(16, false);
            const height = view.getUint32(20, false);
            return { width, height };
        }

        // JPEG 签名: FF D8 FF
        if (uint8[0] === 0xFF && uint8[1] === 0xD8 && uint8[2] === 0xFF) {
            let offset = 2;
            while (offset < buffer.byteLength - 9) {
                if (uint8[offset] !== 0xFF) break;
                const marker = uint8[offset + 1];
                // SOF0, SOF1, SOF2 标记包含尺寸信息
                if (marker >= 0xC0 && marker <= 0xC3 && marker !== 0xC4) {
                    const height = view.getUint16(offset + 5, false);
                    const width = view.getUint16(offset + 7, false);
                    return { width, height };
                }
                const length = view.getUint16(offset + 2, false);
                offset += 2 + length;
            }
            return null;
        }

        // GIF 签名: 47 49 46 (GIF)
        if (uint8[0] === 0x47 && uint8[1] === 0x49 && uint8[2] === 0x46) {
            const width = view.getUint16(6, true); // little-endian
            const height = view.getUint16(8, true);
            return { width, height };
        }

        // WebP 签名: RIFF....WEBP
        if (uint8[0] === 0x52 && uint8[1] === 0x49 && uint8[2] === 0x46 && uint8[3] === 0x46 &&
            uint8[8] === 0x57 && uint8[9] === 0x45 && uint8[10] === 0x42 && uint8[11] === 0x50) {
            // VP8 (lossy): VP8 + 空格
            if (uint8[12] === 0x56 && uint8[13] === 0x50 && uint8[14] === 0x38 && uint8[15] === 0x20) {
                if (buffer.byteLength >= 30) {
                    const width = (view.getUint16(26, true) & 0x3FFF);
                    const height = (view.getUint16(28, true) & 0x3FFF);
                    return { width, height };
                }
            }
            // VP8L (lossless): VP8L
            if (uint8[12] === 0x56 && uint8[13] === 0x50 && uint8[14] === 0x38 && uint8[15] === 0x4C) {
                if (buffer.byteLength >= 25) {
                    const bits = view.getUint32(21, true);
                    const width = (bits & 0x3FFF) + 1;
                    const height = ((bits >> 14) & 0x3FFF) + 1;
                    return { width, height };
                }
            }
            // VP8X (extended): VP8X
            if (uint8[12] === 0x56 && uint8[13] === 0x50 && uint8[14] === 0x38 && uint8[15] === 0x58) {
                if (buffer.byteLength >= 30) {
                    const width = (uint8[24] | (uint8[25] << 8) | (uint8[26] << 16)) + 1;
                    const height = (uint8[27] | (uint8[28] << 8) | (uint8[29] << 16)) + 1;
                    return { width, height };
                }
            }
            return null;
        }

        // BMP 签名: 42 4D (BM)
        if (uint8[0] === 0x42 && uint8[1] === 0x4D) {
            const width = view.getInt32(18, true);
            const height = Math.abs(view.getInt32(22, true)); // height 可能为负数
            return { width, height };
        }

        return null;
    } catch (error) {
        console.error('Error extracting image dimensions:', error);
        return null;
    }
}

// 图像审查
export async function moderateContent(env, url) {
    const securityConfig = await fetchSecurityConfig(env);
    const uploadModerate = securityConfig.upload.moderate;

    const enableModerate = uploadModerate && uploadModerate.enabled;

    let label = "None";

    // 如果未启用审查，直接返回label
    if (!enableModerate) {
        return label;
    }

    // moderatecontent.com 渠道
    if (uploadModerate.channel === 'moderatecontent.com') {
        const apikey = uploadModerate.moderateContentApiKey;
        if (apikey == undefined || apikey == null || apikey == "") {
            label = "None";
        } else {
            try {
                const params = new URLSearchParams({ key: apikey, url: url });
                const fetchResponse = await fetch('https://api.moderatecontent.com/moderate/', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: params.toString()
                });
                if (!fetchResponse.ok) {
                    throw new Error(`HTTP error! status: ${fetchResponse.status}`);
                }
                const moderate_data = await fetchResponse.json();
                if (moderate_data.rating_label) {
                    label = moderate_data.rating_label;
                }
            } catch (error) {
                console.error('Moderate Error:', error);
                // 将不带审查的图片写入数据库
                label = "None";
            }
        }
        return label;
    }

    // nsfw 渠道
    if (uploadModerate.channel === 'nsfwjs') {
        const nsfwApiPath = securityConfig.upload.moderate.nsfwApiPath;

        try {
            const fetchResponse = await fetch(`${nsfwApiPath}?url=${encodeURIComponent(url)}`);
            if (!fetchResponse.ok) {
                throw new Error(`HTTP error! status: ${fetchResponse.status}`);
            }
            const moderate_data = await fetchResponse.json();

            const score = moderate_data.score || 0;
            if (score >= 0.9) {
                label = "adult";
            } else if (score >= 0.7) {
                label = "teen";
            } else {
                label = "everyone";
            }
        } catch (error) {
            console.error('Moderate Error:', error);
            // 将不带审查的图片写入数据库
            label = "None";
        }

        return label;
    }

    return label;
}

// 清除CDN缓存
export async function purgeCDNCache(env, cdnUrl, url, normalizedFolder) {
    if (env.dev_mode === 'true') {
        return;
    }

    // 清除CDN缓存
    try {
        await purgeCFCache(env, cdnUrl);
    } catch (error) {
        console.error('Failed to clear CDN cache:', error);
    }

    // 清除 api/randomFileList 等API缓存
    await purgeRandomFileListCache(url.origin, normalizedFolder);
    await purgePublicFileListCache(url.origin, normalizedFolder);
}

// 结束上传：清除缓存，维护索引
export async function endUpload(context, fileId, metadata) {
    const { env, url } = context;

    // 清除CDN缓存
    const cdnUrl = `https://${url.hostname}/file/${fileId}`;
    const normalizedFolder = sanitizeUploadFolder(url.searchParams.get('uploadFolder') || '');
    await purgeCDNCache(env, cdnUrl, url, normalizedFolder);

    // 更新文件索引（索引更新时会自动计算容量统计）
    await addFileToIndex(context, fileId, metadata);
}

// 从 request 中解析 ip 地址
export function getUploadIp(request) {
    const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || request.headers.get("x-forwarded-for") || request.headers.get("x-client-ip") || request.headers.get("x-host") || request.headers.get("x-originating-ip") || request.headers.get("x-cluster-client-ip") || request.headers.get("forwarded-for") || request.headers.get("forwarded") || request.headers.get("via") || request.headers.get("requester") || request.headers.get("true-client-ip") || request.headers.get("client-ip") || request.headers.get("x-remote-ip") || request.headers.get("x-originating-ip") || request.headers.get("fastly-client-ip") || request.headers.get("akamai-origin-hop") || request.headers.get("x-remote-addr") || request.headers.get("x-remote-host") || request.headers.get("x-client-ips")

    if (!ip) {
        return null;
    }

    // 处理多个IP地址的情况
    const ips = ip.split(',').map(i => i.trim());

    return ips[0]; // 返回第一个IP地址
}

// 检查上传IP是否被封禁
export async function isBlockedUploadIp(env, uploadIp) {
    try {
        const db = getDatabase(env);

        let list = await db.get("manage@blockipList");
        if (list == null) {
            list = [];
        } else {
            list = list.split(",");
        }

        return list.includes(uploadIp);
    } catch (error) {
        console.error('Failed to check blocked IP:', error);
        // 如果数据库未配置，默认不阻止任何IP
        return false;
    }
}

// 构建唯一文件ID
export async function buildUniqueFileId(context, fileName, fileType = 'application/octet-stream') {
    const { env, url } = context;
    const db = getDatabase(env);

    const fileExt = resolveFileExt(fileName, fileType);

    const nameType = url.searchParams.get('uploadNameType') || 'default';
    const uploadFolder = url.searchParams.get('uploadFolder') || '';
    // 对上传路径进行安全处理
    const normalizedFolder = sanitizeUploadFolder(uploadFolder);

    // 处理文件名，移除特殊字符
    fileName = sanitizeFileName(fileName);

    const unique_index = Date.now() + Math.floor(Math.random() * 10000);
    let baseId = '';

    // 根据命名方式构建基础ID
    if (nameType === 'index') {
        baseId = normalizedFolder ? `${normalizedFolder}/${unique_index}.${fileExt}` : `${unique_index}.${fileExt}`;
    } else if (nameType === 'origin') {
        baseId = normalizedFolder ? `${normalizedFolder}/${fileName}` : fileName;
    } else if (nameType === 'short') {
        // 对于短链接，直接在循环中生成不重复的ID
        while (true) {
            const shortId = generateShortId(8);
            const testFullId = normalizedFolder ? `${normalizedFolder}/${shortId}.${fileExt}` : `${shortId}.${fileExt}`;
            if (await db.get(testFullId) === null) {
                return testFullId;
            }
        }
    } else {
        baseId = normalizedFolder ? `${normalizedFolder}/${unique_index}_${fileName}` : `${unique_index}_${fileName}`;
    }

    // 检查基础ID是否已存在
    if (await db.get(baseId) === null) {
        return baseId;
    }

    // 如果已存在，在文件名后面加上递增编号
    let counter = 1;
    while (true) {
        let duplicateId;

        if (nameType === 'index') {
            const baseName = unique_index;
            duplicateId = normalizedFolder ?
                `${normalizedFolder}/${baseName}(${counter}).${fileExt}` :
                `${baseName}(${counter}).${fileExt}`;
        } else if (nameType === 'origin') {
            const nameWithoutExt = fileName.substring(0, fileName.lastIndexOf('.'));
            const ext = fileName.substring(fileName.lastIndexOf('.'));
            duplicateId = normalizedFolder ?
                `${normalizedFolder}/${nameWithoutExt}(${counter})${ext}` :
                `${nameWithoutExt}(${counter})${ext}`;
        } else {
            const baseName = `${unique_index}_${fileName}`;
            const nameWithoutExt = baseName.substring(0, baseName.lastIndexOf('.'));
            const ext = baseName.substring(baseName.lastIndexOf('.'));
            duplicateId = normalizedFolder ?
                `${normalizedFolder}/${nameWithoutExt}(${counter})${ext}` :
                `${nameWithoutExt}(${counter})${ext}`;
        }

        // 检查新ID是否已存在
        if (await db.get(duplicateId) === null) {
            return duplicateId;
        }

        counter++;

        // 防止无限循环，最多尝试1000次
        if (counter > 1000) {
            throw new Error('无法生成唯一的文件ID');
        }
    }
}

// 基于uploadId的一致性渠道选择
export function selectConsistentChannel(channels, uploadId, loadBalanceEnabled) {
    if (!loadBalanceEnabled || !channels || channels.length === 0) {
        return channels[0];
    }

    // 使用uploadId的哈希值来选择渠道，确保相同uploadId总是选择相同渠道
    let hash = 0;
    for (let i = 0; i < uploadId.length; i++) {
        const char = uploadId.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // 转换为32位整数
    }

    const index = Math.abs(hash) % channels.length;
    return channels[index];
}