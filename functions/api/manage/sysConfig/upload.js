import { getDatabase } from '../../../utils/databaseAdapter.js';

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

    const db = getDatabase(env);

    // GET读取设置
    if (request.method === 'GET') {
        const settings = await getUploadConfig(db, env)

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

        // 写入数据库
        await db.put('manage@sysConfig@upload', JSON.stringify(settings))

        return new Response(JSON.stringify(settings), {
            headers: {
                'content-type': 'application/json',
            },
        })
    }

}

export async function getUploadConfig(db, env) {
    const settings = {}
    // 读取数据库中的设置
    const settingsStr = await db.get('manage@sysConfig@upload')
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
            proxyUrl: env.TG_PROXY_URL || '',  // 可选的代理 URL
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
                telegramChannels[0].proxyUrl = tg.proxyUrl
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
            name: 'R2_env',
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
                cfr2Channels[0].quota = r2.quota  // 保留容量限制配置
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
            pathStyle: env.S3_PATH_STYLE === 'true',
            cdnDomain: env.S3_CDN_DOMAIN || '',  // 可选的 CDN 域名
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
                s3Channels[0].quota = s.quota  // 保留容量限制配置
                s3Channels[0].cdnDomain = s.cdnDomain  // 保留 CDN 域名配置
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


    // =====================读取 Discord 渠道配置=====================
    const discord = {}
    const discordChannels = []
    discord.channels = discordChannels

    // 从环境变量读取 Discord 配置
    if (env.DISCORD_BOT_TOKEN) {
        discordChannels.push({
            id: 1,
            name: 'Discord_env',
            type: 'discord',
            savePath: 'environment variable',
            botToken: env.DISCORD_BOT_TOKEN,
            channelId: env.DISCORD_CHANNEL_ID,
            proxyUrl: env.DISCORD_PROXY_URL || '',  // 可选的代理 URL
            isNitro: env.DISCORD_IS_NITRO === 'true',  // Nitro 会员，支持 25MB
            enabled: true,
            fixed: true,
        })
    }

    for (const dc of settingsKV.discord?.channels || []) {
        // 如果 savePath 是 environment variable，修改可变参数
        if (dc.savePath === 'environment variable') {
            // 如果环境变量未删除，进行覆盖操作
            if (discordChannels[0]) {
                discordChannels[0].enabled = dc.enabled
                discordChannels[0].proxyUrl = dc.proxyUrl
                discordChannels[0].isNitro = dc.isNitro
            }
            continue
        }
        // id 自增
        dc.id = discordChannels.length + 1
        discordChannels.push(dc)
    }

    // 负载均衡
    const discordLoadBalance = settingsKV.discord?.loadBalance || {
        enabled: false,
        channels: [],
    }
    discord.loadBalance = discordLoadBalance


    // =====================读取 HuggingFace 渠道配置=====================
    const huggingface = {}
    const huggingfaceChannels = []
    huggingface.channels = huggingfaceChannels

    // 从环境变量读取 HuggingFace 配置
    if (env.HF_TOKEN) {
        huggingfaceChannels.push({
            id: 1,
            name: 'HuggingFace_env',
            type: 'huggingface',
            savePath: 'environment variable',
            token: env.HF_TOKEN,
            repo: env.HF_REPO,
            isPrivate: env.HF_PRIVATE === 'true',
            enabled: true,
            fixed: true,
        })
    }

    for (const hf of settingsKV.huggingface?.channels || []) {
        // 如果 savePath 是 environment variable，修改可变参数
        if (hf.savePath === 'environment variable') {
            // 如果环境变量未删除，进行覆盖操作
            if (huggingfaceChannels[0]) {
                huggingfaceChannels[0].enabled = hf.enabled
                huggingfaceChannels[0].isPrivate = hf.isPrivate
            }
            continue
        }
        // id 自增
        hf.id = huggingfaceChannels.length + 1
        huggingfaceChannels.push(hf)
    }

    // 负载均衡
    const huggingfaceLoadBalance = settingsKV.huggingface?.loadBalance || {
        enabled: false,
        channels: [],
    }
    huggingface.loadBalance = huggingfaceLoadBalance


    settings.telegram = telegram
    settings.cfr2 = cfr2
    settings.s3 = s3
    settings.discord = discord
    settings.huggingface = huggingface

    return settings;
}