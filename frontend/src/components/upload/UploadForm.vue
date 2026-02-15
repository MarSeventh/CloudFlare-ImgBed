<template>
    <div class="upload-form">
        <div 
            class="upload-card-wrapper"
            @mousemove="handleUploadCardMouseMove"
            @mouseleave="handleUploadCardMouseLeave"
        >
            <div class="upload-card-glow" ref="uploadCardGlow"></div>
            <el-upload
                v-if="uploadMethod === 'default'"
                class="upload-card"
                :class="{'is-uploading': uploading, 'upload-card-busy': fileList.length}"
                drag
                multiple
                :http-request="uploadFile"
                :onSuccess="handleSuccess"
                :on-error="handleError"
                :before-upload="beforeUpload"
                :on-progress="handleProgress"
                :file-list="fileList"
                :show-file-list="false"
                >
                <el-icon class="el-icon--upload" :class="{'upload-list-busy': fileList.length}">
                    <CameraFilled/>
                </el-icon>
                <div class="el-upload__text" :class="{'upload-list-busy': fileList.length}"><em>拖拽</em> <em>点击</em> 或 <em>Ctrl + V</em> 粘贴上传</div>
            </el-upload>
        </div>
        <div v-if="uploadMethod === 'paste'" class="upload-card">
            <el-card 
                class="paste-card"
                :class="{'is-uploading': uploading, 'upload-card-busy': fileList.length}"
            >
                <el-input
                    v-model="pastedUrls"
                    class="upload-card-textarea"
                    placeholder="粘贴外链上传，多个外链用换行分隔"
                    type="textarea"
                    :rows="fileList.length ? 4 : 14"
                />
                <div class="paste-card-actions">
                    <el-button
                        class="paste-card-upload-button"
                        type="primary"
                        :size="pasteCardMethodButtonSize"
                        @click="handleUploadPasteUrls"
                    >
                        上 传
                    </el-button>
                    <el-radio-group 
                        v-model="pasteUploadMethod" 
                        class="paste-card-method-group"
                        :size="pasteCardMethodButtonSize"
                    >
                        <el-radio-button label="save">转存</el-radio-button>
                        <el-radio-button label="external">外链</el-radio-button>
                    </el-radio-group>
                </div>
            </el-card>
        </div>
        <el-card class="upload-list-card" :class="{'upload-list-busy': fileList.length, 'is-uploading': uploading}">
            <div class="upload-list-container" :class="{'upload-list-busy': fileList.length}">
                <el-scrollbar @scroll="handleScroll" ref="scrollContainer">
                    <div class="upload-list-dashboard" :class="{ 'list-scrolled': listScrolled }">
                        <el-text class="upload-list-dashboard-title">
                            <el-icon><List /></el-icon>{{ uploadingCount + waitingCount }}
                            <el-icon><Checked /></el-icon>{{ uploadSuccessCount }}
                            <el-icon><Failed /></el-icon>{{ uploadErrorCount }}
                        </el-text>
                        <div class="upload-list-dashboard-action">
                            <div class="modern-action-group">
                                <el-tooltip :disabled="disableTooltip" content="整体复制" placement="top">
                                    <button class="modern-action-btn" @click="copyAll">
                                        <font-awesome-icon icon="copy" />
                                    </button>
                                </el-tooltip>
                                <el-tooltip :disabled="disableTooltip" content="失败重试" placement="top">
                                    <el-dropdown>
                                        <button class="modern-action-btn" @click="retryError">
                                            <font-awesome-icon icon="redo" />
                                        </button>
                                        <template #dropdown>
                                            <el-dropdown-menu class="modern-dropdown-menu">
                                                <el-dropdown-item>
                                                    <div class="modern-dropdown-item-content">
                                                        <span>自动重试</span>
                                                        <el-switch v-model="autoReUpload" @change="handleAutoRetryChange" size="small" />
                                                    </div>
                                                </el-dropdown-item>
                                            </el-dropdown-menu>
                                        </template>
                                    </el-dropdown>
                                </el-tooltip>
                                <el-tooltip :disabled="disableTooltip" content="清空列表" placement="top">
                                    <el-dropdown>
                                        <button class="modern-action-btn modern-action-btn-danger">
                                            <font-awesome-icon icon="trash-alt" />
                                        </button>
                                        <template #dropdown>
                                            <el-dropdown-menu class="modern-dropdown-menu">
                                                <el-dropdown-item @click="clearFileList">清空全部</el-dropdown-item>
                                                <el-dropdown-item @click="clearSuccessList">清空已上传</el-dropdown-item>
                                            </el-dropdown-menu>
                                        </template>
                                    </el-dropdown>
                                </el-tooltip>
                            </div>
                        </div>
                    </div>
                    <UploadFileItem
                        v-for="file in fileList.slice().reverse()"
                        :key="file.name"
                        :file="file"
                        @copy="handleCopy"
                        @remove="handleRemove"
                        @preview-error="(f) => f.url = require('@/assets/404.png')"
                    />
                </el-scrollbar>
            </div>
        </el-card>
    </div>
</template>

<script>
import axios from '@/utils/axios'
import * as imageConversion from 'image-conversion'
import { mapGetters } from 'vuex'
import { buildFileUrls, updateFileListUrls, getUrlByFormat } from '@/utils/upload/urlBuilder'
import { computeSha256 } from '@/utils/upload/sha256'
import UploadFileItem from '@/components/upload/UploadFileItem.vue'

export default {
name: 'UploadForm',
components: {
    UploadFileItem
},
props: {
    selectedUrlForm: {
        type: String,
        default: 'url',
        required: false
    },
    customerCompress: {
        type: Boolean,
        default: true,
        required: false
    },
    compressQuality: {
        type: Number,
        default: 4,
        required: false
    },
    compressBar: {
        type: Number,
        default: 5,
        required: false
    },
    serverCompress: {
        type: Boolean,
        default: true,
        required: false
    },
    uploadChannel: {
        type: String,
        default: 'telegram',
        required: false
    },
    channelName: {
        type: String,
        default: '',
        required: false
    },
    uploadNameType: {
        type: String,
        default: 'default',
        required: false
    },
    useCustomUrl: {
        type: String,
        default: 'false',
        required: false
    },
    customUrlPrefix: {
        type: String,
        default: '',
        required: false
    },
    autoRetry: {
        type: Boolean,
        default: true,
        required: false
    },
    urlPrefix: {
        type: String,
        default: '',
        required: false
    },
    uploadMethod: {
        type: String,
        default: 'default',
        required: false
    },
    uploadFolder: {
        type: String,
        default: '',
        required: false
    },
    convertToWebp: {
        type: Boolean,
        default: false,
        required: false
    }
},
data() {
    return {
        fileList: [],
        uploading: false,
        maxUploading: 6,
        exceptionList: [],
        listScrolled: false,
        fileListLength: 0,
        uploadCount: 0,
        pastedUrls: '',
        pasteUploadMethod: 'save',
        // 失败文件自动重试相关
        autoReUpload: true,
        maxRetryCount: 10, // 最大重试次数
        retryTimer: null, // 自动重试定时器
        retryDelay: 12000, // 重试延迟时间（毫秒）
        // 批量上传并发控制
        uploadQueue: [], // 等待上传的文件队列
        activeUploads: 0, // 当前正在上传的文件数
        maxConcurrentUploads: 6, // 最大并发上传数
        // 取消上传控制
        abortControllers: new Map(), // 存储每个文件的 AbortController
    }
},
watch: {
    fileList: {
        handler() {
            if (this.fileList.length > this.fileListLength) {
                this.$nextTick(() => {
                    setTimeout(() => {
                        if (this.$refs.scrollContainer) {
                            // this.$refs.scrollContainer.setScrollTop(this.$refs.scrollContainer.wrapRef.scrollHeight) // 滚动到底部
                            this.$refs.scrollContainer.setScrollTop(0) // 滚动到顶部
                        }
                    }, 100)
                })
            }
            this.fileListLength = this.fileList.length
        },
        deep: true
    },
    useCustomUrl: {
        handler() {
            updateFileListUrls(this.fileList, this.rootUrl)
        },
        immediate: true
    },
    customUrlPrefix: {
        handler() {
            if (this.useCustomUrl === 'true') {
                updateFileListUrls(this.fileList, this.rootUrl)
            }
        },
        immediate: true
    },
    autoReUpload(val) {
        this.$store.commit('setStoreAutoReUpload', val)
    }
},
computed: {
    ...mapGetters([
        'storeAutoReUpload'
    ]),
    uploadSuccessCount() {
        return this.fileList.filter(item => item.status === 'done' || item.status === 'success').length
    },
    uploadErrorCount() {
        return this.fileList.filter(item => item.status === 'exception').length
    },
    uploadingCount() {
        return this.fileList.filter(item => item.status === 'uploading').length
    },
    waitingCount() {
        return this.uploadQueue.length
    },
    urlSize() {
        // 移动端为small
        return window.innerWidth < 768 ? 'small' : 'default'
    },
    disableTooltip() {
        return window.innerWidth < 768
    },
    rootUrl() {
        // 链接前缀，优先级：用户自定义 > urlPrefix > 默认
        return this.useCustomUrl === 'true' ? this.customUrlPrefix : this.urlPrefix || `${window.location.protocol}//${window.location.host}/file/`
    },
    pasteCardMethodButtonSize() {
        if (this.fileList.length) {
            return 'small'
        } else {
            return window.innerWidth < 768 ? 'small' : 'medium'
        }
    }
},
mounted() {
    document.addEventListener('paste', this.handlePaste)
    this.autoReUpload = this.storeAutoReUpload
},
beforeUnmount() {
    document.removeEventListener('paste', this.handlePaste)
    // 清理状态
    this.uploadQueue = []
    this.fileList = []
    this.activeUploads = 0
},
methods: {
    // 文件名中间截断，保留前缀和扩展名
    truncateFilename(filename, maxLength = 20) {
        if (!filename || filename.length <= maxLength) {
            return filename
        }
        const lastDotIndex = filename.lastIndexOf('.')
        let name, ext
        if (lastDotIndex > 0) {
            name = filename.substring(0, lastDotIndex)
            ext = filename.substring(lastDotIndex)
        } else {
            name = filename
            ext = ''
        }
        // 保留扩展名和部分前后缀
        const keepEnd = ext.length + 4 // 扩展名 + 4个字符
        const keepStart = maxLength - keepEnd - 3 // 3个字符留给...
        if (keepStart <= 0) {
            return filename.substring(0, maxLength - 3) + '...'
        }
        return name.substring(0, keepStart) + '...' + name.slice(-4) + ext
    },
    uploadFile(file) {
        // 如果fileList中不存在该文件，说明已被删除，直接返回
        if (!this.fileList.find(item => item.uid === file.file.uid)) {
            return
        }
        
        // 并发控制：如果当前上传数已达上限，加入队列等待
        if (this.activeUploads >= this.maxConcurrentUploads) {
            this.uploadQueue.push(file)
            const waitingItem = this.fileList.find(item => item.uid === file.file.uid)
            if (waitingItem) waitingItem.status = 'waiting'
            return
        }
        
        // 开始上传，增加计数
        this.activeUploads++
        const uploadingItem = this.fileList.find(item => item.uid === file.file.uid)
        if (uploadingItem) uploadingItem.status = 'uploading'

        const fileItem = this.fileList.find(item => item.uid === file.file.uid)
        const uploadChannel = fileItem?.uploadChannel || this.uploadChannel

        // 如果上传渠道为外链，直接使用外链上传
        if (uploadChannel === 'external') {
            this.uploadSingleFile(file)
            return
        }

        // HuggingFace 渠道：根据文件大小选择上传方式
        // 小文件（<20MB）：通过 CF Workers 代理上传
        // 大文件（>=20MB）：前端直传到 HuggingFace S3，绕过 CF Workers 限制
        if (uploadChannel === 'huggingface') {
            const HF_DIRECT_THRESHOLD = 20 * 1024 * 1024 // 20MB
            if (file.file.size >= HF_DIRECT_THRESHOLD) {
                this.uploadToHuggingFaceDirect(file)
            } else {
                this.uploadSingleFile(file)
            }
            return
        }

        // Discord 渠道：限制 10MB，超过 9MB 就用分块上传（留安全余量）
        if (uploadChannel === 'discord') {
            const DISCORD_CHUNK_THRESHOLD = 9 * 1024 * 1024 // 9MB
            if (file.file.size > DISCORD_CHUNK_THRESHOLD) {
                this.uploadFileInChunks(file)
            } else {
                this.uploadSingleFile(file)
            }
            return
        }

        // 其他渠道，检查文件大小，决定是否使用分块上传
        const CHUNK_THRESHOLD = 20 * 1024 * 1024 // 20MB
        if (file.file.size > CHUNK_THRESHOLD) {
            this.uploadFileInChunks(file)
        } else {
            this.uploadSingleFile(file)
        }
    },
    // 处理上传队列中的下一个文件
    processUploadQueue() {
        // 如果队列为空或已达并发上限，不处理
        if (this.uploadQueue.length === 0 || this.activeUploads >= this.maxConcurrentUploads) {
            return
        }
        
        // 从队列中取出下一个文件并上传
        const nextFile = this.uploadQueue.shift()
        if (nextFile && this.fileList.find(item => item.uid === nextFile.file.uid)) {
            this.uploadFile(nextFile)
        } else {
            // 如果文件已被删除，继续处理下一个
            this.processUploadQueue()
        }
    },
    // 上传完成后的清理工作（成功或失败都调用）
    onUploadComplete() {
        this.activeUploads = Math.max(0, this.activeUploads - 1)
        
        // 处理队列中的下一个文件
        this.processUploadQueue()
        
        // 更新上传状态
        if (this.activeUploads === 0 && this.uploadQueue.length === 0) {
            this.uploading = false
        }
    },
    // 单文件上传
    async uploadSingleFile(file) {
        const fileItem = this.fileList.find(item => item.uid === file.file.uid)
        if (!fileItem) return // 文件已被删除
        
        const needServerCompress = fileItem.serverCompress
        const uploadChannel = fileItem.uploadChannel || this.uploadChannel
        const autoRetry = this.autoRetry && uploadChannel !== 'external'
        const uploadNameType = uploadChannel === 'external' ? 'default' : this.uploadNameType
        
        // 创建 AbortController 用于取消上传
        const abortController = new AbortController()
        this.abortControllers.set(file.file.uid, abortController)
        
        const formData = new FormData()
        formData.append('file', file.file)
        if (uploadChannel === 'external') {
            formData.append('url', file.file.url)
        }

        // HuggingFace 渠道：在前端预计算 SHA256，避免后端 CPU 超时
        if (uploadChannel === 'huggingface') {
            try {
                console.log('Computing SHA256 for HuggingFace upload...')
                const sha256 = await computeSha256(file.file)
                formData.append('sha256', sha256)
                console.log('SHA256 computed:', sha256)
            } catch (err) {
                console.error('Failed to compute SHA256:', err)
                // 继续上传，让后端计算（可能会超时）
            }
        }

        axios({
            url: '/upload' + 
                '?serverCompress=' + needServerCompress + 
                '&uploadChannel=' + uploadChannel + 
                (this.channelName ? '&channelName=' + encodeURIComponent(this.channelName) : '') +
                '&uploadNameType=' + uploadNameType + 
                '&autoRetry=' + autoRetry + 
                '&uploadFolder=' + this.uploadFolder,
            method: 'post',
            data: formData,
            withAuthCode: true,
            signal: abortController.signal, // 添加取消信号
            onUploadProgress: (progressEvent) => {
                const percentCompleted = Math.round((progressEvent.loaded / progressEvent.total) * 100)
                file.onProgress({ percent: percentCompleted, file: file.file })
            }
        }).then(res => {
            file.onSuccess(res, file.file)
        }).catch(err => {
            // 如果是取消操作，不加入异常列表
            if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
                console.log('上传已取消:', file.file.name)
                return
            }
            if (err.response && err.response.status !== 401) {
                this.exceptionList.push(file)
                file.onError(err, file.file)
            } else if (!err.response) {
                // 网络错误（如 ERR_HTTP2_PROTOCOL_ERROR），也加入异常列表
                this.exceptionList.push(file)
                file.onError(err, file.file)
            }
        }).finally(() => {
            // 清理 AbortController
            this.abortControllers.delete(file.file.uid)
            // 调用并发控制的完成回调
            this.onUploadComplete()
        })
    },
    // 分块上传
    async uploadFileInChunks(file) {
        const fileItem = this.fileList.find(item => item.uid === file.file.uid)
        if (!fileItem) return // 文件已被删除
        
        const uploadChannel = fileItem.uploadChannel || this.uploadChannel
        
        // 创建 AbortController 用于取消上传
        const abortController = new AbortController()
        this.abortControllers.set(file.file.uid, abortController)
        
        // Discord 使用 9MB 分块（留安全余量，Discord 限制 10MB）
        // Telegram 使用 16MB 分块（TG Bot getFile 下载限制 20MB，留 4MB 安全余量）
        // 其他渠道使用 16MB 分块
        const CHUNK_SIZE = uploadChannel === 'discord' 
            ? 9 * 1024 * 1024  // 9MB for Discord
            : 16 * 1024 * 1024 // 16MB for Telegram and others (TG getFile limit: 20MB)
        
        const fileSize = file.file.size
        const totalChunks = Math.ceil(fileSize / CHUNK_SIZE)
        
        const needServerCompress = fileItem.serverCompress
        const autoRetry = this.autoRetry && uploadChannel !== 'external'
        const uploadNameType = uploadChannel === 'external' ? 'default' : this.uploadNameType

        // HuggingFace 渠道：在前端预计算 SHA256
        let precomputedSha256 = null
        if (uploadChannel === 'huggingface') {
            try {
                console.log('Computing SHA256 for HuggingFace chunked upload...')
                precomputedSha256 = await computeSha256(file.file)
                console.log('SHA256 computed:', precomputedSha256)
            } catch (err) {
                console.error('Failed to compute SHA256:', err)
            }
        }

        try {
            // 第一步：初始化分块上传，获取uploadId
            const initFormData = new FormData()
            initFormData.append('originalFileName', file.file.name)
            initFormData.append('originalFileType', file.file.type)
            initFormData.append('totalChunks', totalChunks.toString())

            const initResponse = await axios({
                url: '/upload' + 
                    '?serverCompress=' + needServerCompress + 
                    '&uploadChannel=' + uploadChannel + 
                    (this.channelName ? '&channelName=' + encodeURIComponent(this.channelName) : '') +
                    '&uploadNameType=' + uploadNameType + 
                    '&autoRetry=' + autoRetry + 
                    '&uploadFolder=' + this.uploadFolder +
                    '&initChunked=true',
                method: 'post',
                data: initFormData,
                withAuthCode: true
            })

            if (!initResponse.data.success) {
                throw new Error('初始化分块上传失败: ' + initResponse.data.message)
            }

            const uploadId = initResponse.data.uploadId
            console.log('分块上传初始化成功，uploadId:', uploadId)

            // 记录 totalChunks 和 uploadId 到文件项，用于后续清理
            const fileItem = this.fileList.find(item => item.uid === file.file.uid)
            if (fileItem) {
                fileItem.totalChunks = totalChunks
                fileItem.uploadId = uploadId
            }

            // 第二步：并发上传所有分块
            const maxConcurrency = 3 // 最大并发数
            const chunkProgress = new Array(totalChunks).fill(0)
            let nextChunkIndex = 0
            let hasError = false
            let errorMsg = ''
            let isCancelled = false // 标记是否被取消

            const uploadChunk = async (chunkIndex) => {
                if (hasError || isCancelled) return

                const start = chunkIndex * CHUNK_SIZE
                const end = Math.min(start + CHUNK_SIZE, fileSize)
                const chunk = file.file.slice(start, end)
                
                const formData = new FormData()
                formData.append('file', chunk, `${file.file.name}.part${chunkIndex.toString().padStart(3, '0')}`)
                formData.append('chunkIndex', chunkIndex.toString())
                formData.append('totalChunks', totalChunks.toString())
                formData.append('uploadId', uploadId)
                formData.append('originalFileName', file.file.name)
                formData.append('originalFileType', file.file.type)

                let retryCount = 0
                const maxRetries = 3

                while (retryCount < maxRetries) {
                    if (hasError || isCancelled) return
                    try {
                        await axios({
                            url: '/upload' + 
                                '?serverCompress=' + needServerCompress + 
                                '&uploadChannel=' + uploadChannel + 
                                (this.channelName ? '&channelName=' + encodeURIComponent(this.channelName) : '') +
                                '&uploadNameType=' + uploadNameType + 
                                '&autoRetry=' + autoRetry + 
                                '&uploadFolder=' + this.uploadFolder +
                                '&chunked=true',
                            method: 'post',
                            data: formData,
                            withAuthCode: true,
                            signal: abortController.signal, // 添加取消信号
                            onUploadProgress: (progressEvent) => {
                                if (hasError || isCancelled) return
                                const percent = Math.round((progressEvent.loaded / progressEvent.total) * 100)
                                chunkProgress[chunkIndex] = percent
                                const totalPercent = Math.round(chunkProgress.reduce((a, b) => a + b, 0) / totalChunks)
                                file.onProgress({ percent: totalPercent, file: file.file })
                            }
                        })
                        return // Success
                    } catch (err) {
                        // 如果是取消操作，直接返回
                        if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
                            isCancelled = true
                            console.log('分块上传已取消:', file.file.name)
                            return
                        }
                        retryCount++
                        console.warn(`分块 ${chunkIndex + 1}/${totalChunks} 上传失败 (重试 ${retryCount}/${maxRetries}):`, err)
                        if (retryCount >= maxRetries) {
                            hasError = true
                            errorMsg = `分块 ${chunkIndex + 1}/${totalChunks} 上传失败: ${err.message}`
                            throw new Error(errorMsg)
                        }
                        // 等待后重试
                        await new Promise(resolve => setTimeout(resolve, 2000 * retryCount))
                    }
                }
            }

            // 创建并发池
            const pool = []
            for (let i = 0; i < maxConcurrency; i++) {
                pool.push((async () => {
                    while (nextChunkIndex < totalChunks && !hasError && !isCancelled) {
                        const currentIndex = nextChunkIndex++
                        try {
                            await uploadChunk(currentIndex)
                        } catch (e) {
                            if (!isCancelled) {
                                hasError = true
                                errorMsg = e.message
                            }
                            break
                        }
                    }
                })())
            }

            await Promise.all(pool)

            // 如果被取消，直接返回
            if (isCancelled) {
                console.log('分块上传已取消，跳过合并步骤')
                return
            }

            if (hasError) {
                throw new Error(errorMsg || '上传过程中发生错误')
            }

            // 第三步：所有分块上传完成，发送合并请求
            this.$message({
                type: 'info',
                message: '分块上传完成，正在合并文件，请耐心等待...',
                duration: 0 // 不自动关闭
            })

            const mergeFormData = new FormData()
            mergeFormData.append('uploadId', uploadId)
            mergeFormData.append('totalChunks', totalChunks.toString())
            mergeFormData.append('originalFileName', file.file.name)
            mergeFormData.append('originalFileType', file.file.type)
            // HuggingFace 渠道：传递预计算的 SHA256
            if (precomputedSha256) {
                mergeFormData.append('sha256', precomputedSha256)
            }

            const response = await axios({
                url: '/upload' + 
                    '?serverCompress=' + needServerCompress + 
                    '&uploadChannel=' + uploadChannel + 
                    (this.channelName ? '&channelName=' + encodeURIComponent(this.channelName) : '') +
                    '&uploadNameType=' + uploadNameType + 
                    '&autoRetry=' + autoRetry + 
                    '&uploadFolder=' + this.uploadFolder +
                    '&chunked=true&merge=true',
                method: 'post',
                data: mergeFormData,
                withAuthCode: true
            })
            
            // 关闭提示
            this.$message.closeAll()

            // 同步处理完成
            file.onSuccess(response, file.file)
        } catch (err) {
            // 如果是取消操作，不加入异常列表
            if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED') {
                console.log('分块上传已取消:', file.file.name)
                return
            }
            
            console.error('分块上传失败:', err)
            
            // 如果有uploadId，清理相关资源
            const fileItem = this.fileList.find(item => item.uid === file.file.uid)
            if (fileItem && fileItem.uploadId) {
                this.cleanupUploadResources(fileItem.uploadId, fileItem.totalChunks)
                    .then(() => {
                        console.log(`已清理分块上传失败的资源: ${fileItem.uploadId}`)
                    })
                    .catch(cleanupError => {
                        console.warn('清理分块上传失败资源时出错:', cleanupError)
                    })
            }
            
            if (err.response && err.response.status !== 401) {
                this.exceptionList.push(file)
                file.onError(err, file.file)
            } else if (!err.response) {
                // 网络错误，也加入异常列表
                this.exceptionList.push(file)
                file.onError(err, file.file)
            }
        } finally {
            // 清理 AbortController
            this.abortControllers.delete(file.file.uid)
            // 调用并发控制的完成回调
            this.onUploadComplete()
        }
    },
    handleRemove(file) {
        // 如果文件正在上传，取消上传
        if (this.abortControllers.has(file.uid)) {
            this.abortControllers.get(file.uid).abort()
            this.abortControllers.delete(file.uid)
        }
        // 从上传队列中移除（如果在等待中）
        this.uploadQueue = this.uploadQueue.filter(item => item.file.uid !== file.uid)
        // 从文件列表中移除
        this.fileList = this.fileList.filter(item => item.uid !== file.uid)
        this.$message({
            type: 'info',
            message: this.truncateFilename(file.name) + '已删除'
        })
    },

    // 清理上传资源
    async cleanupUploadResources(uploadId, totalChunks = 0) {
        try {
            await axios({
                url: `/upload?cleanup=true&uploadId=${uploadId}&totalChunks=${totalChunks}`,
                method: 'get',
                withAuthCode: true,
                timeout: 5000
            })
            console.log(`清理上传资源成功: ${uploadId}`)
        } catch (error) {
            console.warn('清理上传资源失败:', error)
        }
    },
    handleSuccess(response, file) {
        const fileItem = this.fileList.find(item => item.uid === file.uid)
        if (!fileItem) return // 文件已被删除
        
        try {     
            // 对上传渠道为外链的，不修改链接
            const uploadChannel = fileItem.uploadChannel || this.uploadChannel
            if (uploadChannel !== 'external') {
                // 从response.data[0].src中去除/file/前缀
                const srcID = response.data[0].src.replace('/file/', '')
                fileItem.url = `${window.location.protocol}//${window.location.host}/file/` + srcID
                const urls = buildFileUrls(srcID, file.name, this.rootUrl)
                Object.assign(fileItem, urls)
                fileItem.srcID = srcID
            }
            fileItem.progreess = 100
            fileItem.status = 'success'
            
            // Save to history
            this.saveToHistory(fileItem)

            this.$message({
                type: 'success',
                message: this.truncateFilename(file.name) + '上传成功'
            })
            setTimeout(() => {
                const item = this.fileList.find(item => item.uid === file.uid)
                if (item) item.status = 'done'
            }, 1000)
        } catch (error) {
            this.$message.error(this.truncateFilename(file.name) + '上传失败')
            fileItem.status = 'exception'
        }
        // 注意：并发控制的 onUploadComplete 已在各上传方法的 finally 中调用
    },
    saveToHistory(fileItem) {
        try {
            const history = JSON.parse(localStorage.getItem('uploadHistory') || '[]')
            const newRecord = {
                name: fileItem.name,
                url: fileItem.finalURL,
                time: Date.now(),
                type: fileItem.name.split('.').pop().toLowerCase()
            }
            history.push(newRecord)
            localStorage.setItem('uploadHistory', JSON.stringify(history))
        } catch (e) {
            console.error('Failed to save history', e)
        }
    },
    handleError(err, file) {
        const fileItem = this.fileList.find(item => item.uid === file.uid)
        if (!fileItem) return // 文件已被删除
        
        this.$message.error(this.truncateFilename(file.name) + '上传失败')
        fileItem.status = 'exception'
        
        // 如果开启了自动重试，安排自动重试
        if (this.autoReUpload) {
            this.scheduleAutoRetry();
        }
        // 注意：并发控制的 onUploadComplete 已在各上传方法的 finally 中调用
    },
    handleCopy(file) {
        const status = this.fileList.find(item => item.uid === file.uid).status
        if (status !== 'done' && status !== 'success') {
            this.$message({ type: 'warning', message: '文件未上传成功，无法复制链接' })
            return
        }
        navigator.clipboard.writeText(getUrlByFormat(file, this.selectedUrlForm))
        this.$message({ type: 'success', message: '复制成功' })
    },
    beforeUpload(file) {
        return new Promise(async (resolve, reject) => {
            let processedFile = file
            
            // WebP 转换：在压缩之前进行
            // 条件：1.开启WebP转换 2.文件类型为图片 3.不是WebP/GIF/SVG格式
            const canConvertToWebp = this.convertToWebp && 
                file.type.includes('image') && 
                !file.type.includes('webp') && 
                !file.type.includes('gif') && 
                !file.type.includes('svg')
            
            if (canConvertToWebp) {
                try {
                    const convertedFile = await this.convertImageToWebp(file)
                    if (convertedFile) {
                        processedFile = convertedFile
                        console.log(`WebP转换成功: ${file.name} -> ${convertedFile.name}, 大小: ${(file.size/1024).toFixed(1)}KB -> ${(convertedFile.size/1024).toFixed(1)}KB`)
                    }
                } catch (err) {
                    console.warn('WebP转换失败，使用原文件:', err)
                    // 转换失败，继续使用原文件
                }
            }
            
            // 客户端压缩条件：1.文件类型为图片 2.开启客户端压缩，且文件大小大于压缩阈值
            const needCustomCompress = processedFile.type.includes('image') && this.customerCompress && processedFile.size / 1024 / 1024 > this.compressBar
            const isLtLim = processedFile.size / 1024 / 1024 <= 1024 || this.uploadChannel !== 'telegram'

            const pushFileToQueue = (file, serverCompress) => {
                const fileUrl = URL.createObjectURL(file)
                this.fileList.push({
                    uid: file.uid,
                    name: file.name,
                    url: fileUrl,
                    finalURL: '',
                    mdURL: '',
                    htmlURL: '',
                    ubbURL: '',
                    srcID: '',
                    status: 'uploading',
                    progreess: 0,
                    serverCompress: serverCompress,
                    retryCount: 0,
                })
                resolve(file)
            }

            if (needCustomCompress) {
                //尝试压缩图片
                imageConversion.compressAccurately(processedFile, 1024 * this.compressQuality).then((res) => {
                    //如果压缩后大于1024MB，且上传渠道为telegram，则不上传
                    if (res.size / 1024 / 1024 > 1024 && this.uploadChannel === 'telegram') {
                        this.$message.error(processedFile.name + '压缩后文件过大，无法上传!')
                        reject('文件过大')
                    }
                    this.uploading = true
                    //将res包装成新的file
                    const newFile = new File([res], processedFile.name, { type: res.type })
                    newFile.uid = file.uid

                    const myUploadCount = this.uploadCount++

                    //开启服务端压缩条件：1.开启服务端压缩 2.文件大小小于10MB 3.上传渠道为Telegram
                    const needServerCompress = this.serverCompress && newFile.size / 1024 / 1024 < 10 && this.uploadChannel === 'telegram'

                    if (myUploadCount === 0) {
                        pushFileToQueue(newFile, needServerCompress)
                    } else {
                        setTimeout(() => {
                            pushFileToQueue(newFile, needServerCompress)
                            this.uploadCount--
                        }, 300 * myUploadCount)
                    }
                }).catch((err) => {
                    this.$message.error(processedFile.name + '压缩失败，无法上传!')
                    reject(err)
                })
            } else if (isLtLim) {
                this.uploading = true
                
                const myUploadCount = this.uploadCount++

                // 开启服务端压缩条件：1.上传渠道为Telegram 2.开启服务端压缩 3.如果为图片，则文件大小小于10MB，否则不限制大小
                const needServerCompress = this.uploadChannel === 'telegram' && this.serverCompress && (processedFile.type.includes('image') ? processedFile.size / 1024 / 1024 < 10 : true)

                if (myUploadCount === 0) {
                    pushFileToQueue(processedFile, needServerCompress)
                } else {
                    setTimeout(() => {
                        pushFileToQueue(processedFile, needServerCompress)
                        this.uploadCount--
                    }, 300 * myUploadCount)
                }
            } else {
                this.$message.error(processedFile.name + '文件过大，无法上传!')
                reject('文件过大')
            }
        })
    },
    handleProgress(event) {
        const fileItem = this.fileList.find(item => item.uid === event.file.uid)
        if (fileItem) {
            fileItem.progreess = event.percent
        }
    },
    copyAll() {
        const urls = this.fileList
            .filter(item => item.status === 'done' || item.status === 'success')
            .map(item => getUrlByFormat(item, this.selectedUrlForm))
            .join('\n')
        navigator.clipboard.writeText(urls)
        this.$message({ type: 'success', message: '整体复制成功' })
    },
    clearFileList() {
        if (this.fileList.length > 0) {
            // 取消所有正在上传的文件
            this.abortControllers.forEach((controller, uid) => {
                controller.abort()
            })
            this.abortControllers.clear()
            // 清空上传队列
            this.uploadQueue = []
            // 清空文件列表
            this.fileList = []
            this.$message({
                type: 'success',
                message: '文件列表已清空'
            })
        } else {
            this.$message({
                type: 'info',
                message: '文件列表为空'
            })
        }
    },
    clearSuccessList() {
        if (this.uploadSuccessCount > 0) {
            this.fileList = this.fileList.filter(item => item.status !== 'done' && item.status !== 'success')
            this.$message({
                type: 'success',
                message: '成功上传文件已清空'
            })
        } else {
            this.$message({
                type: 'info',
                message: '成功上传文件为空'
            })
        }
    },
    handlePaste(event) {
        // 当粘贴位置是文本框时，不执行该操作
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
            return
        }
        const items = event.clipboardData.items
        if (items.length > 0) {
            this.uploadFromUrl(items)
        }
    },
    handleUploadPasteUrls() {
        // 用于上传在上传文本框中粘贴的外链
        const urls = this.pastedUrls.split('\n');
        // 处理空行和首尾空字符，链接须符合URL规范
        const validUrls = urls.map(url => url.trim()).
            filter(url => url !== '').
            filter(url => /^(https?:\/\/[^\s$.?#].[^\s]*)$/.test(url));

        // 根据粘贴上传方式进行上传
        if (this.pasteUploadMethod === 'save') {
            // 正常上传
            this.uploadFromUrl(validUrls.map(url => {
                return {
                    kind: 'string',
                    getAsString: (callback) => {
                        callback(url);
                    }
                }
            }));
        } else if (this.pasteUploadMethod === 'external') {
            // 仅保存外链，使用 external 渠道上传
            for (let i = 0; i < validUrls.length; i++) {
                const url = validUrls[i];
                const fileName = url.split('/').pop();
                const mdUrl = `![${fileName}](${url})`;
                const htmlUrl = `<img src="${url}" alt="${fileName}" width=100% />`;
                const ubbUrl = `[img]${url}[/img]`;
                // 将 url 作为文件内容，文件名为 URL 的最后一部分
                const file = new File([], url.split('/').pop(), { type: 'text/plain' });
                file.uid = Date.now() + i;
                file.url = url;
                this.fileList.push({
                    uid: file.uid,
                    name: file.name,
                    url: url,
                    finalURL: url,
                    mdURL: mdUrl,
                    htmlURL: htmlUrl,
                    ubbURL: ubbUrl,
                    srcID: url,
                    status: 'uploading',
                    progreess: 0,
                    serverCompress: false,
                    uploadChannel: 'external',
                    retryCount: 0,
                });
                // 上传
                this.uploadFile({ file: file, 
                    onProgress: (evt) => this.handleProgress(evt), 
                    onSuccess: (response, file) => this.handleSuccess(response, file), 
                    onError: (error, file) => this.handleError(error, file) });
            }
        }
    },
    uploadFromUrl(items) {
        for (let i = 0; i < items.length; i++) {
            if (items[i].kind === 'file') {
                const file = items[i].getAsFile()
                // 允许上传任意类型的文件
                file.uid = Date.now() + i
                //接收beforeUpload的Promise对象
                const checkResult = this.beforeUpload(file)
                if (checkResult instanceof Promise) {
                    checkResult.then((newFile) => {
                        if (newFile instanceof File) {
                            this.uploadFile({ file: newFile, 
                                onProgress: (evt) => this.handleProgress(evt), 
                                onSuccess: (response, file) => this.handleSuccess(response, file), 
                                onError: (error, file) => this.handleError(error, file) })
                        }
                    }).catch((err) => {
                        console.log(err)
                    })
                }
            } else if (items[i].kind === 'string') {
                items[i].getAsString((text) => {
                    const urlPattern = /^(https?:\/\/[^\s$.?#].[^\s]*)$/;
                    let fileName = '';
                    if (urlPattern.test(text)) {
                        axios.post('/api/fetchRes', { url: text }, {
                            responseType: 'blob'
                        }).then(response => {
                            const contentType = response.headers['content-type'];
                            if (response.status == 200) {
                                // 提取文件名
                                const disposition = response.headers['content-disposition'];
                                if (disposition) {
                                    const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                                    const filenameStarRegex = /filename\*\s*=\s*UTF-8''([^;\n]*)/; // 处理 filename*

                                    let matches = filenameRegex.exec(disposition);
                                    if (matches != null && matches[1]) {
                                        fileName = matches[1].replace(/['"]/g, '');
                                        // 尝试解码
                                        try {
                                            fileName = decodeURIComponent(fileName);
                                        } catch (e) {
                                            fileName = '';
                                        }
                                    } 
                                    if (fileName === '') {
                                        matches = filenameStarRegex.exec(disposition); // 尝试匹配 filename*
                                        if (matches != null && matches[1]) {
                                            fileName = decodeURIComponent(matches[1]);
                                        }
                                    }
                                }
                                // 尝试从URL中提取文件名
                                if (fileName === '') {
                                    const url = new URL(text);
                                    fileName = url.pathname.split('/').pop();
                                }
                                // 未提取到文件名，使用默认文件名
                                if (fileName === '') {
                                    // 获取文件后缀
                                    const url = new URL(text);
                                    let extension = url.pathname.split('.').pop();
                                    // 未能从URL提取有效后缀，使用bin作为默认后缀
                                    if (!extension || extension === '' || extension.length > 10) {
                                        extension = 'bin';
                                    }
                                    fileName = 'PastedFile' + Date.now() + i + '.' + extension;
                                }
                                
                                // 读取文件内容
                                const blob = response.data;
                                const file = new File([blob], fileName, { type: blob.type });
                                file.uid = Date.now() + i;
                                // 接收beforeUpload的Promise对象
                                const checkResult = this.beforeUpload(file);
                                if (checkResult instanceof Promise) {
                                    checkResult.then((newFile) => {
                                        if (newFile instanceof File) {
                                            this.uploadFile({ file: newFile, 
                                                onProgress: (evt) => this.handleProgress(evt), 
                                                onSuccess: (response, file) => this.handleSuccess(response, file), 
                                                onError: (error, file) => this.handleError(error, file) });
                                        }
                                    }).catch((err) => {
                                        console.log(err);
                                    });
                                }
                            } else {
                                throw new Error('URL地址请求失败');
                            }
                        })
                        .catch(error => {
                            this.$message({
                                type: 'warning',
                                message: '粘贴板中的URL地址请求失败'
                            });
                        });
                    }
                });
            }
        }
    },
    handleScroll(event) {
        this.listScrolled = event.scrollTop > 0 && this.fileList.length > 0
    },
    retryError() {
        if (this.exceptionList.length > 0) {
            this.retryFailedFiles(this.exceptionList);
            this.exceptionList = []
        } else {
            this.$message({
                type: 'info',
                message: '无上传失败文件'
            })
        }
    },
    handleAutoRetryChange(val) {
        this.$message({
            type: val ? 'success' : 'info',
            message: val ? '自动重试已开启' : '自动重试已关闭'
        });
        
        // 如果开启自动重试且有失败文件，立即开始重试
        if (val && this.exceptionList.length > 0) {
            this.scheduleAutoRetry();
        }
    },
    retryFailedFiles(files) {
        files.forEach(file => {
            const retryCount = file.retryCount || 0;
            if (retryCount < this.maxRetryCount) {
                file.retryCount = retryCount + 1;
                this.uploadFile({ 
                    file: file.file, 
                    onProgress: (evt) => this.handleProgress(evt), 
                    onSuccess: (response, file) => this.handleSuccess(response, file), 
                    onError: (error, file) => this.handleError(error, file) 
                });
            } else {
                this.$message({
                    type: 'warning',
                    message: `${file.name} 已达到最大重试次数(${this.maxRetryCount})，停止重试`
                });
            }
        });
    },
    scheduleAutoRetry() {
        if (this.retryTimer) {
            clearTimeout(this.retryTimer);
        }
        
        this.retryTimer = setTimeout(() => {
            if (this.autoReUpload && this.exceptionList.length > 0) {
                const filesToRetry = [...this.exceptionList];
                this.exceptionList = [];
                this.retryFailedFiles(filesToRetry);
            }
        }, this.retryDelay);
    },
    // HuggingFace 大文件直传（绕过 CF Workers 限制）
    // 流程：前端计算 SHA256 → 获取 S3 上传 URL → 直传到 S3 → 提交文件引用
    async uploadToHuggingFaceDirect(file) {
        const fileItem = this.fileList.find(item => item.uid === file.file.uid);
        if (!fileItem) return;

        // 创建 AbortController 用于取消上传
        const abortController = new AbortController();
        this.abortControllers.set(file.file.uid, abortController);

        try {
            console.log('=== HuggingFace Direct Upload ===');
            console.log('File:', file.file.name, 'Size:', file.file.size);

            // 1. 计算 SHA256
            file.onProgress({ percent: 5, file: file.file });
            console.log('Computing SHA256...');
            const sha256 = await computeSha256(file.file);
            console.log('SHA256:', sha256);

            // 检查是否已取消
            if (abortController.signal.aborted) {
                console.log('HuggingFace 上传已取消:', file.file.name);
                return;
            }

            // 2. 获取文件样本（前512字节的base64）
            const sampleBytes = new Uint8Array(await file.file.slice(0, 512).arrayBuffer());
            const fileSample = btoa(String.fromCharCode(...sampleBytes));

            // 3. 获取 LFS 上传 URL
            file.onProgress({ percent: 10, file: file.file });
            console.log('Getting LFS upload URL...');
            const uploadInfoRes = await axios({
                url: '/api/huggingface/getUploadUrl',
                method: 'post',
                data: {
                    fileSize: file.file.size,
                    fileName: file.file.name,
                    fileType: file.file.type,
                    sha256,
                    fileSample,
                    channelName: this.channelName, // 传递指定的渠道名称
                    uploadNameType: this.uploadNameType,
                    uploadFolder: this.uploadFolder
                },
                withAuthCode: true,
                signal: abortController.signal
            });

            if (!uploadInfoRes.data.success) {
                throw new Error(uploadInfoRes.data.error || 'Failed to get upload URL');
            }

            const uploadInfo = uploadInfoRes.data;
            console.log('Upload info:', uploadInfo);

            // 检查文件是否已存在
            if (uploadInfo.alreadyExists) {
                console.log('File already exists in LFS, skipping upload');
                file.onProgress({ percent: 90, file: file.file });
            } else if (uploadInfo.needsLfs && uploadInfo.uploadAction) {
                // 4. 直接上传到 S3
                const { href, header } = uploadInfo.uploadAction;

                if (header?.chunk_size) {
                    // 分片上传
                    await this.uploadToHuggingFaceMultipart(file, uploadInfo, abortController);
                } else {
                    // 基本上传
                    console.log('Uploading to S3 (basic)...');
                    const uploadRes = await fetch(href, {
                        method: 'PUT',
                        headers: header || {},
                        body: file.file,
                        signal: abortController.signal
                    });

                    if (!uploadRes.ok) {
                        const error = await uploadRes.text();
                        throw new Error(`S3 upload failed: ${uploadRes.status} - ${error}`);
                    }
                    console.log('S3 upload complete');
                }
            }

            // 检查是否已取消
            if (abortController.signal.aborted) {
                console.log('HuggingFace 上传已取消:', file.file.name);
                return;
            }

            // 5. 提交文件引用
            file.onProgress({ percent: 95, file: file.file });
            console.log('Committing file...');
            const commitRes = await axios({
                url: '/api/huggingface/commitUpload',
                method: 'post',
                data: {
                    fullId: uploadInfo.fullId,
                    filePath: uploadInfo.filePath,
                    sha256,
                    fileSize: file.file.size,
                    fileName: file.file.name,
                    fileType: file.file.type,
                    channelName: uploadInfo.channelName
                },
                withAuthCode: true,
                signal: abortController.signal
            });

            if (!commitRes.data.success) {
                throw new Error(commitRes.data.error || 'Failed to commit file');
            }

            console.log('Upload complete:', commitRes.data);
            // 转换响应格式以匹配 handleSuccess 期望的格式
            const formattedResponse = {
                data: [{ src: commitRes.data.src }]
            };
            file.onSuccess(formattedResponse, file.file);

        } catch (err) {
            // 如果是取消操作，不加入异常列表
            if (err.name === 'CanceledError' || err.code === 'ERR_CANCELED' || err.name === 'AbortError') {
                console.log('HuggingFace 上传已取消:', file.file.name);
                return;
            }
            console.error('HuggingFace direct upload error:', err);
            this.exceptionList.push(file);
            file.onError(err, file.file);
        } finally {
            // 清理 AbortController
            this.abortControllers.delete(file.file.uid);
            // 调用并发控制的完成回调
            this.onUploadComplete();
        }
    },
    // HuggingFace 分片上传到 S3
    async uploadToHuggingFaceMultipart(file, uploadInfo, abortController) {
        const { uploadAction } = uploadInfo;
        const { href: completionUrl, header } = uploadAction;
        const chunkSize = parseInt(header.chunk_size);

        // 获取所有分片的上传 URL
        const parts = Object.keys(header).filter(key => /^[0-9]+$/.test(key));
        console.log(`Multipart upload: ${parts.length} parts, chunk size: ${chunkSize}`);

        const completeParts = [];
        const totalParts = parts.length;

        for (const part of parts) {
            // 检查是否已取消
            if (abortController && abortController.signal.aborted) {
                console.log('HuggingFace 分片上传已取消');
                throw new DOMException('Upload cancelled', 'AbortError');
            }

            const index = parseInt(part) - 1;
            const start = index * chunkSize;
            const end = Math.min(start + chunkSize, file.file.size);
            const chunk = file.file.slice(start, end);

            console.log(`Uploading part ${part}/${totalParts}`);
            const response = await fetch(header[part], {
                method: 'PUT',
                body: chunk,
                signal: abortController ? abortController.signal : undefined
            });

            if (!response.ok) {
                throw new Error(`Failed to upload part ${part}: ${response.status}`);
            }

            const etag = response.headers.get('ETag');
            if (!etag) {
                throw new Error(`No ETag for part ${part}`);
            }

            completeParts.push({ partNumber: parseInt(part), etag });

            // 更新进度（10% - 90%）
            const progress = 10 + Math.round((parseInt(part) / totalParts) * 80);
            file.onProgress({ percent: progress, file: file.file });
        }

        // 检查是否已取消
        if (abortController && abortController.signal.aborted) {
            console.log('HuggingFace 分片上传已取消');
            throw new DOMException('Upload cancelled', 'AbortError');
        }

        // 完成分片上传
        console.log('Completing multipart upload...');
        const completeResponse = await fetch(completionUrl, {
            method: 'POST',
            headers: {
                'Accept': 'application/vnd.git-lfs+json',
                'Content-Type': 'application/vnd.git-lfs+json'
            },
            body: JSON.stringify({
                oid: uploadInfo.oid,
                parts: completeParts
            }),
            signal: abortController ? abortController.signal : undefined
        });

        if (!completeResponse.ok) {
            const error = await completeResponse.text();
            throw new Error(`Multipart complete failed: ${completeResponse.status} - ${error}`);
        }

        console.log('Multipart upload complete');
    },
    // 将图片转换为 WebP 格式
    async convertImageToWebp(file) {
        return new Promise((resolve, reject) => {
            // 不支持转换的格式直接返回 null
            if (file.type.includes('gif') || file.type.includes('svg') || file.type.includes('webp')) {
                resolve(null)
                return
            }
            
            const img = new Image()
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')
            
            img.onload = () => {
                canvas.width = img.width
                canvas.height = img.height
                ctx.drawImage(img, 0, 0)
                
                canvas.toBlob((blob) => {
                    if (blob) {
                        // 修改文件名：将原扩展名替换为 .webp
                        const originalName = file.name
                        const lastDotIndex = originalName.lastIndexOf('.')
                        const newName = lastDotIndex > 0 
                            ? originalName.substring(0, lastDotIndex) + '.webp'
                            : originalName + '.webp'
                        
                        const webpFile = new File([blob], newName, { type: 'image/webp' })
                        webpFile.uid = file.uid
                        resolve(webpFile)
                    } else {
                        reject(new Error('WebP 转换失败'))
                    }
                    
                    // 清理
                    URL.revokeObjectURL(img.src)
                }, 'image/webp', 0.92) // 0.92 质量参数，平衡质量和大小
            }
            
            img.onerror = () => {
                URL.revokeObjectURL(img.src)
                reject(new Error('图片加载失败'))
            }
            
            img.src = URL.createObjectURL(file)
        })
    },
    // 拖拽上传卡片鼠标移动事件 - 悬浮光斑效果
    handleUploadCardMouseMove(e) {
        const glow = this.$refs.uploadCardGlow;
        if (!glow) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        glow.style.opacity = '1';
        glow.style.left = x + 'px';
        glow.style.top = y + 'px';
    },
    // 拖拽上传卡片鼠标离开事件
    handleUploadCardMouseLeave() {
        const glow = this.$refs.uploadCardGlow;
        if (!glow) return;
        glow.style.opacity = '0';
    },
},
beforeDestroy() {
    // 清理定时器
    if (this.retryTimer) {
        clearTimeout(this.retryTimer);
    }
}
}
</script>

<style scoped> 
@property --border-angle {
    syntax: '<angle>';
    initial-value: 0deg;
    inherits: false;
}

@keyframes borderRotate {
    0% {
        --border-angle: 0deg;
    }
    100% {
        --border-angle: 360deg;
    }
}
.upload-form {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
}
.upload-list-card {
    width: 55vw;
    height: 7vh;
    margin-top: 10px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border-radius: 15px;
    background-color: var(--upload-list-card-bg-color);
    backdrop-filter: blur(10px);
    border: var(--upload-list-card-border);
    box-shadow: var(--upload-list-card-box-shadow) !important;
    transition: height 0.3s ease;
    overflow: hidden;
}
.upload-list-card :deep(.el-card__body) {
    padding: 0;
    width: 100%;
    overflow: hidden;
}
.upload-list-container {
    width: 55vw;
    height: 7vh;
    transition: height 0.3s ease;
    overflow: hidden;
}
@media (max-width: 768px) {
    .upload-list-card {
        width: 70vw;
    }
    .upload-list-container {
        width: 70vw;
    }
}
.upload-list-card.upload-list-busy {
    height: 40vh;
}
.upload-list-container.upload-list-busy {
    height: 40vh;
}

/* 上传时列表卡片边框效果 - 与流光颜色一致 */
.upload-list-card.is-uploading {
    border: 1px solid var(--el-upload-dragger-uniform-color, #409eff) !important;
    box-shadow: 0 0 20px color-mix(in srgb, var(--el-upload-dragger-uniform-color, #409eff) 30%, transparent),
                0 0 40px color-mix(in srgb, var(--el-upload-dragger-uniform-color, #409eff) 15%, transparent),
                inset 0 0 20px color-mix(in srgb, var(--el-upload-dragger-uniform-color, #409eff) 8%, transparent) !important;
}

/* 拖拽上传卡片包装器 - 用于悬浮光斑效果 */
.upload-card-wrapper {
    position: relative;
    overflow: visible;
}

/* 悬浮光斑效果 */
.upload-card-glow {
    position: absolute;
    width: 200px;
    height: 200px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(96, 165, 250, 0.2) 0%, transparent 70%);
    pointer-events: none;
    transform: translate(-50%, -50%);
    opacity: 0;
    transition: opacity 0.3s ease;
    z-index: 10;
}

.upload-card {
    width: 55vw;
    padding: 20px;
    background: none;
}
@media (max-width: 768px) {
    .upload-card {
        width: 70vw;
    }
}
.upload-card-busy :deep(.el-upload-dragger) {
    height: 17vh;
}
:deep(.el-upload-dragger)  {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 45vh;
    border-radius: 15px;
    border: var(--el-upload-dragger-border);
    opacity: 0.7;
    background-color: var(--el-upload-dragger-bg-color);
    backdrop-filter: blur(10px);
    transition: all 0.3s ease;
}
:deep(.el-upload:focus .el-upload-dragger) {
    border-color: var(--el-upload-dragger-border-color);
}
:deep(.el-upload-dragger:hover) {
    opacity: 0.8;
    box-shadow: var(--el-upload-dragger-hover-box-shadow);
}
:deep(.el-upload-dragger.is-dragover) {
    opacity: 0.8;
    box-shadow: var(--el-upload-dragger-hover-box-shadow);
}
.is-uploading :deep(.el-upload-dragger) {
    border-color: transparent !important;
}

/* 上传时的边缘流光旋转效果 */
.upload-card.is-uploading {
    position: relative;
    background: none;
}

.upload-card.is-uploading::before {
    content: '';
    position: absolute;
    top: 20px;
    left: 20px;
    right: 20px;
    bottom: 20px;
    border-radius: 15px;
    padding: 2px;
    background: conic-gradient(
        from var(--border-angle),
        transparent 0deg,
        transparent 30deg,
        var(--el-upload-dragger-uniform-color, #409eff) 60deg,
        color-mix(in srgb, var(--el-upload-dragger-uniform-color, #409eff) 70%, white) 90deg,
        transparent 120deg,
        transparent 180deg,
        color-mix(in srgb, var(--el-upload-dragger-uniform-color, #409eff) 70%, white) 210deg,
        var(--el-upload-dragger-uniform-color, #409eff) 240deg,
        transparent 270deg,
        transparent 360deg
    );
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    mask-composite: exclude;
    animation: borderRotate 2s linear infinite;
    pointer-events: none;
    z-index: 1;
}
.el-upload__text {
    font-weight: bold;
    font-size: medium;
    user-select: none;
    transition: all 0.3s ease;
}
@media (max-width: 768px) {
    .el-upload__text {
        font-size: small;
    }
}
.el-upload__text.upload-list-busy {
    font-size: small;
}
.el-icon--upload {
    font-size: 100px;
    transition: font-size 0.3s ease;
    color: var(--el-icon--upload-color);
}
.el-icon--upload.upload-list-busy {
    font-size: 60px;
}
@media (max-width: 768px) {
    .el-icon--upload {
        font-size: 50px;
    }
    .el-icon--upload.upload-list-busy {
        font-size: 30px;
    }
}

.paste-card {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 45vh;
    border-radius: 15px;
    border: var(--el-upload-dragger-border);
    box-shadow: none;
    opacity: 0.7;
    background-color: var(--el-upload-dragger-bg-color);
    backdrop-filter: blur(10px);
    transition: all 0.3s ease;
    box-sizing: border-box;
}
.paste-card:hover {
    opacity: 0.8;
    box-shadow: var(--el-upload-dragger-hover-box-shadow);
}

/* 粘贴卡片上传时的边缘流光效果 */
.paste-card.is-uploading {
    position: relative;
    border-color: transparent !important;
    overflow: visible;
}

.paste-card.is-uploading::before {
    content: '';
    position: absolute;
    inset: -4px;
    border-radius: 15px;
    padding: 2px;
    background: conic-gradient(
        from var(--border-angle),
        transparent 0deg,
        transparent 30deg,
        var(--el-upload-dragger-uniform-color, #409eff) 60deg,
        color-mix(in srgb, var(--el-upload-dragger-uniform-color, #409eff) 70%, white) 90deg,
        transparent 120deg,
        transparent 180deg,
        color-mix(in srgb, var(--el-upload-dragger-uniform-color, #409eff) 70%, white) 210deg,
        var(--el-upload-dragger-uniform-color, #409eff) 240deg,
        transparent 270deg,
        transparent 360deg
    );
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    mask-composite: exclude;
    animation: borderRotate 2s linear infinite;
    pointer-events: none;
    z-index: 1;
}

.paste-card :deep(.el-card__body) {
    padding: 0;
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
}
.upload-card-busy.paste-card {
    height: 17vh;
}
.upload-card-textarea {
    width: 50vw;
    height: 70%;
    border-radius: 16px;
    background: var(--textarea-bg, linear-gradient(135deg, rgba(64, 158, 255, 0.03) 0%, rgba(64, 158, 255, 0.01) 100%));
    backdrop-filter: blur(12px);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    box-sizing: border-box;
    display: flex;
    position: relative;
}
.upload-card-busy .upload-card-textarea {
    height: 50%;
}

.upload-card-textarea::before {
    content: '';
    position: absolute;
    inset: -1px;
    border-radius: 17px;
    padding: 1px;
    background: linear-gradient(135deg, rgba(64, 158, 255, 0.3) 0%, rgba(64, 158, 255, 0.1) 50%, rgba(64, 158, 255, 0.3) 100%);
    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
    -webkit-mask-composite: xor;
    mask-composite: exclude;
    pointer-events: none;
    opacity: 0.6;
    transition: opacity 0.3s ease;
}

.upload-card-textarea:hover::before {
    opacity: 1;
}

.upload-card-textarea:focus-within::before {
    opacity: 1;
    background: linear-gradient(135deg, rgba(64, 158, 255, 0.6) 0%, rgba(64, 158, 255, 0.2) 50%, rgba(64, 158, 255, 0.6) 100%);
}

:deep(.el-textarea__inner) {
    border-radius: 16px;
    background: var(--textarea-inner-bg, rgba(0, 0, 0, 0.02));
    backdrop-filter: blur(12px);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    resize: none;
    border: 1px solid transparent;
    padding: 16px 20px;
    font-size: 14px;
    line-height: 1.6;
    color: var(--el-text-color-primary);
}

:deep(.el-textarea__inner::placeholder) {
    color: var(--el-text-color-placeholder);
    font-weight: 400;
    opacity: 0.7;
}

:deep(.el-textarea__inner:hover) {
    background: var(--textarea-inner-hover-bg, rgba(64, 158, 255, 0.03));
}

:deep(.el-textarea__inner:focus) {
    border-color: transparent;
    box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.15),
                0 4px 20px rgba(64, 158, 255, 0.1),
                inset 0 1px 3px rgba(0, 0, 0, 0.05);
    background: var(--textarea-inner-focus-bg, rgba(64, 158, 255, 0.02));
}

/* Modern Scrollbar Styles */
.upload-card-textarea ::-webkit-scrollbar {
    width: 6px;
    height: 6px;
}

.upload-card-textarea ::-webkit-scrollbar-track {
    background: transparent;
    border-radius: 6px;
    margin: 8px;
}

.upload-card-textarea ::-webkit-scrollbar-thumb {
    background: linear-gradient(180deg, rgba(64, 158, 255, 0.4) 0%, rgba(64, 158, 255, 0.6) 100%);
    border-radius: 6px;
    transition: background 0.3s ease;
}

.upload-card-textarea ::-webkit-scrollbar-thumb:hover {
    background: linear-gradient(180deg, rgba(64, 158, 255, 0.6) 0%, rgba(64, 158, 255, 0.8) 100%);
}
.paste-card-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 50vw;
    margin-top: 3%;
}

/* Modern Paste Card Styles */
.paste-card-upload-button {
    min-width: 100px;
    height: 42px;
    border-radius: 14px !important;
    font-weight: 600;
    font-size: 15px;
    letter-spacing: 2px;
    background: linear-gradient(135deg, #409eff 0%, #66b1ff 100%) !important;
    border: none !important;
    box-shadow: 0 4px 15px rgba(64, 158, 255, 0.35),
                inset 0 1px 0 rgba(255, 255, 255, 0.2);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
    position: relative;
    overflow: hidden;
}

.paste-card-upload-button::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.25), transparent);
    transition: left 0.6s ease;
}

.paste-card-upload-button:hover {
    transform: translateY(-3px) scale(1.02);
    box-shadow: 0 8px 25px rgba(64, 158, 255, 0.45),
                inset 0 1px 0 rgba(255, 255, 255, 0.25);
}

.paste-card-upload-button:hover::before {
    left: 100%;
}

.paste-card-upload-button:active {
    transform: translateY(-1px) scale(0.98);
}

/* 上传状态下缩小按钮 */
.upload-card-busy .paste-card-upload-button {
    min-width: 70px;
    height: 32px;
    border-radius: 10px !important;
    font-size: 13px;
    letter-spacing: 1px;
}

.upload-card-busy .paste-card-actions {
    margin-top: 2%;
}

/* Modern Radio Button Group */
.paste-card-method-group {
    background: var(--paste-method-group-bg, rgba(64, 158, 255, 0.08));
    border-radius: 14px;
    padding: 4px;
    border: 1px solid var(--paste-method-group-border, rgba(64, 158, 255, 0.15));
}
.paste-card-method-group :deep(.el-radio-button__inner) {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    border-radius: 10px !important;
    border: none !important;
    background: transparent;
    font-weight: 500;
    padding: 10px 20px;
    color: var(--el-text-color-regular);
}

.paste-card-method-group :deep(.el-radio-button:first-child .el-radio-button__inner) {
    border-radius: 10px !important;
}

.paste-card-method-group :deep(.el-radio-button:last-child .el-radio-button__inner) {
    border-radius: 10px !important;
}

.paste-card-method-group :deep(.el-radio-button__inner:hover) {
    background: var(--paste-method-hover-bg, rgba(64, 158, 255, 0.12));
    color: var(--el-color-primary);
}

.paste-card-method-group :deep(.el-radio-button__original-radio:checked + .el-radio-button__inner) {
    background: linear-gradient(135deg, #409eff 0%, #66b1ff 100%) !important;
    color: white !important;
    box-shadow: 0 3px 10px rgba(64, 158, 255, 0.35);
}

/* Mobile responsive for paste card */
@media (max-width: 768px) {
    .paste-card {
        height: auto;
        min-height: 30vh;
        padding: 6px;
        border-radius: 12px;
    }

    .upload-card-busy.paste-card {
        height: auto;
        min-height: 18vh;
        padding: 5px;
    }

    .upload-card-textarea {
        margin-top: 4px;
        width: calc(100% - 4px) !important;
    }

    .upload-card-textarea::before {
        border-radius: 11px;
    }

    :deep(.el-textarea__inner) {
        border-radius: 10px;
        padding: 8px 10px;
        font-size: 12px;
    }

    .paste-card-actions {
        width: 100% !important;
        margin-top: 6px;
        gap: 6px;
    }

    .paste-card-upload-button {
        height: 30px;
        min-width: 55px;
        border-radius: 8px !important;
        font-size: 12px;
        letter-spacing: 0.5px;
        padding: 0 10px;
    }

    .paste-card-method-group {
        border-radius: 8px;
        padding: 2px;
        height: 30px;
        display: flex;
        align-items: center;
    }

    .paste-card-method-group :deep(.el-radio-button__inner) {
        padding: 4px 10px;
        font-size: 11px;
        border-radius: 6px !important;
        height: 26px;
        display: flex;
        align-items: center;
    }
}

.upload-list-dashboard {
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 7vh;
    padding: 0 15px;
    position: sticky;
    top: 0;
    z-index: 1;
    border-radius: 15px;
    transition: all 0.3s ease;
}
.upload-list-dashboard.list-scrolled {
    background-color: var(--upload-list-dashboard-bg-color);
    box-shadow: var(--upload-list-dashboard-shadow);
}

/* Enhanced Starry Sky Effect */
:deep(.el-upload-dragger) {
    position: relative;
    overflow: hidden;
}

/* Layer 1: Distant stars (Small, slow, dense) */
:deep(.el-upload-dragger::before) {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background-image: 
        radial-gradient(2px 2px at 10% 10%, var(--el-upload-dragger-uniform-color) 50%, transparent 0),
        radial-gradient(2px 2px at 20% 30%, var(--el-upload-dragger-uniform-color) 50%, transparent 0),
        radial-gradient(2px 2px at 30% 10%, var(--el-upload-dragger-uniform-color) 50%, transparent 0),
        radial-gradient(2px 2px at 40% 30%, var(--el-upload-dragger-uniform-color) 50%, transparent 0),
        radial-gradient(2px 2px at 50% 10%, var(--el-upload-dragger-uniform-color) 50%, transparent 0),
        radial-gradient(2px 2px at 60% 30%, var(--el-upload-dragger-uniform-color) 50%, transparent 0),
        radial-gradient(2px 2px at 70% 10%, var(--el-upload-dragger-uniform-color) 50%, transparent 0),
        radial-gradient(2px 2px at 80% 30%, var(--el-upload-dragger-uniform-color) 50%, transparent 0),
        radial-gradient(2px 2px at 90% 10%, var(--el-upload-dragger-uniform-color) 50%, transparent 0),
        radial-gradient(2px 2px at 15% 70%, var(--el-upload-dragger-uniform-color) 50%, transparent 0);
    background-size: 200px 200px;
    opacity: 0;
    z-index: 0;
    transition: opacity 0.6s ease;
}

/* Layer 2: Close stars (Larger, faster, sparse) */
:deep(.el-upload-dragger::after) {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    background-image: 
        radial-gradient(3px 3px at 15% 15%, var(--el-upload-dragger-uniform-color) 50%, transparent 0),
        radial-gradient(3px 3px at 50% 50%, var(--el-upload-dragger-uniform-color) 50%, transparent 0),
        radial-gradient(3px 3px at 85% 85%, var(--el-upload-dragger-uniform-color) 50%, transparent 0),
        radial-gradient(2.5px 2.5px at 35% 65%, var(--el-upload-dragger-uniform-color) 50%, transparent 0),
        radial-gradient(2.5px 2.5px at 65% 35%, var(--el-upload-dragger-uniform-color) 50%, transparent 0);
    background-size: 150px 150px;
    opacity: 0;
    z-index: 0;
    transition: opacity 0.6s ease;
}

.upload-card:hover :deep(.el-upload-dragger::before) {
    opacity: 0.3;
    animation: starScroll 60s linear infinite;
}

.upload-card:hover :deep(.el-upload-dragger::after) {
    opacity: 0.6;
    animation: starScroll 40s linear infinite, starPulse 4s ease-in-out infinite;
}

@keyframes starScroll {
    from { background-position: 0 0; }
    to { background-position: 100px 100px; }
}

@keyframes starPulse {
    0%, 100% { opacity: 0.6; }
    50% { opacity: 0.3; }
}

/* ============================================
   Modern Action Button Group Styles
   ============================================ */
.modern-action-group {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px;
    background: var(--modern-action-group-bg, rgba(64, 158, 255, 0.08));
    border-radius: 14px;
    border: 1px solid var(--modern-action-group-border, rgba(64, 158, 255, 0.15));
    box-shadow: 0 2px 8px var(--modern-action-group-shadow, rgba(0, 0, 0, 0.06));
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.modern-action-group:hover {
    background: var(--modern-action-group-hover-bg, rgba(64, 158, 255, 0.12));
    box-shadow: 0 4px 16px var(--modern-action-group-hover-shadow, rgba(64, 158, 255, 0.15));
    transform: translateY(-1px);
}

.modern-action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 10px;
    background: var(--modern-action-btn-bg, linear-gradient(135deg, #409eff 0%, #66b1ff 100%));
    color: white;
    cursor: pointer;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    font-size: 14px;
    box-shadow: 0 2px 6px rgba(64, 158, 255, 0.25);
    position: relative;
    overflow: hidden;
    outline: none !important;
}

.modern-action-btn:focus,
.modern-action-btn:focus-visible {
    outline: none !important;
}

.modern-action-btn::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    transition: left 0.5s ease;
}

.modern-action-btn:hover {
    transform: translateY(-2px) scale(1.05);
    box-shadow: 0 4px 12px rgba(64, 158, 255, 0.4);
}

.modern-action-btn:hover::before {
    left: 100%;
}

.modern-action-btn:active {
    transform: translateY(0) scale(0.98);
    box-shadow: 0 1px 4px rgba(64, 158, 255, 0.3);
}

.modern-action-btn-danger {
    background: var(--modern-action-btn-danger-bg, linear-gradient(135deg, #f56c6c 0%, #f78989 100%));
    box-shadow: 0 2px 6px rgba(245, 108, 108, 0.25);
}

.modern-action-btn-danger:hover {
    box-shadow: 0 4px 12px rgba(245, 108, 108, 0.4);
}

/* Dropdown Menu Styles */
.modern-dropdown-item-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    gap: 12px;
    padding: 4px 0;
}

.modern-dropdown-item-content span {
    font-weight: 500;
    color: var(--el-text-color-primary);
}

/* ============================================
   Dashboard Title Enhancement
   ============================================ */
.upload-list-dashboard-title {
    font-size: 14px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 14px;
    background: var(--dashboard-title-bg, linear-gradient(135deg, rgba(64, 158, 255, 0.06) 0%, transparent 100%));
    border-radius: 12px;
    color: var(--el-text-color-primary);
}

.upload-list-dashboard-title .el-icon {
    font-size: 16px;
    margin-right: 4px;
    opacity: 0.85;
}

/* ============================================
   Mobile Responsive Styles
   ============================================ */
@media (max-width: 768px) {
    .modern-action-group {
        gap: 4px;
        padding: 3px;
        border-radius: 12px;
    }

    .modern-action-btn {
        width: 32px;
        height: 32px;
        border-radius: 8px;
        font-size: 12px;
    }

    .upload-list-dashboard-title {
        font-size: 12px;
        padding: 4px 10px;
    }
}

</style>
