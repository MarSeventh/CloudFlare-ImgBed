/**
 * IndexRebuilder - 索引重建类
 * 
 * 处理索引重建的完整流程，包括数据获取、排序、分块上传和完成。
 */

import fetchWithAuth from '@/utils/fetchWithAuth';
import BatchProcessor, { BatchOperationError } from '@/utils/batchProcessor';

/**
 * IndexRebuilder 类
 * 
 * 用于重建索引的核心类，协调数据获取、排序和分块上传
 */
class IndexRebuilder {
  /**
   * 创建 IndexRebuilder 实例
   * @param {Object} options - 配置选项
   * @param {number} options.chunkSize - 每个分块的记录数，默认从后端获取
   * @param {number} options.maxRetries - 分块上传最大重试次数，默认 3
   * @param {number} options.retryDelay - 重试延迟基数（毫秒），默认 1000
   * @param {Function} options.onProgress - 进度回调函数
   * @param {Function} options.onError - 错误回调函数
   */
  constructor(options = {}) {
    this.chunkSize = options.chunkSize || null; // 从后端获取
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.onProgress = options.onProgress || (() => {});
    this.onError = options.onError || (() => {});
    this.sessionId = this.generateSessionId();
    this.aborted = false;
  }

  /**
   * 从后端获取索引配置（分块大小等）
   * @returns {Promise<Object>} 配置对象 { chunkSize, databaseType }
   */
  async fetchConfig() {
    try {
      const response = await fetchWithAuth('/api/manage/batch/index/config');
      if (!response.ok) {
        throw new Error('获取配置失败');
      }
      const result = await response.json();
      if (result.success) {
        return {
          chunkSize: result.chunkSize || 500,
          databaseType: result.databaseType || 'unknown'
        };
      }
      throw new Error(result.error || '获取配置失败');
    } catch (error) {
      // 获取失败时使用保守的默认值（兼容 D1）
      console.warn('Failed to fetch index config, using default:', error);
      return { chunkSize: 500, databaseType: 'unknown' };
    }
  }

  /**
   * 执行索引重建
   * 
   * 完整流程：
   * 1. 获取配置（分块大小）
   * 2. 获取所有记录
   * 3. 按时间戳降序排序
   * 4. 分块上传
   * 5. 完成重建
   * 
   * @returns {Promise<Object>} 重建结果 { success: boolean, totalFiles: number }
   * @throws {BatchOperationError} 当发生错误时抛出
   */
  async rebuild() {
    this.aborted = false;
    
    try {
      // 获取配置（分块大小）
      if (!this.chunkSize) {
        const config = await this.fetchConfig();
        this.chunkSize = config.chunkSize;
      }

      // 获取所有记录
      this.onProgress({ 
        phase: 'fetching', 
        message: '正在获取数据...',
        current: 0
      });
      
      const processor = new BatchProcessor({
        onProgress: (p) => this.onProgress({ ...p, phase: 'fetching' }),
        onError: (e) => this.onError(e)
      });
      
      const records = await processor.fetchAllRecords(false);
      
      if (this.aborted) {
        throw new BatchOperationError('操作已取消', 'ABORTED', false, '');
      }

      // 排序（按时间戳降序）
      this.onProgress({ 
        phase: 'sorting', 
        message: '正在排序...',
        current: 0,
        total: records.length
      });
      
      this.sortByTimestampDescending(records);
      
      if (this.aborted) {
        throw new BatchOperationError('操作已取消', 'ABORTED', false, '');
      }

      // 分块上传
      const chunks = this.splitIntoChunks(records);
      
      for (let i = 0; i < chunks.length; i++) {
        if (this.aborted) {
          throw new BatchOperationError('操作已取消', 'ABORTED', false, '');
        }
        
        // 使用重试机制上传分块
        await this.uploadChunkWithRetry(chunks[i], i);
        
        this.onProgress({
          phase: 'uploading',
          current: i + 1,
          total: chunks.length,
          message: `正在上传分块 ${i + 1}/${chunks.length}...`
        });
      }

      // 完成重建
      this.onProgress({ 
        phase: 'finalizing', 
        message: '正在完成重建...',
        current: chunks.length,
        total: chunks.length
      });
      
      await this.finalize(chunks.length, records.length);

      this.onProgress({
        phase: 'completed',
        message: `索引重建完成，共 ${records.length} 个文件`,
        current: records.length,
        total: records.length
      });

      return { success: true, totalFiles: records.length };
    } catch (error) {
      const batchError = error instanceof BatchOperationError 
        ? error 
        : new BatchOperationError(
            error.message || '索引重建失败',
            'REBUILD_ERROR',
            true,
            '请稍后重试'
          );
      this.onError(batchError);
      throw batchError;
    }
  }

  /**
   * 按时间戳降序排序记录
   * 
   * @param {Array} records - 要排序的记录数组（原地排序）
   */
  sortByTimestampDescending(records) {
    records.sort((a, b) => {
      const timestampA = (a.metadata && a.metadata.TimeStamp) || 0;
      const timestampB = (b.metadata && b.metadata.TimeStamp) || 0;
      return timestampB - timestampA;
    });
  }

  /**
   * 将记录分割为多个块
   * 
   * @param {Array} records - 要分割的记录数组
   * @returns {Array<Array>} 分块后的二维数组
   */
  splitIntoChunks(records) {
    const chunks = [];
    for (let i = 0; i < records.length; i += this.chunkSize) {
      chunks.push(records.slice(i, i + this.chunkSize));
    }
    return chunks;
  }

  /**
   * 带重试机制的分块上传
   * 
   * @param {Array} chunk - 要上传的分块数据
   * @param {number} chunkId - 分块 ID
   * @returns {Promise<Object>} 上传响应
   * @throws {BatchOperationError} 当所有重试都失败时抛出
   */
  async uploadChunkWithRetry(chunk, chunkId) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.uploadChunk(chunk, chunkId);
      } catch (error) {
        lastError = error;
        
        // 不重试的错误类型
        if (error instanceof BatchOperationError) {
          if (error.code === 'AUTH_FAILED' || 
              error.code === 'FORBIDDEN' || 
              error.code === 'ABORTED') {
            throw error;
          }
        }
        
        // 如果还有重试机会，等待后重试
        if (attempt < this.maxRetries) {
          // 指数退避
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          await this.sleep(delay);
          
          this.onProgress({
            phase: 'retrying',
            message: `分块 ${chunkId + 1} 上传失败，正在重试 (${attempt}/${this.maxRetries})...`,
            current: chunkId,
            attempt: attempt
          });
        }
      }
    }
    
    // 所有重试都失败
    throw lastError instanceof BatchOperationError 
      ? lastError 
      : new BatchOperationError(
          `分块 ${chunkId + 1} 上传失败，已重试 ${this.maxRetries} 次`,
          'CHUNK_UPLOAD_FAILED',
          false,
          '请检查网络连接后重新开始重建'
        );
  }

  /**
   * 上传单个分块
   * 
   * @param {Array} chunk - 要上传的分块数据
   * @param {number} chunkId - 分块 ID
   * @returns {Promise<Object>} 上传响应
   * @throws {BatchOperationError} 当上传失败时抛出
   */
  async uploadChunk(chunk, chunkId) {
    const checksum = await this.calculateChecksum(chunk);
    
    try {
      const response = await fetchWithAuth('/api/manage/batch/index/chunk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chunkId: String(chunkId),
          sessionId: this.sessionId,
          data: chunk,
          checksum
        })
      });

      if (!response.ok) {
        let errorDetails = '';
        try {
          const errorData = await response.json();
          errorDetails = errorData.error || '';
        } catch {
          // 忽略 JSON 解析错误
        }
        throw this.createHttpError(response.status, errorDetails);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new BatchOperationError(
          result.error || '分块上传失败',
          'CHUNK_UPLOAD_FAILED',
          true,
          '请稍后重试'
        );
      }

      return result;
    } catch (error) {
      if (error instanceof BatchOperationError) {
        throw error;
      }
      // 网络错误
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new BatchOperationError(
          '网络连接失败',
          'NETWORK_ERROR',
          true,
          '请检查网络连接后重试'
        );
      }
      throw new BatchOperationError(
        error.message || '分块上传失败',
        'CHUNK_UPLOAD_FAILED',
        true,
        '请稍后重试'
      );
    }
  }

  /**
   * 完成索引重建
   * 
   * @param {number} totalChunks - 总分块数
   * @param {number} totalFiles - 总文件数
   * @returns {Promise<Object>} 完成响应
   * @throws {BatchOperationError} 当完成请求失败时抛出
   */
  async finalize(totalChunks, totalFiles) {
    try {
      const response = await fetchWithAuth('/api/manage/batch/index/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          totalChunks,
          totalFiles
        })
      });

      if (!response.ok) {
        let errorDetails = '';
        try {
          const errorData = await response.json();
          errorDetails = errorData.error || '';
        } catch {
          // 忽略 JSON 解析错误
        }
        throw this.createHttpError(response.status, errorDetails);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new BatchOperationError(
          result.error || '索引完成失败',
          'FINALIZE_FAILED',
          true,
          '请稍后重试'
        );
      }

      return result;
    } catch (error) {
      if (error instanceof BatchOperationError) {
        throw error;
      }
      throw new BatchOperationError(
        error.message || '索引完成失败',
        'FINALIZE_FAILED',
        true,
        '请稍后重试'
      );
    }
  }

  /**
   * 生成唯一的会话 ID
   * 
   * @returns {string} 会话 ID
   */
  generateSessionId() {
    return `rebuild_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  }

  /**
   * 计算数据的 SHA-256 校验和
   * 
   * @param {Array} data - 要计算校验和的数据
   * @returns {Promise<string>} 十六进制格式的校验和
   */
  async calculateChecksum(data) {
    const text = JSON.stringify(data);
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * 根据 HTTP 状态码创建错误对象
   * 
   * @param {number} status - HTTP 状态码
   * @param {string} details - 错误详情
   * @returns {BatchOperationError}
   */
  createHttpError(status, details = '') {
    switch (status) {
      case 401:
        return new BatchOperationError(
          '认证失败，请重新登录',
          'AUTH_FAILED',
          false,
          '请刷新页面并重新登录'
        );
      case 403:
        return new BatchOperationError(
          '权限不足或请求被拒绝',
          'FORBIDDEN',
          false,
          '请确认您有管理员权限'
        );
      case 400:
        return new BatchOperationError(
          `请求数据无效: ${details}`,
          'INVALID_DATA',
          true,
          '请检查数据格式后重试'
        );
      case 404:
        return new BatchOperationError(
          '会话不存在',
          'SESSION_NOT_FOUND',
          false,
          '请重新开始索引重建'
        );
      case 410:
        return new BatchOperationError(
          '会话已过期',
          'SESSION_EXPIRED',
          false,
          '请重新开始索引重建'
        );
      case 500:
      default:
        return new BatchOperationError(
          `服务器错误: ${details || status}`,
          'SERVER_ERROR',
          true,
          '请稍后重试'
        );
    }
  }

  /**
   * 延迟执行
   * 
   * @param {number} ms - 延迟毫秒数
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 取消当前操作
   */
  abort() {
    this.aborted = true;
  }

  /**
   * 重置重建器状态
   * 在开始新的重建操作前调用
   */
  reset() {
    this.aborted = false;
    this.sessionId = this.generateSessionId();
  }
}

export default IndexRebuilder;
