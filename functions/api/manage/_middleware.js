import { fetchSecurityConfig } from "../../utils/sysConfig";
import { checkDatabaseConfig } from "../../utils/middleware";
import { validateApiToken } from "../../utils/tokenValidator";
import { getDatabase } from "../../utils/databaseAdapter.js";
import { verifyPassword, needsRehash, hashPassword } from "../../utils/passwordHash.js";
import { validateSession } from "../../utils/sessionManager.js";

let securityConfig = {}
let basicUser = ""
let basicPass = ""

async function errorHandling(context) {
  try {
    return await context.next();
  } catch (err) {
    return new Response(`${err.message}\n${err.stack}`, { status: 500 });
  }
}

function basicAuthentication(request) {
  const Authorization = request.headers.get('Authorization');

  const [scheme, encoded] = Authorization.split(' ');

  // The Authorization header must start with Basic, followed by a space.
  if (!encoded || scheme !== 'Basic') {
    return BadRequestException('Malformed authorization header.');
  }

  // Decodes the base64 value and performs unicode normalization.
  // @see https://datatracker.ietf.org/doc/html/rfc7613#section-3.3.2 (and #section-4.2.2)
  // @see https://dev.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/String/normalize
  const buffer = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
  const decoded = new TextDecoder().decode(buffer).normalize();

  // The username & password are split by the first colon.
  //=> example: "username:password"
  const index = decoded.indexOf(':');

  // The user & password are split by the first colon and MUST NOT contain control characters.
  // @see https://tools.ietf.org/html/rfc5234#appendix-B.1 (=> "CTL = %x00-1F / %x7F")
  if (index === -1 || /[\0-\x1F\x7F]/.test(decoded)) {
    return BadRequestException('Invalid authorization value.');
  }

  return {
    user: decoded.substring(0, index),
    pass: decoded.substring(index + 1),
  };
}

function UnauthorizedException(reason) {
  return new Response(reason, {
    status: 401,
    statusText: 'Unauthorized',
    headers: {
      'Content-Type': 'text/plain;charset=UTF-8',
      // Disables caching by default.
      'Cache-Control': 'no-store',
      // Returns the "Content-Length" header for HTTP HEAD requests.
      'Content-Length': reason.length,
    },
  });
}

function BadRequestException(reason) {
  return new Response(reason, {
    status: 400,
    statusText: 'Bad Request',
    headers: {
      'Content-Type': 'text/plain;charset=UTF-8',
      // Disables caching by default.
      'Cache-Control': 'no-store',
      // Returns the "Content-Length" header for HTTP HEAD requests.
      'Content-Length': reason.length,
    },
  });
}


/**
 * 根据请求路径提取所需权限
 * @param {string} pathname - 请求路径
 * @returns {string|null} 需要的权限类型或null
 */
function extractRequiredPermission(pathname) {
  const pathParts = pathname.toLowerCase().split('/');

  if (pathParts.includes('delete')) {
    return 'delete';
  }

  if (pathParts.includes('list')) {
    return 'list';
  }

  // 其他 /api/manage 下的操作需要管理权限
  return 'manage';
}

// CORS 跨域响应头
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, PUT, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

async function authentication(context) {
  // OPTIONS 预检请求不需要鉴权，直接返回 CORS 响应
  // 这是安全的，因为 OPTIONS 请求只是预检请求，不会执行任何实际操作
  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  // 读取安全配置
  securityConfig = await fetchSecurityConfig(context.env);
  basicUser = securityConfig.auth.admin.adminUsername
  basicPass = securityConfig.auth.admin.adminPassword

  if (typeof basicUser == "undefined" || basicUser == null || basicUser == "") {
    // 无需身份验证
    return context.next();
  } else {

    // 1. 优先检查会话 Cookie
    const sessionResult = await validateSession(context.env, context.request, 'admin');
    if (sessionResult.valid) {
      return context.next();
    }

    if (context.request.headers.has('Authorization')) {
      // 2. 尝试使用API Token验证

      // 根据请求的 url 判断所需权限
      const pathname = new URL(context.request.url).pathname;
      const requiredPermission = extractRequiredPermission(pathname);

      const db = getDatabase(context.env);
      const tokenValidation = await validateApiToken(context.request, db, requiredPermission);
      if (tokenValidation.valid) {
        // Token验证通过，继续处理请求
        return context.next();
      }

      // 3. 回退到使用传统 Basic Auth 身份认证方式
      const { user, pass } = basicAuthentication(context.request);
      const passwordMatch = await verifyPassword(pass, basicPass);
      if (basicUser !== user || !passwordMatch) {
        return UnauthorizedException('Invalid credentials.');
      }

      // Basic Auth 验证通过后，如果密码使用旧版哈希或明文存储，自动升级为 PBKDF2
      if (passwordMatch && (needsRehash(basicPass) || !basicPass.startsWith('$pbkdf2$'))) {
        try {
          const db = getDatabase(context.env);
          const settingsStr = await db.get('manage@sysConfig@security');
          if (settingsStr) {
            const settings = JSON.parse(settingsStr);
            if (settings.auth?.admin) {
              settings.auth.admin.adminPassword = await hashPassword(pass);
              await db.put('manage@sysConfig@security', JSON.stringify(settings));
            }
          }
        } catch (e) {
          // rehash 失败不影响登录流程
          console.error('Failed to rehash admin password:', e);
        }
      }

      return context.next();

    } else {
      // 没有 Authorization 头也没有有效 session，返回 401
      return UnauthorizedException('You need to login.');
    }

  }

}

export const onRequest = [checkDatabaseConfig, errorHandling, authentication];