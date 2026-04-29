import { readIndex } from "../../../utils/indexManager";

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
    let count = parseInt(url.searchParams.get('count'), 10) || 10;

    start = Math.max(0, start);  // start 不能小于 0
    count = Math.max(1, count);  // count 不能小于 1

    const allRecords = await readIndex(context, { count: -1, includeSubdirFiles: true });

    const dealedData = dealByIP(allRecords.files);

    dealedData.sort((a, b) => {
        return b.count - a.count;
    });

    const resultRecords = dealedData.slice(start, start + count);

    // 只返回 `count` 条数据
    return new Response(JSON.stringify(resultRecords), {
        headers: { "Content-Type": "application/json" }
    });
    
}


function dealByIP(data) {
    const groups = new Map();

    for (const item of data) {
        const ip = item.metadata?.UploadIP;
        if (!ip) continue;

        const group = groups.get(ip);
        if (group) {
            group.count++;
            continue;
        }

        groups.set(ip, {
            ip,
            address: item.metadata?.UploadAddress || '未知',
            count: 1,
        });
    }

    return Array.from(groups.values());
}

