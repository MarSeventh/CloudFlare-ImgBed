<template>
    <div class="container">
    <div class="upload-home">
        <img id="bg1" class="background-image1" alt="Background Image"/>
        <img id="bg2" class="background-image2" alt="Background Image"/>
        <ToggleDark class="toggle-dark-button"/>
        <el-tooltip content="1. 支持多文件上传，支持所有常见文件格式 <br> 2. Telegram 渠道上传的文件大小不支持超过20MB" raw-content placement="bottom">
            <div class="info-container">
                <font-awesome-icon icon="question" class="info-icon" size="lg"/>
            </div>
        </el-tooltip>
        <el-input class="upload-folder" v-model="uploadFolder" placeholder="上传目录"/>
        <el-tooltip content="切换上传方式" placement="bottom" :disabled="disableTooltip">
            <el-button class="upload-method-button" @click="handleChangeUploadMethod">
                <font-awesome-icon v-if="uploadMethod === 'default'"  icon="folder-open" class="upload-method-icon" size="lg"/>
                <font-awesome-icon v-else-if="uploadMethod === 'paste'" icon="paste" class="upload-method-icon" size="lg"/>
            </el-button>
        </el-tooltip>
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
            <el-tooltip :disabled="disableTooltip" content="管理页面" placement="left">
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
        <div class="header">
            <a href="https://github.com/MarSeventh/CloudFlare-ImgBed">
                <img class="logo" alt="Sanyue logo" :src="logoUrl"/>
            </a> 
            <h1 class="title"><a class="main-title" href="https://github.com/MarSeventh/CloudFlare-ImgBed" target="_blank">{{ ownerName }}</a> ImgHub</h1>
        </div>
        <UploadForm 
            :selectedUrlForm="selectedUrlForm" 
            :customerCompress="customerCompress" 
            :compressQuality="compressQuality"
            :compressBar="compressBar"
            :serverCompress="serverCompress"
            :uploadChannel="uploadChannel"
            :uploadNameType="uploadNameType"
            :useCustomUrl="useCustomUrl"
            :customUrlPrefix="customUrlPrefix"
            :autoRetry="autoRetry"
            :urlPrefix="urlPrefix"
            :uploadMethod="uploadMethod"
            :uploadFolder="uploadFolder"
            class="upload"
        />
        <el-dialog title="链接格式设置" v-model="showUrlDialog" :width="dialogWidth" :show-close="false">
            <p style="font-size: medium; font-weight: bold">默认复制链接</p>
            <el-radio-group v-model="selectedUrlForm" @change="changeUrlForm">
                <el-radio value="url">原始链接</el-radio>
                <el-radio value="md">MarkDown</el-radio>
                <el-radio value="html">HTML</el-radio>
                <el-radio value="ubb">BBCode</el-radio>
            </el-radio-group>
            <p style="font-size: medium; font-weight: bold">自定义链接
                <el-tooltip content="默认链接为https://your.domain/file/xxx.jpg <br> 如果启用自定义链接格式，只保留xxx.jpg部分，其他部分请自行输入" placement="top" raw-content>
                    <font-awesome-icon icon="question-circle" class="question-icon" size="me"/>
                </el-tooltip>
            </p>
            <el-form label-width="25%">
                <el-form-item label="启用自定义">
                    <el-radio-group v-model="useCustomUrl">
                        <el-radio value="true">是</el-radio>
                        <el-radio value="false">否</el-radio>
                    </el-radio-group>
                </el-form-item>
                <el-form-item label="自定义前缀" v-if="useCustomUrl === 'true'">
                    <el-input v-model="customUrlPrefix" placeholder="请输入自定义链接前缀"/>
                </el-form-item>
            </el-form>
            <div class="dialog-action">
                <el-button type="primary" @click="showUrlDialog = false">确定</el-button>
            </div>
        </el-dialog>
        <el-dialog title="上传设置" v-model="showCompressDialog" :width="dialogWidth" :show-close="false">
            <el-form label-width="25%">
                <p style="font-size: medium; font-weight: bold">上传渠道</p>
                <el-form-item label="上传渠道">
                    <el-radio-group v-model="uploadChannel">
                        <el-radio label="telegram">Telegram</el-radio>
                        <el-radio label="cfr2">Cloudflare R2</el-radio>
                        <el-radio label="s3">S3</el-radio>
                    </el-radio-group>
                </el-form-item>
                <el-form-item label="上传目录">
                    <el-input style="width: 300px;" v-model="uploadFolder" placeholder="请输入上传目录路径"/>
                </el-form-item>
                <el-form-item label="自动切换">
                    <el-tooltip content="上传失败自动切换到其他渠道上传" placement="top">
                        <font-awesome-icon icon="question-circle" class="question-icon" size="me"/>
                    </el-tooltip>
                    <el-switch
                        v-model="autoRetry"
                        active-text="开启"
                        inactive-text="关闭"
                        active-color="#13ce66"
                        inactive-color="#ff4949"
                    />
                </el-form-item>
                <p style="font-size: medium; font-weight: bold">文件命名方式</p>
                <el-form-item label="命名方式">
                    <el-radio-group v-model="uploadNameType">
                        <el-radio label="default">默认</el-radio>
                        <el-radio label="index">仅前缀</el-radio>
                        <el-radio label="origin">仅原名</el-radio>
                        <el-radio label="short">短链接</el-radio>
                    </el-radio-group>
                </el-form-item>
                <p style="font-size: medium; font-weight: bold">客户端压缩
                    <el-tooltip content="1. 上传前在本地进行压缩，仅对图片文件生效 <br> 2. 若图片大小大于20MB，将自动进行压缩" placement="top" raw-content>
                        <font-awesome-icon icon="question-circle" class="question-icon" size="me"/>
                    </el-tooltip>
                </p>
                <el-form-item label="开启压缩">
                    <el-switch
                        v-model="customerCompress"
                        active-text="开启"
                        inactive-text="关闭"
                        active-color="#13ce66"
                        inactive-color="#ff4949"
                    />
                </el-form-item>
                <el-form-item label="压缩阈值" v-if="customerCompress">
                    <el-tooltip content="设置图片大小阈值，超过此值将自动压缩，单位MB" placement="top">
                        <font-awesome-icon icon="question-circle" class="question-icon" size="me"/>
                    </el-tooltip>
                    <el-slider class="compress-slider" v-model="compressBar" :min="1" :max="20" show-input :format-tooltip="(value) => `${value} MB`"/>
                </el-form-item>
                <el-form-item label="期望大小" v-if="customerCompress">
                    <el-tooltip content="设置压缩后图片大小期望值，单位MB" placement="top">
                        <font-awesome-icon icon="question-circle" class="question-icon" size="me"/>
                    </el-tooltip>
                    <el-slider class="compress-slider" v-model="compressQuality" :min="1" :max="compressBar" :format-tooltip="(value) => `${value} MB`" show-input/>
                </el-form-item>
                <p style="font-size: medium; font-weight: bold" v-if="uploadChannel === 'telegram'">服务端压缩
                    <el-tooltip content="1. 在 Telegram 端进行压缩，仅对上传渠道为 Telegram 的图片文件生效 <br> 2. 若图片大小（本地压缩后大小）大于10MB，本设置自动失效 <br> 3. 若上传分辨率过大、透明背景等图片，建议关闭服务端压缩，否则可能出现未知问题" placement="top" raw-content>
                        <font-awesome-icon icon="question-circle" class="question-icon" size="me"/>
                    </el-tooltip>
                </p>
                <el-form-item label="开启压缩" v-if="uploadChannel === 'telegram'">
                    <el-switch
                        v-model="serverCompress"
                        active-text="开启"
                        inactive-text="关闭"
                        active-color="#13ce66"
                        inactive-color="#ff4949"
                    />
                </el-form-item>
                <div class="dialog-action">
                    <el-button type="primary" @click="showCompressDialog = false">确定</el-button>
                </div>
            </el-form>
        </el-dialog>
    </div>
    <Footer class="footer"/>
    </div>
</template>

<script>
import UploadForm from '@/components/UploadForm.vue'
import Footer from '@/components/Footer.vue'
import ToggleDark from '@/components/ToggleDark.vue'
import { ref } from 'vue'
import cookies from 'vue-cookies'
import { mapGetters } from 'vuex'

export default {
    name: 'UploadHome',
    data() {
        return {
            selectedUrlForm: ref(''),
            showUrlDialog: false,
            bingWallPaperIndex: 0,
            customWallPaperIndex: 0,
            showCompressDialog: false,
            customerCompress: true, //上传前压缩
            compressQuality: 4, //压缩后大小
            compressBar: 5, //压缩阈值
            serverCompress: true, //服务器端压缩
            uploadChannel: 'telegram', //上传渠道
            uploadNameType: 'default', //上传文件命名方式
            customUrlPrefix: '', //自定义链接前缀
            useCustomUrl: 'false', //是否启用自定义链接格式
            autoRetry: true, //失败自动切换
            useDefaultWallPaper: false,
            isToolBarOpen: false, //是否打开工具栏
            uploadMethod: 'default', //上传方式
            uploadFolder: '', // 添加上传文件夹属性
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
            this.updateCompressConfig('compressBar', val)
        },
        serverCompress(val) {
            this.updateCompressConfig('serverCompress', val)
        },
        uploadChannel(val) {
            this.updateStoreUploadChannel(val)
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
            this.$store.commit('setStoreUploadFolder', val)
        },
        isDark(val) {
            if (this.useDefaultWallPaper) {
                const bg1 = document.getElementById('bg1')
                bg1.src = val? require('@/assets/background.jpg') : require('@/assets/background-light.jpg')
                bg1.onload = () => {
                    bg1.style.opacity = this.bkOpacity
                }
            }
        }
    },
    computed: {
        ...mapGetters(['userConfig', 'bingWallPapers', 'uploadCopyUrlForm', 'compressConfig', 'storeUploadChannel', 'storeUploadNameType', 'customUrlSettings', 'storeAutoRetry', 'storeUploadMethod', 'storeUploadFolder']),
        ownerName() {
            return this.userConfig?.ownerName || 'Sanyue'
        },
        logoUrl() {
            return this.userConfig?.logoUrl || require('../assets/logo.png')
        },
        bkInterval() {
            return this.userConfig?.bkInterval || 3000
        },
        bkOpacity() {
            return this.userConfig?.bkOpacity || 1
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
        isDark() {
            return this.$store.getters.useDarkMode
        }
    },
    mounted() {
        const bg1 = document.getElementById('bg1')
        const bg2 = document.getElementById('bg2')
        if (this.userConfig?.uploadBkImg === 'bing') {
            //bing壁纸轮播
            this.$store.dispatch('fetchBingWallPapers').then(() => {
                bg1.src = this.bingWallPapers[this.bingWallPaperIndex]?.url
                bg1.onload = () => {
                    bg1.style.opacity = this.bkOpacity
                    // 取消container的默认背景颜色
                    document.querySelector('.container').style.background = 'transparent'
                }
                setInterval(() => {
                    //如果bing壁纸组为空，跳过
                    let curBg = bg1.style.opacity != 0 ? bg1 : bg2
                    let nextBg = bg1.style.opacity != 0 ? bg2 : bg1
                    curBg.style.opacity = 0
                    this.bingWallPaperIndex = (this.bingWallPaperIndex + 1) % this.bingWallPapers.length
                    nextBg.src = this.bingWallPapers[this.bingWallPaperIndex]?.url
                    nextBg.onload = () => {
                        nextBg.style.opacity = this.bkOpacity
                    }
                }, this.bkInterval)
            })
        } else if (this.userConfig?.uploadBkImg instanceof Array && this.userConfig?.uploadBkImg?.length > 1) {
            //自定义壁纸组轮播
            bg1.src = this.userConfig.uploadBkImg[this.customWallPaperIndex]
            bg1.onload = () => {
                bg1.style.opacity = this.bkOpacity
                // 取消container的默认背景颜色
                document.querySelector('.container').style.background = 'transparent'
            }
            setInterval(() => {
                let curBg = bg1.style.opacity != 0 ? bg1 : bg2
                let nextBg = bg1.style.opacity != 0 ? bg2 : bg1
                curBg.style.opacity = 0
                this.customWallPaperIndex = (this.customWallPaperIndex + 1) % this.userConfig.uploadBkImg.length
                nextBg.src = this.userConfig.uploadBkImg[this.customWallPaperIndex]
                nextBg.onload = () => {
                    nextBg.style.opacity = this.bkOpacity
                }
            }, this.bkInterval)
        } else if (this.userConfig?.uploadBkImg instanceof Array && this.userConfig?.uploadBkImg.length == 1) {
            //单张自定义壁纸
            bg1.src = this.userConfig.uploadBkImg[0]
            bg1.onload = () => {
                bg1.style.opacity = this.bkOpacity
                // 取消container的默认背景颜色
                document.querySelector('.container').style.background = 'transparent'
            }
        } else {
            //默认壁纸
            // this.useDefaultWallPaper = true
            // bg1.src = this.isDark? require('@/assets/background.jpg') : require('@/assets/background-light.jpg')
            // bg1.onload = () => {
            //     bg1.style.opacity = this.bkOpacity
            //     // 取消container的默认背景颜色
            //     document.querySelector('.container').style.background = 'transparent'
            // }
        }

        // 读取用户选择的链接格式
        this.selectedUrlForm = this.uploadCopyUrlForm || 'url'
        // 读取用户选择的压缩设置
        this.customerCompress = this.compressConfig.customerCompress
        this.compressQuality = this.compressConfig.compressQuality
        this.compressBar = this.compressConfig.compressBar
        this.serverCompress = this.compressConfig.serverCompress
        // 读取用户选择的上传渠道
        this.uploadChannel = this.storeUploadChannel
        // 用户定义的失败自动切换
        this.autoRetry = this.storeAutoRetry
        // 读取用户选择的上传文件命名方式
        this.uploadNameType = this.storeUploadNameType
        // 读取用户自定义链接格式
        this.customUrlPrefix = this.customUrlSettings.customUrlPrefix
        this.useCustomUrl = this.customUrlSettings.useCustomUrl
        // 读取用户偏好的上传方式
        this.uploadMethod = this.storeUploadMethod
        // 读取用户设置的上传文件夹
        this.uploadFolder = this.storeUploadFolder
    },
    components: {
        UploadForm,
        Footer,
        ToggleDark
    },
    methods: {
        handleManage() {
            this.$router.push('/dashboard')
        },
        openUrlDialog() {
            this.showUrlDialog = true
        },
        handleLogout() {
            cookies.remove('authCode')
            this.$router.push('/login')
            this.$message.success('已退出登录~')
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

.upload-folder {
    width: 100px;
    height: 2.5rem;
    position: fixed;
    top: 30px;
    right: 180px;
    z-index: 100;
    border-radius: 12px;
}
@media (max-width: 768px) {
    .upload-folder {
        width: 80px;
        height: 2rem;
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
.main-title {
    background: var(--upload-main-title-color);
    transition: all 0.3s ease;
    background-clip: text;
    color: transparent;
    text-decoration: none;
}
.logo {
    height: 70px;
    width: 70px;
    position: fixed;
    top: 5px;
    left: 5px;
    z-index: 100;
}
.title {
    font-size: 2.5rem;
    font-weight: 700;
    font-family: 'Noto Sans SC', sans-serif;
}
@media (max-width: 768px) {
    .title {
        font-size: 1.8rem;
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

.question-icon {
    margin: 0 3px;
}

.compress-slider {
    width: 80%;
    margin: 0 auto;
}

.footer {
    height: 6vh;
}
.background-image1 {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    z-index: -1;
    opacity: 0;
    transition: all 1s ease-in-out;
}
.background-image2 {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    z-index: -1;
    opacity: 0;
    transition: all 1s ease-in-out;
}

</style>