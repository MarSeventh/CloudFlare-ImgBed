import { purgeCFCache } from "../../../utils/purgeCache";

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

    //read the metadata
    const value = await env.img_url.getWithMetadata(params.id);

    //change the metadata
    value.metadata.ListType = "White"
    await env.img_url.put(params.id,"",{metadata: value.metadata});
    const info = JSON.stringify(value.metadata);

    // 清除CDN缓存
    await purgeCFCache(env, cdnUrl);

    return new Response(info);

  }