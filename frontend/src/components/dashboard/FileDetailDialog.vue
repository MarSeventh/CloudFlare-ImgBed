<template>
    <el-dialog title="文件详情" v-model="visible" :width="dialogWidth">
        <div class="detail-actions">
            <el-button type="primary" @click="$emit('download')" round size="small" class="detail-action" v-if="!isEditing">
                <font-awesome-icon icon="download" style="margin-right: 3px;"></font-awesome-icon> 下载
            </el-button>
            <el-button type="primary" @click="$emit('tagManagement')" round size="small" class="detail-action" v-if="!isEditing">
                <font-awesome-icon icon="tags" style="margin-right: 3px;"></font-awesome-icon> 标签
            </el-button>
            <el-button type="primary" @click="$emit('block')" round size="small" class="detail-action" v-if="!isEditing">
                <font-awesome-icon icon="ban" style="margin-right: 3px;"></font-awesome-icon> 黑名单
            </el-button>
            <el-button type="primary" @click="$emit('white')" round size="small" class="detail-action" v-if="!isEditing">
                <font-awesome-icon icon="user-plus" style="margin-right: 3px;"></font-awesome-icon> 白名单
            </el-button>
            <el-button type="danger" @click="$emit('delete')" round size="small" class="detail-action" v-if="!isEditing">
                <font-awesome-icon icon="trash-alt" style="margin-right: 3px;"></font-awesome-icon> 删除
            </el-button>
            <el-button type="warning" @click="startEdit()" round size="small" class="detail-action" v-if="!isEditing">
                <font-awesome-icon icon="edit" style="margin-right: 3px;"></font-awesome-icon> 编辑
            </el-button>
            <el-button type="info" @click="openRenameDialog()" round size="small" class="detail-action" v-if="!isEditing">
                <font-awesome-icon icon="i-cursor" style="margin-right: 3px;"></font-awesome-icon> 重命名
            </el-button>
            <el-button type="success" @click="saveMetadata()" round size="small" class="detail-action" v-if="isEditing" :loading="editSaving">
                <font-awesome-icon icon="save" style="margin-right: 3px;" v-if="!editSaving"></font-awesome-icon> 保存
            </el-button>
            <el-button @click="cancelEdit()" round size="small" class="detail-action" v-if="isEditing">
                取消
            </el-button>
        </div>
        <el-tabs v-model="activeTab" @tab-click="handleTabClick" style="margin-bottom: 10px;">
            <el-tab-pane label="原始链接" name="originUrl">
                <el-input v-model="urls.originUrl" readonly @click="handleUrlClick"></el-input>
            </el-tab-pane>
            <el-tab-pane label="Markdown" name="mdUrl">
                <el-input v-model="urls.mdUrl" readonly @click="handleUrlClick"></el-input>
            </el-tab-pane>
            <el-tab-pane label="HTML" name="htmlUrl">
                <el-input v-model="urls.htmlUrl" readonly @click="handleUrlClick"></el-input>
            </el-tab-pane>
            <el-tab-pane label="BBCode" name="bbUrl">
                <el-input v-model="urls.bbUrl" readonly @click="handleUrlClick"></el-input>
            </el-tab-pane>
            <el-tab-pane label="TG File ID" v-if="file?.metadata?.TgFileId" name="tgId">
                <el-input v-model="urls.tgId" readonly @click="handleUrlClick"></el-input>
            </el-tab-pane>
            <el-tab-pane label="S3 Location" v-if="file?.metadata?.S3Location" name="s3Location">
                <el-input v-model="urls.S3Location" readonly @click="handleUrlClick"></el-input>
            </el-tab-pane>
            <el-tab-pane label="S3 CDN URL" v-if="file?.metadata?.S3CdnFileUrl" name="s3CdnFileUrl">
                <el-input v-model="urls.S3CdnFileUrl" readonly @click="handleUrlClick"></el-input>
            </el-tab-pane>
        </el-tabs>
        <!-- 文件预览区域 -->
        <div class="preview-section">
            <div class="preview-content">
                <video v-if="isVideo" :src="fileLink" autoplay muted loop class="video-preview" @click="openImageLink"></video>
                <audio v-else-if="isAudio" :src="fileLink" controls autoplay class="audio-preview"></audio>
                <el-image 
                    v-else-if="isImage" 
                    :src="fileLink" 
                    :preview-src-list="[fileLink]"
                    :preview-teleported="true"
                    fit="contain" 
                    lazy 
                    class="image-preview"
                ></el-image>
                <font-awesome-icon v-else icon="file" class="file-icon-detail"></font-awesome-icon>
            </div>
        </div>
        <!-- 详细信息 -->
        <el-descriptions border :column="descColumn">
            <el-descriptions-item label="文件名">
                <el-input v-if="isEditing" v-model="editForm.FileName" size="small" placeholder="请输入文件名"></el-input>
                <span v-else>{{ file?.metadata?.FileName || file?.name }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="文件类型">
                <el-input v-if="isEditing" v-model="editForm.FileType" size="small" placeholder="如 image/jpeg"></el-input>
                <span v-else>{{ file?.metadata?.FileType || '未知' }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="文件大小">{{ fileSizeDisplay }}</el-descriptions-item>
            <el-descriptions-item label="图片尺寸">
                <div v-if="imageDimensions" style="display: flex; align-items: center; gap: 6px;">
                    <span>{{ file?.metadata?.Width }} × {{ file?.metadata?.Height }}</span>
                    <el-tag size="small" type="info" style="display: inline-flex; align-items: center; justify-content: center;">{{ orientationIcon }}</el-tag>
                </div>
                <span v-else style="color: #909399;">无</span>
            </el-descriptions-item>
            <el-descriptions-item label="上传时间">{{ uploadTime }}</el-descriptions-item>
            <el-descriptions-item label="渠道类型/名称">
                <el-tag size="small" type="info" style="margin-right: 6px;">{{ file?.metadata?.Channel || '未知' }}</el-tag>
                <span>{{ file?.metadata?.ChannelName || '-' }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="访问状态/审查">
                <el-tag size="small" :type="accessTagType" style="margin-right: 6px;">{{ accessType }}</el-tag>
                <span>{{ file?.metadata?.Label || '无' }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="上传IP">{{ file?.metadata?.UploadIP || '未知' }}</el-descriptions-item>
            <el-descriptions-item label="上传地址">{{ file?.metadata?.UploadAddress || '未知' }}</el-descriptions-item>
            <el-descriptions-item label="文件标签">
                <div v-if="file?.metadata?.Tags && file?.metadata?.Tags.length > 0" style="display: flex; flex-wrap: wrap; gap: 5px;">
                    <el-tag v-for="tag in file?.metadata?.Tags" :key="tag" size="small">{{ tag }}</el-tag>
                </div>
                <span v-else style="color: #909399;">暂无标签</span>
            </el-descriptions-item>
        </el-descriptions>
        <!-- 重命名弹窗 -->
        <el-dialog
            v-model="showRenameDialog"
            title="重命名 File ID"
            :width="dialogWidth"
            append-to-body
        >
            <el-form @submit.prevent>
                <el-form-item label="新 File ID" :error="renameValidation.error">
                    <el-input
                        v-model="renameForm.newFileId"
                        placeholder="请输入新的 File ID"
                        @input="validateRenameInput"
                        clearable
                    ></el-input>
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="closeRenameDialog()">取消</el-button>
                <el-button type="primary" @click="submitRename()" :loading="renameSaving" :disabled="!renameValidation.valid">确认重命名</el-button>
            </template>
        </el-dialog>
    </el-dialog>
</template>

<script>
import { ElMessage } from 'element-plus';
import fetchWithAuth from '@/utils/fetchWithAuth';
import { validateFileId } from '@/utils/fileIdValidator';

export default {
    name: 'FileDetailDialog',
    props: {
        modelValue: { type: Boolean, default: false },
        file: { type: Object, default: null },
        fileLink: { type: String, default: '' },
        urls: { type: Object, default: () => ({ originUrl: '', mdUrl: '', htmlUrl: '', bbUrl: '', tgId: '', S3Location: '', S3CdnFileUrl: '' }) }
    },
    emits: ['update:modelValue', 'download', 'tagManagement', 'block', 'white', 'delete', 'metadataUpdated', 'fileRenamed'],
    watch: {
        visible(val) {
            if (!val) {
                // 关闭弹窗时退出编辑状态
                this.isEditing = false;
                this.editSaving = false;
            }
        }
    },
    data() {
        return {
            activeTab: 'originUrl',
            isEditing: false,
            editForm: {
                FileName: '',
                FileType: ''
            },
            editSaving: false,
            showRenameDialog: false,
            renameForm: {
                newFileId: ''
            },
            renameValidation: {
                valid: true,
                error: ''
            },
            renameSaving: false
        }
    },
    computed: {
        visible: {
            get() { return this.modelValue; },
            set(val) { this.$emit('update:modelValue', val); }
        },
        dialogWidth() {
            return window.innerWidth < 768 ? '95%' : '900px';
        },
        descColumn() {
            return window.innerWidth < 768 ? 1 : 2;
        },
        isVideo() {
            // 先通过 content-type 判断
            const fileType = this.file?.metadata?.FileType?.toLowerCase() || '';
            if (fileType.includes('video')) return true;
            // 再通过文件后缀判断
            const name = this.file?.name?.toLowerCase() || '';
            return name.endsWith('.mp4') || name.endsWith('.webm') || name.endsWith('.mov') || name.endsWith('.avi');
        },
        isAudio() {
            // 先通过 content-type 判断
            const fileType = this.file?.metadata?.FileType?.toLowerCase() || '';
            if (fileType.includes('audio')) return true;
            // 再通过文件后缀判断
            const name = this.file?.name?.toLowerCase() || '';
            return name.endsWith('.mp3') || name.endsWith('.wav') || name.endsWith('.ogg') || name.endsWith('.flac');
        },
        isImage() {
            // 先通过 content-type 判断
            const fileType = this.file?.metadata?.FileType?.toLowerCase() || '';
            if (fileType.includes('image')) return true;
            // 再通过文件后缀判断
            const name = this.file?.name?.toLowerCase() || '';
            return name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || 
                   name.endsWith('.gif') || name.endsWith('.webp') || name.endsWith('.svg') || 
                   name.endsWith('.bmp') || name.endsWith('.avif') || name.endsWith('.heic') || name.endsWith('.heif');
        },
        uploadTime() {
            if (this.file?.metadata?.TimeStamp) {
                return new Date(this.file.metadata.TimeStamp).toLocaleString();
            }
            return '未知';
        },
        accessType() {
            const listType = this.file?.metadata?.ListType;
            const label = this.file?.metadata?.Label;
            if (listType === 'White') return '正常（白名单）';
            if (listType === 'Block') return '已屏蔽（黑名单）';
            if (label === 'adult') return '已屏蔽（审查不通过）'
            return '正常';
        },
        accessTagType() {
            const listType = this.file?.metadata?.ListType;
            const label = this.file?.metadata?.Label;
            if (listType === 'White') return 'success';
            if (listType === 'Block') return 'danger';
            if (label === 'adult') return 'danger';
            return 'success';
        },
        imageDimensions() {
            const width = this.file?.metadata?.Width;
            const height = this.file?.metadata?.Height;
            if (width && height) return true;
            return null;
        },
        orientationIcon() {
            const width = this.file?.metadata?.Width;
            const height = this.file?.metadata?.Height;
            if (!width || !height) return '';
            const ratio = width / height;
            if (ratio > 1.1) return '横';
            if (ratio < 0.9) return '竖';
            return '方';
        },
        fileSizeDisplay() {
            const sizeBytes = this.file?.metadata?.FileSizeBytes;
            const sizeMB = this.file?.metadata?.FileSize;
            if (sizeBytes) {
                // 根据大小选择合适的单位
                if (sizeBytes < 1024) {
                    return `${sizeBytes} B`;
                } else if (sizeBytes < 1024 * 1024) {
                    return `${(sizeBytes / 1024).toFixed(2)} KB`;
                } else {
                    return `${(sizeBytes / 1024 / 1024).toFixed(2)} MB`;
                }
            } else if (sizeMB) {
                return `${sizeMB} MB`;
            }
            return '未知';
        }
    },
    methods: {
        handleVideoClick(e) {
            const video = e.target;
            if (video.paused) video.play();
            else video.pause();
        },
        handleTabClick() {},
        handleUrlClick(e) {
            const input = e.target;
            input.select();
            navigator.clipboard.writeText(input.value).then(() => {
                ElMessage.success('链接已复制');
            });
        },
        openImageLink() {
            if (this.fileLink) {
                // 移除 ?from=admin 参数
                const cleanUrl = this.fileLink.replace(/\?from=admin$/, '');
                window.open(cleanUrl, '_blank');
            }
        },
        startEdit() {
            this.editForm.FileName = this.file?.metadata?.FileName || '';
            this.editForm.FileType = this.file?.metadata?.FileType || '';
            this.isEditing = true;
        },
        cancelEdit() {
            this.isEditing = false;
            this.editForm.FileName = this.file?.metadata?.FileName || '';
            this.editForm.FileType = this.file?.metadata?.FileType || '';
            this.editSaving = false;
        },
        async saveMetadata() {
            this.editSaving = true;
            try {
                const fileId = this.file.name;
                const response = await fetchWithAuth(`/api/manage/metadata/${fileId}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ FileName: this.editForm.FileName, FileType: this.editForm.FileType })
                });

                if (response.ok) {
                    const data = await response.json();
                    ElMessage.success('元数据保存成功');
                    this.isEditing = false;
                    this.$emit('metadataUpdated', fileId, data.metadata);
                } else {
                    const error = await response.json().catch(() => ({}));
                    throw new Error(error.message || '保存元数据失败');
                }
            } catch (error) {
                console.error('Error saving metadata:', error);
                ElMessage.error(error.message || '保存元数据失败');
            } finally {
                this.editSaving = false;
            }
        },
        openRenameDialog() {
            this.renameForm.newFileId = this.file?.name || '';
            this.renameValidation = { valid: true, error: '' };
            this.showRenameDialog = true;
        },
        closeRenameDialog() {
            this.showRenameDialog = false;
            this.renameForm.newFileId = '';
            this.renameValidation = { valid: true, error: '' };
        },
        validateRenameInput() {
            const result = validateFileId(this.renameForm.newFileId, this.file?.name || '');
            this.renameValidation = {
                valid: result.valid,
                error: result.error || ''
            };
        },
        async submitRename() {
            // Validate input first
            this.validateRenameInput();
            if (!this.renameValidation.valid) {
                return;
            }

            this.renameSaving = true;
            try {
                const oldFileId = this.file.name;
                const response = await fetchWithAuth(`/api/manage/rename/${oldFileId}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ newFileId: this.renameForm.newFileId })
                });

                if (response.ok) {
                    const data = await response.json();
                    ElMessage.success('文件重命名成功');
                    this.showRenameDialog = false;
                    this.$emit('fileRenamed', oldFileId, this.renameForm.newFileId, data.metadata);
                } else if (response.status === 409) {
                    // Conflict — target File_ID already exists
                    this.renameValidation = {
                        valid: false,
                        error: '目标文件名已存在'
                    };
                } else {
                    const error = await response.json().catch(() => ({}));
                    throw new Error(error.message || '重命名失败');
                }
            } catch (error) {
                console.error('Error renaming file:', error);
                ElMessage.error(error.message || '重命名失败');
            } finally {
                this.renameSaving = false;
            }
        }
    }
}
</script>

<style scoped>
.detail-actions {
    display: flex;
    justify-content: right;
    margin-bottom: 10px;
    flex-wrap: wrap;
    gap: 8px;
}
.detail-action {
    margin-left: 0 !important;
}
.video-preview {
    width: 100%;
    max-width: 400px;
    max-height: 300px;
    border-radius: 8px;
    cursor: pointer;
    object-fit: contain;
}
.audio-preview {
    width: 100%;
    max-width: 400px;
    border-radius: 8px;
}
.image-preview {
    width: auto;
    height: auto;
    max-width: 100%;
    max-height: 300px;
    border-radius: 8px;
    cursor: pointer;
}
.image-preview :deep(img) {
    max-width: 100%;
    max-height: 300px;
    object-fit: contain;
}
.file-icon-detail {
    font-size: 64px;
    color: var(--el-text-color-secondary);
}
.preview-section {
    display: flex;
    justify-content: center;
    margin-bottom: 15px;
    padding: 12px;
    background: var(--el-fill-color-light);
    border-radius: 8px;
    min-height: 60px;
}
.preview-content {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
}
:deep(.el-descriptions__content) {
    word-break: break-all;
    word-wrap: break-word;
}
:deep(.el-descriptions__content .el-tag) {
    vertical-align: middle;
}
:deep(.el-descriptions__content .el-tag + span) {
    vertical-align: middle;
}
:deep(.el-descriptions__label) {
    width: 120px !important;
    min-width: 100px !important;
    max-width: 120px !important;
}
:deep(.el-descriptions__body table) {
    table-layout: fixed;
}
@media (max-width: 768px) {
    .detail-actions {
        justify-content: center;
    }
}
</style>
