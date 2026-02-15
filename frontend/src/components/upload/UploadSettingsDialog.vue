<template>
    <el-dialog title="上传设置" v-model="visible" :width="dialogWidth" :show-close="false" class="settings-dialog">
        <!-- 上传渠道 -->
        <div class="dialog-section">
            <div class="section-header">
                <span class="section-title">上传渠道</span>
            </div>
            <div class="section-content">
                <div class="setting-item">
                    <span class="setting-label">渠道类型</span>
                    <el-radio-group :model-value="uploadChannel" @update:model-value="$emit('update:uploadChannel', $event)" class="radio-card-group compact">
                        <el-radio label="telegram" class="radio-card">
                            <font-awesome-icon icon="paper-plane" class="channel-icon"/>
                            <span>TG</span>
                        </el-radio>
                        <el-radio label="cfr2" class="radio-card">
                            <font-awesome-icon icon="cloud" class="channel-icon"/>
                            <span>R2</span>
                        </el-radio>
                        <el-radio label="s3" class="radio-card">
                            <font-awesome-icon icon="database" class="channel-icon"/>
                            <span>S3</span>
                        </el-radio>
                        <el-radio label="discord" class="radio-card">
                            <font-awesome-icon icon="comments" class="channel-icon"/>
                            <span>DC</span>
                        </el-radio>
                        <el-radio label="huggingface" class="radio-card">
                            <font-awesome-icon icon="robot" class="channel-icon"/>
                            <span>HF</span>
                        </el-radio>
                    </el-radio-group>
                </div>
                <div class="setting-item" v-if="currentChannelList.length > 1">
                    <span class="setting-label">
                        渠道名称
                        <el-tooltip content="选择具体的渠道名称，不选择则使用负载均衡或默认渠道" placement="top">
                            <font-awesome-icon icon="question-circle" class="inline-help-icon"/>
                        </el-tooltip>
                    </span>
                    <el-select :model-value="channelName" @update:model-value="$emit('update:channelName', $event)" placeholder="自动选择" clearable class="setting-input">
                        <el-option
                            v-for="ch in currentChannelList"
                            :key="ch.name"
                            :label="ch.name"
                            :value="ch.name"
                        />
                    </el-select>
                </div>
                <div class="setting-item">
                    <span class="setting-label">上传目录</span>
                    <el-input :model-value="uploadFolder" @update:model-value="$emit('update:uploadFolder', $event)" placeholder="请输入上传目录路径" class="setting-input"/>
                </div>
                <div class="setting-item">
                    <span class="setting-label">
                        自动切换
                        <el-tooltip content="对于非分块上传文件，上传失败自动切换到其他渠道上传" placement="top">
                            <font-awesome-icon icon="question-circle" class="inline-help-icon"/>
                        </el-tooltip>
                    </span>
                    <el-switch :model-value="autoRetry" @update:model-value="$emit('update:autoRetry', $event)" />
                </div>
            </div>
        </div>
        
        <!-- 文件命名方式 -->
        <div class="dialog-section">
            <div class="section-header">
                <span class="section-title">文件命名方式</span>
            </div>
            <div class="section-content">
                <el-radio-group :model-value="uploadNameType" @update:model-value="$emit('update:uploadNameType', $event)" class="radio-card-group grid-2x2">
                    <el-radio label="default" class="radio-card">
                        <font-awesome-icon icon="cog" class="radio-icon"/>
                        <span>默认</span>
                    </el-radio>
                    <el-radio label="index" class="radio-card">
                        <font-awesome-icon icon="hashtag" class="radio-icon"/>
                        <span>仅前缀</span>
                    </el-radio>
                    <el-radio label="origin" class="radio-card">
                        <font-awesome-icon icon="file-signature" class="radio-icon"/>
                        <span>仅原名</span>
                    </el-radio>
                    <el-radio label="short" class="radio-card">
                        <font-awesome-icon icon="compress-alt" class="radio-icon"/>
                        <span>短链接</span>
                    </el-radio>
                </el-radio-group>
            </div>
        </div>
        
        <!-- 客户端预处理 -->
        <div class="dialog-section">
            <div class="section-header">
                <span class="section-title">文件预处理</span>
                <el-tooltip content="上传前在本地进行格式转换和压缩，仅对图片文件生效" placement="top">
                    <font-awesome-icon icon="question-circle" class="section-help-icon"/>
                </el-tooltip>
            </div>
            <div class="section-content">
                <div class="setting-item">
                    <span class="setting-label">
                        转换为WebP
                        <el-tooltip content="上传前将图片转换为WebP格式，可有效减小文件体积。转换失败时保持原格式上传" placement="top">
                            <font-awesome-icon icon="question-circle" class="inline-help-icon"/>
                        </el-tooltip>
                    </span>
                    <el-switch :model-value="convertToWebp" @update:model-value="$emit('update:convertToWebp', $event)" />
                </div>
                <div class="setting-item">
                    <span class="setting-label">文件压缩</span>
                    <el-switch :model-value="customerCompress" @update:model-value="$emit('update:customerCompress', $event)" />
                </div>
                <div class="setting-item slider-item" v-if="customerCompress">
                    <span class="setting-label">
                        压缩阈值
                        <el-tooltip content="设置图片大小阈值，超过此值将自动压缩，单位MB" placement="top">
                            <font-awesome-icon icon="question-circle" class="inline-help-icon"/>
                        </el-tooltip>
                    </span>
                    <div class="slider-wrapper">
                        <el-slider :model-value="compressBar" @update:model-value="$emit('update:compressBar', $event)" :min="1" :max="20" :format-tooltip="(value) => `${value} MB`"/>
                        <div class="slider-input-wrapper">
                            <el-input-number :model-value="compressBar" @update:model-value="$emit('update:compressBar', $event)" :min="1" :max="20" :step="1" :value-on-clear="1" class="slider-input" controls-position="right"/>
                            <span class="slider-unit">MB</span>
                        </div>
                    </div>
                </div>
                <div class="setting-item slider-item" v-if="customerCompress">
                    <span class="setting-label">
                        期望大小
                        <el-tooltip content="设置压缩后图片大小期望值，单位MB" placement="top">
                            <font-awesome-icon icon="question-circle" class="inline-help-icon"/>
                        </el-tooltip>
                    </span>
                    <div class="slider-wrapper">
                        <el-slider :model-value="compressQuality" @update:model-value="$emit('update:compressQuality', $event)" :min="0.5" :max="compressBar" :step="0.1" :format-tooltip="(value) => `${value} MB`"/>
                        <div class="slider-input-wrapper">
                            <el-input-number :model-value="compressQuality" @update:model-value="$emit('update:compressQuality', $event)" :min="0.5" :max="compressBar" :step="0.1" :precision="1" :value-on-clear="0.5" class="slider-input" controls-position="right"/>
                            <span class="slider-unit">MB</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- 服务端压缩 - 仅 Telegram -->
        <div class="dialog-section" v-if="uploadChannel === 'telegram'">
            <div class="section-header">
                <span class="section-title">服务端压缩</span>
                <el-tooltip content="1. 在 Telegram 端进行压缩，仅对上传渠道为 Telegram 的图片文件生效 <br> 2. 若图片大小（本地压缩后大小）大于10MB，本设置自动失效 <br> 3. 若上传分辨率过大、透明背景等图片，建议关闭服务端压缩，否则可能出现未知问题" placement="top" raw-content>
                    <font-awesome-icon icon="question-circle" class="section-help-icon"/>
                </el-tooltip>
            </div>
            <div class="section-content">
                <div class="setting-item">
                    <span class="setting-label">开启压缩</span>
                    <el-switch :model-value="serverCompress" @update:model-value="$emit('update:serverCompress', $event)" />
                </div>
            </div>
        </div>
        
        <div class="dialog-action">
            <el-button type="primary" @click="visible = false" class="confirm-btn">确定</el-button>
        </div>
    </el-dialog>
</template>

<script>
export default {
    name: 'UploadSettingsDialog',
    props: {
        modelValue: { type: Boolean, default: false },
        uploadChannel: { type: String, default: 'telegram' },
        channelName: { type: String, default: '' },
        currentChannelList: { type: Array, default: () => [] },
        uploadFolder: { type: String, default: '' },
        autoRetry: { type: Boolean, default: true },
        uploadNameType: { type: String, default: 'default' },
        convertToWebp: { type: Boolean, default: false },
        customerCompress: { type: Boolean, default: true },
        compressBar: { type: Number, default: 5 },
        compressQuality: { type: Number, default: 4 },
        serverCompress: { type: Boolean, default: true }
    },
    emits: [
        'update:modelValue',
        'update:uploadChannel',
        'update:channelName',
        'update:uploadFolder',
        'update:autoRetry',
        'update:uploadNameType',
        'update:convertToWebp',
        'update:customerCompress',
        'update:compressBar',
        'update:compressQuality',
        'update:serverCompress'
    ],
    computed: {
        visible: {
            get() { return this.modelValue },
            set(val) { this.$emit('update:modelValue', val) }
        },
        dialogWidth() {
            return window.innerWidth > 768 ? '50%' : '90%'
        }
    }
}
</script>
