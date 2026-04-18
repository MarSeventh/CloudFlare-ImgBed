import { validateAnySession } from "../../utils/auth/sessionManager.js";
import { fetchSecurityConfig } from "../../utils/sysConfig.js";

/**
 * 会话检查接口
 * 用于前端路由守卫检查当前会话是否有效
 * 同时返回各端是否需要认证
 */
export async function onRequestGet(context) {
    const { request, env } = context;

    // 读取安全配置，判断是否需要认证
    const securityConfig = await fetchSecurityConfig(env);
    const adminUsername = securityConfig.auth.admin.adminUsername;
    const adminPassword = securityConfig.auth.admin.adminPassword;
    const userAuthCode = securityConfig.auth.user.authCode;

    const adminRequired = !!(adminUsername && adminUsername.trim()) || !!(adminPassword && adminPassword.trim());
    const userRequired = !!(userAuthCode && userAuthCode.trim());

    // 检查会话
    const sessionResult = await validateAnySession(env, request);
    if (sessionResult.valid) {
        return new Response(JSON.stringify({
            valid: true,
            authType: sessionResult.session.authType,
            adminRequired,
            userRequired,
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify({
        valid: false,
        adminRequired,
        userRequired,
    }), {
        status: 200, // 不再返回 401，让前端根据字段判断
        headers: { 'Content-Type': 'application/json' },
    });
}
