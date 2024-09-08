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
    let allRecords = [];
    let cursor = null;

    do {
      const records = await env.img_url.list({
        limit: 1000,
        cursor,
      });
      allRecords.push(...records.keys);
      cursor = records.cursor;
    } while (cursor);

    const info = JSON.stringify(allRecords);
    return new Response(info);

  }