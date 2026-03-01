import { getDirectoryTree } from '../utils/indexManager';
import { dualAuthCheck } from '../utils/dualAuth';
import { fetchPageConfig } from '../utils/sysConfig';

/**
 * 目录树 API 端点
 * GET /api/directoryTree
 * 
 * 查询参数：
 * - cacheTime: 可选，覆盖默认缓存时间（秒），默认 60
 * 
 * 响应：
 * - 成功：{ tree: DirectoryTreeNode }
 * - 失败：{ error: string }
 * 
 * 权限说明：
 * - 管理端鉴权成功：始终允许访问
 * - 用户端鉴权成功：仅当 showDirectorySuggestions 开启时允许访问
 */
export async function onRequestGet(context) {
    const { env, request } = context;
    const url = new URL(request.url);
    
    // 双重鉴权：用户端或管理端任意一个通过即可
    const authResult = await dualAuthCheck(env, url, request);
    if (!authResult.authorized) {
        return new Response('Unauthorized', { status: 401 });
    }
    
    // 如果是用户端鉴权，检查 showDirectorySuggestions 设置
    if (authResult.authType === 'user') {
        const pageConfig = await fetchPageConfig(env);
        // 从 config 数组中查找 showDirectorySuggestions 设置
        const showDirSetting = pageConfig.config?.find(c => c.id === 'showDirectorySuggestions');
        const showDirectorySuggestions = showDirSetting?.value ?? showDirSetting?.default ?? true;
        
        if (!showDirectorySuggestions) {
            return new Response(JSON.stringify({ error: 'Directory suggestions disabled' }), {
                status: 403,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }
    
    try {
        const tree = await getDirectoryTree(context);
        const cacheTime = url.searchParams.get('cacheTime') || 60;
        
        return new Response(JSON.stringify({ tree }), {
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': `public, max-age=${cacheTime}`,
                'Access-Control-Allow-Origin': '*',
            }
        });
    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
