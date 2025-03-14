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

    let allRecords = [];

    allRecords = await getAllRecords(env);

    // 按照 IP 分组
    const dealedData = await dealByIP(allRecords);

    // 按照分组中的count倒序排序
    dealedData.sort((a, b) => {
        return b.count - a.count;
    });

    const resultRecords = dealedData.slice(start, start + count);

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

async function dealByIP(data) {
    let dealedData = [];
    let ipSet = new Set();

    data.forEach(item => {
        if (item.metadata?.UploadIP) {
            ipSet.add(item.metadata.UploadIP);
        }
    });

    const promises = Array.from(ipSet).map(async ip => {
        let ipData = data.filter(item => item.metadata?.UploadIP === ip);
        let count = ipData.length;
        let address = await getIPAddress(ip);
        return {ip, address, count, data: ipData};
    });

    dealedData = await Promise.all(promises);
    return dealedData;
}

// 获取IP地址
async function getIPAddress(ip) {
    let address = '未知';
    try {
        const ipInfo = await fetch(`https://apimobile.meituan.com/locate/v2/ip/loc?rgeo=true&ip=${ip}`);
        const ipData = await ipInfo.json();
        
        if (ipInfo.ok && ipData.data) {
            const lng = ipData.data?.lng || 0;
            const lat = ipData.data?.lat || 0;
            
            // 读取具体地址
            const addressInfo = await fetch(`https://apimobile.meituan.com/group/v1/city/latlng/${lat},${lng}?tag=0`);
            const addressData = await addressInfo.json();

            if (addressInfo.ok && addressData.data) {
                // 根据各字段是否存在，拼接地址
                address = [
                    addressData.data.detail,
                    addressData.data.city,
                    addressData.data.province,
                    addressData.data.country
                ].filter(Boolean).join(', ');
            }
        }
    } catch (error) {
        console.error('Error fetching IP address:', error);
    }
    return address;
}
