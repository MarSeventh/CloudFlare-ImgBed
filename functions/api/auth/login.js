import { fetchSecurityConfig } from "../../utils/sysConfig";
import { verifyPassword } from "../../utils/passwordHash.js";
import { createSession } from "../../utils/sessionManager.js";

export async function onRequestPost(context) {
    const { request, env } = context;

    //从POST请求中获取authCode
    const jsonRequest = await request.json();
    const authCode = jsonRequest.authCode;

    // 读取安全设置
    const securityConfig = await fetchSecurityConfig(env);
    const rightAuthCode = securityConfig.auth.user.authCode;

    //验证authCode（兼容明文和哈希两种存储格式）
    if (rightAuthCode !== undefined && rightAuthCode !== '') {
      const isValid = await verifyPassword(authCode, rightAuthCode);
      if (!isValid) {
        return new Response('Unauthorized', { status: 401 });
      }
    }

    // 创建会话并通过 HttpOnly Cookie 返回
    const { cookie } = await createSession(env, 'user');

    return new Response('Login success', {
      status: 200,
      headers: {
        'Set-Cookie': cookie,
      },
    });
}
