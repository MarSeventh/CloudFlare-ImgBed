export async function onRequest(context) {
    // 安全设置相关，GET方法读取设置，POST方法保存设置
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
        const settings = await getSecurityConfig(kv, env)

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
        await kv.put('manage@sysConfig@security', JSON.stringify(settings))

        return new Response(JSON.stringify(settings), {
            headers: {
                'content-type': 'application/json',
            },
        })
    }

}

export async function getSecurityConfig(kv, env) {
    const settings = {}
    // 读取KV中的设置
    const settingsStr = await kv.get('manage@sysConfig@security')
    const settingsKV = settingsStr ? JSON.parse(settingsStr) : {}

    // 认证管理
    const auth = {
        user: {
            authCode: env.AUTH_CODE
        },
        admin: {
            adminUsername: env.BASIC_USER,
            adminPassword: env.BASIC_PASS,
        }
    }
    settings.auth = auth

    // 上传管理
    const upload = {
        moderate: {
            channel: 'moderatecontent.com',
            apiKey: env.ModerateContentApiKey,
        }
    }
    settings.upload = upload

    // 访问管理
    const access = {
        allowedDomains: env.ALLOWED_DOMAINS,
        whiteListMode: env.WhiteList_Mode === 'true',
    }
    settings.access = access

    // 用 KV 中的设置覆盖默认设置
    Object.assign(settings, settingsKV)

    return settings;
}
