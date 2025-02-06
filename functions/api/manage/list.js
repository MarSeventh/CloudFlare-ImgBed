export async function onRequest(context) {
    // Contents of context object
    const {
      request, // same as existing Worker API
      env, // same as existing Worker API
      params, // if filename includes [id] or [[path]]
      waitUntil, // same as ctx.waitUntil in existing Worker API
      next, // used for middleware or to fetch assets
      data, // arbitrary space for passing data between middlewares
    } = context;
    const url = new URL(request.url);

    // 解析 URL 中的参数
    let start = parseInt(url.searchParams.get('start'), 10) || 0;
    let count = parseInt(url.searchParams.get('count'), 10) || 50;
    let sum = url.searchParams.get('sum') || false;

    // count 为 -1 时，返回所有数据
    if (count === -1) {
        const allRecords = await getAllRecords(env);
        // sum 参数为 true 时，只返回数据总数
        if (sum === 'true') {
            return new Response(JSON.stringify(
                {
                    sum: allRecords.length
                }
            ), {
                headers: { "Content-Type": "application/json" }
            });
        } else {
            return new Response(JSON.stringify(allRecords), {
                headers: { "Content-Type": "application/json" }
            });
        }
    }

    // 倒序返回指定数量的数据
    
    start = Math.max(0, start);  // start 不能小于 0
    count = Math.max(1, count);  // count 不能小于 1

    let allRecords = [];
    
    allRecords = await getAllRecords(env);

    // 按照 metadata 中的时间戳倒序排序
    allRecords.sort((a, b) => {
        return b.metadata.TimeStamp - a.metadata.TimeStamp;
    });

    const resultRecords = allRecords.slice(start, start + count);

    // 只返回 `count` 条数据
    return new Response(JSON.stringify(resultRecords), {
        headers: { "Content-Type": "application/json" }
    });
}

async function getAllRecords(env) {
    let recordsFetched = 0;
    let allRecords = [];
    let cursor = null;

    while (true) {
        const limit = 1000; // 读取所需的最少数量
        const response = await env.img_url.list({ limit, cursor });

        // 过滤掉以 "manage@" 开头的 key
        const filteredRecords = response.keys.filter(item => !item.name.startsWith("manage@"));

        allRecords.push(...filteredRecords);
        recordsFetched += filteredRecords.length;
        cursor = response.cursor;

        if (!cursor) {
            break;
        }
    }

    return allRecords;
}