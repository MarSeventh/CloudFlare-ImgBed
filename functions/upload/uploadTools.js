import { fetchSecurityConfig } from "../utils/sysConfig";
import { purgeCFCache } from "../utils/purgeCache";
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

// 检查文件扩展名是否有效
export function isExtValid(fileExt) {
    return ['jpeg', 'jpg', 'png', 'gif', 'webp',
        'mp4', 'mp3', 'ogg',
        'mp3', 'wav', 'flac', 'aac', 'opus',
        'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'pdf',
        'txt', 'md', 'json', 'xml', 'html', 'css', 'js', 'ts', 'go', 'java', 'php', 'py', 'rb', 'sh', 'bat', 'cmd', 'ps1', 'psm1', 'psd', 'ai', 'sketch', 'fig', 'svg', 'eps', 'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'apk', 'exe', 'msi', 'dmg', 'iso', 'torrent', 'webp', 'ico', 'svg', 'ttf', 'otf', 'woff', 'woff2', 'eot', 'apk', 'crx', 'xpi', 'deb', 'rpm', 'jar', 'war', 'ear', 'img', 'iso', 'vdi', 'ova', 'ovf', 'qcow2', 'vmdk', 'vhd', 'vhdx', 'pvm', 'dsk', 'hdd', 'bin', 'cue', 'mds', 'mdf', 'nrg', 'ccd', 'cif', 'c2d', 'daa', 'b6t', 'b5t', 'bwt', 'isz', 'isz', 'cdi', 'flp', 'uif', 'xdi', 'sdi'
    ].includes(fileExt);
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

    // 清除api/randomFileList API缓存
    try {
        const cache = caches.default;
        // await cache.delete(`${url.origin}/api/randomFileList`); delete有bug，通过写入一个max-age=0的response来清除缓存
        const nullResponse = new Response(null, {
            headers: { 'Cache-Control': 'max-age=0' },
        });

        await cache.put(`${url.origin}/api/randomFileList?dir=${normalizedFolder}`, nullResponse);
    } catch (error) {
        console.error('Failed to clear cache:', error);
    }
}

// 结束上传：清除缓存，维护索引
export async function endUpload(context, fileId, metadata) {
    const { env, url } = context;

    // 清除CDN缓存
    const cdnUrl = `https://${url.hostname}/file/${fileId}`;
    const normalizedFolder = (url.searchParams.get('uploadFolder') || '').replace(/^\/+/, '').replace(/\/{2,}/g, '/').replace(/\/$/, '');
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

    let fileExt = fileName.split('.').pop();
    if (!fileExt || fileExt === fileName) {
        fileExt = fileType.split('/').pop();
        if (fileExt === fileType || fileExt === '' || fileExt === null || fileExt === undefined) {
            fileExt = 'unknown';
        }
    }

    const nameType = url.searchParams.get('uploadNameType') || 'default';
    const uploadFolder = url.searchParams.get('uploadFolder') || '';
    const normalizedFolder = uploadFolder
        ? uploadFolder.replace(/^\/+/, '').replace(/\/{2,}/g, '/').replace(/\/$/, '')
        : '';

    if (!isExtValid(fileExt)) {
        fileExt = fileType.split('/').pop();
        if (fileExt === fileType || fileExt === '' || fileExt === null || fileExt === undefined) {
            fileExt = 'unknown';
        }
    }

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