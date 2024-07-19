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
    if(typeof context.env.BASIC_USER == "undefined" || context.env.BASIC_USER == null || context.env.BASIC_USER == ""){
        return new Response('Not using basic auth.', { status: 200 });
    }else{
        return new Response('true', { status: 200 });
    }

  }