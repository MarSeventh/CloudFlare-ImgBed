import { fetchSecurityConfig } from "../../utils/sysConfig";
import { verifyPassword, needsRehash, hashPassword } from "../../utils/passwordHash.js";
import { createSession } from "../../utils/sessionManager.js";
import { getDatabase } from "../../utils/databaseAdapter.js";

export async function onRequestPost(context) {
    const { request, env } = context;

    //从POST请求中获取authCode
    const jsonRequest = await request.json();
    const authCode = jsonRequest.authCode;

    // 读取安全设置
    const securityConfig = await fetchSecurityConfig(env);
    const rightAuthCode = securityConfig.auth.user.authCode;

    //验证authCode（兼容明文、SHA-256 和 PBKDF2 三种存储格式）
    if (rightAuthCode !== undefined && rightAuthCode !== '') {
      const isValid = await verifyPassword(authCode, rightAuthCode);
      if (!isValid) {
        return new Response('Unauthorized', { status: 401 });
      }

      // 登录成功后，如果密码使用旧版哈希或明文存储，自动升级为 PBKDF2
      if (needsRehash(rightAuthCode) || !rightAuthCode.startsWith('$pbkdf2$')) {
        try {
          const db = getDatabase(env);
          const settingsStr = await db.get('manage@sysConfig@security');
          if (settingsStr) {
            const settings = JSON.parse(settingsStr);
            if (settings.auth?.user) {
              settings.auth.user.authCode = await hashPassword(authCode);
              await db.put('manage@sysConfig@security', JSON.stringify(settings));
            }
          }
        } catch (e) {
          // rehash 失败不影响登录流程
          console.error('Failed to rehash user password:', e);
        }
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
