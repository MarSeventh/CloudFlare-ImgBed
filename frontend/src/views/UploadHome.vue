<template>
    <div class="container">
    <div class="upload-home">
        <!-- 桌面端按钮 -->
        <ToggleDark class="toggle-dark-button desktop-only"/>
        <el-tooltip content="查看文档" placement="bottom" :disabled="disableTooltip">
            <a href="https://cfbed.sanyue.de/qa/" target="_blank" class="info-container">
                <font-awesome-icon icon="book" class="info-icon" size="lg"/>
            </a>
        </el-tooltip>
        <el-input class="upload-folder" :class="{ 'active': isFolderInputActive, 'no-announcement': !announcementAvailable }" v-model="uploadFolder" placeholder="上传目录" @focus="isFolderInputActive = true" @blur="isFolderInputActive = false"/>
        <el-tooltip content="切换上传方式" placement="bottom" :disabled="disableTooltip">
            <el-button class="upload-method-button desktop-only" @click="handleChangeUploadMethod">
                <font-awesome-icon v-if="uploadMethod === 'default'"  icon="folder-open" class="upload-method-icon" size="lg"/>
                <font-awesome-icon v-else-if="uploadMethod === 'paste'" icon="paste" class="upload-method-icon" size="lg"/>
            </el-button>
        </el-tooltip>
        <el-tooltip content="上传记录" placement="bottom" :disabled="disableTooltip">
            <el-button class="history-button desktop-only" @click="showHistory = true">
                <font-awesome-icon icon="history" class="history-icon" size="lg"/>
            </el-button>
        </el-tooltip>
        <el-tooltip v-if="announcementAvailable" content="查看公告" placement="bottom" :disabled="disableTooltip">
            <el-button class="announcement-button desktop-only" @click="handleShowAnnouncement">
                <font-awesome-icon icon="bullhorn" class="announcement-icon" size="lg"/>
            </el-button>
        </el-tooltip>

        <!-- 移动端更多按钮 -->
        <el-dropdown class="mobile-more-dropdown mobile-only" trigger="click" @command="handleMobileMenuCommand">
            <el-button class="mobile-more-button">
                <font-awesome-icon icon="ellipsis-v" size="lg"/>
            </el-button>
            <template #dropdown>
                <el-dropdown-menu>
                    <el-dropdown-item command="toggleTheme">
                        <font-awesome-icon :icon="getThemeIcon()" style="margin-right: 8px;"/>
                        {{ getThemeText() }}
                    </el-dropdown-item>
                    <el-dropdown-item command="toggleUploadMethod">
                        <font-awesome-icon :icon="uploadMethod === 'default' ? 'paste' : 'folder-open'" style="margin-right: 8px;"/>
                        {{ uploadMethod === 'default' ? '粘贴上传' : '文件上传' }}
                    </el-dropdown-item>
                    <el-dropdown-item command="showHistory">
                        <font-awesome-icon icon="history" style="margin-right: 8px;"/>
                        上传记录
                    </el-dropdown-item>
                    <el-dropdown-item command="showAnnouncement" :disabled="!announcementAvailable">
                        <font-awesome-icon icon="bullhorn" style="margin-right: 8px;"/>
                        查看公告
                    </el-dropdown-item>
                </el-dropdown-menu>
            </template>
        </el-dropdown>
        <div class="toolbar-manage">
            <el-button class="toolbar-manage-button" :class="{ 'active': isToolBarOpen}" size="large" @click="handleOpenToolbar" circle>
                <font-awesome-icon v-if="!isToolBarOpen"  icon="bars" class="manage-icon" size="lg"/>
                <font-awesome-icon v-else icon="times" class="manage-icon" size="lg"/>
            </el-button>
        </div>
        <div class="toolbar">
            <el-tooltip :disabled="disableTooltip" content="上传设置" placement="top">
                <el-button class="toolbar-button compress-button" :class="{ 'active': isToolBarOpen}" size="large" @click="openCompressDialog" circle>
                    <font-awesome-icon icon="cloud-upload" class="compress-icon" size="lg"/>
                </el-button>
            </el-tooltip>
            <el-tooltip :disabled="disableTooltip" content="链接格式" placement="left">
                <el-button class="toolbar-button link-button" :class="{ 'active': isToolBarOpen}" size="large" @click="openUrlDialog" circle>
                    <font-awesome-icon icon="link" class="link-icon" size="lg"/>
                </el-button>
            </el-tooltip>
            <el-tooltip :disabled="disableTooltip" content="系统管理" placement="left">
                <el-button class="toolbar-button config-button" :class="{ 'active': isToolBarOpen}" size="large" @click="handleManage" circle>
                    <font-awesome-icon icon="cog" class="config-icon" size="lg"/>
                </el-button>
            </el-tooltip>
            <el-tooltip :disabled="disableTooltip" content="退出登录" placement="left">
                <el-button class="toolbar-button sign-out-button" :class="{ 'active': isToolBarOpen}" size="large" @click="handleLogout" circle>
                    <font-awesome-icon icon="sign-out-alt" class="sign-out-icon" size="lg"/>
                </el-button>
            </el-tooltip>
        </div>
        <Logo :useConfigLink="true" />
        <div class="header">
            <h1 class="title"><a class="main-title" href="https://github.com/MarSeventh/CloudFlare-ImgBed" target="_blank">{{ ownerName }}</a> ImgHub</h1>
        </div>
        <UploadForm 
            :selectedUrlForm="selectedUrlForm" 
            :customerCompress="customerCompress" 
            :compressQuality="compressQuality"
            :compressBar="compressBar"
            :serverCompress="serverCompress"
            :uploadChannel="uploadChannel"
            :channelName="channelName"
            :uploadNameType="uploadNameType"
            :useCustomUrl="useCustomUrl"
            :customUrlPrefix="customUrlPrefix"
            :autoRetry="autoRetry"
            :urlPrefix="urlPrefix"
            :uploadMethod="uploadMethod"
            :uploadFolder="uploadFolder"
            :convertToWebp="convertToWebp"
            class="upload"
        />
        <el-dialog title="链接格式设置" v-model="showUrlDialog" :width="dialogWidth" :show-close="false" class="settings-dialog">
            <div class="dialog-section">
                <div class="section-header">
                    <span class="section-title">默认复制链接</span>
                </div>
                <div class="section-content">
                    <el-radio-group v-model="selectedUrlForm" @change="changeUrlForm" class="radio-card-group grid-2x2">
                        <el-radio value="url" class="radio-card">
                            <font-awesome-icon icon="link" class="radio-icon"/>
                            <span>原始链接</span>
                        </el-radio>
                        <el-radio value="md" class="radio-card">
                            <font-awesome-icon icon="code" class="radio-icon"/>
                            <span>MarkDown</span>
                        </el-radio>
                        <el-radio value="html" class="radio-card">
                            <font-awesome-icon icon="code-branch" class="radio-icon"/>
                            <span>HTML</span>
                        </el-radio>
                        <el-radio value="ubb" class="radio-card">
                            <font-awesome-icon icon="quote-right" class="radio-icon"/>
                            <span>BBCode</span>
                        </el-radio>
                    </el-radio-group>
                </div>
            </div>
            
            <div class="dialog-section">
                <div class="section-header">
                    <span class="section-title">自定义链接</span>
                    <el-tooltip content="默认链接为https://your.domain/file/xxx.jpg <br> 如果启用自定义链接格式，只保留xxx.jpg部分，其他部分请自行输入" placement="top" raw-content>
                        <font-awesome-icon icon="question-circle" class="section-help-icon"/>
                    </el-tooltip>
                </div>
                <div class="section-content">
                    <div class="setting-item">
                        <span class="setting-label">启用自定义</span>
                        <el-switch v-model="useCustomUrl" active-value="true" inactive-value="false" />
                    </div>
                    <div class="setting-item" v-if="useCustomUrl === 'true'">
                        <span class="setting-label">自定义前缀</span>
                        <el-input v-model="customUrlPrefix" placeholder="请输入自定义链接前缀" class="setting-input"/>
                    </div>
                </div>
            </div>
            
            <div class="dialog-action">
                <el-button type="primary" @click="showUrlDialog = false" class="confirm-btn">确定</el-button>
            </div>
        </el-dialog>
        <UploadSettingsDialog
            v-model="showCompressDialog"
            v-model:uploadChannel="uploadChannel"
            v-model:channelName="channelName"
            :currentChannelList="currentChannelList"
            v-model:uploadFolder="uploadFolder"
            v-model:autoRetry="autoRetry"
            v-model:uploadNameType="uploadNameType"
            v-model:convertToWebp="convertToWebp"
            v-model:customerCompress="customerCompress"
            v-model:compressBar="compressBar"
            v-model:compressQuality="compressQuality"
            v-model:serverCompress="serverCompress"
        />
    </div>
    <Footer class="footer"/>
    <el-dialog title="公告" v-model="showAnnouncementDialog" :width="dialogWidth" :show-close="false" :close-on-click-modal="false" :close-on-press-escape="false" center>
        <div v-html="announcementContent"></div>
        <template #footer>
            <span class="dialog-footer">
                <el-button type="primary" @click="showAnnouncementDialog = false">我已知晓！</el-button>
            </span>
        </template>
    </el-dialog>
    <UploadHistory :show="showHistory" @close="showHistory = false" />
    </div>
</template>

<script>
import UploadForm from '@/components/upload/UploadForm.vue'
import Footer from '@/components/Footer.vue'
import ToggleDark from '@/components/ToggleDark.vue'
import Logo from '@/components/Logo.vue'
import UploadHistory from '@/components/upload/UploadHistory.vue'
import UploadSettingsDialog from '@/components/upload/UploadSettingsDialog.vue'
import backgroundManager from '@/mixins/backgroundManager'
import axios from '@/utils/axios'
import { ref } from 'vue'
import cookies from 'vue-cookies'
import { mapGetters } from 'vuex'
import { validateFolderPath } from '@/utils/pathValidator'

export default {
    name: 'UploadHome',
    mixins: [backgroundManager],
    data() {
        return {
            selectedUrlForm: ref(''),
            showUrlDialog: false,
            showCompressDialog: false,
            customerCompress: true, //上传前压缩
            compressQuality: 4, //压缩后大小
            compressBar: 5, //压缩阈值
            convertToWebp: false, //转换为WebP格式
            serverCompress: true, //服务器端压缩
            uploadChannel: '', //上传渠道
            channelName: '', //指定的渠道名称
            availableChannels: {}, //可用渠道列表
            uploadNameType: '', //上传文件命名方式
            customUrlPrefix: '', //自定义链接前缀
            useCustomUrl: 'false', //是否启用自定义链接格式
            autoRetry: true, //失败自动切换
            useDefaultWallPaper: false,
            isToolBarOpen: false, //是否打开工具栏
            uploadMethod: 'default', //上传方式
            uploadFolder: '', // 上传文件夹
            isFolderInputActive: false,
            showAnnouncementDialog: false, // 控制公告弹窗的显示
            announcementContent: '', // 公告内容
            showHistory: false,
            themeMode: 'auto', // 主题模式：light, dark, auto
        }
    },
    watch: {
        customerCompress(val) {
            this.updateCompressConfig('customerCompress', val)
        },
        compressQuality(val) {
            this.updateCompressConfig('compressQuality', val)
        },
        compressBar(val) {
            // 确保值在有效范围内
            if (val === null || val === undefined || val < 1) {
                this.compressBar = 1
                return
            }
            // 确保期望大小不超过压缩阈值
            if (this.compressQuality > val) {
                this.compressQuality = val
            }
            this.updateCompressConfig('compressBar', val)
        },
        serverCompress(val) {
            this.updateCompressConfig('serverCompress', val)
        },
        convertToWebp(val) {
            this.updateCompressConfig('convertToWebp', val)
        },
        uploadChannel(val) {
            this.updateStoreUploadChannel(val)
            // 切换渠道类型时，检查持久化的渠道名是否在新渠道列表中
            const newChannelList = this.availableChannels[val] || []
            const savedChannelName = this.storeChannelName
            if (savedChannelName && newChannelList.some(ch => ch.name === savedChannelName)) {
                // 持久化的渠道名在新渠道列表中，恢复它
                this.channelName = savedChannelName
            } else {
                // 否则清空
                this.channelName = ''
            }
        },
        channelName(val) {
            // 确保清空时保存空字符串而不是null
            this.$store.commit('setStoreChannelName', val || '')
        },
        uploadNameType(val) {
            this.updateStoreUploadNameType(val)
        },
        customUrlPrefix(val) {
            this.$store.commit('setCustomUrlSettings', { key: 'customUrlPrefix', value: val })
        },
        useCustomUrl(val) {
            this.$store.commit('setCustomUrlSettings', { key: 'useCustomUrl', value: val })
        },
        autoRetry(val) {
            this.$store.commit('setStoreAutoRetry', val)
        },
        uploadFolder(val) {
            // 验证上传文件夹路径的合法性
            if (this.validateUploadFolder(val)) {
                this.$store.commit('setStoreUploadFolder', val)
            } else {
                this.$nextTick(() => {
                    this.uploadFolder = this.storeUploadFolder
                })
            }
        }
    },
    computed: {
        ...mapGetters(['userConfig', 'uploadCopyUrlForm', 'compressConfig', 'storeUploadChannel', 'storeChannelName', 'storeUploadNameType', 'customUrlSettings', 'storeAutoRetry', 'storeUploadMethod', 'storeUploadFolder']),
        ownerName() {
            return this.userConfig?.ownerName || 'Sanyue'
        },
        dialogWidth() {
            return window.innerWidth > 768 ? '50%' : '90%'
        },
        disableTooltip() {
            return window.innerWidth < 768
        },
        urlPrefix() {
            // 全局自定义链接前缀
            return this.userConfig?.urlPrefix || `${window.location.protocol}//${window.location.host}/file/`
        },
        announcementAvailable() {
            return !!this.userConfig?.announcement
        },
        // 当前渠道类型对应的渠道列表
        currentChannelList() {
            return this.availableChannels[this.uploadChannel] || []
        }
    },
    mounted() {
        // 初始化背景图，启用自动创建元素
        this.initializeBackground('uploadBkImg', '.container', false, true)

        // 读取用户选择的链接格式
        this.selectedUrlForm = this.uploadCopyUrlForm || 'url'
        // 读取用户选择的压缩设置（优先用户设置，其次系统默认配置）
        this.customerCompress = this.compressConfig.customerCompress ?? this.parseBoolean(this.userConfig?.defaultCustomerCompress, true)
        this.compressQuality = this.compressConfig.compressQuality ?? this.parseNumber(this.userConfig?.defaultCompressQuality, 4)
        this.compressBar = this.compressConfig.compressBar ?? this.parseNumber(this.userConfig?.defaultCompressBar, 5)
        this.serverCompress = this.compressConfig.serverCompress ?? true
        this.convertToWebp = this.compressConfig.convertToWebp ?? this.parseBoolean(this.userConfig?.defaultConvertToWebp, false)
        // 读取用户选择的上传渠道
        this.uploadChannel = this.storeUploadChannel || this.userConfig?.defaultUploadChannel || 'telegram'
        // 用户定义的失败自动切换
        this.autoRetry = this.storeAutoRetry
        // 读取用户选择的上传文件命名方式
        this.uploadNameType = this.storeUploadNameType || this.userConfig?.defaultUploadNameType || 'default'
        // 读取用户自定义链接格式
        this.customUrlPrefix = this.customUrlSettings.customUrlPrefix
        this.useCustomUrl = this.customUrlSettings.useCustomUrl
        // 读取用户偏好的上传方式
        this.uploadMethod = this.storeUploadMethod
        // 获取可用渠道列表
        this.fetchAvailableChannels()
        // 读取用户设置的上传文件夹
        this.uploadFolder = this.storeUploadFolder || this.userConfig?.defaultUploadFolder || ''

        // 从 Vuex store 读取主题模式状态
        const cusDarkMode = this.$store.getters.cusDarkMode
        const useDarkMode = this.$store.getters.useDarkMode
        
        if (!cusDarkMode) {
            this.themeMode = 'auto'
        } else if (useDarkMode) {
            this.themeMode = 'dark'
        } else {
            this.themeMode = 'light'
        }

        // 首次访问公告
        const visited = localStorage.getItem('visitedUploadHome')
        const announcement = this.userConfig?.announcement
        if (!visited && announcement) {
            this.announcementContent = announcement
            this.showAnnouncementDialog = true
            localStorage.setItem('visitedUploadHome', 'true')
        }
    },
    components: {
        UploadForm,
        Footer,
        ToggleDark,
        Logo,
        UploadHistory,
        UploadSettingsDialog
    },
    methods: {
        // 获取可用渠道列表
        async fetchAvailableChannels() {
            try {
                const response = await axios.get('/api/channels')
                if (response.data) {
                    this.availableChannels = response.data
                    // 恢复渠道名称：优先持久化的值，其次系统默认配置
                    const savedChannelName = this.storeChannelName
                    const defaultChannelName = this.userConfig?.defaultChannelName
                    const currentChannelList = this.availableChannels[this.uploadChannel] || []
                    
                    // 如果用户主动清空过（savedChannelName === ''），则保持为空
                    // 如果从未选择过（savedChannelName === null/undefined），则使用默认值
                    if (savedChannelName && currentChannelList.some(ch => ch.name === savedChannelName)) {
                        this.channelName = savedChannelName
                    } else if (savedChannelName === '' || savedChannelName === null || savedChannelName === undefined) {
                        // 用户主动清空或从未选择，检查是否使用默认值
                        if (savedChannelName !== '' && defaultChannelName && currentChannelList.some(ch => ch.name === defaultChannelName)) {
                            this.channelName = defaultChannelName
                        }
                        // 如果 savedChannelName === ''，说明用户主动清空，保持为空
                    }
                }
            } catch (error) {
                console.error('Failed to fetch available channels:', error)
            }
        },
        // 验证上传文件夹路径的合法性
        validateUploadFolder(path) {
            const result = validateFolderPath(path)
            if (!result.valid) {
                // 将错误消息中的"目标目录"替换为"上传目录"以保持原有的提示风格
                const errorMessage = result.error.replace('目标目录', '上传目录')
                this.$message.error(errorMessage)
                return false
            }
            return true
        },
        handleManage() {
            this.$router.push('/dashboard')
        },
        // 解析布尔值
        parseBoolean(value, defaultValue) {
            if (value === undefined || value === null) return defaultValue
            if (typeof value === 'boolean') return value
            if (typeof value === 'string') return value === 'true'
            return defaultValue
        },
        // 解析数字
        parseNumber(value, defaultValue) {
            if (value === undefined || value === null) return defaultValue
            const num = parseFloat(value)
            return isNaN(num) ? defaultValue : num
        },
        openUrlDialog() {
            this.showUrlDialog = true
        },
        handleLogout() {
            cookies.remove('authCode')
            this.$router.push('/login')
            this.$message.success('已退出登录')
        },
        changeUrlForm() {
            this.$store.commit('setUploadCopyUrlForm', this.selectedUrlForm)
        },
        openCompressDialog() {
            this.showCompressDialog = true
        },
        updateCompressConfig(key, value) {
            this.$store.commit('setCompressConfig', { key, value })
        },
        updateStoreUploadChannel(value) {
            this.$store.commit('setStoreUploadChannel', value)
        },
        updateStoreUploadNameType(value) {
            this.$store.commit('setStoreUploadNameType', value)
        },
        handleOpenToolbar () {
            this.isToolBarOpen = !this.isToolBarOpen
            // 等过渡动画结束，向active类添加pointer-events属性，使其可以点击
            setTimeout(() => {
                const buttons = document.querySelectorAll('.toolbar-button')
                buttons.forEach(button => {
                    button.style.pointerEvents = this.isToolBarOpen? 'auto' : 'none'
                })
            }, 300)
        },
        handleChangeUploadMethod() {
            this.uploadMethod = this.uploadMethod === 'default'? 'paste' : 'default'
            this.$store.commit('setUploadMethod', this.uploadMethod)
        },
        handleMobileMenuCommand(command) {
            if (command === 'toggleTheme') {
                // 循环切换：auto -> light -> dark -> auto
                if (this.themeMode === 'auto') {
                    // 切换到亮色
                    this.themeMode = 'light'
                    this.$store.commit('setCusDarkMode', true)
                    this.$store.commit('setUseDarkMode', false)
                } else if (this.themeMode === 'light') {
                    // 切换到暗色
                    this.themeMode = 'dark'
                    this.$store.commit('setCusDarkMode', true)
                    this.$store.commit('setUseDarkMode', true)
                } else {
                    // 切换到自动
                    this.themeMode = 'auto'
                    this.$store.commit('setCusDarkMode', false)
                }
            } else if (command === 'toggleUploadMethod') {
                this.handleChangeUploadMethod()
            } else if (command === 'showHistory') {
                this.showHistory = true
            } else if (command === 'showAnnouncement') {
                this.handleShowAnnouncement()
            }
        },
        getThemeIcon() {
            // 显示下一个模式的图标
            if (this.themeMode === 'auto') return 'sun'  // auto -> light
            if (this.themeMode === 'light') return 'moon'  // light -> dark
            return 'adjust'  // dark -> auto
        },
        getThemeText() {
            // 显示下一个模式的文字
            if (this.themeMode === 'auto') return '浅色模式'
            if (this.themeMode === 'light') return '深色模式'
            return '自动模式'
        },
        handleShowAnnouncement() {
            const announcement = this.userConfig?.announcement
            if (announcement) {
                this.announcementContent = announcement
                this.showAnnouncementDialog = true
            } else {
                this.$message.info('暂无公告')
            }
        }
    }
}
</script>

<style scoped>
.container {
    background: var(--bg-color);
    min-height: 100vh;
}

/* 定义顺时针和逆时针旋转动画 */
.rotate {
    animation: spin 2s ease-in-out; /* 动画时长为2秒，执行一次 */
}

/* 定义放大缩小动画 */
.scale {
    animation: scale 0.5s ease-in-out; /* 动画时长为0.5秒，执行一次 */
}

/* 关键帧：先顺时针旋转，再逆时针旋转 */
@keyframes spin {
    0% {
        transform: rotate(0deg); /* 初始位置 */
    }
    25% {
        transform: rotate(5deg); /* 顺时针旋转20度 */
    }
    50% {
        transform: rotate(0deg); /* 顺时针旋转回到初始位置 */
    }
    75% {
        transform: rotate(-3deg); /* 逆时针旋转20度 */
    }
    100% {
        transform: rotate(0deg); /* 逆时针旋转回到初始位置 */
    }
}

@keyframes streamer {
    0% {
        background-position: 200% center;
    }
    100% {
        background-position: -200% center;
    }
}


/* 关键帧：旋转抖动 */
@keyframes rotate-shake {
    0% {
        transform: rotate(0deg); /* 初始位置 */
    }
    50% {
        transform: rotate(10deg); /* 旋转10度 */
    }
    100% {
        transform: rotate(0deg); /* 回到初始位置 */
    }
}

/* 关键帧：左右抖动 */
@keyframes shake {
    0% {
        transform: translateX(0); /* 初始位置 */
    }
    50% {
        transform: translateX(-1px); /* 向右移动3像素 */
    }
    100% {
        transform: translateX(0); /* 回到初始位置 */
    }
}

/* 关键帧：放大缩小 */
@keyframes scale {
    0% {
        transform: scale(1); /* 初始大小 */
    }
    50% {
        transform: scale(1.1); /* 放大到1.2倍 */
    }
    100% {
        transform: scale(1); /* 回到初始大小 */
    }
}


/* 桌面端和移动端显示控制 */
.desktop-only {
    display: inline-block;
}
.mobile-only {
    display: none;
}
@media (max-width: 768px) {
    .desktop-only {
        display: none !important;
    }
    .mobile-only {
        display: flex !important;
    }
}

.toggle-dark-button {
    border: none;
    transition: all 0.3s ease;
    background-color: var(--toolbar-button-bg-color);
    box-shadow: var(--toolbar-button-shadow);
    backdrop-filter: blur(10px);
    border-radius: 12px;
    position: fixed;
    top: 30px;
    right: 30px;
}

.upload-method-button {
    width: 2.5rem;
    height: 2.5rem;
    display: flex;
    justify-content: center;
    align-items: center;
    border: none;
    transition: all 0.3s ease;
    background-color: var(--toolbar-button-bg-color);
    box-shadow: var(--toolbar-button-shadow);
    backdrop-filter: blur(10px);
    color: var(--theme-toggle-color);
    border-radius: 12px;
    position: fixed;
    top: 30px;
    right: 130px;
    outline: none;
}
@media (max-width: 768px) {
    .upload-method-button {
        width: 2rem;
        height: 2rem;
    }
}
.upload-method-icon {
    outline: none;
}

.history-button {
    width: 2.5rem;
    height: 2.5rem;
    display: flex;
    justify-content: center;
    align-items: center;
    position: fixed;
    top: 30px;
    right: 180px;
    border: none;
    transition: all 0.3s ease;
    background-color: var(--toolbar-button-bg-color);
    box-shadow: var(--toolbar-button-shadow);
    backdrop-filter: blur(10px);
    color: var(--theme-toggle-color);
    z-index: 100;
    border-radius: 12px;
    outline: none;
}
@media (max-width: 768px) {
    .history-button {
        width: 2rem;
        height: 2rem;
        top: 85px;
        right: 80px;
    }
}
.history-button:hover {
    transform: scale(1.05);
    box-shadow: var(--toolbar-button-shadow-hover);
}

/* 公告按钮 */
.announcement-button {
    width: 2.5rem;
    height: 2.5rem;
    display: flex;
    justify-content: center;
    align-items: center;
    position: fixed;
    top: 30px;
    right: 230px;
    border: none;
    transition: all 0.3s ease;
    background-color: var(--toolbar-button-bg-color);
    box-shadow: var(--toolbar-button-shadow);
    backdrop-filter: blur(10px);
    color: var(--theme-toggle-color);
    z-index: 100;
    border-radius: 12px;
    outline: none;
}
.announcement-button:hover:not(:disabled) {
    transform: scale(1.05);
    box-shadow: var(--toolbar-button-shadow-hover);
}
.announcement-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

/* 移动端更多按钮 */
.mobile-more-dropdown {
    position: fixed;
    top: 30px;
    right: 30px;
    z-index: 100;
}
.mobile-more-button {
    width: 2rem;
    height: 2rem;
    display: flex;
    justify-content: center;
    align-items: center;
    border: none;
    transition: all 0.3s ease;
    background-color: var(--toolbar-button-bg-color);
    box-shadow: var(--toolbar-button-shadow);
    backdrop-filter: blur(10px);
    color: var(--theme-toggle-color);
    border-radius: 12px;
    outline: none;
    padding: 0;
}
.mobile-more-button:hover {
    transform: scale(1.05);
    box-shadow: var(--toolbar-button-shadow-hover);
}

/* 上传文件输入框样式 */
.upload-folder {
    width: 100px;
    height: 2.5rem;
    position: fixed;
    top: 30px;
    right: 280px;
    z-index: 100;
    border-radius: 12px;
    transition: all 0.3s ease, width 0.4s ease;
}
.upload-folder.no-announcement {
    right: 230px;
}
.upload-folder.active {
    width: 200px;
}
@media (max-width: 768px) {
    .upload-folder {
        width: 80px;
        height: 2rem;
        right: 110px;
    }
    .upload-folder.no-announcement {
        right: 110px;
    }
    .upload-folder.active {
        width: 120px;
    }
}
.upload-folder :deep(.el-input__wrapper) {
    border-radius: 12px;
    background-color: var(--toolbar-button-bg-color);
    box-shadow: var(--toolbar-button-shadow);
    backdrop-filter: blur(10px);
    border: none;
}


.info-container {
    width: 2.5rem;
    height: 2.5rem;
    display: flex;
    justify-content: center;
    align-items: center;
    border: none;
    background-color: var(--toolbar-button-bg-color);
    box-shadow: var(--toolbar-button-shadow);
    backdrop-filter: blur(10px);
    border-radius: 12px;
    color: var(--theme-toggle-color);
    transition: all 0.3s ease;
    position: fixed;
    top: 30px;
    right: 80px;
    cursor: pointer;
}
.info-icon {
    outline: none;
}
@media (max-width: 768px) {
    .info-container {
        width: 2rem;
        height: 2rem;
        right: 70px;
    }
}

.toolbar-manage {
    position: fixed;
    bottom: 50px;
    right: 30px;
    z-index: 200;
}
.toolbar-manage-button {
    border: none;
    transition: all 0.3s ease, border-radius 0.4s ease;
    margin-left: 0;
    background-color: var(--toolbar-button-bg-color);
    box-shadow: var(--toolbar-button-shadow);
    backdrop-filter: blur(10px);
    color: var(--toolbar-button-color);
    outline: none;
    border-radius: 12px;
}
.toolbar-manage-button.active {
    border-radius: 50%;
}

.toolbar {
    position: fixed;
    bottom: 50px;
    right: 30px;
    display: flex;
    flex-direction: column;
    align-items: center;
    z-index: 100;
}

.toolbar-button {
    border: none;
    transition: all 0.3s ease;
    margin-left: 0;
    background-color: var(--toolbar-button-bg-color);
    box-shadow: var(--toolbar-button-shadow);
    backdrop-filter: blur(10px);
    color: var(--toolbar-button-color);
}

/* 按钮悬停效果 */
.upload-folder:hover,
.toggle-dark-button:hover,
.info-container:hover,
.upload-method-button:hover,
.toolbar-manage-button:hover,
.toolbar-button:hover {
    transform: scale(1.05);
    box-shadow: var(--toolbar-button-shadow-hover);
}

/* 按钮形成扇形 */
.compress-button {
    position: fixed;
    bottom: 50px;
    right: 30px;
    opacity: 0;
    transition: all 0.3s ease, transform 0.4s cubic-bezier(0.68, -0.55, 0.27, 1.55), opacity 0.3s cubic-bezier(0.68, -0.55, 0.27, 1.55);
    pointer-events: none;
}
.compress-button.active {
    transform: translateY(-75px);
    opacity: 1;
}

.link-button {
    position: fixed;
    bottom: 50px;
    right: 30px;
    opacity: 0;
    transition: all 0.3s ease, transform 0.4s cubic-bezier(0.68, -0.55, 0.27, 1.55), opacity 0.3s cubic-bezier(0.68, -0.55, 0.27, 1.55);
    pointer-events: none;
}
.link-button.active {
    transform: translateY(-58px) translateX(-50px);
    opacity: 1;
}

.config-button {
    position: fixed;
    bottom: 50px;
    right: 30px;
    opacity: 0;
    transition: all 0.3s ease, transform 0.4s cubic-bezier(0.68, -0.55, 0.27, 1.55), opacity 0.3s cubic-bezier(0.68, -0.55, 0.27, 1.55);
    pointer-events: none;
}
.config-button.active {
    transform: translateY(-11px) translateX(-75px);
    opacity: 1;
}

.sign-out-button {
    position: fixed;
    bottom: 50px;
    right: 30px;
    opacity: 0;
    transition: all 0.3s ease, transform 0.4s cubic-bezier(0.68, -0.55, 0.27, 1.55), opacity 0.3s cubic-bezier(0.68, -0.55, 0.27, 1.55);
    pointer-events: none;
}
.sign-out-button.active {
    transform: translateY(42px) translateX(-68px);
    opacity: 1;
}

/* 非移动端时的图标动画样式 */
@media (min-width: 768px) {
    .compress-button:hover {
        transform: translateY(-77px);
    }
    .link-button:hover {
        transform: translateY(-60px) translateX(-52px);
    }
    .config-button:hover {
        transform: translateY(-12px) translateX(-77px);
    }
    .sign-out-button:hover {
        transform: translateY(44px) translateX(-70px);
    }

    .compress-icon:hover {
        animation: scale 0.5s ease-in-out;
    }
    .config-icon:hover {
        animation: spin 0.5s ease-in-out;
    }
    .link-icon:hover {
        animation: rotate-shake 0.5s ease-in-out;
    }
    .sign-out-icon:hover {
        animation: shake 0.5s ease-in-out;
    }
}


:deep(.el-dialog) {
    border-radius: 12px;
    background-color: var(--dialog-bg-color);
    backdrop-filter: blur(10px);
    box-shadow: var(--dialog-box-shadow);
}
.dialog-action {
    display: flex;
    justify-content: center;
    margin-top: 20px;
}


.header {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 15px;
    margin-top: 5vh;
    color: var(--upload-header-color);
    user-select: none;
    text-decoration: none;
    position: relative;
    top: -3vh;
    transition: all 0.3s ease;
}
.title {
    font-size: 2.5rem;
    font-weight: 400;
    font-family: 'Righteous', 'Noto Sans SC', sans-serif;
    position: relative;
    padding-bottom: 8px;
    cursor: pointer;
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    animation: float 4s ease-in-out infinite;
    letter-spacing: 3px;
}
.title:hover {
    transform: scale(1.08) translateY(-3px);
    filter: drop-shadow(0 0 20px var(--el-upload-dragger-uniform-color));
}
.title::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 3px;
    background: linear-gradient(90deg, 
        transparent, 
        var(--el-upload-dragger-uniform-color), 
        transparent);
    border-radius: 3px;
    transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: 0 0 10px var(--el-upload-dragger-uniform-color);
}
.title:hover::after {
    width: 80%;
}

/* 动态流光标题 */
.main-title {
    background: var(--upload-main-title-color);
    background-size: 200% auto;
    background-clip: text;
    -webkit-background-clip: text;
    color: transparent;
    text-decoration: none;
    display: inline-block;
    animation: titleShimmer 3s ease-in-out infinite;
    position: relative;
    filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.3));
}



.title:hover .main-title {
    animation: titleShimmer 1s ease-in-out infinite;
    filter: brightness(1.2);
}

/* 漂浮动画 */
@keyframes float {
    0%, 100% {
        transform: translateY(0);
    }
    50% {
        transform: translateY(-5px);
    }
}

/* 标题流光动画 */
@keyframes titleShimmer {
    0% {
        background-position: 200% center;
    }
    100% {
        background-position: -200% center;
    }
}

@media (max-width: 768px) {
    .title {
        font-size: 1.8rem;
        letter-spacing: 1px;
    }
    .title:hover {
        transform: scale(1.05) translateY(-2px);
    }
}

.upload-home {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    min-height: 94vh;
    background-color: var(--admin-container-bg-color);
}
.upload {
    margin-bottom: 5px;
    position: relative;
    top: -3vh;
}

.footer {
    height: 6vh;
}
</style>