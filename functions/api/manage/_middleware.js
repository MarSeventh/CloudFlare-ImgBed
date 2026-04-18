import { checkDatabaseConfig } from "../../utils/middleware";
import { authenticate, AUTH_SCOPE } from "../../utils/auth/authCore.js";

async function errorHandling(context) {
  try {
    return await context.next();
  } catch (err) {
    return new Response(`${err.message}\n${err.stack}`, { status: 500 });
  }
}

function UnauthorizedException(reason) {
  return new Response(reason, {
    status: 401,
    statusText: 'Unauthorized',
    headers: {
      'Content-Type': 'text/plain;charset=UTF-8',
      'Cache-Control': 'no-store',
      'Content-Length': reason.length,
    },
  });
}

/**
 * 根据请求路径提取所需权限
 * @param {string} pathname - 请求路径
 * @returns {string} 需要的权限类型
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
  if (context.request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  const pathname = new URL(context.request.url).pathname;
  const requiredPermission = extractRequiredPermission(pathname);

  const result = await authenticate({
    env: context.env,
    request: context.request,
    requiredPermission,
    authScope: AUTH_SCOPE.ADMIN,
  });

  if (!result.authorized) {
    return UnauthorizedException('You need to login');
  }

  return context.next();
}

export const onRequest = [checkDatabaseConfig, errorHandling, authentication];
