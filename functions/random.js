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
    const requestUrl = new URL(request.url);
    const protocol = requestUrl.protocol;
    const domain = requestUrl.hostname;
    const port = requestUrl.port;
    const list = await env.img_url.list();
    if (env.AllowRandom != "true") {
        return new Response(JSON.stringify({ error: "Random is disabled" }), { status: 403 });
    }
    if (list.keys.length == 0) {
        return new Response(JSON.stringify({}), { status: 200 });
    } else {
        const randomIndex = Math.floor(Math.random() * list.keys.length);
        const randomKey = list.keys[randomIndex];
        const randomPath = '/file/' + randomKey.name;
        let randomUrl = randomPath;
        const randomType = requestUrl.searchParams.get('type');
        const resType = requestUrl.searchParams.get('form');
        // if param 'type' is set to 'url', return the full URL
        if (randomType == 'url') {
            if (port) {
                randomUrl = protocol + '//' + domain + ':' + port + randomPath;
            } else {
                randomUrl = protocol + '//' + domain + randomPath;
            }
        }
        // if param 'type' is set to 'img', return the image
        if (randomType === 'img') {
            // Return an image response
            randomUrl = protocol + '//' + domain + ':' + port + randomPath;
            return new Response(await fetch(randomUrl).then(res => res.blob()), {
                headers: { 'Content-Type': 'image/jpeg' },
                status: 200
            });
        }
        
        if (resType == 'text') {
            return new Response(randomUrl, { status: 200 });
        } else {
            return new Response(JSON.stringify({ url: randomUrl }), { status: 200 });
        }
    }
}
