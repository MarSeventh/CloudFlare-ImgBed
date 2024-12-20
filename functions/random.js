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

    // 检查是否启用了随机图功能
    if (env.AllowRandom != "true") {
        return new Response(JSON.stringify({ error: "Random is disabled" }), { status: 403 });
    }

    // 检查是否配置了KV数据库
    if (typeof env.img_url == "undefined" || env.img_url == null || env.img_url == "") {
        return new Response('Error: Please configure KV database', { status: 500 });
    }

    // 从params中读取返回的文件类型
    let fileType = requestUrl.searchParams.get('content');
    if (fileType == null) {
        fileType = ['image'];
    } else {
        fileType = fileType.split(',');
    }

    // 调用randomFileList接口，读取KV数据库中的所有记录
    let allRecords = [];
    allRecords = JSON.parse(await fetch(requestUrl.origin + '/api/randomFileList').then(res => res.text()));

    // 筛选出符合fileType要求的记录
    allRecords = allRecords.filter(item => { return fileType.some(type => item.FileType.includes(type)) });


    if (allRecords.length == 0) {
        return new Response(JSON.stringify({}), { status: 200 });
    } else {
        const randomIndex = Math.floor(Math.random() * allRecords.length);
        const randomKey = allRecords[randomIndex];
        const randomPath = '/file/' + randomKey.name;
        let randomUrl = randomPath;

        const randomType = requestUrl.searchParams.get('type');
        const resType = requestUrl.searchParams.get('form');
        
        // if param 'type' is set to 'url', return the full URL
        if (randomType == 'url') {
            randomUrl = requestUrl.origin + randomPath;
        }

        // if param 'type' is set to 'img', return the image
        if (randomType == 'img') {
            // Return an image response
            randomUrl = requestUrl.origin + randomPath;
            let contentType = 'image/jpeg';
            return new Response(await fetch(randomUrl).then(res => {
                contentType = res.headers.get('content-type');
                return res.blob();
            }), {
                headers: contentType ? { 'Content-Type': contentType } : { 'Content-Type': 'image/jpeg' },
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
