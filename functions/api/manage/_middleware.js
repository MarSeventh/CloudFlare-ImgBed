import { fetchSecurityConfig } from "../../utils/sysConfig";
import { checkDatabaseConfig } from "../../utils/middleware";
import { validateApiToken } from "../../utils/tokenValidator";
import { getDatabase } from "../../utils/databaseAdapter.js";

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
  // 提取路径中的关键部分
  const pathParts = pathname.toLowerCase().split('/');
  
  // 检查是否包含delete路径
  if (pathParts.includes('delete')) {
    return 'delete';
  }
  
  // 检查是否包含list路径
  if (pathParts.includes('list')) {
    return 'list';
  }
  
  // 其他情况返回null
  return null;
}

async function authentication(context) {
  // 读取安全配置
  securityConfig = await fetchSecurityConfig(context.env);
  basicUser = securityConfig.auth.admin.adminUsername
  basicPass = securityConfig.auth.admin.adminPassword

  if(typeof basicUser == "undefined" || basicUser == null || basicUser == ""){
    // 无需身份验证
    return context.next();
  }else{

    if (context.request.headers.has('Authorization')) {
      // 首先尝试使用API Token验证

      // 根据请求的 url 判断所需权限
      const pathname = new URL(context.request.url).pathname;
      const requiredPermission = extractRequiredPermission(pathname);

      const db = getDatabase(context.env);
      const tokenValidation = await validateApiToken(context.request, db, requiredPermission);
      if (tokenValidation.valid) {
        // Token验证通过，继续处理请求
        return context.next();
      }
      
      // 回退到使用传统身份认证方式
      const { user, pass } = basicAuthentication(context.request);                         
      if (basicUser !== user || basicPass !== pass) {
        return UnauthorizedException('Invalid credentials.');
      }else{
        return context.next();
      }
        
    } else {
      // 要求客户端进行基本认证
      return new Response('You need to login.', {
        status: 401,
        headers: {
        // Prompts the user for credentials.
        'WWW-Authenticate': 'Basic realm="my scope", charset="UTF-8"',
        // 'WWW-Authenticate': 'None',
        },
      });
    }

  }  
  
}

export const onRequest = [checkDatabaseConfig, errorHandling, authentication];