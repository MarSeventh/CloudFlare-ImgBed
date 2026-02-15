<template>
  <div class="status-panel" v-loading="loading">
    <!-- 顶部概览卡片 -->
    <div class="overview-cards">
      <div class="overview-card total-files" @click="fetchIndexInfo">
        <div class="card-icon">
          <font-awesome-icon icon="database" />
        </div>
        <div class="card-content">
          <div class="card-title">文件总数</div>
          <div class="card-value">{{ indexInfo.totalFiles?.toLocaleString() || '0' }}</div>
          <div class="card-subtitle">点击刷新</div>
        </div>
      </div>

      <div class="overview-card index-status">
        <div class="card-icon">
          <font-awesome-icon icon="clock" />
        </div>
        <div class="card-content">
          <div class="card-title">索引更新时间</div>
          <div class="card-value">{{ formatTime(indexInfo.lastUpdated) }}</div>
          <div class="card-subtitle">{{ getTimeAgo(indexInfo.lastUpdated) }}</div>
        </div>
      </div>

      <div class="overview-card system-version" @click="openReleases">
        <div class="card-icon">
          <font-awesome-icon icon="code-branch" />
        </div>
        <div class="card-content">
          <div class="card-title">系统版本</div>
          <div class="card-value">v{{ version }}</div>
          <div class="card-subtitle">点击查看更新日志</div>
        </div>
      </div>
    </div>

    <!-- 统计图表区域 -->
    <div class="charts-section">
      <!-- 渠道统计 - 饼状图 -->
      <div class="chart-card">
        <div class="chart-header">
          <font-awesome-icon icon="share-alt" />
          <span>上传渠道分布</span>
        </div>
        <div class="chart-content">
          <div v-if="Object.keys(indexInfo.channelStats || {}).length === 0" class="empty-state">
            <font-awesome-icon icon="inbox" />
            <span>暂无数据</span>
          </div>
          <div v-else class="pie-chart-container">
            <div class="pie-chart-wrapper">
              <Doughnut :data="channelChartData" :options="chartOptions" />
              <div class="chart-center-text">
                <div class="center-value">{{ indexInfo.totalFiles?.toLocaleString() || '0' }}</div>
                <div class="center-label">文件总数</div>
              </div>
            </div>
            <div class="chart-legend">
              <div 
                v-for="(count, channel, index) in indexInfo.channelStats" 
                :key="channel"
                class="legend-item"
              >
                <span class="legend-color" :style="{ background: getChartColor(index) }"></span>
                <span class="legend-label">{{ channel }}</span>
                <span class="legend-value">{{ count.toLocaleString() }}</span>
                <span class="legend-percent">{{ getPercentage(count, indexInfo.totalFiles) }}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 文件类型统计 - 饼状图 -->
      <div class="chart-card">
        <div class="chart-header">
          <font-awesome-icon icon="file-alt" />
          <span>文件状态分布</span>
        </div>
        <div class="chart-content">
          <div v-if="Object.keys(indexInfo.typeStats || {}).length === 0" class="empty-state">
            <font-awesome-icon icon="inbox" />
            <span>暂无数据</span>
          </div>
          <div v-else class="pie-chart-container">
            <div class="pie-chart-wrapper">
              <Doughnut :data="typeChartData" :options="chartOptions" />
              <div class="chart-center-text">
                <div class="center-value">{{ Object.keys(indexInfo.typeStats).length }}</div>
                <div class="center-label">状态类型</div>
              </div>
            </div>
            <div class="chart-legend">
              <div 
                v-for="(count, status, index) in aggregatedTypeStats" 
                :key="status"
                class="legend-item"
              >
                <span class="legend-color" :style="{ background: getTypeChartColor(index) }"></span>
                <span class="legend-label">{{ status }}</span>
                <span class="legend-value">{{ count.toLocaleString() }}</span>
                <span class="legend-percent">{{ getPercentage(count, indexInfo.totalFiles) }}%</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 操作区域 -->
    <div class="actions-section">
      <div class="action-card">
        <div class="action-header">
          <font-awesome-icon icon="tools" />
          <span>系统维护</span>
        </div>
        <div class="action-content">
          <!-- 进度显示 UI (Requirements 3.6, 4.6, 9.1, 9.2) -->
          <div v-if="isProcessing" class="progress-container">
            <div class="progress-header">
              <span class="progress-phase">{{ phaseDescription }}</span>
              <span class="progress-percentage">{{ Math.round(processingProgress.percentage) }}%</span>
            </div>
            <el-progress 
              :percentage="processingProgress.percentage" 
              :stroke-width="12"
              :show-text="false"
              class="progress-bar"
            />
            <div class="progress-details">
              <!-- 当前/总数显示 (Requirement 9.1) -->
              <span class="progress-count" v-if="processingProgress.current > 0">
                <font-awesome-icon icon="file-alt" />
                {{ processingProgress.current.toLocaleString() }}
                <template v-if="processingProgress.total > 0">
                  / {{ processingProgress.total.toLocaleString() }}
                </template>
                条记录
              </span>
              <!-- 预计剩余时间 (Requirement 9.2) -->
              <span class="progress-time" v-if="estimatedTimeRemaining">
                <font-awesome-icon icon="clock" />
                {{ estimatedTimeRemaining }}
              </span>
            </div>
            <div class="progress-message" v-if="processingProgress.message">
              {{ processingProgress.message }}
            </div>
            <!-- 取消按钮 -->
            <el-button 
              type="danger" 
              plain
              size="small"
              @click="cancelOperation"
              class="cancel-btn"
            >
              <font-awesome-icon icon="times" />
              取消操作
            </el-button>
          </div>
          
          <!-- 错误显示 (Requirement 9.3) -->
          <div v-else-if="processingError" class="error-container">
            <div class="error-icon">
              <font-awesome-icon icon="exclamation-triangle" />
            </div>
            <div class="error-content">
              <div class="error-message">{{ processingError.message }}</div>
              <div class="error-suggestion" v-if="processingError.suggestion">
                {{ processingError.suggestion }}
              </div>
            </div>
            <div class="error-actions">
              <el-button 
                v-if="processingError.recoverable"
                type="primary" 
                size="small"
                @click="retryOperation"
              >
                <font-awesome-icon icon="redo" />
                重试
              </el-button>
              <el-button 
                type="default" 
                size="small"
                @click="dismissError"
              >
                关闭
              </el-button>
            </div>
          </div>
          
          <!-- 操作按钮 -->
          <div v-else class="action-buttons">
            <el-tooltip content="重新扫描所有文件并更新索引数据，适用于数据不一致时的修复" placement="top">
              <el-button 
                type="primary" 
                :loading="rebuilding"
                :disabled="isProcessing"
                @click="rebuildIndex"
                class="action-btn rebuild-btn"
              >
                <font-awesome-icon icon="sync-alt" />
                {{ rebuilding ? '重建中...' : '重建索引' }}
              </el-button>
            </el-tooltip>

            <el-tooltip content="备份所有文件元数据和系统设置到JSON文件" placement="top">
              <el-button 
                type="success" 
                :loading="backing"
                :disabled="isProcessing"
                @click="backupData"
                class="action-btn backup-btn"
              >
                <font-awesome-icon icon="download" />
                {{ backing ? '备份中...' : '备份数据' }}
              </el-button>
            </el-tooltip>

            <el-tooltip content="从备份文件恢复数据，将覆盖现有的文件元数据和系统设置" placement="top">
              <div class="restore-section">
                <input 
                  type="file" 
                  ref="fileInput" 
                  accept=".json"
                  @change="handleFileSelect"
                  style="display: none"
                />
                <el-button 
                  type="warning" 
                  :loading="restoring"
                  :disabled="isProcessing"
                  @click="selectRestoreFile"
                  class="action-btn restore-btn"
                >
                  <font-awesome-icon icon="upload" />
                  {{ restoring ? '恢复中...' : '恢复数据' }}
                </el-button>
              </div>
            </el-tooltip>
          </div>
        </div>
      </div>
    </div>

    <!-- 最新/最旧文件信息 -->
    <div class="file-info-section" v-if="indexInfo.newestFile || indexInfo.oldestFile">
      <!-- 最新上传 -->
      <div class="file-info-card info-card-newest" v-if="indexInfo.newestFile" @click="openFileInNewTab(indexInfo.newestFile)">
        <!-- 图片/视频背景 -->
        <el-image 
          v-if="isImageFile(indexInfo.newestFile) && !loadErrors['newest']"
          :src="'/file/' + indexInfo.newestFile.id + '?from=admin'"
          fit="cover"
          class="card-bg-media"
          @error="handleImageError('newest')"
        ></el-image>
        <video 
          v-else-if="isVideoFile(indexInfo.newestFile) && !loadErrors['newest']"
          :src="'/file/' + indexInfo.newestFile.id + '?from=admin'"
          class="card-bg-media"
          muted
          loop
          autoplay
          @error="handleImageError('newest')"
        ></video>
        <div v-else class="card-bg-fallback">
           <font-awesome-icon icon="file-alt" class="fallback-icon" />
        </div>
        
        <!-- 顶部标题浮层 -->
        <div class="file-card-header">
          <font-awesome-icon icon="arrow-up" />
          <span>最近上传</span>
        </div>
        
        <!-- 底部信息浮层 -->
        <div class="info-card-footer">
          <div class="file-name">
            {{ indexInfo.newestFile.metadata?.FileName || indexInfo.newestFile.id }}
          </div>
          <div class="file-meta">{{ formatTime(indexInfo.newestFile.metadata?.TimeStamp) }}</div>
        </div>
      </div>

      <!-- 最早上传 -->
      <div class="file-info-card info-card-oldest" v-if="indexInfo.oldestFile" @click="openFileInNewTab(indexInfo.oldestFile)">
        <!-- 图片/视频背景 -->
        <el-image 
          v-if="isImageFile(indexInfo.oldestFile) && !loadErrors['oldest']"
          :src="'/file/' + indexInfo.oldestFile.id + '?from=admin'"
          fit="cover"
          class="card-bg-media"
          @error="handleImageError('oldest')"
        ></el-image>
        <video 
          v-else-if="isVideoFile(indexInfo.oldestFile) && !loadErrors['oldest']"
          :src="'/file/' + indexInfo.oldestFile.id + '?from=admin'"
          class="card-bg-media"
          muted
          loop
          autoplay
          @error="handleImageError('oldest')"
        ></video>
        <div v-else class="card-bg-fallback">
           <font-awesome-icon icon="file-alt" class="fallback-icon" />
        </div>

        <!-- 顶部标题浮层 -->
        <div class="file-card-header warning">
          <font-awesome-icon icon="arrow-down" />
          <span>最早上传</span>
        </div>

        <!-- 底部信息浮层 -->
        <div class="info-card-footer">
          <div class="file-name">
            {{ indexInfo.oldestFile.metadata?.FileName || indexInfo.oldestFile.id }}
          </div>
          <div class="file-meta">{{ formatTime(indexInfo.oldestFile.metadata?.TimeStamp) }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import fetchWithAuth from '@/utils/fetchWithAuth'
import packageInfo from '../../../package.json'
import { Doughnut } from 'vue-chartjs'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import IndexRebuilder from '@/utils/indexRebuilder'
import BackupGenerator from '@/utils/backupGenerator'
import RestoreProcessor from '@/utils/restoreProcessor'

ChartJS.register(ArcElement, Tooltip, Legend)

export default {
  name: 'SysCogStatus',
  components: {
    Doughnut
  },
  data() {
    return {
      loading: false,
      rebuilding: false,
      backing: false,
      restoring: false,
      indexInfo: {},
      version: packageInfo.version, // 从package.json获取版本号
      loadErrors: {
        newest: false,
        oldest: false
      },
      // 渠道图表颜色
      channelColors: [
        '#8B5CF6', '#EC4899', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#6366F1', '#84CC16'
      ],
      // 状态图表颜色
      typeColors: [
        '#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'
      ],
      // 批量操作进度状态
      isProcessing: false,
      processingPhase: '', // fetching, sorting, uploading, finalizing, building, downloading, completed
      processingProgress: {
        current: 0,
        total: 0,
        message: '',
        percentage: 0
      },
      processingError: null,
      processingStartTime: null,
      // 当前处理器实例（用于取消操作）
      currentRebuilder: null,
      currentBackupGenerator: null,
      currentRestoreProcessor: null
    }
  },
  computed: {
    // 渠道分布图表数据
    channelChartData() {
      const stats = this.indexInfo.channelStats || {}
      return {
        labels: Object.keys(stats),
        datasets: [{
          data: Object.values(stats),
          backgroundColor: this.channelColors.slice(0, Object.keys(stats).length),
          borderWidth: 0
        }]
      }
    },
    // 文件状态图表数据 - 将Block映射为"已屏蔽"，其余为"正常"
    typeChartData() {
      const aggregatedStats = this.aggregatedTypeStats
      return {
        labels: Object.keys(aggregatedStats),
        datasets: [{
          data: Object.values(aggregatedStats),
          backgroundColor: this.typeColors.slice(0, Object.keys(aggregatedStats).length),
          borderWidth: 0
        }]
      }
    },
    // 聚合后的状态统计：Block -> 已屏蔽，其余 -> 正常
    aggregatedTypeStats() {
      const stats = this.indexInfo.typeStats || {}
      const aggregatedStats = {}
      for (const [status, count] of Object.entries(stats)) {
        const mappedStatus = status === 'Block' ? '已屏蔽' : '正常'
        aggregatedStats[mappedStatus] = (aggregatedStats[mappedStatus] || 0) + count
      }
      return aggregatedStats
    },
    // 图表配置
    chartOptions() {
      return {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '65%',
        hoverOffset: 8,
        layout: {
          padding: 10
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleColor: '#fff',
            bodyColor: '#fff',
            padding: 12,
            cornerRadius: 8,
            displayColors: true,
            z: 100,
            callbacks: {
              label: (context) => {
                const value = context.raw
                const total = context.dataset.data.reduce((a, b) => a + b, 0)
                const percentage = ((value / total) * 100).toFixed(1)
                return ` ${value.toLocaleString()} (${percentage}%)`
              }
            }
          }
        },
        animation: {
          animateRotate: true,
          animateScale: true
        }
      }
    },
    // 预计剩余时间（Requirements 9.2）
    estimatedTimeRemaining() {
      if (!this.isProcessing || !this.processingStartTime) return ''
      if (this.processingProgress.current === 0 || this.processingProgress.percentage === 0) return ''
      
      const elapsed = Date.now() - this.processingStartTime
      const progress = this.processingProgress.percentage / 100
      if (progress <= 0) return ''
      
      const totalEstimated = elapsed / progress
      const remaining = totalEstimated - elapsed
      
      if (remaining <= 0) return '即将完成'
      
      const seconds = Math.ceil(remaining / 1000)
      if (seconds < 60) return `约 ${seconds} 秒`
      const minutes = Math.ceil(seconds / 60)
      if (minutes < 60) return `约 ${minutes} 分钟`
      const hours = Math.floor(minutes / 60)
      const remainingMinutes = minutes % 60
      return `约 ${hours} 小时 ${remainingMinutes} 分钟`
    },
    // 处理阶段描述
    phaseDescription() {
      const phaseMap = {
        'fetching': '正在获取数据',
        'sorting': '正在排序',
        'uploading': '正在上传',
        'finalizing': '正在完成',
        'building': '正在构建备份',
        'downloading': '正在生成下载',
        'restoring_files': '正在恢复文件',
        'restoring_settings': '正在恢复设置',
        'completed': '已完成',
        'retrying': '正在重试'
      }
      return phaseMap[this.processingPhase] || this.processingPhase
    }
  },
  mounted() {
    this.fetchIndexInfo()
  },
  methods: {
    // 获取渠道图表颜色
    getChartColor(index) {
      return this.channelColors[index % this.channelColors.length]
    },
    // 获取状态图表颜色
    getTypeChartColor(index) {
      return this.typeColors[index % this.typeColors.length]
    },
    // 获取索引信息
    async fetchIndexInfo() {
      this.loading = true
      try {
        const response = await fetchWithAuth('/api/manage/list?action=info', {
          method: 'GET'
        })
        
        if (response.ok) {
          const data = await response.json()
          this.indexInfo = data
        } else {
          throw new Error('API请求失败')
        }
      } catch (error) {
        console.error('获取索引信息失败:', error)
        this.$message.error('获取索引信息失败')
      } finally {
        this.loading = false
      }
    },

    // 重建索引 - 使用前端辅助重建流程 (Requirements 3.6, 9.1, 9.2, 9.3, 9.4)
    async rebuildIndex() {
      if (this.isProcessing) {
        this.$message.warning('已有操作正在进行中')
        return
      }
      
      this.rebuilding = true
      this.isProcessing = true
      this.processingError = null
      this.processingStartTime = Date.now()
      this.processingProgress = { current: 0, total: 0, message: '', percentage: 0 }
      
      // 创建 IndexRebuilder 实例
      this.currentRebuilder = new IndexRebuilder({
        onProgress: (progress) => this.handleProgress(progress),
        onError: (error) => this.handleError(error)
      })
      
      try {
        const result = await this.currentRebuilder.rebuild()
        
        // 成功完成 (Requirement 9.4)
        this.$message.success(`索引重建完成！共处理 ${result.totalFiles.toLocaleString()} 个文件`)
        
        // 刷新索引信息
        setTimeout(() => {
          this.fetchIndexInfo()
        }, 1000)
      } catch (error) {
        // 错误处理 (Requirement 9.3)
        if (error.code !== 'ABORTED') {
          const errorMessage = error.suggestion 
            ? `${error.message}。${error.suggestion}`
            : error.message
          this.$message.error(errorMessage)
          this.processingError = {
            message: error.message,
            suggestion: error.suggestion,
            recoverable: error.recoverable
          }
        }
      } finally {
        this.rebuilding = false
        this.isProcessing = false
        this.currentRebuilder = null
        this.processingStartTime = null
      }
    },

    // 备份数据 - 使用前端辅助备份流程 (Requirements 4.6, 9.1, 9.2, 9.3, 9.4)
    async backupData() {
      if (this.isProcessing) {
        this.$message.warning('已有操作正在进行中')
        return
      }
      
      this.backing = true
      this.isProcessing = true
      this.processingError = null
      this.processingStartTime = Date.now()
      this.processingProgress = { current: 0, total: 0, message: '', percentage: 0 }
      
      // 创建 BackupGenerator 实例
      this.currentBackupGenerator = new BackupGenerator({
        onProgress: (progress) => this.handleProgress(progress)
      })
      
      try {
        const result = await this.currentBackupGenerator.generateBackup()
        
        // 成功完成 (Requirement 9.4)
        const settingsMsg = result.settingsCount > 0 ? `，${result.settingsCount} 个设置项` : ''
        this.$message.success(`备份完成！共备份 ${result.fileCount.toLocaleString()} 个文件${settingsMsg}`)
      } catch (error) {
        // 错误处理 (Requirement 9.3)
        if (error.code !== 'ABORTED') {
          const errorMessage = error.suggestion 
            ? `${error.message}。${error.suggestion}`
            : error.message
          this.$message.error(errorMessage)
          this.processingError = {
            message: error.message,
            suggestion: error.suggestion,
            recoverable: error.recoverable
          }
        }
      } finally {
        this.backing = false
        this.isProcessing = false
        this.currentBackupGenerator = null
        this.processingStartTime = null
      }
    },

    // 选择恢复文件
    selectRestoreFile() {
      if (this.restoring) return
      this.$refs.fileInput.click()
    },

    // 处理文件选择
    async handleFileSelect(event) {
      const file = event.target.files[0]
      if (!file) return

      if (!file.name.endsWith('.json')) {
        this.$message.error('请选择JSON格式的备份文件')
        return
      }

      // 确认恢复操作
      try {
        await this.$confirm(
          '恢复操作将覆盖现有的文件元数据和系统设置，此操作不可逆。确定要继续吗？',
          '确认恢复',
          {
            confirmButtonText: '确定恢复',
            cancelButtonText: '取消',
            type: 'warning'
          }
        )
        
        await this.restoreData(file)
      } catch (error) {
        if (error !== 'cancel') {
          console.error('确认恢复失败:', error)
        }
      }
      
      // 清除文件选择
      event.target.value = ''
    },

    // 恢复数据 - 使用前端辅助分批恢复流程
    async restoreData(file) {
      if (this.isProcessing) {
        this.$message.warning('已有操作正在进行中')
        return
      }

      this.restoring = true
      this.isProcessing = true
      this.processingError = null
      this.processingStartTime = Date.now()
      this.processingProgress = { current: 0, total: 0, message: '', percentage: 0 }

      try {
        // 解析备份文件
        const fileContent = await file.text()
        let backupData
        try {
          backupData = JSON.parse(fileContent)
        } catch (parseError) {
          throw new Error('备份文件格式无效，请选择有效的 JSON 文件')
        }

        // 创建 RestoreProcessor 实例
        this.currentRestoreProcessor = new RestoreProcessor({
          chunkSize: 100, // 每批恢复 100 条
          onProgress: (progress) => this.handleProgress(progress),
          onError: (error) => this.handleError(error)
        })

        const result = await this.currentRestoreProcessor.restore(backupData)

        // 恢复完成，重置恢复状态
        this.restoring = false
        this.isProcessing = false
        this.currentRestoreProcessor = null
        this.processingStartTime = null

        // 显示恢复成功消息
        this.$message.success(
          `恢复完成！已恢复 ${result.restoredFiles} 个文件和 ${result.restoredSettings} 个设置项，正在重建索引...`
        )

        // 短暂延迟后自动开始重建索引
        await new Promise(resolve => setTimeout(resolve, 500))
        await this.rebuildIndex()
      } catch (error) {
        console.error('恢复数据失败:', error)
        
        // 出错时重置状态
        this.restoring = false
        this.isProcessing = false
        this.currentRestoreProcessor = null
        this.processingStartTime = null
        
        if (error.code !== 'ABORTED') {
          const errorMessage = error.suggestion
            ? `${error.message}。${error.suggestion}`
            : error.message
          this.$message.error('恢复数据失败: ' + errorMessage)
          this.processingError = {
            message: error.message,
            suggestion: error.suggestion,
            recoverable: error.recoverable
          }
        }
      }
    },

    // 格式化时间
    formatTime(timestamp) {
      if (!timestamp) return '未知'
      const date = new Date(timestamp)
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    },

    // 计算百分比
    getPercentage(value, total) {
      if (!total || total === 0) return 0
      return Math.round((value / total) * 100)
    },

    // 计算时间差
    getTimeAgo(timestamp) {
      if (!timestamp) return ''
      const now = Date.now()
      const diff = now - timestamp
      const minutes = Math.floor(diff / 60000)
      const hours = Math.floor(diff / 3600000)
      const days = Math.floor(diff / 86400000)
      
      if (days > 0) return `${days}天前`
      if (hours > 0) return `${hours}小时前`
      if (minutes > 0) return `${minutes}分钟前`
      return '刚刚'
    },
    
    // 图片加载失败处理
    handleImageError(type) {
      this.loadErrors[type] = true
    },
    
    // 检查是否应该显示预览图
    isValidPreview(type, file) {
      if (this.loadErrors[type]) return false
      if (!file?.metadata?.FileType) return false
      return file.metadata.FileType.includes('image') || file.metadata.FileType.includes('video')
    },
    
    // 打开发布页面
    openReleases() {
      window.open('https://github.com/MarSeventh/CloudFlare-ImgBed/releases', '_blank')
    },
    
    // 判断是否为图片文件
    isImageFile(file) {
      if (!file) return false
      // 优先通过 FileType 判断
      if (file.metadata?.FileType?.includes('image')) return true
      // 通过文件名后缀判断
      const fileName = file.metadata?.FileName || file.id || ''
      const extension = fileName.substring(fileName.lastIndexOf('.') + 1).toLowerCase()
      const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'ico', 'tiff', 'tif', 'avif', 'heic', 'heif']
      return imageExtensions.includes(extension)
    },
    
    // 判断是否为视频文件
    isVideoFile(file) {
      if (!file) return false
      // 优先通过 FileType 判断
      if (file.metadata?.FileType?.includes('video')) return true
      // 通过文件名后缀判断
      const fileName = file.metadata?.FileName || file.id || ''
      const extension = fileName.substring(fileName.lastIndexOf('.') + 1).toLowerCase()
      const videoExtensions = ['mp4', 'webm', 'ogg', 'avi', 'mov', 'flv', 'wmv', 'mkv', 'm4v', '3gp', 'mpeg', 'mpg']
      return videoExtensions.includes(extension)
    },
    
    // 在新窗口打开文件
    openFileInNewTab(file) {
      if (!file?.id) return
      window.open('/file/' + file.id, '_blank')
    },
    
    // 处理进度更新 (Requirements 3.6, 4.6, 9.1, 9.2)
    handleProgress(progress) {
      this.processingPhase = progress.phase
      this.processingProgress.message = progress.message || ''
      this.processingProgress.current = progress.current || 0
      
      // 根据不同阶段计算进度百分比
      if (progress.phase === 'fetching') {
        // 获取阶段：基于已获取的记录数估算（假设总数未知时显示已获取数量）
        this.processingProgress.total = progress.total || 0
        // 获取阶段占总进度的 60%
        if (progress.total && progress.total > 0) {
          this.processingProgress.percentage = Math.min(60, (progress.current / progress.total) * 60)
        } else {
          // 未知总数时，使用对数增长模拟进度
          this.processingProgress.percentage = Math.min(50, Math.log10(progress.current + 1) * 15)
        }
      } else if (progress.phase === 'sorting') {
        // 排序阶段：占 60-70%
        this.processingProgress.percentage = 65
        this.processingProgress.total = progress.total || this.processingProgress.total
      } else if (progress.phase === 'uploading') {
        // 上传阶段：占 70-95%
        this.processingProgress.total = progress.total || 0
        if (progress.total && progress.total > 0) {
          this.processingProgress.percentage = 70 + (progress.current / progress.total) * 25
        }
      } else if (progress.phase === 'finalizing') {
        // 完成阶段：95-100%
        this.processingProgress.percentage = 97
      } else if (progress.phase === 'building') {
        // 构建备份阶段：70-90%
        this.processingProgress.percentage = 80
      } else if (progress.phase === 'downloading') {
        // 下载阶段：90-100%
        this.processingProgress.percentage = 95
      } else if (progress.phase === 'restoring_files') {
        // 恢复文件阶段：0-80%
        this.processingProgress.total = progress.total || 0
        this.processingProgress.percentage = progress.percentage || 0
      } else if (progress.phase === 'restoring_settings') {
        // 恢复设置阶段：80-100%
        this.processingProgress.total = progress.total || 0
        this.processingProgress.percentage = progress.percentage || 80
      } else if (progress.phase === 'completed') {
        // 完成
        this.processingProgress.percentage = 100
      } else if (progress.phase === 'retrying') {
        // 重试阶段：保持当前进度
        this.processingProgress.message = progress.message
      }
    },
    
    // 处理错误 (Requirement 9.3)
    handleError(error) {
      console.error('批量操作错误:', error)
      this.processingError = {
        message: error.message,
        suggestion: error.suggestion,
        recoverable: error.recoverable
      }
    },
    
    // 取消当前操作 (Requirement 2.4)
    cancelOperation() {
      if (this.currentRebuilder) {
        this.currentRebuilder.abort()
        this.$message.info('正在取消索引重建...')
      }
      if (this.currentBackupGenerator) {
        this.currentBackupGenerator.abort()
        this.$message.info('正在取消备份...')
      }
      if (this.currentRestoreProcessor) {
        this.currentRestoreProcessor.abort()
        this.$message.info('正在取消恢复...')
      }
    },
    
    // 重试操作
    retryOperation() {
      this.processingError = null
      if (this.rebuilding) {
        this.rebuilding = false
        this.isProcessing = false
        this.$nextTick(() => {
          this.rebuildIndex()
        })
      } else if (this.backing) {
        this.backing = false
        this.isProcessing = false
        this.$nextTick(() => {
          this.backupData()
        })
      }
    },
    
    // 关闭错误提示
    dismissError() {
      this.processingError = null
    }
  }
}
</script>

<style scoped>
.status-panel {
  padding: 20px;
  background: transparent;
  min-height: 100vh;
}

/* 概览卡片 */
.overview-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.overview-card {
  background: var(--glass-bg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-radius: 16px;
  padding: 24px;
  display: flex;
  align-items: center;
  box-shadow: var(--glass-shadow);
  transition: all 0.3s ease;
  border: 1px solid var(--glass-border);
  cursor: pointer;
}

.overview-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--glass-shadow-hover);
  background: var(--glass-bg-hover);
}

.card-icon {
  width: 60px;
  height: 60px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  margin-right: 20px;
  background: linear-gradient(135deg, #60A5FA, #93C5FD);
  color: white;
}

.card-content {
  flex: 1;
}

.card-title {
  font-size: 14px;
  color: #666;
  margin-bottom: 8px;
  font-weight: 500;
}

.card-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--admin-container-color);
  line-height: 1;
}

.card-subtitle {
  font-size: 11px;
  color: #999;
  margin-top: 4px;
  opacity: 0.8;
}

/* 图表区域 */
.charts-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
  overflow: visible;
}

.chart-card {
  background: var(--glass-bg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-radius: 16px;
  padding: 24px;
  box-shadow: var(--glass-shadow);
  transition: all 0.3s ease;
  border: 1px solid var(--glass-border);
}

.chart-card:hover {
  box-shadow: var(--glass-shadow-hover);
  background: var(--glass-bg-hover);
}

.chart-card,
.chart-content,
.pie-chart-container,
.pie-chart-wrapper {
  overflow: visible;
}

.chart-header {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 20px;
  font-size: 16px;
  font-weight: 600;
  color: var(--admin-container-color);
}

.chart-header .fa-icon {
  margin-right: 10px;
  color: var(--admin-purple);
}

.chart-content {
  min-height: 160px;
  padding: 15px;
  margin: -5px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 160px;
  color: #999;
  font-size: 14px;
}

.empty-state .fa-icon {
  font-size: 32px;
  margin-bottom: 10px;
}

.stats-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stats-item {
  display: flex;
  align-items: center;
  gap: 12px;
}

.stats-label {
  min-width: 80px;
  font-size: 13px;
  color: #666;
  font-weight: 500;
}

.stats-bar {
  flex: 1;
  height: 8px;
  background: #f0f0f0;
  border-radius: 4px;
  overflow: hidden;
}

.stats-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--admin-purple), #E1BEE7);
  border-radius: 4px;
  transition: width 0.6s ease;
}

.type-fill {
  background: linear-gradient(90deg, #4CAF50, #81C784);
}

.stats-value {
  min-width: 50px;
  text-align: right;
  font-size: 13px;
  font-weight: 600;
  color: var(--admin-container-color);
}

/* 饼状图样式 */
.pie-chart-container {
  display: flex;
  align-items: center;
  gap: 24px;
  flex-wrap: wrap;
  justify-content: center;
}

.pie-chart-wrapper {
  position: relative;
  width: 180px;
  height: 180px;
  flex-shrink: 0;
  padding: 15px;
  box-sizing: content-box;
  overflow: visible;
  isolation: isolate;
}

.chart-center-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  text-align: center;
  pointer-events: none;
  z-index: -1;
}

.center-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--admin-container-color);
  line-height: 1.2;
}

.center-label {
  font-size: 11px;
  color: #888;
  margin-top: 2px;
}

.chart-legend {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
  min-width: 180px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: rgba(0, 0, 0, 0.03);
  border-radius: 8px;
  transition: all 0.2s ease;
}

.legend-item:hover {
  background: rgba(0, 0, 0, 0.06);
  transform: translateX(4px);
}

html.dark .legend-item {
  background: rgba(255, 255, 255, 0.05);
}

html.dark .legend-item:hover {
  background: rgba(255, 255, 255, 0.1);
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  flex-shrink: 0;
}

.legend-label {
  flex: 1;
  font-size: 13px;
  color: var(--admin-container-color);
  font-weight: 500;
}

.legend-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--admin-container-color);
  min-width: 50px;
  text-align: right;
}

.legend-percent {
  font-size: 12px;
  color: #888;
  min-width: 40px;
  text-align: right;
}

/* 操作区域 */
.actions-section {
  margin-bottom: 30px;
}

.action-card {
  background: var(--glass-bg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-radius: 16px;
  padding: 24px;
  box-shadow: var(--glass-shadow);
  border: 1px solid var(--glass-border);
  transition: all 0.3s ease;
}

.action-card:hover {
  box-shadow: var(--glass-shadow-hover);
  background: var(--glass-bg-hover);
}

.action-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 3px;
  font-size: 16px;
  font-weight: 600;
  color: var(--admin-container-color);
}

.action-header .fa-icon {
  margin-right: 10px;
  color: var(--admin-purple);
}

.action-content {
  display: flex;
  justify-content: center;
  padding: 20px 0;
}

.action-buttons {
  display: flex;
  gap: 20px;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  width: 100%;
}

.action-btn {
  border: none;
  border-radius: 14px;
  padding: 14px 28px;
  margin-left: 0;
  font-weight: 600;
  font-size: 14px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  min-width: 150px;
  width: 150px;
  height: 52px;
  position: relative;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

@media (max-width: 768px) {
  .action-btn {
    flex: 1;
    width: auto;
    min-width: 0;
    height: auto;
  }
}

.action-btn::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transition: left 0.5s ease;
}

.action-btn:hover::before {
  left: 100%;
}

.action-btn:hover {
  transform: translateY(-3px);
}

.action-btn:active {
  transform: translateY(-1px);
}

.action-btn .fa-icon {
  margin-right: 10px;
  font-size: 15px;
}

.rebuild-btn {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
}

.rebuild-btn:hover {
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.45);
  background: linear-gradient(135deg, #5a6fd6 0%, #6a4190 100%);
}

.backup-btn {
  background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
  color: #fff;
}

.backup-btn:hover {
  box-shadow: 0 8px 24px rgba(17, 153, 142, 0.45);
  background: linear-gradient(135deg, #0f8a80 0%, #32d970 100%);
}

.restore-btn {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  color: #fff;
}

.restore-btn:hover {
  box-shadow: 0 8px 24px rgba(245, 87, 108, 0.45);
  background: linear-gradient(135deg, #e085eb 0%, #e04d61 100%);
}

.restore-section {
  display: inline-block;
}

@media (max-width: 768px) {
  .action-buttons > .el-tooltip,
  .action-buttons > .restore-section,
  .restore-section {
    flex: 1;
    width: 100%;
  }
  
  .action-btn {
    width: 100% !important;
    padding: 10px 20px !important;
    box-sizing: border-box;
  }
}

/* 文件信息区域 */
.file-info-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  align-items: stretch;
}

.file-info-card {
  position: relative;
  background: var(--glass-bg);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-radius: 16px;
  box-shadow: var(--glass-shadow);
  border: 1px solid var(--glass-border);
  transition: all 0.3s ease;
  height: 300px;
  overflow: hidden;
  cursor: pointer;
}

/* 图片/视频占满整个卡片 */
.card-bg-media {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.5s ease;
  display: block;
}

/* 确保 el-image 内部图片撑满容器 */
.card-bg-media:deep(.el-image__inner) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.card-bg-media:deep(.el-image__wrapper) {
  width: 100%;
  height: 100%;
}

.card-bg-fallback {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: var(--admin-dashborad-stats-bg-color);
  display: flex;
  align-items: center;
  justify-content: center;
}

.fallback-icon {
  font-size: 80px;
  color: var(--el-text-color-placeholder);
  opacity: 0.3;
}

/* 文件卡片标题 - 浮层在顶部 */
.file-card-header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 12px 16px;
  font-size: 14px;
  font-weight: 600;
  color: white;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.6), transparent);
  z-index: 2;
}

.file-card-header .fa-icon {
  color: #60A5FA;
}

.file-card-header.warning .fa-icon {
  color: #F59E0B;
}

/* 底部文件信息 - 浮层在底部 */
.info-card-footer {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 12px 16px;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.7), transparent);
  text-align: center;
  z-index: 2;
}

.info-card-footer .file-name {
  font-size: 14px;
  color: white;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

.info-card-footer .file-meta {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.8);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
}

/* 大屏幕上增大图片卡片高度 */
@media (min-width: 1200px) {
  .file-info-card {
    height: 400px;
  }
}

@media (min-width: 1600px) {
  .file-info-card {
    height: 450px;
  }
}

.file-info-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--glass-shadow-hover);
}

.file-info-card:hover .card-bg-media {
  transform: scale(1.05);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .status-panel {
    padding: 15px;
  }
  
  .overview-cards {
    grid-template-columns: 1fr;
    gap: 15px;
  }
  
  .charts-section {
    grid-template-columns: 1fr;
    gap: 15px;
  }
  
  .file-info-section {
    grid-template-columns: 1fr;
    gap: 15px;
  }
  
  .card-icon {
    width: 50px;
    height: 50px;
    font-size: 20px;
    margin-right: 15px;
  }
  
  .card-value {
    font-size: 24px;
  }

  .action-buttons {
    flex-direction: column;
    gap: 12px;
  }

  .action-btn {
    width: 100%;
    min-width: unset;
  }
}

/* 加载动画 */
.stats-fill {
  animation: fillAnimation 1s ease-out;
}

@keyframes fillAnimation {
  from {
    width: 0;
  }
}

/* 进度显示样式 (Requirements 3.6, 4.6, 9.1, 9.2) */
.progress-container {
  width: 100%;
  padding: 20px;
  text-align: center;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.progress-phase {
  font-size: 16px;
  font-weight: 600;
  color: var(--admin-container-color);
}

.progress-percentage {
  font-size: 18px;
  font-weight: 700;
  color: var(--admin-purple);
}

.progress-bar {
  margin-bottom: 16px;
}

.progress-bar :deep(.el-progress-bar__outer) {
  background-color: rgba(139, 92, 246, 0.1);
  border-radius: 6px;
}

.progress-bar :deep(.el-progress-bar__inner) {
  background: linear-gradient(90deg, var(--admin-purple), #E1BEE7);
  border-radius: 6px;
  transition: width 0.3s ease;
}

.progress-details {
  display: flex;
  justify-content: center;
  gap: 24px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.progress-count,
.progress-time {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: #666;
}

.progress-count .fa-icon,
.progress-time .fa-icon {
  color: var(--admin-purple);
  font-size: 12px;
}

.progress-message {
  font-size: 13px;
  color: #888;
  margin-bottom: 16px;
  min-height: 20px;
}

.cancel-btn {
  margin-top: 12px;
  border-radius: 10px;
  padding: 10px 24px;
  font-weight: 600;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #EF4444;
}

.cancel-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.5);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(239, 68, 68, 0.25);
}

.cancel-btn .fa-icon {
  margin-right: 8px;
}

/* 错误显示样式 (Requirement 9.3) */
.error-container {
  width: 100%;
  padding: 20px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  background: rgba(239, 68, 68, 0.05);
  border-radius: 12px;
  border: 1px solid rgba(239, 68, 68, 0.2);
}

.error-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(239, 68, 68, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #EF4444;
  font-size: 24px;
}

.error-content {
  text-align: center;
}

.error-message {
  font-size: 15px;
  font-weight: 600;
  color: #EF4444;
  margin-bottom: 8px;
}

.error-suggestion {
  font-size: 13px;
  color: #666;
}

.error-actions {
  display: flex;
  gap: 12px;
}

.error-actions .el-button {
  border-radius: 10px;
  padding: 10px 24px;
  font-weight: 600;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  min-width: 100px;
}

.error-actions .el-button--primary {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border: none;
  color: #fff;
}

.error-actions .el-button--primary:hover {
  background: linear-gradient(135deg, #5a6fd6 0%, #6a4190 100%);
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(102, 126, 234, 0.4);
}

.error-actions .el-button--default {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: var(--el-text-color-regular);
}

.error-actions .el-button--default:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.error-actions .fa-icon {
  margin-right: 8px;
}

/* 暗色模式适配 */
html.dark .progress-count,
html.dark .progress-time {
  color: #aaa;
}

html.dark .progress-message {
  color: #999;
}

html.dark .error-container {
  background: rgba(239, 68, 68, 0.1);
  border-color: rgba(239, 68, 68, 0.3);
}

html.dark .error-suggestion {
  color: #aaa;
}

/* 响应式适配 */
@media (max-width: 768px) {
  .progress-container,
  .error-container {
    padding: 16px;
  }
  
  .progress-header {
    flex-direction: column;
    gap: 8px;
    text-align: center;
  }
  
  .progress-details {
    flex-direction: column;
    gap: 8px;
  }
  
  .error-actions {
    flex-direction: column;
    width: 100%;
  }
  
  .error-actions .el-button {
    width: 100%;
    margin: 0;
  }
}
</style>
