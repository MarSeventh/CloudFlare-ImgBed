export async function onRequest(context) {
    // 上传设置相关，GET方法读取设置，POST方法保存设置
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
        const settings = await getUploadConfig(kv, env)

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
        await kv.put('manage@sysConfig@upload', JSON.stringify(settings))

        return new Response(JSON.stringify(settings), {
            headers: {
                'content-type': 'application/json',
            },
        })
    }

}

export async function getUploadConfig(kv, env) {
    const settings = {}
    // 读取KV中的设置
    const settingsStr = await kv.get('manage@sysConfig@upload')
    const settingsKV = settingsStr ? JSON.parse(settingsStr) : {}

    // =====================读取tg渠道配置=====================
    const telegram = {}

    const telegramChannels = []
    telegram.channels = telegramChannels
    if (env.TG_BOT_TOKEN) {
        telegramChannels.push({
            id: 1,
            name: 'Telegram_env',
            type: 'telegram',
            savePath: 'environment variable',
            botToken: env.TG_BOT_TOKEN,
            chatId: env.TG_CHAT_ID,
            enabled: true,
            fixed: true,
        })
    }
    for (const tg of settingsKV.telegram?.channels || []) {
        // 如果savePath是environment variable，修改可变参数
        if (tg.savePath === 'environment variable') {
            // 如果环境变量未删除，进行覆盖操作
            if (telegramChannels[0]) {
                telegramChannels[0].enabled = tg.enabled
            }

            continue
        }
        // id自增
        tg.id = telegramChannels.length + 1
        telegramChannels.push(tg)
    }

    // 负载均衡
    const tgLoadBalance = settingsKV.telegram?.loadBalance || {
        enabled: false,
        channels: [],
    }
    telegram.loadBalance = tgLoadBalance
    


    // =====================读取r2渠道配置=====================
    const cfr2 = {}
    const cfr2Channels = []
    cfr2.channels = cfr2Channels
    if (env.img_r2) {
        cfr2Channels.push({
            id: 1,
            name: 'Cloudflare R2_env',
            type: 'cfr2',
            savePath: 'environment variable',
            publicUrl: env.R2PublicUrl,
            enabled: true,
            fixed: true,
        })
    }
    for (const r2 of settingsKV.cfr2?.channels || []) {
        // 如果savePath是environment variable，修改可变参数
        if (r2.savePath === 'environment variable') {
            // 如果环境变量未删除，进行覆盖操作
            if (cfr2Channels[0]) {
                cfr2Channels[0].publicUrl = r2.publicUrl
                cfr2Channels[0].enabled = r2.enabled
            }

            continue
        }
        // id自增
        r2.id = cfr2Channels.length + 1
        cfr2Channels.push(r2)
    }

    // 负载均衡
    const r2LoadBalance = settingsKV.cfr2?.loadBalance || {
        enabled: false,
        channels: [],
    }
    cfr2.loadBalance = r2LoadBalance


    // =====================读取s3渠道配置=====================
    const s3 = {}
    const s3Channels = []
    s3.channels = s3Channels
    if (env.S3_ACCESS_KEY_ID) {
        s3Channels.push({
            id: 1,
            name: 'S3_env',
            type: 's3',
            savePath: 'environment variable',
            accessKeyId: env.S3_ACCESS_KEY_ID,
            secretAccessKey: env.S3_SECRET_ACCESS_KEY,
            region: env.S3_REGION || 'auto',
            bucketName: env.S3_BUCKET_NAME,
            endpoint: env.S3_ENDPOINT,
            enabled: true,
            fixed: true,
        })
    }
    for (const s of settingsKV.s3?.channels || []) {
        // 如果savePath是environment variable，修改可变参数
        if (s.savePath === 'environment variable') {
            // 如果环境变量未删除，进行覆盖操作
            if (s3Channels[0]) {
                s3Channels[0].enabled = s.enabled
            }
            
            continue
        }
        // id自增
        s.id = s3Channels.length + 1
        s3Channels.push(s)
    }

    // 负载均衡
    const s3LoadBalance = settingsKV.s3?.loadBalance || {
        enabled: false,
        channels: [],
    }
    s3.loadBalance = s3LoadBalance



    settings.telegram = telegram
    settings.cfr2 = cfr2
    settings.s3 = s3

    return settings;
}