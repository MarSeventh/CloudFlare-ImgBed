import { getDatabase } from '../../../utils/databaseAdapter.js';

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
    try {
        const db = getDatabase(env);
        let list = await db.get("manage@blockipList");
        if (list == null) {
            list = [];
        } else {
            list = list.split(",");
        }

        //从请求body中获取要white的ip
        const ip = await request.text();
        if (ip == null || ip == "") {
            return new Response('Error: Please input ip', { status: 400 });
        }

        //将ip从list中删除
        list = list.filter(item => item !== ip);
        await db.put("manage@blockipList", list.join(","));
        return new Response('delete ip from block ip list successfully', { status: 200 });
    } catch (e) {
        return new Response('delete ip from block ip list failed', { status: 500 });
    }
}