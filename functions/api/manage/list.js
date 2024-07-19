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
    const value = await env.img_url.list();

    console.log(value)
    //let res=[]
    //for (let i in value.keys){
      //add to res
      //"metadata":{"TimeStamp":19876541,"ListType":"None","rating_label":"None"}
      //let tmp = {
      //  name: value.keys[i].name,
      //  TimeStamp: value.keys[i].metadata.TimeStamp,
      //  ListType: value.keys[i].metadata.ListType,
      //  rating_label: value.keys[i].metadata.rating_label,
      //}
      //res.push(tmp)
    //}
    const info = JSON.stringify(value.keys);
    return new Response(info);

  }