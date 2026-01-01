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

        // 获取请求的目录
        let dir = url.searchParams.get('dir') || '';

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

        // 读取文件列表
        const result = await readIndex(context, {
            directory: dir,
            start,
            count,
            includeSubdirFiles: false,
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

        // 转换文件格式（只返回必要信息，隐藏敏感元数据）
        const safeFiles = result.files.map(file => ({
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
            totalCount: result.totalCount,
            returnedCount: result.returnedCount,
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
