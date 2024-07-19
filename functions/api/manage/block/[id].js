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
    console.log(env)
    console.log(params.id)
    //read the metadata
    const value = await env.img_url.getWithMetadata(params.id);
    console.log(value)
    //"metadata":{"TimeStamp":19876541,"ListType":"None","rating_label":"None"}
    //change the metadata
    value.metadata.ListType = "Block"
    await env.img_url.put(params.id,"",{metadata: value.metadata});
    const info = JSON.stringify(value.metadata);
    return new Response(info);

  }