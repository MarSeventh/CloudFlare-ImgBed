/**
 * BackupGenerator - 备份数据生成类
 * 
 * 处理前端辅助备份功能，获取所有文件记录（包含分块文件的 value），
 * 构建完整的备份 JSON 文件，并触发浏览器下载。
 */

import BatchProcessor from '@/utils/batchProcessor';
import fetchWithAuth from '@/utils/fetchWithAuth';
import packageInfo from '../../package.json'

/**
 * BackupGenerator 类
 * 
 * 用于生成和下载备份数据的类
 */
class BackupGenerator {
  /**
   * 创建 BackupGenerator 实例
   * @param {Object} options - 配置选项
   * @param {Function} options.onProgress - 进度回调函数
   */
  constructor(options = {}) {
    this.onProgress = options.onProgress || (() => {});
    this.processor = null;
  }

  /**
   * 生成并下载备份
   * 
   * 完整流程：
   * 1. 获取所有文件记录（包含分块文件的 value）
   * 2. 构建备份数据结构
   * 3. 获取系统设置
   * 4. 生成并触发下载
   * 
   * @returns {Promise<Object>} 包含 success 和 fileCount 的结果对象
   * @throws {Error} 当备份过程中发生错误时抛出
   */
  async generateBackup() {
    // 获取所有文件记录（包含分块文件的 value）
    this.processor = new BatchProcessor({
      onProgress: (p) => this.onProgress({ ...p, phase: 'fetching' })
    });

    const records = await this.processor.fetchAllRecords(true);

    // 构建备份数据
    this.onProgress({ phase: 'building', message: '正在构建备份数据...' });

    const backupData = {
      timestamp: Date.now(),
      version: packageInfo.version,
      data: {
        fileCount: records.length,
        files: {},
        settings: {}
      }
    };

    // 将记录转换为以 id 为键的对象格式
    for (const record of records) {
      backupData.data.files[record.id] = {
        metadata: record.metadata,
        value: record.value || null
      };
    }

    // 3. 获取系统设置
    const settings = await this.fetchSettings();
    backupData.data.settings = settings;

    // 生成下载
    this.onProgress({ phase: 'downloading', message: '正在生成下载...' });
    this.downloadBackup(backupData);

    const settingsCount = Object.keys(settings).length;
    return { success: true, fileCount: records.length, settingsCount };
  }

  /**
   * 获取系统设置
   * 
   * @returns {Promise<Object>} 系统设置对象，失败时返回空对象
   */
  async fetchSettings() {
    try {
      const response = await fetchWithAuth('/api/manage/batch/settings');
      if (!response.ok) {
        console.warn('Failed to fetch settings:', response.status);
        return {};
      }
      const data = await response.json();
      // 返回 settings 字段，而不是整个响应
      return data.settings || {};
    } catch (error) {
      console.warn('Failed to fetch settings:', error);
      return {};
    }
  }

  /**
   * 触发浏览器下载备份文件
   * 
   * @param {Object} data - 备份数据对象
   */
  downloadBackup(data) {
    // 将数据转换为格式化的 JSON 字符串
    const json = JSON.stringify(data, null, 2);
    
    // 创建 Blob 对象
    const blob = new Blob([json], { type: 'application/json' });
    
    // 创建下载 URL
    const url = URL.createObjectURL(blob);

    // 创建临时下载链接
    const a = document.createElement('a');
    a.href = url;
    // 使用日期作为文件名的一部分
    a.download = `imgbed_backup_${new Date().toISOString().split('T')[0]}.json`;
    
    // 触发下载
    document.body.appendChild(a);
    a.click();
    
    // 清理
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * 取消当前备份操作
   */
  abort() {
    if (this.processor) {
      this.processor.abort();
    }
  }

  /**
   * 检查操作是否已被取消
   * @returns {boolean}
   */
  isAborted() {
    return this.processor ? this.processor.isAborted() : false;
  }
}

export default BackupGenerator;
