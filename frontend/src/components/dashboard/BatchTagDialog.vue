<template>
    <el-dialog
        title="批量标签管理"
        v-model="visible"
        :width="dialogWidth"
        @close="handleClose"
    >
        <div class="batch-tag-container">
            <el-tabs v-model="activeTab" type="border-card">
                <!-- 添加标签 -->
                <el-tab-pane label="添加" name="add">
                    <div class="tab-content">
                        <p class="tab-description">为选中的 {{ fileCount }} 个文件添加标签</p>

                        <div class="input-section">
                            <el-input
                                v-model="inputTag"
                                placeholder="输入标签名称"
                                @keyup.enter="handleAddInputTag"
                                @input="handleInputChange"
                                clearable
                            >
                                <template #append>
                                    <el-button @click="handleAddInputTag" type="primary">
                                        <font-awesome-icon icon="plus"/>
                                    </el-button>
                                </template>
                            </el-input>

                            <!-- 自动完成建议 -->
                            <div v-if="showSuggestions && suggestions.length > 0" class="suggestions-panel">
                                <div
                                    v-for="tag in suggestions"
                                    :key="tag"
                                    class="suggestion-item"
                                    @click="selectSuggestion(tag)"
                                >
                                    {{ tag }}
                                </div>
                            </div>
                        </div>

                        <div class="tags-to-add-section">
                            <h4>待添加的标签</h4>
                            <div v-if="tagsToAdd.length > 0" class="tags-container">
                                <el-tag
                                    v-for="tag in tagsToAdd"
                                    :key="tag"
                                    closable
                                    @close="removeFromToAdd(tag)"
                                    class="tag-item"
                                >
                                    {{ tag }}
                                </el-tag>
                            </div>
                            <div v-else class="empty-message">
                                暂无待添加标签
                            </div>
                        </div>

                        <div class="action-buttons">
                            <el-button
                                type="primary"
                                @click="executeAddTags"
                                :loading="loading"
                                :disabled="tagsToAdd.length === 0"
                            >
                                添加到所有文件
                            </el-button>
                        </div>
                    </div>
                </el-tab-pane>

                <!-- 移除标签 -->
                <el-tab-pane label="移除" name="remove">
                    <div class="tab-content">
                        <p class="tab-description">移除选中文件的共有标签</p>

                        <div v-if="commonTags.length > 0" class="common-tags-section">
                            <h4>共有标签</h4>
                            <div class="tags-container">
                                <el-tag
                                    v-for="tag in commonTags"
                                    :key="tag"
                                    closable
                                    @close="handleRemoveCommonTag(tag)"
                                    class="tag-item"
                                    type="warning"
                                >
                                    {{ tag }}
                                </el-tag>
                            </div>
                        </div>
                        <div v-else class="empty-message">
                            选中的文件没有共有标签
                        </div>
                    </div>
                </el-tab-pane>

                <!-- 清空标签 -->
                <el-tab-pane label="清空" name="clear">
                    <div class="tab-content">
                        <p class="tab-description">清空选中的 {{ fileCount }} 个文件的所有标签</p>

                        <el-alert
                            title="⚠️警告"
                            type="warning"
                            description="此操作将清空所有选中文件的标签，且不可恢复"
                            :closable="false"
                            style="margin-bottom: 20px;"
                            center
                        />

                        <div class="action-buttons">
                            <el-button
                                type="danger"
                                @click="handleClearAllTags"
                                :loading="loading"
                            >
                                确认清空所有标签
                            </el-button>
                        </div>
                    </div>
                </el-tab-pane>
            </el-tabs>
        </div>
    </el-dialog>
</template>

<script>
import { ElMessage, ElMessageBox } from 'element-plus';
import fetchWithAuth from '@/utils/fetchWithAuth';

export default {
    name: 'BatchTagDialog',
    props: {
        modelValue: {
            type: Boolean,
            default: false
        },
        selectedFiles: {
            type: Array,
            required: true,
            default: () => []
        }
    },
    emits: ['update:modelValue', 'tagsUpdated'],
    data() {
        return {
            activeTab: 'add',
            inputTag: '',
            tagsToAdd: [],
            commonTags: [],
            suggestions: [],
            showSuggestions: false,
            loading: false,
            debounceTimer: null
        };
    },
    computed: {
        visible: {
            get() {
                return this.modelValue;
            },
            set(val) {
                this.$emit('update:modelValue', val);
            }
        },
        dialogWidth() {
            return window.innerWidth < 768 ? '90%' : '600px';
        },
        selectedFilesOnly() {
            // 排除文件夹，只保留文件
            return this.selectedFiles.filter(file => !file.isFolder);
        },
        fileCount() {
            return this.selectedFilesOnly.length;
        },
        fileIds() {
            return this.selectedFilesOnly.map(file => file.name);
        }
    },
    watch: {
        visible(newVal) {
            if (newVal) {
                this.loadCommonTags();
            } else {
                this.resetData();
            }
        },
        activeTab(newTab) {
            if (newTab === 'remove') {
                this.loadCommonTags();
            }
        }
    },
    methods: {
        resetData() {
            this.tagsToAdd = [];
            this.inputTag = '';
            this.showSuggestions = false;
            this.activeTab = 'add';
        },

        async loadCommonTags() {
            if (this.selectedFilesOnly.length === 0) {
                this.commonTags = [];
                return;
            }

            try {
                // 获取所有文件的标签
                const tagPromises = this.selectedFilesOnly.map(file =>
                    fetchWithAuth(`/api/manage/tags/${encodeURIComponent(file.name)}`, {
                        method: 'GET'
                    })
                );

                const responses = await Promise.all(tagPromises);
                const allTags = [];

                for (const response of responses) {
                    if (response.ok) {
                        const data = await response.json();
                        allTags.push(data.tags || []);
                    }
                }

                // 找出共有标签
                if (allTags.length > 0) {
                    this.commonTags = allTags[0].filter(tag =>
                        allTags.every(tags => tags.includes(tag))
                    );
                } else {
                    this.commonTags = [];
                }
            } catch (error) {
                console.error('Error loading common tags:', error);
                ElMessage.error('加载共有标签失败');
            }
        },

        handleInputChange() {
            clearTimeout(this.debounceTimer);

            if (!this.inputTag || this.inputTag.trim().length === 0) {
                this.showSuggestions = false;
                return;
            }

            this.debounceTimer = setTimeout(() => {
                this.fetchSuggestions();
            }, 300);
        },

        async fetchSuggestions() {
            try {
                const prefix = this.inputTag.trim().toLowerCase();
                const response = await fetchWithAuth(
                    `/api/manage/tags/autocomplete?prefix=${encodeURIComponent(prefix)}&limit=10`,
                    { method: 'GET' }
                );

                if (response.ok) {
                    const data = await response.json();
                    this.suggestions = (data.tags || []).filter(tag => !this.tagsToAdd.includes(tag));
                    this.showSuggestions = this.suggestions.length > 0;
                }
            } catch (error) {
                console.error('Error fetching suggestions:', error);
            }
        },

        selectSuggestion(tag) {
            this.inputTag = tag;
            this.showSuggestions = false;
            this.handleAddInputTag();
        },

        handleAddInputTag() {
            const tag = this.inputTag.trim();

            if (!tag) {
                return;
            }

            if (this.tagsToAdd.includes(tag)) {
                ElMessage.warning('标签已在列表中');
                this.inputTag = '';
                this.showSuggestions = false;
                return;
            }

            this.tagsToAdd.push(tag);
            this.inputTag = '';
            this.showSuggestions = false;
        },

        removeFromToAdd(tag) {
            const index = this.tagsToAdd.indexOf(tag);
            if (index > -1) {
                this.tagsToAdd.splice(index, 1);
            }
        },

        async executeAddTags() {
            if (this.tagsToAdd.length === 0) {
                ElMessage.warning('请先添加要批量添加的标签');
                return;
            }

            this.loading = true;

            try {
                const response = await fetchWithAuth('/api/manage/tags/batch', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        fileIds: this.fileIds,
                        action: 'add',
                        tags: this.tagsToAdd
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.success || data.updated > 0) {
                        ElMessage.success(`成功为 ${data.updated} 个文件添加标签`);
                        this.$emit('tagsUpdated');
                        this.tagsToAdd = [];
                    } else {
                        throw new Error('批量添加标签失败');
                    }
                } else {
                    throw new Error('批量添加标签失败');
                }
            } catch (error) {
                console.error('Error adding tags:', error);
                ElMessage.error('批量添加标签失败');
            } finally {
                this.loading = false;
            }
        },

        async handleRemoveCommonTag(tag) {
            this.loading = true;

            try {
                const response = await fetchWithAuth('/api/manage/tags/batch', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        fileIds: this.fileIds,
                        action: 'remove',
                        tags: [tag]
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.success || data.updated > 0) {
                        ElMessage.success(`成功从 ${data.updated} 个文件中移除标签`);
                        this.$emit('tagsUpdated');
                        await this.loadCommonTags();
                    } else {
                        throw new Error('移除标签失败');
                    }
                } else {
                    throw new Error('移除标签失败');
                }
            } catch (error) {
                console.error('Error removing tag:', error);
                ElMessage.error('移除标签失败');
            } finally {
                this.loading = false;
            }
        },

        handleClearAllTags() {
            ElMessageBox.confirm(
                `确定要清空选中的 ${this.fileCount} 个文件的所有标签吗？此操作不可恢复。`,
                '确认清空',
                {
                    confirmButtonText: '确定',
                    cancelButtonText: '取消',
                    type: 'warning'
                }
            ).then(() => {
                this.executeClearTags();
            }).catch(() => {
                ElMessage.info('已取消清空操作');
            });
        },

        async executeClearTags() {
            this.loading = true;

            try {
                const response = await fetchWithAuth('/api/manage/tags/batch', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        fileIds: this.fileIds,
                        action: 'set',
                        tags: []
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.success || data.updated > 0) {
                        ElMessage.success(`成功清空 ${data.updated} 个文件的标签`);
                        this.$emit('tagsUpdated');
                        this.commonTags = [];
                    } else {
                        throw new Error('清空标签失败');
                    }
                } else {
                    throw new Error('清空标签失败');
                }
            } catch (error) {
                console.error('Error clearing tags:', error);
                ElMessage.error('清空标签失败');
            } finally {
                this.loading = false;
            }
        },

        handleClose() {
            this.visible = false;
        }
    }
};
</script>

<style scoped>
.batch-tag-container {
    padding: 0;
}

.tab-content {
    padding: 20px;
}

.tab-description {
    margin: 0 0 15px 0;
    color: #606266;
    font-size: 14px;
}

.input-section {
    position: relative;
    margin-bottom: 20px;
}

.suggestions-panel {
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    background: var(--admin-dashboard-tag-suggestion-bg-color);
    border: 1px solid var(--admin-dashboard-tag-suggestion-border-color);
    border-radius: 4px;
    box-shadow: var(--admin-dashboard-tag-suggestion-box-shadow);
    max-height: 200px;
    overflow-y: auto;
    z-index: 1000;
    margin-top: 4px;
}

.suggestion-item {
    padding: 8px 12px;
    cursor: pointer;
    transition: background-color 0.2s;
}

.suggestion-item:hover {
    background-color: var(--admin-dashboard-tag-suggestion-item-hover-bg-color);
}

.tags-to-add-section,
.common-tags-section {
    margin-bottom: 20px;
}

.tags-to-add-section h4,
.common-tags-section h4 {
    margin: 0 0 10px 0;
    font-size: 14px;
    color: #606266;
}

.tags-container {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    min-height: 40px;
}

.tag-item {
    cursor: default;
}

.empty-message {
    color: #909399;
    font-size: 13px;
    padding: 10px 0;
}

.action-buttons {
    margin-top: 20px;
    display: flex;
    justify-content: flex-end;
}
</style>
