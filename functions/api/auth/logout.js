import { destroySession } from "../../utils/sessionManager.js";

export async function onRequestPost(context) {
    const { request, env } = context;

    // 从请求体中获取要登出的类型，默认清除所有
    let authType = null;
    try {
        const body = await request.json();
        authType = body.authType || null;
    } catch {
        // 没有请求体，清除所有
    }

    const result = await destroySession(env, request, authType);

    // result 可能是单个字符串或数组
    const headers = new Headers();
    if (Array.isArray(result)) {
        result.forEach(cookie => headers.append('Set-Cookie', cookie));
    } else {
        headers.set('Set-Cookie', result);
    }

    return new Response('Logged out', {
        status: 200,
        headers,
    });
}
