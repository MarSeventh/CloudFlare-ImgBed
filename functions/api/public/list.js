import { fetchOthersConfig } from "../../utils/sysConfig";
import { readIndex } from '../../utils/indexManager.js';

// CORS 跨域响应头
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
};

/**
 * 检查目录是否在允许列表中
 * @param {string} dir - 请求的目录
 * @param {string[]} allowedDirs - 允许的目录列表
 * @returns {boolean}
 */
function isAllowedDirectory(dir, allowedDirs) {
    // 如果允许目录列表为空，视为允许所有目录（包括根目录）
    if (!allowedDirs || allowedDirs.length === 0) {
        return true;
    }

    // 标准化目录格式
    const normalizedDir = dir.replace(/^\/+/, '').replace(/\/+$/, '');

    for (const allowed of allowedDirs) {
        const normalizedAllowed = allowed.trim().replace(/^\/+/, '').replace(/\/+$/, '');

        // "*" 或空字符串表示允许所有目录（包括根目录）
        if (normalizedAllowed === '*' || normalizedAllowed === '') {
            return true;
        }

        // 根目录访问：如果请求的是空目录，需要精确匹配
        if (normalizedDir === '' && normalizedAllowed !== '') {
            continue; // 根目录不匹配具体目录名
        }

        // 精确匹配或子目录匹配
        if (normalizedDir === normalizedAllowed ||
            normalizedDir.startsWith(normalizedAllowed + '/')) {
            return true;
        }
    }

    return false;
}

export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);

    // OPTIONS 预检请求
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: corsHeaders
        });
    }

    // 只允许 GET 请求
    if (request.method !== 'GET') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }

    try {
        // 读取配置
        const othersConfig = await fetchOthersConfig(env);
        const publicBrowse = othersConfig.publicBrowse || {};

        // 检查是否启用公开浏览
        if (!publicBrowse.enabled) {
            return new Response(JSON.stringify({ error: 'Public browse is disabled' }), {
                status: 403,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // 解析允许的目录
        const allowedDirStr = publicBrowse.allowedDir || '';
        let allowedDirs = allowedDirStr.split(',').map(d => d.trim()).filter(d => d);

        // 获取请求的目录和搜索参数
        let dir = url.searchParams.get('dir') || '';
        let search = url.searchParams.get('search') || '';
        if (search) {
            search = decodeURIComponent(search).trim();
        }
        
        // 获取高级搜索参数
        const recursive = url.searchParams.get('recursive') === 'true';
        const fileType = url.searchParams.get('type') || ''; // image, video, audio, other
        
        // 检查目录权限
        if (!isAllowedDirectory(dir, allowedDirs)) {
            return new Response(JSON.stringify({ error: 'Directory not allowed' }), {
                status: 403,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // 处理目录格式
        if (dir.startsWith('/')) {
            dir = dir.substring(1);
        }
        if (dir && !dir.endsWith('/')) {
            dir += '/';
        }

        // 解析分页参数
        const start = parseInt(url.searchParams.get('start'), 10) || 0;
        const count = parseInt(url.searchParams.get('count'), 10) || 50;

        // 读取文件列表（获取全部，因为需要先过滤 block/adult）
        const result = await readIndex(context, {
            directory: dir,
            search,
            start: 0,
            count: -1, // 获取全部
            includeSubdirFiles: recursive,
        });

        if (!result.success) {
            return new Response(JSON.stringify({ error: 'Failed to read file list' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }

        // 过滤子目录，只返回允许的目录
        const filteredDirectories = result.directories.filter(subDir => {
            return isAllowedDirectory(subDir, allowedDirs);
        });

        // 文件类型过滤辅助函数
        const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif'];
        const videoExts = ['mp4', 'webm', 'ogg', 'mov', 'm4v', 'mkv', 'avi', '3gp', 'mpeg', 'mpg', 'flv', 'wmv', 'ts', 'rmvb'];
        const audioExts = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma', 'ape', 'opus'];
        
        const getFileExt = (name) => (name.split('.').pop() || '').toLowerCase();
        const isImageFile = (name) => imageExts.includes(getFileExt(name));
        const isVideoFile = (name) => videoExts.includes(getFileExt(name));
        const isAudioFile = (name) => audioExts.includes(getFileExt(name));

        // 过滤掉 block 和 adult 图片（公开浏览不应显示这些内容）
        let filteredFiles = result.files.filter(file => {
            const listType = file.metadata?.ListType;
            const label = file.metadata?.Label;
            // 排除被屏蔽的和成人内容
            if (listType === 'Block' || label === 'adult') {
                return false;
            }
            return true;
        });

        // 按文件类型过滤
        if (fileType) {
            filteredFiles = filteredFiles.filter(file => {
                const name = file.id;
                switch (fileType) {
                    case 'image': return isImageFile(name);
                    case 'video': return isVideoFile(name);
                    case 'audio': return isAudioFile(name);
                    case 'other': return !isImageFile(name) && !isVideoFile(name) && !isAudioFile(name);
                    default: return true;
                }
            });
        }

        // 计算过滤后的总数和分页
        const filteredTotalCount = filteredFiles.length;
        // 过滤后再分页
        filteredFiles = filteredFiles.slice(start, start + count);

        // 转换文件格式（只返回必要信息，隐藏敏感元数据）
        const safeFiles = filteredFiles.map(file => ({
            name: file.id,
            metadata: {
                FileType: file.metadata?.FileType,
                TimeStamp: file.metadata?.TimeStamp,
                FileSize: file.metadata?.FileSize,
                // 不返回 Channel、IP、Label 等敏感信息
            }
        }));

        return new Response(JSON.stringify({
            files: safeFiles,
            directories: filteredDirectories,
            totalCount: fileType ? filteredTotalCount : result.totalCount,
            returnedCount: safeFiles.length,
            allowedDirs: allowedDirs, // 返回允许的目录列表供前端使用
        }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });

    } catch (error) {
        console.error('Error in public list API:', error);
        return new Response(JSON.stringify({
            error: 'Internal server error',
            message: error.message
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}
