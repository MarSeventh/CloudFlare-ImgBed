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
    // 解码params.id
    params.id = decodeURIComponent(params.id);

    try {
      // 读取图片信息
      const img = await env.img_url.getWithMetadata(params.id);

      // 如果是R2渠道的图片，删除R2中对应的图片
      if (img.metadata?.Channel === 'CloudflareR2') {
        await env.img_r2.delete(params.id);
      }

      await env.img_url.delete(params.id);
      const info = JSON.stringify(params.id);
      
      return new Response(info);
    } catch (e) {
      return new Response('Error: Delete Image Failed', { status: 400 });
    }
  }