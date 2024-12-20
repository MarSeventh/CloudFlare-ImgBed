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

    // 检查是否启用了随机图功能
    if (env.AllowRandom != "true") {
        return new Response(JSON.stringify({ error: "Random is disabled" }), { status: 403 });
    }

    // 检查是否配置了KV数据库
    if (typeof env.img_url == "undefined" || env.img_url == null || env.img_url == "") {
        return new Response('Error: Please configure KV database', { status: 500 });
    }

    let allRecords = [];
    let cursor = null;

    do {
      const records = await env.img_url.list({
        limit: 1000,
        cursor,
      });
      // 除去records中key以manage@开头的记录
      records.keys = records.keys.filter(item => !item.name.startsWith("manage@"));
      // 保留metadata中fileType为image或video的记录
      records.keys = records.keys.filter(item => item.metadata?.FileType?.includes("image") || item.metadata?.FileType?.includes("video"));
      allRecords.push(...records.keys);
      cursor = records.cursor;
    } while (cursor);

    // 仅保留记录的name和metadata中的FileType字段
    allRecords = allRecords.map(item => {
        return {
            name: item.name,
            FileType: item.metadata?.FileType
        }
    });

    // 返回所有记录，设置缓存时间为1天
    const info = JSON.stringify(allRecords);
    return new Response(info,
        {
            headers: {
                "Content-Type": "application/json",
                "Cache-Control": "public, max-age=86400",
            }
        }
    );
}