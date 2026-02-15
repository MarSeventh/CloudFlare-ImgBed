<template>
    <el-dialog
        title="标签管理"
        v-model="visible"
        :width="dialogWidth"
        @close="handleClose"
    >
        <div class="tag-management-container">
            <!-- 输入区域 -->
            <div class="input-section">
                <el-input
                    v-model="inputTag"
                    placeholder="输入标签名称"
                    @keyup.enter="handleAddTag"
                    @input="handleInputChange"
                    clearable
                >
                    <template #append>
                        <el-button @click="handleAddTag" type="primary">
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

            <!-- 当前标签 -->
            <div class="current-tags-section">
                <h4>当前标签</h4>
                <div v-if="currentTags.length > 0" class="tags-container">
                    <el-tag
                        v-for="tag in currentTags"
                        :key="tag"
                        closable
                        @close="handleRemoveTag(tag)"
                        class="tag-item"
                    >
                        {{ tag }}
                    </el-tag>
                </div>
                <div v-else class="empty-message">
                    暂无标签
                </div>
            </div>

            <!-- 常用标签 -->
            <div class="popular-tags-section">
                <h4>常用标签</h4>
                <div v-if="popularTags.length > 0" class="tags-container">
                    <el-tag
                        v-for="tag in popularTags"
                        :key="tag"
                        @click="handleAddPopularTag(tag)"
                        class="tag-item clickable"
                        type="info"
                    >
                        {{ tag }}
                    </el-tag>
                </div>
                <div v-else-if="loadingPopularTags" class="empty-message">
                    <el-icon class="is-loading"><Loading /></el-icon>
                    加载中...
                </div>
                <div v-else class="empty-message">
                    暂无常用标签
                </div>
            </div>
        </div>

        <template #footer>
            <span class="dialog-footer">
                <el-button @click="handleClose">关闭</el-button>
            </span>
        </template>
    </el-dialog>
</template>

<script>
import { ElMessage } from 'element-plus';
import { Loading } from '@element-plus/icons-vue';
import fetchWithAuth from '@/utils/fetchWithAuth';

export default {
    name: 'TagManagementDialog',
    components: {
        Loading
    },
    props: {
        modelValue: {
            type: Boolean,
            default: false
        },
        fileId: {
            type: String,
            required: true
        }
    },
    emits: ['update:modelValue', 'tagsUpdated'],
    data() {
        return {
            currentTags: [],
            inputTag: '',
            suggestions: [],
            popularTags: [],
            showSuggestions: false,
            loading: false,
            loadingPopularTags: false,
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
            return window.innerWidth < 768 ? '90%' : '500px';
        }
    },
    watch: {
        visible(newVal) {
            if (newVal) {
                this.loadFileTags();
                this.loadPopularTags();
            }
        }
    },
    methods: {
        async loadFileTags() {
            try {
                const response = await fetchWithAuth(`/api/manage/tags/${encodeURIComponent(this.fileId)}`, {
                    method: 'GET'
                });

                if (response.ok) {
                    const data = await response.json();
                    this.currentTags = data.tags || [];
                } else {
                    throw new Error('Failed to load tags');
                }
            } catch (error) {
                console.error('Error loading file tags:', error);
                ElMessage.error('加载标签失败');
            }
        },

        async loadPopularTags() {
            this.loadingPopularTags = true;
            try {
                const response = await fetchWithAuth('/api/manage/tags/autocomplete?limit=20', {
                    method: 'GET'
                });

                if (response.ok) {
                    const data = await response.json();
                    this.popularTags = (data.tags || []).filter(tag => !this.currentTags.includes(tag));
                }
            } catch (error) {
                console.error('Error loading popular tags:', error);
            } finally {
                this.loadingPopularTags = false;
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
                    this.suggestions = (data.tags || []).filter(tag => !this.currentTags.includes(tag));
                    this.showSuggestions = this.suggestions.length > 0;
                }
            } catch (error) {
                console.error('Error fetching suggestions:', error);
            }
        },

        selectSuggestion(tag) {
            this.inputTag = tag;
            this.showSuggestions = false;
            this.handleAddTag();
        },

        async handleAddTag() {
            const tag = this.inputTag.trim();

            if (!tag) {
                return;
            }

            if (this.currentTags.includes(tag)) {
                ElMessage.warning('标签已存在');
                this.inputTag = '';
                this.showSuggestions = false;
                return;
            }

            try {
                const response = await fetchWithAuth(`/api/manage/tags/${encodeURIComponent(this.fileId)}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        action: 'add',
                        tags: [tag]
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    this.currentTags = data.tags || [];
                    this.inputTag = '';
                    this.showSuggestions = false;
                    ElMessage.success('标签添加成功');
                    this.$emit('tagsUpdated', this.currentTags);

                    // 重新加载常用标签
                    this.loadPopularTags();
                } else {
                    const error = await response.json();
                    throw new Error(error.message || '添加标签失败');
                }
            } catch (error) {
                console.error('Error adding tag:', error);
                ElMessage.error(error.message || '添加标签失败');
            }
        },

        async handleRemoveTag(tag) {
            try {
                const response = await fetchWithAuth(`/api/manage/tags/${encodeURIComponent(this.fileId)}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        action: 'remove',
                        tags: [tag]
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    this.currentTags = data.tags || [];
                    ElMessage.success('标签删除成功');
                    this.$emit('tagsUpdated', this.currentTags);

                    // 重新加载常用标签
                    this.loadPopularTags();
                } else {
                    throw new Error('删除标签失败');
                }
            } catch (error) {
                console.error('Error removing tag:', error);
                ElMessage.error('删除标签失败');
            }
        },

        handleAddPopularTag(tag) {
            this.inputTag = tag;
            this.handleAddTag();
        },

        handleClose() {
            this.visible = false;
            this.inputTag = '';
            this.showSuggestions = false;
            this.currentTags = [];
            this.popularTags = [];
        }
    }
};
</script>

<style scoped>
.tag-management-container {
    padding: 10px 0;
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

.current-tags-section,
.popular-tags-section {
    margin-bottom: 20px;
}

.current-tags-section h4,
.popular-tags-section h4 {
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

.tag-item.clickable {
    cursor: pointer;
    transition: transform 0.2s;
}

.tag-item.clickable:hover {
    transform: translateY(-2px);
}

.empty-message {
    color: #909399;
    font-size: 13px;
    padding: 10px 0;
}

.dialog-footer {
    display: flex;
    justify-content: flex-end;
}
</style>
