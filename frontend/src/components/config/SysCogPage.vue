<template>
    <div class="page-settings" v-loading="loading">
        <!-- 根据category分组显示设置 -->
        <div v-for="(categoryGroup, categoryName) in groupedSettings" :key="categoryName" class="first-settings">
            <h3 class="first-title">{{ categoryName }}</h3>
            <el-form :model="settings" label-width="150px">
                <el-form-item v-for="(setting, index) in categoryGroup" :key="setting.id">
                    <template #label>
                        {{ setting.label }}
                        <el-tooltip v-if="setting.tooltip" :content="setting.tooltip" placement="top" raw-content>
                            <font-awesome-icon icon="question-circle" style="margin-left: 5px; cursor: pointer;"/>
                        </el-tooltip>
                    </template>
                    <!-- 如果是select类型则使用下拉选择器 -->
                    <el-select v-if="setting.type === 'select'" v-model="setting.value" :disabled="setting.fixed" :placeholder="setting.placeholder" style="width: 100%">
                        <el-option
                            v-for="option in setting.options"
                            :key="option.value"
                            :label="option.label"
                            :value="option.value">
                        </el-option>
                    </el-select>
                    <!-- 如果是channelName类型则使用渠道名选择器 -->
                    <el-select v-else-if="setting.type === 'channelName'" v-model="setting.value" :disabled="!currentUploadChannel || currentChannelList.length === 0" placeholder="请先选择上传渠道" clearable style="width: 100%">
                        <el-option
                            v-for="ch in currentChannelList"
                            :key="ch.name"
                            :label="ch.name"
                            :value="ch.name">
                        </el-option>
                    </el-select>
                    <!-- 如果是boolean类型则使用切换按钮 -->
                    <el-switch v-else-if="setting.type === 'boolean'" v-model="setting.value" :disabled="setting.fixed"></el-switch>
                    <!-- 否则使用输入框 -->
                    <el-input v-else v-model="setting.value" :disabled="setting.fixed" :placeholder="setting.placeholder"></el-input>
                </el-form-item>
            </el-form>
        </div>

    
        <!-- 悬浮保存按钮 -->
        <FloatingSaveButton :show="!loading" @click="saveSettings" />
    </div>
</template>

<script>
import fetchWithAuth from '@/utils/fetchWithAuth';
import axios from '@/utils/axios';
import FloatingSaveButton from '@/components/FloatingSaveButton.vue';

export default {
components: {
    FloatingSaveButton
},
data() {
    return {
        settings: {
            config: []
        },
        // 加载状态
        loading: true,
        // 可用渠道列表
        availableChannels: {}
    };
},
computed: {
    // 根据category将配置项分组
    groupedSettings() {
        const grouped = {};
        if (this.settings.config) {
            this.settings.config.forEach(setting => {
                const category = setting.category || '其他设置';
                if (!grouped[category]) {
                    grouped[category] = [];
                }
                grouped[category].push(setting);
            });
        }
        return grouped;
    },
    // 当前选择的上传渠道
    currentUploadChannel() {
        const channelSetting = this.settings.config?.find(s => s.id === 'defaultUploadChannel');
        return channelSetting?.value || '';
    },
    // 当前渠道类型对应的渠道列表
    currentChannelList() {
        return this.availableChannels[this.currentUploadChannel] || [];
    }
},
watch: {
    // 监听上传渠道变化，清空渠道名称（如果不在新列表中）
    currentUploadChannel(newVal, oldVal) {
        if (newVal !== oldVal) {
            const channelNameSetting = this.settings.config?.find(s => s.id === 'defaultChannelName');
            if (channelNameSetting) {
                const newChannelList = this.availableChannels[newVal] || [];
                if (!newChannelList.some(ch => ch.name === channelNameSetting.value)) {
                    channelNameSetting.value = '';
                }
            }
        }
    }
},
methods: {
    saveSettings() {
        fetchWithAuth('/api/manage/sysConfig/page', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(this.settings)
        })
        .then(() => this.$message.success('设置已保存'));
    },
    // 获取可用渠道列表
    async fetchAvailableChannels() {
        try {
            const response = await axios.get('/api/channels');
            if (response.data) {
                this.availableChannels = response.data;
            }
        } catch (error) {
            console.error('Failed to fetch available channels:', error);
        }
    }
},
mounted() {
    this.loading = true;
    // 获取可用渠道列表
    this.fetchAvailableChannels();
    // 获取上传设置
    fetchWithAuth('/api/manage/sysConfig/page')
    .then((response) => response.json())
    .then((data) => {
        this.settings = data;
        // 处理布尔类型的值初始化
        if (this.settings.config) {
            this.settings.config.forEach(setting => {
                if (setting.type === 'boolean') {
                    // 将字符串转换为布尔值
                    if (typeof setting.value === 'string') {
                        setting.value = setting.value === 'true';
                    } else if (setting.value === undefined || setting.value === null) {
                        // 如果没有值，使用默认值
                        setting.value = setting.default || false;
                    }
                }
            });
        }
    })
    .finally(() => {
        this.loading = false;
    });
}
};
</script>

<style scoped>
.page-settings {
    padding: 20px;
    min-height: 500px;
}

.first-settings {
    margin-bottom: 40px;
}

.first-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 20px;
    padding-bottom: 12px;
    border-bottom: 2px solid var(--el-color-primary-light-7);
}

.second-title {
    display: flex;
    align-items: center;
    gap: 8px;
    text-align: start;
    margin-left: 0;
    margin-bottom: 16px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--el-border-color-lighter);
}

/* 表单样式 - 上下排列左对齐 */
.first-settings :deep(.el-form) {
    padding: 16px 20px;
    background: var(--glass-bg);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-radius: 12px;
    border: 1px solid var(--glass-border);
    box-shadow: var(--glass-shadow);
    transition: all 0.3s ease;
}

.first-settings :deep(.el-form:hover) {
    box-shadow: var(--glass-shadow-hover);
    background: var(--glass-bg-hover);
}

.first-settings :deep(.el-form-item) {
    margin-bottom: 20px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
}

.first-settings :deep(.el-form-item:last-child) {
    margin-bottom: 0;
}

.first-settings :deep(.el-form-item__label) {
    text-align: left;
    padding-bottom: 8px;
    font-weight: 500;
    color: var(--el-text-color-primary);
    width: auto !important;
    display: flex;
    align-items: center;
    gap: 5px;
}

.first-settings :deep(.el-form-item__content) {
    width: 100%;
    max-width: 400px;
    margin-left: 0 !important;
}

.first-settings :deep(.el-input) {
    width: 100%;
}

.first-settings :deep(.el-select) {
    width: 100%;
}

.first-settings :deep(.el-switch) {
    --el-switch-on-color: var(--el-color-primary);
}

/* 移动端适配 */
@media (max-width: 768px) {
    .page-settings {
        padding: 15px;
        padding-bottom: 80px; /* 为悬浮按钮留出空间 */
    }
    
    .first-settings :deep(.el-form) {
        padding: 12px 15px;
    }
    
    .first-settings :deep(.el-form-item__content) {
        max-width: 100%;
    }
}
</style>