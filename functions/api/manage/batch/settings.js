/**
 * BatchSettingsAPI - 批量读取系统设置的 API 端点
 * 
 * 读取所有 `manage@` 前缀的设置（排除索引相关键）
 * 用于备份功能获取系统设置数据
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
 * 检查键是否为索引相关键（需要排除）
 * 
 * 排除的键模式：
 * - manage@index (主索引)
 * - manage@index_* (索引分块)
 * - manage@index@meta (索引元数据)
 * - manage@indexMeta (旧版索引元数据)
 * 
 * @param {string} key - KV 键名
 * @returns {boolean} 是否为索引相关键
 */
function isIndexRelatedKey(key) {
  // 精确匹配 manage@index
  if (key === 'manage@index') {
    return true;
  }
  
  // 匹配 manage@index_ 开头的分块键 (manage@index_0, manage@index_1, ...)
  if (key.startsWith('manage@index_')) {
    return true;
  }
  
  // 匹配 manage@index@ 开头的元数据键 (manage@index@meta, manage@index@operation_*)
  if (key.startsWith('manage@index@')) {
    return true;
  }
  
  // 匹配旧版索引元数据键
  if (key === 'manage@indexMeta') {
    return true;
  }
  
  return false;
}

/**
 * 从键名中移除 manage@ 前缀
 * 
 * @param {string} key - 完整的 KV 键名
 * @returns {string} 移除前缀后的键名
 */
function stripManagePrefix(key) {
  const prefix = 'manage@';
  if (key.startsWith(prefix)) {
    return key.slice(prefix.length);
  }
  return key;
}

/**
 * 处理 GET 请求 - 读取所有系统设置
 * 
 * @param {Object} context - Cloudflare Workers 上下文
 * @returns {Promise<Response>}
 */
export async function onRequestGet(context) {
  const { env } = context;

  try {
    // 获取数据库实例（认证已由 _middleware.js 处理）
    const db = getDatabase(env);

    // 3. 列出所有 manage@ 前缀的键
    const settings = {};
    let cursor = null;
    
    do {
      // 构建 list 请求选项
      const listOptions = {
        prefix: 'manage@',
        limit: 1000,
      };
      
      if (cursor) {
        listOptions.cursor = cursor;
      }

      // 执行 KV list 操作
      const listResult = await db.list(listOptions);

      // 检查响应格式
      if (!listResult || !listResult.keys || !Array.isArray(listResult.keys)) {
        return errorResponse('Database list operation failed', 500);
      }

      // 处理每个键
      for (const item of listResult.keys) {
        const key = item.name;
        
        // 跳过索引相关键
        if (isIndexRelatedKey(key)) {
          continue;
        }

        // 读取设置值
        try {
          const value = await db.get(key);
          
          if (value !== null && value !== undefined) {
            // 尝试解析 JSON，如果失败则保留原始字符串
            let parsedValue;
            try {
              parsedValue = JSON.parse(value);
            } catch {
              parsedValue = value;
            }
            
            // 使用移除前缀后的键名
            const settingKey = stripManagePrefix(key);
            settings[settingKey] = parsedValue;
          }
        } catch (valueError) {
          // 读取值失败时记录错误但继续处理
          console.error(`Failed to read value for ${key}:`, valueError);
        }
      }

      // 更新 cursor 用于下一次迭代
      cursor = listResult.cursor || null;
      
    } while (cursor);

    // 4. 返回成功响应
    return jsonResponse({
      success: true,
      settings,
    });

  } catch (error) {
    console.error('Error in BatchSettingsAPI:', error);
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
