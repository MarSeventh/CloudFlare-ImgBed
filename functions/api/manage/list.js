export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);

    let start = parseInt(url.searchParams.get('start'), 10) || 0;
    let count = parseInt(url.searchParams.get('count'), 10) || 50;
    let sum = url.searchParams.get('sum') || false;
    let dir = url.searchParams.get('dir') || ''; // 目录名

    let allRecords = await getAllRecords(env);

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
                subdirectories.add(parts[0]);
            }
        }
    }

    // 按照 metadata 中的时间戳倒序排序
    filteredRecords.sort((a, b) => {
        return b.metadata.TimeStamp - a.metadata.TimeStamp;
    });

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

async function getAllRecords(env) {
    let allRecords = [];
    let cursor = null;

    while (true) {
        const limit = 1000;
        const response = await env.img_url.list({ limit, cursor });
        cursor = response.cursor;

        const filteredRecords = response.keys.filter(item => !item.name.startsWith("manage@"));
        allRecords.push(...filteredRecords);

        if (!cursor || filteredRecords.length < limit) {
            break;
        }
    }

    return allRecords;
}
