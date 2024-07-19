export async function onRequest(context) {  // Contents of context object  
    const {
        request, // same as existing Worker API    
        env, // same as existing Worker API    
        params, // if filename includes [id] or [[path]]   
        waitUntil, // same as ctx.waitUntil in existing Worker API    
        next, // used for middleware or to fetch assets    
        data, // arbitrary space for passing data between middlewares 
    } = context;

    const url = new URL(request.url);
    
    const response = fetch('https://telegra.ph/' + url.pathname + url.search, {
        method: request.method,
        headers: request.headers,
        body: request.body,
    }).then(async (response) => {
        console.log(response.ok); // true if the response status is 2xx
        console.log(response.status); // 200
        if (response.ok) {
            // Referer header equal to the admin page
            console.log(url.origin + "/admin")
            if (request.headers.get('Referer') == url.origin + "/admin") {
                //show the image
                return response;
            }

            if (typeof env.img_url == "undefined" || env.img_url == null || env.img_url == "") { } else {
                //check the record from kv
                const record = await env.img_url.getWithMetadata(params.id);
                console.log("record")
                console.log(record)
                if (record.metadata === null) {

                } else {

                    //if the record is not null, redirect to the image
                    if (record.metadata.ListType == "White") {
                        return response;
                    } else if (record.metadata.ListType == "Block") {
                        console.log("Referer")
                        console.log(request.headers.get('Referer'))
                        if (typeof request.headers.get('Referer') == "undefined" || request.headers.get('Referer') == null || request.headers.get('Referer') == "") {
                            return Response.redirect(url.origin + "/block-img.html", 302)
                        } else {
                            return Response.redirect("https://static-res.pages.dev/teleimage/img-block-compressed.png", 302)
                        }

                    } else if (record.metadata.Label == "adult") {
                        if (typeof request.headers.get('Referer') == "undefined" || request.headers.get('Referer') == null || request.headers.get('Referer') == "") {
                            return Response.redirect(url.origin + "/block-img.html", 302)
                        } else {
                            return Response.redirect("https://static-res.pages.dev/teleimage/img-block-compressed.png", 302)
                        }
                    }
                    //check if the env variables WhiteList_Mode are set
                    console.log("env.WhiteList_Mode:", env.WhiteList_Mode)
                    if (env.WhiteList_Mode == "true") {
                        //if the env variables WhiteList_Mode are set, redirect to the image
                        return Response.redirect(url.origin + "/whitelist-on.html", 302);
                    } else {
                        //if the env variables WhiteList_Mode are not set, redirect to the image
                        return response;
                    }
                }

            }

            //get time
            let time = new Date().getTime();

            let apikey = env.ModerateContentApiKey

            if (typeof apikey == "undefined" || apikey == null || apikey == "") {

                if (typeof env.img_url == "undefined" || env.img_url == null || env.img_url == "") {
                    console.log("Not enbaled KV")

                } else {
                    //add image to kv
                    await env.img_url.put(params.id, "", {
                        metadata: { ListType: "None", Label: "None", TimeStamp: time },
                    });

                }
            } else {
                await fetch(`https://api.moderatecontent.com/moderate/?key=` + apikey + `&url=https://telegra.ph/` + url.pathname + url.search).
                    then(async (response) => {
                        let moderate_data = await response.json();
                        console.log(moderate_data)
                        console.log("---env.img_url---")
                        console.log(env.img_url == "true")
                        if (typeof env.img_url == "undefined" || env.img_url == null || env.img_url == "") { } else {
                            //add image to kv
                            await env.img_url.put(params.id, "", {
                                metadata: { ListType: "None", Label: moderate_data.rating_label, TimeStamp: time },
                            });
                        }
                        if (moderate_data.rating_label == "adult") {
                            return Response.redirect(url.origin + "/block-img.html", 302)
                        }
                    });

            }
        }
        return response;
    });

    return response;

}
