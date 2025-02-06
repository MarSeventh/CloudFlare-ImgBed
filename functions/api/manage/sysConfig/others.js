export async function onRequest(context) {
    // 其他设置相关，GET方法读取设置，POST方法保存设置
    const {
      request, // same as existing Worker API
      env, // same as existing Worker API
      params, // if filename includes [id] or [[path]]
      waitUntil, // same as ctx.waitUntil in existing Worker API
      next, // used for middleware or to fetch assets
      data, // arbitrary space for passing data between middlewares
    } = context;

    const kv = env.img_url

    // GET读取设置
    if (request.method === 'GET') {
        const settings = await getOthersConfig(kv, env)

        return new Response(JSON.stringify(settings), {
            headers: {
                'content-type': 'application/json',
            },
        })
    }

    // POST保存设置
    if (request.method === 'POST') {
        const body = await request.json()
        const settings = body

        // 写入 KV
        await kv.put('manage@sysConfig@others', JSON.stringify(settings))

        return new Response(JSON.stringify(settings), {
            headers: {
                'content-type': 'application/json',
            },
        })
    }

}

export async function getOthersConfig(kv, env) {
    const settings = {}
    // 读取KV中的设置
    const settingsStr = await kv.get('manage@sysConfig@others')
    const settingsKV = settingsStr ? JSON.parse(settingsStr) : {}

    // 远端遥测
    settings.telemetry = {
        enabled: !env.disable_telemetry === 'true',
        fixed: false,
    }

    // 随机图API
    settings.randomImageAPI = {
        enabled: env.AllowRandom === 'true',
        fixed: false,
    }

    // CloudFlare API Token
    settings.cloudflareApiToken = {
        CF_ZONE_ID: env.CF_ZONE_ID,
        CF_EMAIL: env.CF_EMAIL,
        CF_API_KEY: env.CF_API_KEY,
        fixed: false,
    }

    // 用KV存储的设置覆盖默认设置
    Object.assign(settings, settingsKV)

    return settings;
}