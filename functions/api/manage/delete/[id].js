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
    // 组装 CDN URL
    const url = new URL(request.url);
    const cdnUrl = `https://${url.hostname}/file/${params.id}`;

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

      // 清除CDN缓存
      const options = {
        method: 'POST',
        headers: {'Content-Type': 'application/json', 'X-Auth-Email': `${env.CF_EMAIL}`, 'X-Auth-Key': `${env.CF_API_KEY}`},
        body: `{"files":["${ cdnUrl }"]}`
      };
      await fetch(`https://api.cloudflare.com/client/v4/zones/${ env.CF_ZONE_ID }/purge_cache`, options);
      // 清除api/randomFileList API缓存
      try {
          const cache = caches.default;
          // 通过写入一个max-age=0的response来清除缓存
          const nullResponse = new Response(null, {
              headers: { 'Cache-Control': 'max-age=0' },
          });
          await cache.put(`${url.origin}/api/randomFileList`, nullResponse);
      } catch (error) {
          console.error('Failed to clear cache:', error);
      }
      
      return new Response(info);
    } catch (e) {
      return new Response('Error: Delete Image Failed', { status: 400 });
    }
  }