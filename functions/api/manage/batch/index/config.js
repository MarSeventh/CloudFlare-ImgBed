/**
 * BatchIndexConfigAPI - 获取索引重建配置
 * 
 * 返回根据数据库类型确定的分块大小等配置信息
 */

import { checkDatabaseConfig } from '../../../../utils/databaseAdapter.js';

// CORS 跨域响应头
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

// D1 单字段限制 2MB，KV 限制 25MB
const INDEX_CHUNK_SIZE_D1 = 500;
const INDEX_CHUNK_SIZE_KV = 5000;

/**
 * 创建 JSON 响应
 */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders,
    },
  });
}

/**
 * 处理 GET 请求 - 获取索引配置
 */
export async function onRequestGet(context) {
  const { env } = context;

  try {
    const config = checkDatabaseConfig(env);
    const chunkSize = config.usingD1 ? INDEX_CHUNK_SIZE_D1 : INDEX_CHUNK_SIZE_KV;

    return jsonResponse({
      success: true,
      chunkSize,
      databaseType: config.usingD1 ? 'd1' : 'kv',
    });
  } catch (error) {
    return jsonResponse({ success: false, error: error.message }, 500);
  }
}

/**
 * 处理 OPTIONS 请求 - CORS 预检
 */
export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function onRequest(context) {
  const { request } = context;
  if (request.method === 'GET') return onRequestGet(context);
  if (request.method === 'OPTIONS') return onRequestOptions();
  return jsonResponse({ success: false, error: 'Method not allowed' }, 405);
}
