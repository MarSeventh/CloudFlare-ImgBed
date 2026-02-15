/**
 * BatchProcessor - 批量数据处理类
 * 
 * 处理批量数据获取和处理的核心类，使用 cursor 分页机制获取所有数据。
 * 支持进度回调和取消功能。
 */

import fetchWithAuth from '@/utils/fetchWithAuth';

/**
 * 批量操作错误类
 * 提供错误代码、是否可恢复、建议操作等信息
 */
export class BatchOperationError extends Error {
  constructor(message, code, recoverable = false, suggestion = '') {
    super(message);
    this.name = 'BatchOperationError';
    this.code = code;
    this.recoverable = recoverable;
    this.suggestion = suggestion;
  }
}

/**
 * 错误处理器映射
 * 根据 HTTP 状态码返回对应的错误对象
 */
const ERROR_HANDLERS = {
  401: () => new BatchOperationError(
    '认证失败，请重新登录',
    'AUTH_FAILED',
    false,
    '请刷新页面并重新登录'
  ),
  403: () => new BatchOperationError(
    '权限不足或请求被拒绝',
    'FORBIDDEN',
    false,
    '请确认您有管理员权限'
  ),
  400: (details) => new BatchOperationError(
    `请求数据无效: ${details}`,
    'INVALID_DATA',
    true,
    '请检查数据格式后重试'
  ),
  500: () => new BatchOperationError(
    '服务器内部错误',
    'SERVER_ERROR',
    true,
    '请稍后重试，如果问题持续请联系管理员'
  ),
  NETWORK: () => new BatchOperationError(
    '网络连接失败',
    'NETWORK_ERROR',
    true,
    '请检查网络连接后重试'
  ),
  ABORT: () => new BatchOperationError(
    '操作已取消',
    'ABORTED',
    false,
    ''
  )
};

/**
 * 根据错误创建 BatchOperationError
 * @param {Error|Response} error - 原始错误或响应对象
 * @param {string} details - 错误详情
 * @returns {BatchOperationError}
 */
function createError(error, details = '') {
  // 处理取消操作
  if (error.name === 'AbortError') {
    return ERROR_HANDLERS.ABORT();
  }
  
  // 处理 HTTP 响应错误
  if (error instanceof Response || (error && typeof error.status === 'number')) {
    const handler = ERROR_HANDLERS[error.status];
    if (handler) {
      return handler(details);
    }
    return new BatchOperationError(
      `请求失败: ${error.status}`,
      'HTTP_ERROR',
      true,
      '请稍后重试'
    );
  }
  
  // 处理网络错误
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return ERROR_HANDLERS.NETWORK();
  }
  
  // 其他错误
  return new BatchOperationError(
    error.message || '未知错误',
    'UNKNOWN_ERROR',
    true,
    '请稍后重试'
  );
}

/**
 * BatchProcessor 类
 * 
 * 用于批量获取和处理数据的核心类
 */
class BatchProcessor {
  /**
   * 创建 BatchProcessor 实例
   * @param {Object} options - 配置选项
   * @param {number} options.batchSize - 每批数据量，默认 1000
   * @param {Function} options.onProgress - 进度回调函数
   * @param {Function} options.onError - 错误回调函数
   */
  constructor(options = {}) {
    this.batchSize = options.batchSize || 1000;
    this.onProgress = options.onProgress || (() => {});
    this.onError = options.onError || (() => {});
    this.abortController = null;
  }

  /**
   * 获取所有数据记录
   * 使用 cursor 分页机制循环获取所有数据，直到没有更多数据或操作被取消
   * 
   * @param {boolean} includeValue - 是否包含分块文件的 value 数据
   * @returns {Promise<Array>} 所有记录的数组
   * @throws {BatchOperationError} 当发生错误时抛出
   */
  async fetchAllRecords(includeValue = false) {
    // 创建新的 AbortController 用于取消操作
    this.abortController = new AbortController();
    const allRecords = [];
    let cursor = null;
    let totalFetched = 0;
    let batchCount = 0;

    try {
      do {
        // 检查是否已取消
        if (this.abortController.signal.aborted) {
          break;
        }

        // 获取一批数据
        const response = await this.fetchBatch(cursor, includeValue);
        
        // 合并数据到总数组
        allRecords.push(...response.records);
        cursor = response.nextCursor;
        totalFetched += response.records.length;
        batchCount++;

        // 调用进度回调
        this.onProgress({
          phase: 'fetching',
          current: totalFetched,
          batchCount: batchCount,
          message: `已获取 ${totalFetched} 条记录...`
        });

      } while (cursor && !this.abortController.signal.aborted);

      // 如果是因为取消而退出循环，抛出取消错误
      if (this.abortController.signal.aborted) {
        throw ERROR_HANDLERS.ABORT();
      }

      return allRecords;
    } catch (error) {
      // 调用错误回调
      const batchError = error instanceof BatchOperationError 
        ? error 
        : createError(error);
      this.onError(batchError);
      throw batchError;
    }
  }

  /**
   * 获取单批数据
   * 
   * @param {string|null} cursor - 分页游标，首次请求为 null
   * @param {boolean} includeValue - 是否包含分块文件的 value 数据
   * @returns {Promise<Object>} 包含 records 和 nextCursor 的响应对象
   * @throws {BatchOperationError} 当请求失败时抛出
   */
  async fetchBatch(cursor, includeValue) {
    // 构建查询参数
    const params = new URLSearchParams();
    if (cursor) {
      params.set('cursor', cursor);
    }
    if (includeValue) {
      params.set('includeValue', 'true');
    }
    params.set('limit', String(this.batchSize));

    try {
      // 发送请求，传入 abort signal 支持取消
      const response = await fetchWithAuth(
        `/api/manage/batch/list?${params}`,
        { signal: this.abortController.signal }
      );

      // 检查响应状态
      if (!response.ok) {
        let errorDetails = '';
        try {
          const errorData = await response.json();
          errorDetails = errorData.error || '';
        } catch {
          // 忽略 JSON 解析错误
        }
        throw createError(response, errorDetails);
      }

      // 解析响应数据
      const data = await response.json();
      
      // 验证响应格式
      if (!data.success) {
        throw new BatchOperationError(
          data.error || '请求失败',
          'API_ERROR',
          true,
          '请稍后重试'
        );
      }

      return {
        records: data.records || [],
        nextCursor: data.nextCursor || null,
        totalProcessed: data.totalProcessed || 0
      };
    } catch (error) {
      // 如果已经是 BatchOperationError，直接抛出
      if (error instanceof BatchOperationError) {
        throw error;
      }
      // 否则转换为 BatchOperationError
      throw createError(error);
    }
  }

  /**
   * 取消当前操作
   * 调用此方法将中止正在进行的 fetch 请求
   */
  abort() {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /**
   * 检查操作是否已被取消
   * @returns {boolean}
   */
  isAborted() {
    return this.abortController ? this.abortController.signal.aborted : false;
  }

  /**
   * 重置处理器状态
   * 在开始新的批量操作前调用
   */
  reset() {
    this.abortController = null;
  }
}

export default BatchProcessor;
