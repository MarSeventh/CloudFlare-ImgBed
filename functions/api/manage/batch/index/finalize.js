/**
 * BatchIndexFinalizeAPI - 完成索引重建，组装所有分块
 * 
 * 实现分块组装逻辑，将所有分块合并为完整索引
 * 更新索引元数据
 * 清理临时分块数据
 */

import { getDatabase, checkDatabaseConfig } from '../../../../utils/databaseAdapter.js';

// CORS 跨域响应头
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

// 索引存储键
const INDEX_KEY = 'manage@index';
const INDEX_META_KEY = 'manage@index@meta';
// D1 单字段限制 2MB，KV 限制 25MB，根据数据库类型动态设置
const INDEX_CHUNK_SIZE_D1 = 500; // D1 数据库分块大小
const INDEX_CHUNK_SIZE_KV = 5000; // KV 存储分块大小

/**
 * 根据数据库类型获取索引分块大小
 * @param {Object} env - 环境变量
 * @returns {number} 分块大小
 */
function getIndexChunkSize(env) {
  const config = checkDatabaseConfig(env);
  return config.usingD1 ? INDEX_CHUNK_SIZE_D1 : INDEX_CHUNK_SIZE_KV;
}

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
 * 验证请求体数据结构
 * @param {Object} body - 请求体
 * @returns {{valid: boolean, error?: string}}
 */
function validateRequestBody(body) {
  // 检查必需字段
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object' };
  }

  // 验证 sessionId
  if (!isValidSessionId(body.sessionId)) {
    return { valid: false, error: 'sessionId must be a valid alphanumeric string' };
  }

  // 验证 totalChunks
  if (typeof body.totalChunks !== 'number' || !Number.isInteger(body.totalChunks) || body.totalChunks < 0) {
    return { valid: false, error: 'totalChunks must be a non-negative integer' };
  }

  // 验证 totalFiles
  if (typeof body.totalFiles !== 'number' || !Number.isInteger(body.totalFiles) || body.totalFiles < 0) {
    return { valid: false, error: 'totalFiles must be a non-negative integer' };
  }

  // checksum 是可选的，但如果提供了必须是有效的字符串
  if (body.checksum !== undefined && body.checksum !== null) {
    if (typeof body.checksum !== 'string') {
      return { valid: false, error: 'checksum must be a string if provided' };
    }
  }

  return { valid: true };
}

/**
 * 读取所有分块数据
 * @param {Object} db - 数据库实例
 * @param {string} sessionId - 会话 ID
 * @param {number} totalChunks - 总分块数
 * @returns {Promise<{success: boolean, chunks?: Array, error?: string, missingChunks?: Array}>}
 */
async function readAllChunks(db, sessionId, totalChunks) {
  const chunks = [];
  const missingChunks = [];

  // 读取所有分块 (0 到 totalChunks-1)
  for (let chunkId = 0; chunkId < totalChunks; chunkId++) {
    const chunkKey = `chunk_${sessionId}_${chunkId}`;
    
    try {
      const chunkDataStr = await db.get(chunkKey);
      
      if (!chunkDataStr) {
        missingChunks.push(chunkId);
        continue;
      }

      const chunkData = JSON.parse(chunkDataStr);
      
      // 验证分块数据结构
      if (!chunkData || !Array.isArray(chunkData.data)) {
        missingChunks.push(chunkId);
        continue;
      }

      chunks.push({
        chunkId: parseInt(chunkData.chunkId, 10),
        data: chunkData.data,
        recordCount: chunkData.recordCount || chunkData.data.length,
      });
    } catch (error) {
      console.error(`Error reading chunk ${chunkId}:`, error);
      missingChunks.push(chunkId);
    }
  }

  if (missingChunks.length > 0) {
    return {
      success: false,
      error: `Missing chunks: ${missingChunks.join(', ')}`,
      missingChunks,
    };
  }

  return { success: true, chunks };
}

/**
 * 组装分块为完整索引
 * @param {Array} chunks - 分块数组
 * @returns {Array} 完整的文件记录数组
 */
function assembleChunks(chunks) {
  // 按 chunkId 排序确保顺序正确
  chunks.sort((a, b) => a.chunkId - b.chunkId);

  // 合并所有分块的数据
  const allFiles = [];
  for (const chunk of chunks) {
    allFiles.push(...chunk.data);
  }

  return allFiles;
}

/**
 * 保存分块索引到数据库
 * @param {Object} db - 数据库实例
 * @param {Array} files - 文件记录数组
 * @param {Object} env - 环境变量
 * @returns {Promise<{success: boolean, metadata?: Object, error?: string}>}
 */
async function saveIndex(db, files, env) {
  try {
    const chunkSize = getIndexChunkSize(env);
    const chunks = [];
    
    // 将文件数组分块
    for (let i = 0; i < files.length; i += chunkSize) {
      const chunk = files.slice(i, i + chunkSize);
      chunks.push(chunk);
    }

    // 计算各渠道容量统计
    const channelStats = {};
    let totalSizeMB = 0;

    for (const file of files) {
      const channelName = file.metadata?.ChannelName;
      const fileSize = parseFloat(file.metadata?.FileSize) || 0;

      totalSizeMB += fileSize;

      if (channelName) {
        if (!channelStats[channelName]) {
          channelStats[channelName] = { usedMB: 0, fileCount: 0 };
        }
        channelStats[channelName].usedMB += fileSize;
        channelStats[channelName].fileCount += 1;
      }
    }

    const lastUpdated = Date.now();

    // 保存索引元数据
    const metadata = {
      lastUpdated,
      totalCount: files.length,
      totalSizeMB: Math.round(totalSizeMB * 100) / 100,
      channelStats,
      lastOperationId: null, // 重建后清除操作 ID
      chunkCount: chunks.length,
      chunkSize: chunkSize,
    };

    await db.put(INDEX_META_KEY, JSON.stringify(metadata));

    // 保存各个分块
    const savePromises = chunks.map((chunk, chunkId) => {
      const chunkKey = `${INDEX_KEY}_${chunkId}`;
      return db.put(chunkKey, JSON.stringify(chunk));
    });

    await Promise.all(savePromises);

    console.log(`Saved index: ${chunks.length} chunks, ${files.length} total files, ${totalSizeMB.toFixed(2)} MB`);

    return { success: true, metadata };
  } catch (error) {
    console.error('Error saving index:', error);
    return { success: false, error: error.message };
  }
}

/**
 * 清理临时分块数据
 * @param {Object} db - 数据库实例
 * @param {string} sessionId - 会话 ID
 * @param {number} totalChunks - 总分块数
 * @returns {Promise<void>}
 */
async function cleanupChunks(db, sessionId, totalChunks) {
  const deletePromises = [];

  for (let chunkId = 0; chunkId < totalChunks; chunkId++) {
    const chunkKey = `chunk_${sessionId}_${chunkId}`;
    deletePromises.push(
      db.delete(chunkKey).catch(error => {
        console.warn(`Failed to delete chunk ${chunkKey}:`, error);
      })
    );
  }

  await Promise.all(deletePromises);
  console.log(`Cleaned up ${totalChunks} temporary chunks for session ${sessionId}`);
}

/**
 * 清理旧的索引分块（如果新索引分块数量少于旧的）
 * @param {Object} db - 数据库实例
 * @param {number} newChunkCount - 新索引的分块数量
 * @returns {Promise<void>}
 */
async function cleanupOldIndexChunks(db, newChunkCount) {
  try {
    // 读取旧的元数据获取旧的分块数量
    const oldMetaStr = await db.get(INDEX_META_KEY);
    if (!oldMetaStr) {
      return;
    }

    const oldMeta = JSON.parse(oldMetaStr);
    const oldChunkCount = oldMeta.chunkCount || 0;

    // 如果新的分块数量少于旧的，删除多余的分块
    if (newChunkCount < oldChunkCount) {
      const deletePromises = [];
      for (let i = newChunkCount; i < oldChunkCount; i++) {
        const chunkKey = `${INDEX_KEY}_${i}`;
        deletePromises.push(
          db.delete(chunkKey).catch(error => {
            console.warn(`Failed to delete old index chunk ${chunkKey}:`, error);
          })
        );
      }
      await Promise.all(deletePromises);
      console.log(`Cleaned up ${oldChunkCount - newChunkCount} old index chunks`);
    }
  } catch (error) {
    console.warn('Error cleaning up old index chunks:', error);
  }
}

/**
 * 处理 POST 请求 - 完成索引重建
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

    const { sessionId, totalChunks, totalFiles } = body;

    // 4. 获取数据库实例
    const db = getDatabase(env);

    // 5. 处理空索引的情况
    if (totalChunks === 0 || totalFiles === 0) {
      // 保存空索引
      const saveResult = await saveIndex(db, [], env);
      if (!saveResult.success) {
        return errorResponse('Failed to save empty index', 500, saveResult.error);
      }

      // 清理旧的索引分块
      await cleanupOldIndexChunks(db, 0);

      return jsonResponse({
        success: true,
        indexedCount: 0,
        lastUpdated: saveResult.metadata.lastUpdated,
      });
    }

    // 读取所有分块
    const chunksResult = await readAllChunks(db, sessionId, totalChunks);
    if (!chunksResult.success) {
      return errorResponse('Failed to read chunks', 400, chunksResult.error);
    }

    // 7. 组装分块为完整索引
    const allFiles = assembleChunks(chunksResult.chunks);

    // 8. 验证文件数量
    if (allFiles.length !== totalFiles) {
      console.warn(`File count mismatch: expected ${totalFiles}, got ${allFiles.length}`);
      // 不作为错误处理，继续保存实际获取的文件数量
    }

    // 9. 清理旧的索引分块（在保存新索引之前）
    const chunkSize = getIndexChunkSize(env);
    const newChunkCount = Math.ceil(allFiles.length / chunkSize);
    await cleanupOldIndexChunks(db, newChunkCount);

    // 10. 保存新索引
    const saveResult = await saveIndex(db, allFiles, env);
    if (!saveResult.success) {
      return errorResponse('Failed to save index', 500, saveResult.error);
    }

    // 11. 清理临时分块数据
    // 使用 waitUntil 异步清理，不阻塞响应
    if (context.waitUntil) {
      context.waitUntil(cleanupChunks(db, sessionId, totalChunks));
    } else {
      await cleanupChunks(db, sessionId, totalChunks);
    }

    // 12. 返回成功响应
    return jsonResponse({
      success: true,
      indexedCount: allFiles.length,
      lastUpdated: saveResult.metadata.lastUpdated,
    });

  } catch (error) {
    console.error('Error in BatchIndexFinalizeAPI:', error);
    return errorResponse(`Server error: ${error.message}`, 500);
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
