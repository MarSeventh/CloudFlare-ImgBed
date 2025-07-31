import { readIndex, getIndexInfo, rebuildIndex, mergeOperationsToIndex, getIndexStorageStats } from '../../utils/indexManager.js';

export async function onRequest(context) {
    const { request, env, waitUntil } = context;
    const url = new URL(request.url);

    // 解析查询参数
    let start = parseInt(url.searchParams.get('start'), 10) || 0;
    let count = parseInt(url.searchParams.get('count'), 10) || 50;
    let sum = url.searchParams.get('sum') === 'true';
    let dir = url.searchParams.get('dir') || '';
    let search = url.searchParams.get('search') || '';
    let channel = url.searchParams.get('channel') || '';
    let listType = url.searchParams.get('listType') || '';
    let action = url.searchParams.get('action') || '';

    // 处理搜索关键字
    if (search) {
        search = decodeURIComponent(search).trim();
    }

    // 处理目录参数
    if (dir.startsWith('/')) {
        dir = dir.substring(1);
    }

    // 处理挂起索引
    await mergeOperationsToIndex(context);

    try {
        // 特殊操作：重建索引
        if (action === 'rebuild') {
            const result = waitUntil(rebuildIndex(context, (processed) => {
                console.log(`Rebuilt ${processed} files...`);
            }));

            return new Response('Index rebuilt asynchronously', {
                headers: { "Content-Type": "text/plain" }
            });
        }

        // 特殊操作：获取索引存储信息
        if (action === 'index-storage-stats') {
            const stats = await getIndexStorageStats(context);
            return new Response(JSON.stringify(stats), {
                headers: { "Content-Type": "application/json" }
            });
        }

        // 特殊操作：获取索引信息
        if (action === 'info') {
            const info = await getIndexInfo(context);
            return new Response(JSON.stringify(info), {
                headers: { "Content-Type": "application/json" }
            });
        }

        // 普通查询：只返回总数
        if (count === -1 && sum) {
            const result = await readIndex(context, {
                search,
                directory: dir,
                channel,
                listType,
                countOnly: true
            });
            
            return new Response(JSON.stringify({ 
                sum: result.totalCount,
                indexLastUpdated: result.indexLastUpdated 
            }), {
                headers: { "Content-Type": "application/json" }
            });
        }

        // 普通查询：返回数据
        const result = await readIndex(context, {
            search,
            directory: dir,
            start,
            count,
            channel,
            listType
        });

        // 转换文件格式
        const compatibleFiles = result.files.map(file => ({
            name: file.id,
            metadata: file.metadata
        }));

        return new Response(JSON.stringify({
            files: compatibleFiles,
            directories: result.directories,
            totalCount: result.totalCount,
            returnedCount: result.returnedCount,
            indexLastUpdated: result.indexLastUpdated,
            isIndexedResponse: true // 标记这是来自索引的响应
        }), {
            headers: { "Content-Type": "application/json" }
        });

    } catch (error) {
        console.error('Error in list-indexed API:', error);
        return new Response(JSON.stringify({
            error: 'Internal server error',
            message: error.message
        }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}
