/**
 * BatchIndexChunkAPI - 接收并存储索引分块的 API 端点
 * 
 * 实现数据结构验证和 checksum 校验
 * 存储分块数据到 KV，使用 session ID 和 chunk ID 作为键
 */

import { getDatabase } from '../../../../utils/databaseAdapter.js';

// CORS 跨域响应头
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
 * @param {string} details - 详细错误信息（可选）
 * @returns {Response}
 */
function errorResponse(message, status = 400, details = null) {
  const responseData = { success: false, error: message };
  if (details) {
    responseData.details = details;
  }
  return jsonResponse(responseData, status);
}

/**
 * 计算数据的 SHA-256 校验和
 * @param {Array} data - 要计算校验和的数据
 * @returns {Promise<string>} 十六进制格式的校验和
 */
async function calculateChecksum(data) {
  const text = JSON.stringify(data);
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 验证 sessionId 格式
 * 格式: rebuild_{timestamp}_{randomString}
 * @param {string} sessionId - 会话 ID
 * @returns {boolean}
 */
function isValidSessionId(sessionId) {
  if (typeof sessionId !== 'string' || sessionId.length === 0) {
    return false;
  }
  // 限制长度防止过长的 key
  if (sessionId.length > 100) {
    return false;
  }
  // 只允许字母、数字、下划线和连字符
  const validPattern = /^[a-zA-Z0-9_-]+$/;
  return validPattern.test(sessionId);
}

/**
 * 验证 chunkId 格式
 * 应该是数字字符串 (0, 1, 2, ...)
 * @param {string} chunkId - 分块 ID
 * @returns {boolean}
 */
function isValidChunkId(chunkId) {
  if (typeof chunkId !== 'string' || chunkId.length === 0) {
    return false;
  }
  // 必须是非负整数
  const num = parseInt(chunkId, 10);
  return !isNaN(num) && num >= 0 && String(num) === chunkId;
}

/**
 * 清理字符串字段，防止注入攻击
 * @param {string} str - 要清理的字符串
 * @returns {string} 清理后的字符串
 */
function sanitizeString(str) {
  if (typeof str !== 'string') {
    return str;
  }
  // 移除控制字符（除了常见的空白字符）
  // 保留 \t (0x09), \n (0x0A), \r (0x0D)
  return str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * 递归清理对象中的所有字符串字段
 * @param {any} obj - 要清理的对象
 * @returns {any} 清理后的对象
 */
function sanitizeObject(obj) {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  if (typeof obj === 'object') {
    const sanitized = {};
    for (const key of Object.keys(obj)) {
      sanitized[sanitizeString(key)] = sanitizeObject(obj[key]);
    }
    return sanitized;
  }
  
  return obj;
}

/**
 * 验证文件元数据结构
 * 兼容早期版本数据，早期版本只有 ListType, Label, TimeStamp 字段
 * @param {Object} metadata - 文件元数据
 * @returns {{valid: boolean, error?: string}}
 */
function validateMetadata(metadata) {
  if (!metadata || typeof metadata !== 'object') {
    return { valid: false, error: 'metadata must be an object' };
  }
  
  // FileName 字段为可选（兼容早期版本）
  if (metadata.FileName !== undefined && typeof metadata.FileName !== 'string') {
    return { valid: false, error: 'metadata.FileName must be a string if provided' };
  }
  
  // 可选字段类型检查（允许 null）
  if (metadata.FileType !== undefined && metadata.FileType !== null && typeof metadata.FileType !== 'string') {
    return { valid: false, error: 'metadata.FileType must be a string' };
  }
  
  if (metadata.FileSize !== undefined && metadata.FileSize !== null && typeof metadata.FileSize !== 'string') {
    return { valid: false, error: 'metadata.FileSize must be a string' };
  }
  
  if (metadata.TimeStamp !== undefined && typeof metadata.TimeStamp !== 'number') {
    return { valid: false, error: 'metadata.TimeStamp must be a number' };
  }
  
  if (metadata.Channel !== undefined && metadata.Channel !== null && typeof metadata.Channel !== 'string') {
    return { valid: false, error: 'metadata.Channel must be a string' };
  }
  
  if (metadata.Tags !== undefined && !Array.isArray(metadata.Tags)) {
    return { valid: false, error: 'metadata.Tags must be an array' };
  }
  
  // 早期版本字段验证
  if (metadata.ListType !== undefined && metadata.ListType !== null && typeof metadata.ListType !== 'string') {
    return { valid: false, error: 'metadata.ListType must be a string' };
  }
  
  if (metadata.Label !== undefined && metadata.Label !== null && typeof metadata.Label !== 'string') {
    return { valid: false, error: 'metadata.Label must be a string' };
  }
  
  return { valid: true };
}

/**
 * 验证单个数据记录
 * @param {Object} record - 数据记录
 * @param {number} index - 记录索引（用于错误消息）
 * @returns {{valid: boolean, error?: string}}
 */
function validateRecord(record, index) {
  if (!record || typeof record !== 'object') {
    return { valid: false, error: `record[${index}] must be an object` };
  }
  
  if (typeof record.id !== 'string' || record.id.length === 0) {
    return { valid: false, error: `record[${index}].id must be a non-empty string` };
  }
  
  // 验证 id 不包含危险字符
  if (record.id.includes('\x00') || record.id.includes('\n') || record.id.includes('\r')) {
    return { valid: false, error: `record[${index}].id contains invalid characters` };
  }
  
  const metadataValidation = validateMetadata(record.metadata);
  if (!metadataValidation.valid) {
    return { valid: false, error: `record[${index}].${metadataValidation.error}` };
  }
  
  return { valid: true };
}

/**
 * 验证请求体数据结构
 * @param {Object} body - 请求体
 * @returns {{valid: boolean, error?: string}}
 */
function validateRequestBody(body) {
  // 检查必需字段
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object' };
  }
  
  // 验证 chunkId
  if (!isValidChunkId(body.chunkId)) {
    return { valid: false, error: 'chunkId must be a valid non-negative integer string' };
  }
  
  // 验证 sessionId
  if (!isValidSessionId(body.sessionId)) {
    return { valid: false, error: 'sessionId must be a valid alphanumeric string' };
  }
  
  // 验证 data 数组
  if (!Array.isArray(body.data)) {
    return { valid: false, error: 'data must be an array' };
  }
  
  // 限制数据量防止 DoS
  if (body.data.length > 10000) {
    return { valid: false, error: 'data array exceeds maximum size of 10000 records' };
  }
  
  // 验证每条记录
  for (let i = 0; i < body.data.length; i++) {
    const recordValidation = validateRecord(body.data[i], i);
    if (!recordValidation.valid) {
      return recordValidation;
    }
  }
  
  // 验证 checksum
  if (typeof body.checksum !== 'string' || body.checksum.length === 0) {
    return { valid: false, error: 'checksum must be a non-empty string' };
  }
  
  // 验证 checksum 格式（SHA-256 十六进制，64 字符）
  if (!/^[a-f0-9]{64}$/i.test(body.checksum)) {
    return { valid: false, error: 'checksum must be a valid SHA-256 hex string (64 characters)' };
  }
  
  return { valid: true };
}

/**
 * 处理 POST 请求 - 接收并存储索引分块
 * 
 * @param {Object} context - Cloudflare Workers 上下文
 * @returns {Promise<Response>}
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    // 认证已由 _middleware.js 处理

    // 解析请求体
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      return errorResponse('Invalid JSON in request body', 400);
    }

    // 验证请求体数据结构
    const validation = validateRequestBody(body);
    if (!validation.valid) {
      return errorResponse('Invalid request body', 400, validation.error);
    }

    const { chunkId, sessionId, data, checksum } = body;

    // 清理数据中的字符串字段
    const sanitizedData = sanitizeObject(data);

    // 验证 checksum
    const calculatedChecksum = await calculateChecksum(sanitizedData);
    if (calculatedChecksum.toLowerCase() !== checksum.toLowerCase()) {
      return errorResponse('Checksum mismatch', 400, 'The provided checksum does not match the data');
    }

    // 6. 获取数据库实例
    const db = getDatabase(env);

    // 存储分块数据到 KV
    // 使用格式: chunk_{sessionId}_{chunkId}
    const chunkKey = `chunk_${sessionId}_${chunkId}`;
    
    const chunkData = {
      chunkId,
      sessionId,
      data: sanitizedData,
      checksum: calculatedChecksum,
      storedAt: Date.now(),
      recordCount: sanitizedData.length,
    };

    await db.put(chunkKey, JSON.stringify(chunkData));

    // 8. 返回成功响应
    return jsonResponse({
      success: true,
      chunkId,
      storedCount: sanitizedData.length,
    });

  } catch (error) {
    console.error('Error in BatchIndexChunkAPI:', error);
    return errorResponse(`Database write error: ${error.message}`, 500);
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
  
  if (request.method === 'POST') {
    return onRequestPost(context);
  }
  
  if (request.method === 'OPTIONS') {
    return onRequestOptions();
  }
  
  return errorResponse('Method not allowed', 405);
}
