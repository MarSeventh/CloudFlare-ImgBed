export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);

    let start = parseInt(url.searchParams.get('start'), 10) || 0;
    let count = parseInt(url.searchParams.get('count'), 10) || 50;
    let sum = url.searchParams.get('sum') || false;
    let dir = url.searchParams.get('dir') || ''; // 目录名
    let search = url.searchParams.get('search') || ''; // 搜索关键字

    // 处理搜索关键字
    if (search) {
        search = decodeURIComponent(search).trim().toLowerCase();
    }

    // 处理为相对路径
    if (dir.startsWith('/')) {
        dir = dir.substring(1);
    }
    if (dir !== '' && !dir.endsWith('/')) {
        dir += '/';
    }

    // 只需要返回总数
    if (count === -1 && sum === 'true') {
        const totalCount = await getRecordCount(env, dir, search);
        return new Response(JSON.stringify({ sum: totalCount }), {
            headers: { "Content-Type": "application/json" }
        });
    }

    // 返回数据
    const result = await getRecords(env, dir, search, start, count);

    return new Response(JSON.stringify({
        files: result.files,
        directories: Array.from(result.directories)
    }), {
        headers: { "Content-Type": "application/json" }
    });
}

// 快速获取记录总数
async function getRecordCount(env, dir, search) {
    let count = 0;
    let cursor = null;
    const batchSize = 1000;

    while (true) {
        const response = await env.img_url.list({
            prefix: dir,
            limit: batchSize,
            cursor: cursor
        });
        cursor = response.cursor;

        for (const item of response.keys) {
            if (item.name.startsWith("manage@")) continue;
            
            if (search) {
                const matchesSearch = item.name.toLowerCase().includes(search) || 
                                    item.metadata?.FileName?.toLowerCase().includes(search);
                if (matchesSearch) count++;
            } else {
                count++;
            }
        }

        if (!cursor) break;
    }

    return count;
}

// 获取需要的记录
async function getRecords(env, dir, search, start, count) {
    const subdirectories = new Set();
    let cursor = null;
    const batchSize = 1000;
    
    // 使用最小堆来维护排序，只保留需要的记录数量
    const maxHeapSize = count === -1 ? Infinity : start + count + 1000; // 预留一些缓冲
    let allValidRecords = [];

    while (true) {
        const response = await env.img_url.list({
            prefix: dir,
            limit: batchSize,
            cursor: cursor
        });
        cursor = response.cursor;

        // 批量处理当前批次的记录
        const batchRecords = [];
        for (const record of response.keys) {
            if (record.name.startsWith("manage@")) continue;

            // 搜索过滤
            if (search) {
                const matchesSearch = record.name.toLowerCase().includes(search) || 
                                    record.metadata?.FileName?.toLowerCase().includes(search);
                if (!matchesSearch) continue;
            }

            // 解析目录结构
            let key = record.name;
            if (key.startsWith(dir)) {
                let relativePath = key.substring(dir.length);
                if (relativePath.startsWith('/')) {
                    relativePath = relativePath.substring(1);
                }

                let parts = relativePath.split('/');
                if (parts.length === 1) {
                    // 直接位于该目录的文件
                    batchRecords.push(record);
                } else {
                    // 该目录下的子文件夹
                    if (dir === '' || dir.endsWith('/')) {
                        subdirectories.add(dir + parts[0]);
                    } else {
                        subdirectories.add(dir + '/' + parts[0]);
                    }
                }
            }
        }

        // 将当前批次的记录添加到总记录中
        allValidRecords.push(...batchRecords);

        // 如果记录数量超过最大堆大小，进行部分排序和裁剪
        if (allValidRecords.length > maxHeapSize && count !== -1) {
            allValidRecords.sort((a, b) => b.metadata.TimeStamp - a.metadata.TimeStamp);
            allValidRecords = allValidRecords.slice(0, maxHeapSize);
        }

        if (!cursor) break;
        
        // 添加协作点，避免长时间占用CPU
        if (allValidRecords.length % 5000 === 0) {
            await new Promise(resolve => setTimeout(resolve, 0));
        }
    }

    // 最终排序
    allValidRecords.sort((a, b) => b.metadata.TimeStamp - a.metadata.TimeStamp);

    // 分页处理
    let resultFiles;
    if (count === -1) {
        resultFiles = allValidRecords;
    } else {
        start = Math.max(0, start);
        count = Math.max(1, count);
        resultFiles = allValidRecords.slice(start, start + count);
    }

    return {
        files: resultFiles,
        directories: subdirectories
    };
}
