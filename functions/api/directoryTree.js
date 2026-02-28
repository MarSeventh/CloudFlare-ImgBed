import { getDirectoryTree } from '../utils/indexManager';
import { dualAuthCheck } from '../utils/dualAuth';

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
 */
export async function onRequestGet(context) {
    const { env, request } = context;
    const url = new URL(request.url);
    
    // 双重鉴权：用户端或管理端任意一个通过即可
    const authResult = await dualAuthCheck(env, url, request);
    if (!authResult.authorized) {
        return new Response('Unauthorized', { status: 401 });
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
