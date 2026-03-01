/**
 * BatchListAPI - 分批读取 KV 数据的 API 端点
 * 
 * 实现 cursor 分页机制，每批最多 1000 条记录
 * 支持 includeValue 参数用于获取分块文件的 value
 */

import { getDatabase } from '../../../utils/databaseAdapter.js';

// CORS 跨域响应头
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

/**
 * 创建 JSON 响应
 * @param {Object} data - 响应数据
 * @param {number} status - HTTP 状态码
 * @returns {Response}
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
 * 创建错误响应
 * @param {string} message - 错误消息
 * @param {number} status - HTTP 状态码
 * @returns {Response}
 */
function errorResponse(message, status = 400) {
  return jsonResponse({ success: false, error: message }, status);
}

/**
 * 检查文件是否为需要读取 value 的分块文件
 * 仅 TelegramNew 和 Discord 渠道的分块文件需要读取 value
 * 
 * @param {Object} metadata - 文件元数据
 * @returns {boolean}
 */
function isChunkedFileNeedingValue(metadata) {
  if (!metadata || !metadata.IsChunked) {
    return false;
  }
  
  const channel = metadata.Channel;
  return channel === 'TelegramNew' || channel === 'Discord';
}

/**
 * 处理 GET 请求 - 分批读取 KV 数据
 * 
 * @param {Object} context - Cloudflare Workers 上下文
 * @returns {Promise<Response>}
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  try {
    // 解析查询参数
    const cursor = url.searchParams.get('cursor') || null;
    let limit = parseInt(url.searchParams.get('limit'), 10) || 1000;
    const includeValue = url.searchParams.get('includeValue') === 'true';

    // 限制每批最多 1000 条记录
    if (limit > 1000) {
      limit = 1000;
    }
    if (limit < 1) {
      limit = 1;
    }

    // 获取数据库实例
    const db = getDatabase(env);

    // 构建 list 请求选项
    const listOptions = {
      limit,
    };

    // 如果有 cursor，添加到选项中
    if (cursor) {
      listOptions.cursor = cursor;
    }

    // 执行 KV list 操作
    const listResult = await db.list(listOptions);

    // 检查响应格式
    if (!listResult || !listResult.keys || !Array.isArray(listResult.keys)) {
      return errorResponse('Database list operation failed', 500);
    }

    // 处理记录
    const records = [];
    
    for (const item of listResult.keys) {
      // 跳过管理相关的键（以 manage@ 开头）
      if (item.name.startsWith('manage@')) {
        continue;
      }
      
      // 跳过分块数据键（以 chunk_ 开头）
      if (item.name.startsWith('chunk_')) {
        continue;
      }

      // 跳过没有元数据的文件
      if (!item.metadata) {
        continue;
      }

      // 构建记录对象
      const record = {
        id: item.name,
        metadata: item.metadata,
      };

      // 如果需要包含 value 且是分块文件，读取 value
      if (includeValue && isChunkedFileNeedingValue(item.metadata)) {
        try {
          const value = await db.get(item.name);
          if (value) {
            record.value = value;
          }
        } catch (valueError) {
          // 读取 value 失败时记录错误但继续处理
          console.error(`Failed to read value for ${item.name}:`, valueError);
        }
      }

      records.push(record);
    }

    // 构建响应
    const response = {
      success: true,
      records,
      nextCursor: listResult.cursor || null,
      totalProcessed: records.length,
    };

    return jsonResponse(response);

  } catch (error) {
    console.error('Error in BatchListAPI:', error);
    return errorResponse(`Database read error: ${error.message}`, 500);
  }
}

/**
 * 处理 OPTIONS 请求 - CORS 预检
 * 
 * @returns {Response}
 */
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

/**
 * 默认请求处理器
 * 
 * @param {Object} context - Cloudflare Workers 上下文
 * @returns {Promise<Response>}
 */
export async function onRequest(context) {
  const { request } = context;
  
  if (request.method === 'GET') {
    return onRequestGet(context);
  }
  
  if (request.method === 'OPTIONS') {
    return onRequestOptions();
  }
  
  return errorResponse('Method not allowed', 405);
}
