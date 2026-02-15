<template>
    <div class="history-container" :class="{ 'active': show }">
        <div class="history-header">
            <div class="header-left">
                <h2>历史记录</h2>
                <span class="record-count">共 {{ totalCount }} 条</span>
            </div>
            <div class="header-right">
                <el-tooltip content="切换视图" placement="bottom">
                    <el-button circle @click="toggleViewMode">
                        <font-awesome-icon :icon="viewMode === 'grid' ? 'list' : 'th-large'" />
                    </el-button>
                </el-tooltip>
                <el-tooltip content="清空记录" placement="bottom">
                    <el-button circle type="danger" @click="clearHistory">
                        <font-awesome-icon icon="trash-alt" />
                    </el-button>
                </el-tooltip>
                <el-button circle @click="$emit('close')">
                    <font-awesome-icon icon="times" />
                </el-button>
            </div>
        </div>
        
        <div class="history-content" v-if="historyList.length > 0" ref="historyContent" @scroll="handleScroll">
            <div v-for="group in groupedHistory" :key="group.date" class="history-group">
                <div class="timeline-header">
                    <div class="timeline-dot"></div>
                    <span class="date-label">{{ group.date }}</span>
                </div>

                <!-- Grid View -->
                <div v-if="viewMode === 'grid'" class="grid-view">
                    <div v-for="item in group.items" :key="item.time" class="grid-item">
                        <div class="grid-preview">
                            <img v-if="isImage(item.name)" :src="item.url" loading="lazy" @error="handleImageError" />
                            <video v-else-if="isVideo(item.name)" :src="item.url" muted></video>
                            <div v-else class="file-icon-wrapper">
                                <font-awesome-icon icon="file" class="file-icon" />
                            </div>
                            <div class="grid-overlay">
                                <div class="grid-actions">
                                    <el-button circle size="default" type="primary" @click="copyLink(item.url)">
                                        <font-awesome-icon icon="copy" />
                                    </el-button>
                                    <el-button circle size="default" class="action-btn-view" @click="openLink(item.url)">
                                        <font-awesome-icon icon="external-link-alt" />
                                    </el-button>
                                    <el-button circle size="default" type="danger" @click="deleteItem(item)">
                                        <font-awesome-icon icon="trash-alt" />
                                    </el-button>
                                </div>
                            </div>
                        </div>
                        <div class="grid-info">
                            <div class="file-name" :title="item.name">{{ item.name }}</div>
                            <div class="upload-time">{{ formatTime(item.time) }}</div>
                        </div>
                    </div>
                </div>

                <!-- List View -->
                <div v-else class="list-view">
                    <div v-for="item in group.items" :key="item.time" class="list-item">
                        <div class="list-preview">
                            <img v-if="isImage(item.name)" :src="item.url" loading="lazy" @error="handleImageError" />
                            <video v-else-if="isVideo(item.name)" :src="item.url" muted></video>
                            <div v-else class="file-icon-wrapper-small">
                                <font-awesome-icon icon="file" />
                            </div>
                        </div>
                        <div class="list-info">
                            <div class="file-name" :title="item.name">{{ item.name }}</div>
                            <div class="file-url" :title="item.url">{{ item.url }}</div>
                        </div>
                        <div class="list-meta">
                            <div class="upload-time">{{ formatTime(item.time) }}</div>
                        </div>
                        <div class="list-actions">
                            <el-button circle size="small" type="primary" @click="copyLink(item.url)">
                                <font-awesome-icon icon="copy" />
                            </el-button>
                            <el-button circle size="small" class="action-btn-view" @click="openLink(item.url)">
                                <font-awesome-icon icon="external-link-alt" />
                            </el-button>
                            <el-button circle size="small" type="danger" @click="deleteItem(item)">
                                <font-awesome-icon icon="trash-alt" />
                            </el-button>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- 加载更多提示 -->
            <div v-if="hasMore" class="load-more-container">
                <div v-if="loadingMore" class="loading-indicator">
                    <font-awesome-icon icon="spinner" spin />
                    <span>加载中...</span>
                </div>
                <div v-else class="load-more-hint">下拉加载更多</div>
            </div>
            <div v-else-if="historyList.length > 0" class="no-more-hint">没有更多记录了</div>
        </div>
        
        <div v-else class="empty-state">
            <font-awesome-icon icon="history" class="empty-icon" />
            <p>暂无上传记录</p>
        </div>
    </div>
</template>

<script>
export default {
    name: 'UploadHistory',
    props: {
        show: {
            type: Boolean,
            default: false
        }
    },
    data() {
        return {
            historyList: [],
            allHistory: [], // 完整历史记录
            viewMode: 'grid', // 'grid' or 'list'
            pageSize: 30, // 每次加载数量
            currentPage: 0,
            loadingMore: false,
            totalCount: 0,
        }
    },
    watch: {
        show(val) {
            if (val) {
                this.resetAndLoad()
            }
        }
    },
    computed: {
        hasMore() {
            return this.historyList.length < this.totalCount
        },
        groupedHistory() {
            const groups = {}
            this.historyList.forEach(item => {
                const date = new Date(item.time)
                const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
                if (!groups[dateStr]) {
                    groups[dateStr] = []
                }
                groups[dateStr].push(item)
            })
            
            // Sort dates descending
            return Object.keys(groups).sort((a, b) => new Date(b) - new Date(a)).map(date => ({
                date,
                items: groups[date]
            }))
        }
    },
    mounted() {
        // Load view mode preference
        const savedMode = localStorage.getItem('historyViewMode')
        if (savedMode) {
            this.viewMode = savedMode
        }
    },
    methods: {
        resetAndLoad() {
            this.historyList = []
            this.currentPage = 0
            this.loadAllHistory()
            this.loadMore()
        },
        loadAllHistory() {
            try {
                const history = JSON.parse(localStorage.getItem('uploadHistory') || '[]')
                // Sort by time desc
                this.allHistory = history.sort((a, b) => b.time - a.time)
                this.totalCount = this.allHistory.length
            } catch (e) {
                console.error('Failed to load history', e)
                this.allHistory = []
                this.totalCount = 0
            }
        },
        loadMore() {
            if (this.loadingMore || !this.hasMore) return
            
            this.loadingMore = true
            
            // 模拟异步加载，避免阻塞UI
            setTimeout(() => {
                const start = this.currentPage * this.pageSize
                const end = start + this.pageSize
                const newItems = this.allHistory.slice(start, end)
                
                this.historyList = [...this.historyList, ...newItems]
                this.currentPage++
                this.loadingMore = false
            }, 50)
        },
        handleScroll(e) {
            const container = e.target
            const scrollTop = container.scrollTop
            const scrollHeight = container.scrollHeight
            const clientHeight = container.clientHeight
            
            // 距离底部 100px 时加载更多
            if (scrollHeight - scrollTop - clientHeight < 100) {
                this.loadMore()
            }
        },
        toggleViewMode() {
            this.viewMode = this.viewMode === 'grid' ? 'list' : 'grid'
            localStorage.setItem('historyViewMode', this.viewMode)
        },
        clearHistory() {
            this.$confirm('确定要清空所有上传记录吗？', '提示', {
                confirmButtonText: '确定',
                cancelButtonText: '取消',
                type: 'warning'
            }).then(() => {
                this.historyList = []
                this.allHistory = []
                this.totalCount = 0
                this.currentPage = 0
                localStorage.removeItem('uploadHistory')
                this.$message.success('记录已清空')
            }).catch(() => {})
        },
        deleteItem(item) {
            this.$confirm('确定要删除这条记录吗？', '提示', {
                confirmButtonText: '确定',
                cancelButtonText: '取消',
                type: 'warning'
            }).then(() => {
                // Remove from lists
                this.historyList = this.historyList.filter(i => i.time !== item.time)
                this.allHistory = this.allHistory.filter(i => i.time !== item.time)
                this.totalCount = this.allHistory.length
                
                // Update localStorage
                try {
                    localStorage.setItem('uploadHistory', JSON.stringify(this.allHistory))
                    this.$message.success('记录已删除')
                } catch (e) {
                    console.error('Failed to update history', e)
                }
            }).catch(() => {})
        },
        isImage(fileName) {
            const imageExtensions = [
                'jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg', 'tiff', 'ico', 'avif', 'heic',
                'jfif', 'pjpeg', 'pjp'
            ];
            const extension = fileName ? fileName.split('.').pop().toLowerCase() : '';
            return imageExtensions.includes(extension);
        },
        isVideo(fileName) {
            const videoExtensions = ['mp4', 'webm', 'ogg', 'mkv'];
            const extension = fileName ? fileName.split('.').pop().toLowerCase() : '';
            return videoExtensions.includes(extension);
        },
        formatTime(timestamp) {
            const date = new Date(timestamp)
            const year = date.getFullYear()
            const month = String(date.getMonth() + 1).padStart(2, '0')
            const day = String(date.getDate()).padStart(2, '0')
            const hours = String(date.getHours()).padStart(2, '0')
            const minutes = String(date.getMinutes()).padStart(2, '0')
            const seconds = String(date.getSeconds()).padStart(2, '0')
            return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
        },
        copyLink(url) {
            navigator.clipboard.writeText(url).then(() => {
                this.$message.success('链接已复制')
            }).catch(() => {
                this.$message.error('复制失败')
            })
        },
        openLink(url) {
            window.open(url, '_blank')
        },
        handleImageError(e) {
            e.target.src = require('@/assets/404.png')
        }
    }
}
</script>

<style scoped>
.history-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 2000;
    display: flex;
    flex-direction: column;
    color: var(--upload-text-color);
    /* 初始状态：从右上角的小圆开始 */
    clip-path: circle(0% at calc(100% - 200px) 50px);
    opacity: 0;
    transition: 
        clip-path 0.6s cubic-bezier(0.4, 0, 0.2, 1),
        opacity 0.3s ease;
}

/* 使用伪元素处理背景模糊，避免与内容渲染冲突导致闪烁 */
.history-container::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    backdrop-filter: blur(20px);
    background: var(--admin-container-bg-color);
    z-index: -1;
    /* 强制创建独立的合成层，提升渲染稳定性 */
    will-change: transform;
    transform: translateZ(0);
}

.history-container.active {
    clip-path: circle(150% at calc(100% - 200px) 50px);
    opacity: 1;
}

.history-header {
    padding: 20px 40px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--el-border-color-lighter);
}

.header-left {
    display: flex;
    align-items: baseline;
    gap: 15px;
}

.header-left h2 {
    margin: 0;
    font-size: 24px;
    background: var(--upload-main-title-color);
    background-size: 200% auto;
    background-clip: text;
    -webkit-background-clip: text;
    color: transparent;
    font-weight: 700;
}

.record-count {
    color: var(--upload-text-color);
    font-size: 14px;
    opacity: 0.8;
}

.header-right {
    display: flex;
    gap: 10px;
}

.header-right .el-button {
    background-color: var(--toolbar-button-bg-color);
    box-shadow: var(--toolbar-button-shadow);
    backdrop-filter: blur(10px);
    border: none;
    color: var(--theme-toggle-color);
    transition: all 0.3s ease;
}

.header-right .el-button:hover {
    transform: scale(1.05);
    box-shadow: var(--toolbar-button-shadow-hover);
}

.header-right .el-button.el-button--danger {
    background: linear-gradient(135deg, #ff6b6b, #ee5a5a);
    color: #fff;
}

.history-content {
    flex: 1;
    overflow-y: auto;
    padding: 20px 40px;
}

/* Grid View */
.grid-view {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 20px;
}

.grid-item {
    background: var(--toolbar-button-bg-color);
    border-radius: 12px;
    overflow: hidden;
    box-shadow: var(--toolbar-button-shadow);
    transition: transform 0.3s ease, box-shadow 0.3s ease;
    border: none;
    backdrop-filter: blur(10px);
}

.grid-item:hover {
    transform: translateY(-5px);
    box-shadow: var(--toolbar-button-shadow-hover);
}

.grid-preview {
    height: 160px;
    position: relative;
    background: var(--el-fill-color-light);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
}

.grid-preview img, .grid-preview video {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.file-icon-wrapper {
    font-size: 48px;
    color: var(--theme-toggle-color);
    opacity: 0.5;
}

.grid-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.3s ease;
}

.grid-item:hover .grid-overlay {
    opacity: 1;
}

.grid-actions {
    display: flex;
    gap: 15px;
}

.grid-actions .el-button {
    backdrop-filter: blur(10px);
}

.grid-info {
    padding: 12px;
}

.file-name {
    font-size: 14px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    margin-bottom: 5px;
    color: var(--upload-text-color);
}

.upload-time {
    font-size: 12px;
    color: var(--upload-text-color);
    opacity: 0.6;
}

/* List View */
.list-view {
    display: flex;
    flex-direction: column;
    gap: 10px;
}

.list-item {
    display: flex;
    align-items: center;
    padding: 12px 15px;
    background: var(--toolbar-button-bg-color);
    border-radius: 12px;
    box-shadow: var(--toolbar-button-shadow);
    backdrop-filter: blur(10px);
    border: none;
    transition: all 0.3s ease;
}

.list-item:hover {
    transform: translateX(5px);
    box-shadow: var(--toolbar-button-shadow-hover);
}

.list-preview {
    width: 50px;
    height: 50px;
    border-radius: 8px;
    overflow: hidden;
    margin-right: 15px;
    background: var(--el-fill-color-light);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
}

.list-preview img, .list-preview video {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.file-icon-wrapper-small {
    font-size: 24px;
    color: var(--theme-toggle-color);
    opacity: 0.5;
}

.list-info {
    flex: 1;
    min-width: 0;
    margin-right: 20px;
}

.file-url {
    font-size: 12px;
    color: var(--upload-text-color);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    opacity: 0.6;
}

.list-meta {
    margin-right: 20px;
    text-align: right;
    min-width: 140px;
}

.list-actions {
    display: flex;
    gap: 8px;
}

.list-actions .el-button {
    backdrop-filter: blur(10px);
}

.empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--upload-text-color);
    font-size: 18px;
    opacity: 0.5;
}

.empty-icon {
    font-size: 64px;
    margin-bottom: 20px;
    color: var(--theme-toggle-color);
}

/* Scrollbar styling */
.history-content::-webkit-scrollbar {
    width: 8px;
}
.history-content::-webkit-scrollbar-track {
    background: transparent;
}
.history-content::-webkit-scrollbar-thumb {
    background: var(--el-border-color);
    border-radius: 4px;
}
.history-content::-webkit-scrollbar-thumb:hover {
    background: var(--el-border-color-darker);
}

.action-btn-view {
    background-color: var(--toolbar-button-bg-color);
    box-shadow: var(--toolbar-button-shadow);
    border: none;
    color: var(--theme-toggle-color);
}
.action-btn-view:hover {
    box-shadow: var(--toolbar-button-shadow-hover);
    color: var(--el-color-primary);
}

.history-group {
    position: relative;
    padding-left: 30px;
    border-left: 2px solid var(--el-border-color-lighter);
    margin-left: 10px;
    padding-bottom: 30px;
}

.history-group:last-child {
    border-left: 2px solid transparent;
}

.timeline-header {
    display: flex;
    align-items: center;
    margin-bottom: 20px;
    position: relative;
}

.timeline-dot {
    position: absolute;
    left: -38px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--el-upload-dragger-uniform-color);
    box-shadow: 0 0 10px var(--el-upload-dragger-uniform-color);
    z-index: 2;
    box-sizing: border-box;
}

.date-label {
    font-size: 20px;
    font-weight: bold;
    background: var(--upload-main-title-color);
    background-size: 200% auto;
    background-clip: text;
    -webkit-background-clip: text;
    color: transparent;
}

/* 加载更多样式 */
.load-more-container {
    display: flex;
    justify-content: center;
    padding: 20px;
}

.loading-indicator {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--el-upload-dragger-uniform-color);
}

.load-more-hint {
    color: var(--upload-text-color);
    opacity: 0.5;
    font-size: 14px;
}

.no-more-hint {
    text-align: center;
    padding: 20px;
    color: var(--upload-text-color);
    opacity: 0.5;
    font-size: 14px;
}

/* 移动端适配 */
@media (max-width: 768px) {
    .history-header {
        padding: 15px 20px;
    }
    
    .header-left h2 {
        font-size: 20px;
    }
    
    .history-content {
        padding: 15px 20px;
    }
    
    .grid-view {
        grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
        gap: 15px;
    }
    
    .grid-preview {
        height: 120px;
    }
    
    .list-meta {
        display: none;
    }
    
    .list-info {
        margin-right: 10px;
    }
}
</style>
