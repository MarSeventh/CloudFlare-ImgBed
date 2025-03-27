export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);

    let start = parseInt(url.searchParams.get('start'), 10) || 0;
    let count = parseInt(url.searchParams.get('count'), 10) || 50;
    let sum = url.searchParams.get('sum') || false;
    let dir = url.searchParams.get('dir') || ''; // 目录名
    // 相对路径
    if (dir.startsWith('/')) {
        dir = dir.substring(1);
    }
    if (dir !== '' && !dir.endsWith('/')) {
        dir += '/';
    }

    let allRecords = await getAllRecords(env, dir);

    allRecords.sort((a, b) => {
        return b.metadata.TimeStamp - a.metadata.TimeStamp;
    });

    // 解析目录下的文件和子目录
    let filteredRecords = [];
    let subdirectories = new Set();

    for (let record of allRecords) {
        let key = record.name;
        if (key.startsWith(dir)) {
            let relativePath = key.substring(dir.length);
            if (relativePath.startsWith('/')) {
                relativePath = relativePath.substring(1);
            }

            let parts = relativePath.split('/');
            if (parts.length === 1) {
                // 直接位于该目录的文件
                filteredRecords.push(record);
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


    // sum 参数为 true 时，只返回数据总数
    if (count === -1 && sum === 'true') {
        return new Response(JSON.stringify({ sum: filteredRecords.length }), {
            headers: { "Content-Type": "application/json" }
        });
    }

    // count 为 -1 时返回所有数据
    if (count === -1) {
        return new Response(JSON.stringify({
            files: filteredRecords,
            directories: Array.from(subdirectories)
        }), {
            headers: { "Content-Type": "application/json" }
        });
    }

    // 进行分页
    start = Math.max(0, start);
    count = Math.max(1, count);
    const resultRecords = filteredRecords.slice(start, start + count);

    return new Response(JSON.stringify({
        files: resultRecords,
        directories: Array.from(subdirectories)
    }), {
        headers: { "Content-Type": "application/json" }
    });
}

async function getAllRecords(env, dir) {
    // 按前缀列出所有文件
    let allRecords = [];
    let cursor = null;

    while (true) {
        const limit = 1000;
        const response = await env.img_url.list({
            prefix: dir,
            limit: limit,
            cursor: cursor
        });
        cursor = response.cursor;

        const filteredRecords = response.keys.filter(item => !item.name.startsWith("manage@"));
        allRecords.push(...filteredRecords);

        if (!cursor || filteredRecords.length < limit) {
            break;
        }
    }

    return allRecords;
}
