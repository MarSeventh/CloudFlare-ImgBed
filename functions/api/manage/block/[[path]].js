import { purgeCFCache, purgeRandomFileListCache, purgePublicFileListCache } from "../../../utils/purgeCache";
import { addFileToIndex } from "../../../utils/indexManager.js";
import { getDatabase } from "../../../utils/databaseAdapter.js";

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

    if (params.path) {
      params.path = String(params.path).split(',').join('/');
    }
    const cdnUrl = `https://${url.hostname}/file/${params.path}`;

    // 解码params.path
    params.path = decodeURIComponent(params.path);

    //read the metadata
    const db = getDatabase(env);
    const value = await db.getWithMetadata(params.path);

    //change the metadata
    value.metadata.ListType = "Block"
    await db.put(params.path, value.value, {metadata: value.metadata});
    const info = JSON.stringify(value.metadata);

    // 清除CDN缓存
    await purgeCFCache(env, cdnUrl);

    // 清除 randomFileList 等API缓存
    const normalizedFolder = params.path.split('/').slice(0, -1).join('/');
    await purgeRandomFileListCache(url.origin, normalizedFolder);
    await purgePublicFileListCache(url.origin, normalizedFolder);

    // 更新索引
    waitUntil(addFileToIndex(context, params.path, value.metadata));

    return new Response(info);
}