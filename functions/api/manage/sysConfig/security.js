import { getDatabase } from '../../../utils/databaseAdapter.js';

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

    const db = getDatabase(env);

    // GET读取设置
    if (request.method === 'GET') {
        const settings = await getSecurityConfig(db, env)

        return new Response(JSON.stringify(settings), {
            headers: {
                'content-type': 'application/json',
            },
        })
    }

    // POST保存设置
    if (request.method === 'POST') {
        const settings = await getSecurityConfig(db, env) // 先读取已有设置，再进行覆盖

        const body = await request.json()
        const newSettings = body

        // 覆盖设置，apiTokens不在这里修改
        settings.auth = newSettings.auth || settings.auth
        settings.upload = newSettings.upload || settings.upload
        settings.access = newSettings.access || settings.access

        // 写入数据库
        await db.put('manage@sysConfig@security', JSON.stringify(settings))

        return new Response('security settings saved', {
            headers: {
                'content-type': 'application/json',
            },
        })
    }

}

export async function getSecurityConfig(db, env) {
    const settings = {}
    // 读取数据库中的设置
    const settingsStr = await db.get('manage@sysConfig@security')
    const settingsKV = settingsStr ? JSON.parse(settingsStr) : {}

    // 认证管理
    const kvAuth = settingsKV.auth || {}
    const auth = {
        user: {
            authCode: kvAuth.user?.authCode || env.AUTH_CODE || '',
        },
        admin: {
            adminUsername: kvAuth.admin?.adminUsername || env.BASIC_USER || '',
            adminPassword: kvAuth.admin?.adminPassword || env.BASIC_PASS || '',
        }
    }
    settings.auth = auth

    // 上传管理
    const kvUpload = settingsKV.upload || {}
    const upload = {
        moderate: {
            enabled: kvUpload.moderate?.enabled ?? false,
            channel: kvUpload.moderate?.channel || 'moderatecontent.com', // [moderatecontent.com, nsfwjs]
            moderateContentApiKey: kvUpload.moderate?.moderateContentApiKey || kvUpload.moderate?.apiKey || env.ModerateContentApiKey || '',
            nsfwApiPath: kvUpload.moderate?.nsfwApiPath || '',
        }
    }
    settings.upload = upload

    // 访问管理
    const kvAccess = settingsKV.access || {}
    const access = {
        allowedDomains: kvAccess.allowedDomains || env.ALLOWED_DOMAINS || '',
        whiteListMode: kvAccess.whiteListMode ?? env.WhiteList_Mode === 'true',
    }
    settings.access = access

    // API Token 管理
    const kvApiTokens = settingsKV.apiTokens || {}
    const apiTokens = {
        tokens: kvApiTokens.tokens || {}
    }
    settings.apiTokens = apiTokens

    return settings;
}
