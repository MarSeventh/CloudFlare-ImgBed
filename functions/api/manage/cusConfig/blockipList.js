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
        const list = await db.get("manage@blockipList");
        if (list == null) {
            return new Response('', { status: 200 });
        } else {
            return new Response(list, { status: 200 });
        }
    } catch (e) {
        return new Response('fetch block ip list failed', { status: 500 });
    }
}