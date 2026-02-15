/**
 * RestoreProcessor - 分批恢复数据类
 * 
 * 将备份数据分批上传到后端进行恢复，避免 CPU 超时
 */

import fetchWithAuth from '@/utils/fetchWithAuth';
import { BatchOperationError } from '@/utils/batchProcessor';

/**
 * RestoreProcessor 类
 */
class RestoreProcessor {
  /**
   * 创建 RestoreProcessor 实例
   * @param {Object} options - 配置选项
   * @param {number} options.chunkSize - 每批数据量，默认 50
   * @param {number} options.maxRetries - 最大重试次数，默认 3
   * @param {number} options.retryDelay - 重试延迟基数（毫秒），默认 1000
   * @param {Function} options.onProgress - 进度回调函数
   * @param {Function} options.onError - 错误回调函数
   */
  constructor(options = {}) {
    this.chunkSize = options.chunkSize || 50;
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.onProgress = options.onProgress || (() => {});
    this.onError = options.onError || (() => {});
    this.aborted = false;
  }

  /**
   * 执行恢复操作
   * 
   * @param {Object} backupData - 备份数据对象
   * @returns {Promise<Object>} 恢复结果
   */
  async restore(backupData) {
    this.aborted = false;

    // 验证备份数据格式
    if (!backupData || !backupData.data) {
      throw new BatchOperationError(
        '备份文件格式无效',
        'INVALID_BACKUP',
        false,
        '请选择有效的备份文件'
      );
    }

    const { files = {}, settings = {} } = backupData.data;
    const fileEntries = Object.entries(files);
    const settingEntries = Object.entries(settings);
    
    const totalFiles = fileEntries.length;
    const totalSettings = settingEntries.length;
    const totalItems = totalFiles + totalSettings;

    let restoredFiles = 0;
    let restoredSettings = 0;
    let failedFiles = 0;
    let failedSettings = 0;

    try {
      // 1. 分批恢复文件数据
      this.onProgress({
        phase: 'restoring_files',
        message: '正在恢复文件数据...',
        current: 0,
        total: totalItems
      });

      const fileChunks = this.splitIntoChunks(fileEntries, this.chunkSize);
      
      for (let i = 0; i < fileChunks.length; i++) {
        if (this.aborted) {
          throw new BatchOperationError('操作已取消', 'ABORTED', false, '');
        }

        const chunk = fileChunks[i];
        const chunkData = Object.fromEntries(chunk);
        
        const result = await this.uploadChunkWithRetry('files', chunkData);
        restoredFiles += result.restoredCount;
        failedFiles += result.failedCount;

        this.onProgress({
          phase: 'restoring_files',
          message: `正在恢复文件数据 ${restoredFiles}/${totalFiles}...`,
          current: restoredFiles,
          total: totalItems,
          percentage: (restoredFiles / totalItems) * 80
        });
      }

      // 2. 分批恢复系统设置
      this.onProgress({
        phase: 'restoring_settings',
        message: '正在恢复系统设置...',
        current: restoredFiles,
        total: totalItems
      });

      const settingChunks = this.splitIntoChunks(settingEntries, this.chunkSize);
      
      for (let i = 0; i < settingChunks.length; i++) {
        if (this.aborted) {
          throw new BatchOperationError('操作已取消', 'ABORTED', false, '');
        }

        const chunk = settingChunks[i];
        const chunkData = Object.fromEntries(chunk);
        
        const result = await this.uploadChunkWithRetry('settings', chunkData);
        restoredSettings += result.restoredCount;
        failedSettings += result.failedCount;

        this.onProgress({
          phase: 'restoring_settings',
          message: `正在恢复系统设置 ${restoredSettings}/${totalSettings}...`,
          current: restoredFiles + restoredSettings,
          total: totalItems,
          percentage: 80 + (restoredSettings / totalSettings) * 20
        });
      }

      // 3. 完成
      this.onProgress({
        phase: 'completed',
        message: '恢复完成',
        current: totalItems,
        total: totalItems,
        percentage: 100
      });

      return {
        success: true,
        restoredFiles,
        restoredSettings,
        failedFiles,
        failedSettings,
        backupTimestamp: backupData.timestamp
      };

    } catch (error) {
      const batchError = error instanceof BatchOperationError
        ? error
        : new BatchOperationError(
            error.message || '恢复失败',
            'RESTORE_ERROR',
            true,
            '请稍后重试'
          );
      this.onError(batchError);
      throw batchError;
    }
  }

  /**
   * 将数组分割为多个块
   */
  splitIntoChunks(entries, chunkSize) {
    const chunks = [];
    for (let i = 0; i < entries.length; i += chunkSize) {
      chunks.push(entries.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * 带重试机制的分块上传
   */
  async uploadChunkWithRetry(type, data) {
    let lastError;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.uploadChunk(type, data);
      } catch (error) {
        lastError = error;

        if (error instanceof BatchOperationError) {
          if (error.code === 'AUTH_FAILED' ||
              error.code === 'FORBIDDEN' ||
              error.code === 'ABORTED') {
            throw error;
          }
        }

        if (attempt < this.maxRetries) {
          const delay = this.retryDelay * Math.pow(2, attempt - 1);
          await this.sleep(delay);
        }
      }
    }

    throw lastError;
  }

  /**
   * 上传单个分块
   */
  async uploadChunk(type, data) {
    try {
      const response = await fetchWithAuth('/api/manage/batch/restore/chunk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, data })
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
          result.error || '恢复分块失败',
          'CHUNK_RESTORE_FAILED',
          true,
          '请稍后重试'
        );
      }

      return result;
    } catch (error) {
      if (error instanceof BatchOperationError) {
        throw error;
      }
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new BatchOperationError(
          '网络连接失败',
          'NETWORK_ERROR',
          true,
          '请检查网络连接后重试'
        );
      }
      throw new BatchOperationError(
        error.message || '恢复分块失败',
        'CHUNK_RESTORE_FAILED',
        true,
        '请稍后重试'
      );
    }
  }

  /**
   * 根据 HTTP 状态码创建错误对象
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
          '请检查备份文件格式'
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
}

export default RestoreProcessor;
