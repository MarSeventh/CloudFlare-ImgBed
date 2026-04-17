import { validateAnySession } from "../utils/sessionManager.js";

/**
 * 会话检查接口
 * 用于前端路由守卫检查当前会话是否有效
 * 同时检查 admin_session 和 user_session
 */
export async function onRequestGet(context) {
    const { request, env } = context;

    const sessionResult = await validateAnySession(env, request);
    if (sessionResult.valid) {
        return new Response(JSON.stringify({
            valid: true,
            authType: sessionResult.session.authType,
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify({ valid: false }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
    });
}
