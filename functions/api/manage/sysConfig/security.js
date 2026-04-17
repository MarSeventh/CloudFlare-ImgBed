import { getDatabase } from '../../../utils/databaseAdapter.js';
import { hashPassword, isHashed } from '../../../utils/passwordHash.js';
import { destroySessionsByAuthType } from '../../../utils/sessionManager.js';

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

        // 对前端隐藏实际密码值，返回占位符
        // 前端只有在用户修改密码时才会发送新密码
        const maskedSettings = JSON.parse(JSON.stringify(settings));
        if (maskedSettings.auth.user?.authCode) {
            maskedSettings.auth.user._hasPassword = true;
            maskedSettings.auth.user.authCode = ''; // 不向前端暴露密码/哈希
        }
        if (maskedSettings.auth.admin?.adminPassword) {
            maskedSettings.auth.admin._hasPassword = true;
            maskedSettings.auth.admin.adminPassword = ''; // 不向前端暴露密码/哈希
        }

        return new Response(JSON.stringify(maskedSettings), {
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
        settings.upload = newSettings.upload || settings.upload
        settings.access = newSettings.access || settings.access

        // 处理认证设置：空密码表示不修改，_clear 标记表示清除密码
        let userPasswordChanged = false;
        let adminPasswordChanged = false;

        if (newSettings.auth) {
            if (newSettings.auth.user) {
                if (newSettings.auth.user._clear) {
                    // 显式清除密码
                    newSettings.auth.user.authCode = '';
                    userPasswordChanged = true;
                } else if (newSettings.auth.user.authCode === '' || newSettings.auth.user.authCode === undefined) {
                    // 密码为空，保留原密码
                    newSettings.auth.user.authCode = settings.auth.user.authCode;
                } else {
                    userPasswordChanged = true;
                }
                delete newSettings.auth.user._clear;
                settings.auth.user = newSettings.auth.user;
            }
            if (newSettings.auth.admin) {
                if (newSettings.auth.admin._clear) {
                    // 显式清除密码和用户名
                    newSettings.auth.admin.adminPassword = '';
                    newSettings.auth.admin.adminUsername = '';
                    adminPasswordChanged = true;
                } else if (newSettings.auth.admin.adminPassword === '' || newSettings.auth.admin.adminPassword === undefined) {
                    // 密码为空，保留原密码
                    newSettings.auth.admin.adminPassword = settings.auth.admin.adminPassword;
                } else {
                    adminPasswordChanged = true;
                }
                delete newSettings.auth.admin._clear;
                if (newSettings.auth.admin.adminUsername !== undefined) {
                    settings.auth.admin.adminUsername = newSettings.auth.admin.adminUsername;
                }
                settings.auth.admin.adminPassword = newSettings.auth.admin.adminPassword;
            }
        }

        // 对密码进行哈希处理（如果是新的明文密码）
        if (settings.auth.user?.authCode && !isHashed(settings.auth.user.authCode)) {
            settings.auth.user.authCode = await hashPassword(settings.auth.user.authCode);
        }
        if (settings.auth.admin?.adminPassword && !isHashed(settings.auth.admin.adminPassword)) {
            settings.auth.admin.adminPassword = await hashPassword(settings.auth.admin.adminPassword);
        }

        // 清理前端标记字段
        delete settings.auth.user?._hasPassword;
        delete settings.auth.admin?._hasPassword;

        // 写入数据库
        await db.put('manage@sysConfig@security', JSON.stringify(settings))

        // 密码变更后清除对应类型的所有会话
        if (userPasswordChanged) {
            await destroySessionsByAuthType(env, 'user');
        }
        if (adminPasswordChanged) {
            await destroySessionsByAuthType(env, 'admin');
        }

        return new Response(JSON.stringify({
            message: 'security settings saved',
            userPasswordChanged,
            adminPasswordChanged,
        }), {
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
            authCode: kvAuth.user?.authCode ?? env.AUTH_CODE ?? '',
        },
        admin: {
            adminUsername: kvAuth.admin?.adminUsername ?? env.BASIC_USER ?? '',
            adminPassword: kvAuth.admin?.adminPassword ?? env.BASIC_PASS ?? '',
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
