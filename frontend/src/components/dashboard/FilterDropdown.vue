<template>
    <el-dropdown :hide-on-click="false" trigger="click" class="filter-dropdown" ref="dropdownRef">
        <span class="el-dropdown-link filter-trigger">
            <el-badge :value="activeFilterCount" :hidden="activeFilterCount === 0" class="filter-badge">
                <font-awesome-icon icon="filter" class="header-icon"/>
            </el-badge>
        </span>
        <template #dropdown>
            <el-dropdown-menu class="filter-dropdown-menu">
                <!-- 访问状态 -->
                <div class="filter-section">
                    <div class="filter-title">访问状态</div>
                    <div class="filter-options">
                        <el-checkbox-group v-model="localFilters.accessStatus" @change="handleFilterChange('accessStatus')">
                            <el-checkbox
                                v-for="option in accessStatusOptions"
                                :key="'accessStatus-' + option.value"
                                :label="option.value">
                                {{ option.label }}
                            </el-checkbox>
                        </el-checkbox-group>
                    </div>
                </div>
                <!-- 黑白名单 -->
                <div class="filter-section">
                    <div class="filter-title">黑白名单</div>
                    <div class="filter-options">
                        <el-checkbox-group v-model="localFilters.listType" @change="handleFilterChange('listType')">
                            <el-checkbox
                                v-for="option in listTypeOptions"
                                :key="'listType-' + option.value"
                                :label="option.value">
                                {{ option.label }}
                            </el-checkbox>
                        </el-checkbox-group>
                    </div>
                </div>
                <!-- 审查结果 -->
                <div class="filter-section">
                    <div class="filter-title">审查结果</div>
                    <div class="filter-options">
                        <el-checkbox-group v-model="localFilters.label" @change="handleFilterChange('label')">
                            <el-checkbox 
                                v-for="option in labelOptions" 
                                :key="'label-' + option.value"
                                :label="option.value">
                                {{ option.label }}
                            </el-checkbox>
                        </el-checkbox-group>
                    </div>
                </div>
                <!-- 文件类型 -->
                <div class="filter-section">
                    <div class="filter-title">文件类型</div>
                    <div class="filter-options">
                        <el-checkbox-group v-model="localFilters.fileType" @change="handleFilterChange('fileType')">
                            <el-checkbox 
                                v-for="option in fileTypeOptions" 
                                :key="'fileType-' + option.value"
                                :label="option.value">
                                {{ option.label }}
                            </el-checkbox>
                        </el-checkbox-group>
                    </div>
                </div>
                <!-- 渠道类型 -->
                <div class="filter-section">
                    <div class="filter-title">渠道类型</div>
                    <div class="filter-options">
                        <el-checkbox-group v-model="localFilters.channel" @change="handleFilterChange('channel')">
                            <el-checkbox 
                                v-for="option in channelOptions" 
                                :key="'channel-' + option.value"
                                :label="option.value">
                                {{ option.label }}
                            </el-checkbox>
                        </el-checkbox-group>
                    </div>
                </div>
                <!-- 渠道名称 -->
                <div class="filter-section" v-if="channelNameOptions.length > 0">
                    <div class="filter-title">渠道名称</div>
                    <div class="filter-options">
                        <el-checkbox-group v-model="localFilters.channelName" @change="handleFilterChange('channelName')">
                            <template v-for="(group, index) in groupedChannelNames" :key="'group-' + group.type">
                                <div v-if="index > 0" class="channel-divider"></div>
                                <div class="channel-group-title">{{ group.typeLabel }}</div>
                                <el-checkbox
                                    v-for="option in group.channels"
                                    :key="'channelName-' + option.type + '-' + option.name"
                                    :label="option.type + ':' + option.name">
                                    {{ option.name }}
                                </el-checkbox>
                            </template>
                        </el-checkbox-group>
                    </div>
                </div>
                <!-- 清除筛选按钮 -->
                <div class="filter-actions">
                    <el-button size="small" @click="clearFilters" :disabled="activeFilterCount === 0">清除筛选</el-button>
                </div>
            </el-dropdown-menu>
        </template>
    </el-dropdown>
</template>

<script>
export default {
    name: 'FilterDropdown',
    props: {
        filters: {
            type: Object,
            default: () => ({
                accessStatus: [],  // 访问状态: 'normal'(正常), 'blocked'(已屏蔽)
                listType: [],      // 黑白名单: 'White', 'Block', 'none'
                label: [],
                fileType: [],
                channel: [],
                channelName: []
            })
        },
        channelNameOptions: {
            type: Array,
            default: () => []
        }
    },
    emits: ['update:filters', 'change'],
    data() {
        return {
            // 访问状态选项（综合判断 ListType 和 Label）
            // 正常: ListType !== 'Block' && Label !== 'adult'
            // 已屏蔽: ListType === 'Block' || Label === 'adult'
            accessStatusOptions: [
                { label: '正常', value: 'normal' },
                { label: '已屏蔽', value: 'blocked' }
            ],
            // 黑白名单选项（直接使用 ListType 字段值）
            listTypeOptions: [
                { label: '白名单', value: 'White' },
                { label: '黑名单', value: 'Block' },
                { label: '未设置', value: 'None' }
            ],
            // 审查结果选项
            // 参考 FileDetailDialog: adult=已屏蔽（审查不通过）, 其他=正常
            labelOptions: [
                { label: '正常', value: 'normal' },
                { label: '12+内容', value: 'teen' },
                { label: '成人内容', value: 'adult' }
            ],
            fileTypeOptions: [
                { label: '图片', value: 'image' },
                { label: '视频', value: 'video' },
                { label: '音频', value: 'audio' },
                { label: '其他', value: 'other' }
            ],
            channelOptions: [
                { label: 'Telegram', value: 'TelegramNew' },
                { label: 'Cloudflare R2', value: 'CloudflareR2' },
                { label: 'S3', value: 'S3' },
                { label: 'Discord', value: 'Discord' },
                { label: 'HuggingFace', value: 'HuggingFace' },
                { label: '外链', value: 'External' }
            ],
            localFilters: {
                accessStatus: [],
                listType: [],
                label: [],
                fileType: [],
                channel: [],
                channelName: []
            }
        };
    },
    computed: {
        activeFilterCount() {
            return Object.values(this.localFilters).reduce((count, arr) => count + arr.length, 0);
        },
        // 按类型分组渠道名称
        groupedChannelNames() {
            const groups = {};

            this.channelNameOptions.forEach(option => {
                if (!groups[option.type]) {
                    groups[option.type] = {
                        type: option.type,
                        typeLabel: option.typeLabel,
                        channels: []
                    };
                }
                groups[option.type].channels.push(option);
            });

            return Object.values(groups);
        }
    },
    watch: {
        filters: {
            handler(newFilters) {
                this.localFilters = {
                    accessStatus: Array.isArray(newFilters.accessStatus) ? [...newFilters.accessStatus] : [],
                    listType: Array.isArray(newFilters.listType) ? [...newFilters.listType] : [],
                    label: Array.isArray(newFilters.label) ? [...newFilters.label] : [],
                    fileType: Array.isArray(newFilters.fileType) ? [...newFilters.fileType] : [],
                    channel: Array.isArray(newFilters.channel) ? [...newFilters.channel] : [],
                    channelName: Array.isArray(newFilters.channelName) ? [...newFilters.channelName] : []
                };
            },
            immediate: true,
            deep: true
        }
    },
    methods: {
        handleFilterChange(type) {
            this.$emit('update:filters', { ...this.localFilters });
            this.$emit('change', { type, filters: { ...this.localFilters } });
        },
        clearFilters() {
            this.localFilters = {
                accessStatus: [],
                listType: [],
                label: [],
                fileType: [],
                channel: [],
                channelName: []
            };
            this.$emit('update:filters', { ...this.localFilters });
            this.$emit('change', { type: 'clear', filters: { ...this.localFilters } });
        }
    }
};
</script>

<style scoped>
.filter-dropdown {
    flex-shrink: 0;
}

.filter-trigger {
    cursor: pointer;
    display: flex;
    align-items: center;
}

.header-icon {
    font-size: 1.5em;
    cursor: pointer;
    transition: all 0.3s ease;
    color: var(--admin-container-color);
    outline: none;
}

.header-icon:hover {
    color: var(--admin-purple);
    transform: scale(1.2);
}

.filter-badge :deep(.el-badge__content) {
    background: linear-gradient(135deg, #0ea5e9, #38bdf8);
    border: none;
    font-size: 10px;
    height: 16px;
    line-height: 16px;
    padding: 0 5px;
}

.filter-dropdown-menu {
    padding: 8px 0;
    min-width: 180px;
    max-height: 400px;
    overflow-y: auto;
}

.filter-section {
    padding: 8px 12px;
    border-bottom: 1px solid var(--el-border-color-lighter);
}

.filter-section:last-of-type {
    border-bottom: none;
}

.filter-title {
    font-size: 12px;
    font-weight: 600;
    color: var(--el-text-color-secondary);
    margin-bottom: 6px;
}

.filter-options {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.filter-options :deep(.el-checkbox-group) {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.filter-options :deep(.el-checkbox) {
    margin-right: 0;
    height: 26px;
    padding: 0 6px;
    border-radius: 4px;
    transition: all 0.2s ease;
}

.filter-options :deep(.el-checkbox:hover) {
    background: var(--el-fill-color-light);
}

.filter-options :deep(.el-checkbox__label) {
    font-size: 13px;
    color: var(--el-text-color-primary);
}

.filter-options :deep(.el-checkbox__input.is-checked + .el-checkbox__label) {
    color: #0ea5e9;
}

/* 渠道分组样式 */
.channel-group-title {
    font-size: 11px;
    font-weight: 600;
    color: var(--el-text-color-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    padding: 4px 6px;
    margin-top: 4px;
    margin-bottom: 2px;
}

.channel-divider {
    height: 1px;
    background: var(--el-border-color-lighter);
    margin: 6px 0;
}

.filter-options :deep(.el-checkbox__input.is-checked .el-checkbox__inner) {
    background-color: #0ea5e9;
    border-color: #0ea5e9;
}

.filter-actions {
    padding: 10px 12px 6px;
    display: flex;
    justify-content: center;
}

.filter-actions .el-button {
    width: 100%;
    background: var(--el-fill-color-light);
    border: 1px solid var(--el-border-color);
    color: var(--el-text-color-regular);
    border-radius: 6px;
    transition: all 0.2s ease;
}

.filter-actions .el-button:hover:not(:disabled) {
    background: linear-gradient(135deg, #0ea5e9, #38bdf8);
    border-color: #38bdf8;
    color: white;
}

.filter-actions .el-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

/* 移动端适配 */
@media (max-width: 768px) {
    .filter-dropdown-menu {
        min-width: 160px;
        max-height: 320px;
    }
    
    .filter-section {
        padding: 6px 10px;
    }
    
    .filter-title {
        font-size: 11px;
        margin-bottom: 4px;
    }
    
    .filter-options :deep(.el-checkbox) {
        height: 24px;
        padding: 0 4px;
    }
    
    .filter-options :deep(.el-checkbox__label) {
        font-size: 12px;
    }
    
    .header-icon {
        font-size: 1.2em;
    }
}
</style>
