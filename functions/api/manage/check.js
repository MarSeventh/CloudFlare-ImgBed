import { createSession, validateSession } from "../../utils/sessionManager.js";

export async function onRequest(context) {
    const { request, env } = context;

    // 如果已经有有效会话，直接返回成功
    const sessionResult = await validateSession(env, request, 'admin');
    if (sessionResult.valid) {
        return new Response('true', { status: 200 });
    }

    // 认证已通过（由 middleware 保证），创建会话 Cookie
    const { cookie } = await createSession(env, 'admin');

    return new Response('true', {
        status: 200,
        headers: {
            'Set-Cookie': cookie,
        },
    });
}
