<template>
    <div 
        class="list-item"
        @touchstart="$emit('touchstart', $event)"
        @touchend="$emit('touchend', $event)"
        @touchmove="$emit('touchmove', $event)"
    >
        <!-- 复选框 -->
        <div class="list-col list-col-checkbox">
            <span class="custom-checkbox" :class="{ 'checked': localSelected }" @click.stop="toggleSelect">
                <font-awesome-icon v-if="localSelected" icon="check" class="check-icon"/>
            </span>
        </div>
        <!-- 预览 -->
        <div class="list-col list-col-preview" @click="handlePreviewClick">
            <template v-if="isFolder">
                <font-awesome-icon icon="folder-open" class="list-folder-icon"/>
            </template>
            <template v-else-if="isVideo">
                <video :src="fileLink" class="list-preview-img" muted preload="metadata"></video>
            </template>
            <template v-else-if="isImage">
                <img :src="fileLink" class="list-preview-img" loading="lazy" decoding="async" />
            </template>
            <template v-else>
                <font-awesome-icon icon="file" class="list-file-icon"/>
            </template>
        </div>
        <!-- 文件名 -->
        <div class="list-col list-col-name" @click="handlePreviewClick">
            <span class="filename-ellipsis" :title="displayName">
                <span class="filename-start">{{ fileNameStart }}</span>
                <span class="filename-end">{{ fileNameEnd }}</span>
            </span>
        </div>
        <!-- 标签 -->
        <div class="list-col list-col-tags">
            <template v-if="!isFolder && item.metadata?.Tags && item.metadata.Tags.length > 0">
                <span 
                    v-for="(tag, tagIndex) in item.metadata.Tags.slice(0, 3)" 
                    :key="tagIndex" 
                    class="color-tag"
                    :style="{ background: getTagColor(tagIndex) }"
                >{{ tag }}</span>
                <span v-if="item.metadata.Tags.length > 3" class="color-tag color-tag-more" :style="{ background: getTagColor(3) }">+{{ item.metadata.Tags.length - 3 }}</span>
            </template>
            <span v-else class="list-empty">-</span>
        </div>
        <!-- 渠道类型 -->
        <div class="list-col list-col-channel">
            {{ isFolder ? '-' : (item.metadata?.Channel || item.channelTag || '-') }}
        </div>
        <!-- 渠道名称 -->
        <div class="list-col list-col-channel-name">
            <div v-if="!isFolder && item.metadata?.ChannelName" class="channel-name-box">{{ item.metadata.ChannelName }}</div>
            <span v-else class="list-empty">-</span>
        </div>
        <!-- 上传地址 -->
        <div class="list-col list-col-address">
            <div v-if="!isFolder && item.metadata?.UploadIP" class="address-box">{{ item.metadata.UploadIP }}</div>
            <span v-else class="list-empty">-</span>
        </div>
        <!-- 大小 -->
        <div class="list-col list-col-size">
            {{ isFolder ? '-' : fileSizeDisplay }}
        </div>
        <!-- 上传时间 -->
        <div class="list-col list-col-date">
            {{ uploadDate }}
        </div>
        <!-- 操作 -->
        <div class="list-col list-col-actions">
            <template v-if="!isFolder">
                <el-tooltip content="复制链接" placement="top">
                    <button class="list-action-btn" @click.stop="$emit('copy')">
                        <font-awesome-icon icon="copy"/>
                    </button>
                </el-tooltip>
                <el-tooltip content="下载" placement="top">
                    <button class="list-action-btn" @click.stop="$emit('download')">
                        <font-awesome-icon icon="download"/>
                    </button>
                </el-tooltip>
                <el-tooltip content="移动" placement="top">
                    <button class="list-action-btn" @click.stop="$emit('move')">
                        <font-awesome-icon icon="file-export"/>
                    </button>
                </el-tooltip>
            </template>
            <template v-else>
                <el-tooltip content="复制链接" placement="top">
                    <button class="list-action-btn" @click.stop="$emit('folderCopy')">
                        <font-awesome-icon icon="copy"/>
                    </button>
                </el-tooltip>
                <el-tooltip content="移动" placement="top">
                    <button class="list-action-btn" @click.stop="$emit('move')">
                        <font-awesome-icon icon="file-export"/>
                    </button>
                </el-tooltip>
            </template>
            <el-tooltip content="删除" placement="top">
                <button class="list-action-btn list-action-danger" @click.stop="$emit('delete')">
                    <font-awesome-icon icon="trash-alt"/>
                </button>
            </el-tooltip>
        </div>
    </div>
</template>

<script>
export default {
    name: 'FileListItem',
    props: {
        item: { type: Object, required: true },
        selected: { type: Boolean, default: false },
        fileLink: { type: String, default: '' }
    },
    emits: ['update:selected', 'enter', 'detail', 'copy', 'folderCopy', 'move', 'delete', 'download', 'touchstart', 'touchend', 'touchmove'],
    data() {
        return {
            localSelected: this.selected,
            tagColors: ['#f472b6', '#a78bfa', '#60a5fa', '#34d399']
        }
    },
    computed: {
        isFolder() {
            // 检查 isFolder 属性或名称以 / 结尾
            return this.item.isFolder || this.item.name?.endsWith('/');
        },
        isVideo() {
            const name = this.item.name?.toLowerCase() || '';
            return name.endsWith('.mp4') || name.endsWith('.webm') || name.endsWith('.mov') || name.endsWith('.avi');
        },
        isImage() {
            const name = this.item.name?.toLowerCase() || '';
            return name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || 
                   name.endsWith('.gif') || name.endsWith('.webp') || name.endsWith('.svg') || name.endsWith('.bmp');
        },
        displayName() {
            if (this.isFolder) {
                const parts = this.item.name.split('/').filter(Boolean);
                return parts[parts.length - 1] || this.item.name;
            }
            return this.item.metadata?.FileName || this.getFileName(this.item.name);
        },
        fileNameStart() {
            const name = this.displayName;
            if (name.length <= 20) return name;
            return name.slice(0, -8);
        },
        fileNameEnd() {
            const name = this.displayName;
            if (name.length <= 20) return '';
            return name.slice(-8);
        },
        uploadDate() {
            if (this.item.uploaded) {
                return new Date(this.item.uploaded).toLocaleDateString();
            }
            if (this.item.metadata?.TimeStamp) {
                return new Date(this.item.metadata.TimeStamp).toLocaleDateString();
            }
            return '-';
        },
        fileSizeDisplay() {
            const sizeBytes = this.item.metadata?.FileSizeBytes;
            const sizeMB = this.item.metadata?.FileSize;
            if (sizeBytes) {
                if (sizeBytes < 1024) {
                    return `${sizeBytes} B`;
                } else if (sizeBytes < 1024 * 1024) {
                    return `${(sizeBytes / 1024).toFixed(1)} KB`;
                } else {
                    return `${(sizeBytes / 1024 / 1024).toFixed(2)} MB`;
                }
            } else if (sizeMB) {
                return `${sizeMB} MB`;
            }
            return '-';
        }
    },
    watch: {
        selected(val) {
            this.localSelected = val;
        }
    },
    methods: {
        toggleSelect() {
            this.localSelected = !this.localSelected;
            this.$emit('update:selected', this.localSelected);
        },
        handlePreviewClick() {
            if (this.isFolder) {
                this.$emit('enter');
            } else {
                this.$emit('detail');
            }
        },
        getFileName(name) {
            const parts = (name || '').split('/');
            return parts[parts.length - 1];
        },
        getTagColor(index) {
            return this.tagColors[index % this.tagColors.length];
        }
    }
}
</script>

<style scoped>
.list-item {
    display: grid;
    grid-template-columns: 50px 60px minmax(180px, 1fr) 130px 100px 110px 130px 80px 100px 120px;
    padding: 12px 20px;
    align-items: center;
    transition: background 0.2s ease;
    border-bottom: 1px solid var(--el-border-color-lighter);
    min-width: fit-content;
}
.list-item:last-child {
    border-bottom: none;
}
.list-item:hover {
    background: var(--el-fill-color-light);
}
.list-col {
    display: flex;
    align-items: center;
}
.list-col-checkbox {
    justify-content: center;
    min-width: 40px;
}
.list-col-preview {
    justify-content: center;
    cursor: pointer;
}
.list-col-name {
    cursor: pointer;
    overflow: hidden;
    padding-right: 16px;
    min-width: 0;
}
.list-col-name:hover {
    color: #38bdf8;
}
.filename-ellipsis {
    display: flex;
    max-width: 100%;
    overflow: hidden;
    align-items: center;
}
.filename-start {
    flex-shrink: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.filename-end {
    flex-shrink: 0;
    white-space: nowrap;
}
.list-col-size, .list-col-date, .list-col-channel, .list-col-channel-name {
    font-size: 13px;
    color: var(--el-text-color-secondary);
}
.list-col-address {
    font-size: 13px;
}
.address-box, .channel-name-box {
    background: var(--el-fill-color-light);
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
    max-width: 100%;
    overflow-x: auto;
    overflow-y: hidden;
    white-space: nowrap;
    scrollbar-width: none;
    -ms-overflow-style: none;
}
.address-box { width: 85px; font-family: 'Consolas', 'Monaco', monospace; }
.channel-name-box { width: 70px; }
.address-box::-webkit-scrollbar, .channel-name-box::-webkit-scrollbar { display: none; }
.list-col-tags {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-wrap: nowrap;
    overflow: hidden;
}
.custom-checkbox {
    width: 18px;
    height: 18px;
    border: 2px solid var(--el-border-color);
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 0.2s ease;
    background: transparent;
}
.custom-checkbox:hover {
    border-color: #38bdf8;
}
.custom-checkbox.checked {
    background: linear-gradient(135deg, #0ea5e9, #38bdf8);
    border-color: #38bdf8;
}
.custom-checkbox .check-icon {
    font-size: 10px;
    color: white;
}
.color-tag {
    padding: 2px 8px;
    border-radius: 10px;
    font-size: 11px;
    color: white;
    white-space: nowrap;
    max-width: 60px;
    overflow: hidden;
    text-overflow: ellipsis;
    text-shadow: 0 1px 2px rgba(0,0,0,0.2);
}
.color-tag-more {
    min-width: 30px;
    text-align: center;
}
.list-empty {
    color: var(--el-text-color-placeholder);
}
.list-col-actions {
    display: flex;
    gap: 8px;
    justify-content: flex-end;
}
.list-preview-img {
    width: 40px;
    height: 40px;
    object-fit: cover;
    border-radius: 6px;
}
.list-folder-icon {
    font-size: 28px;
    color: var(--el-color-primary);
}
.list-file-icon {
    font-size: 24px;
    color: var(--el-text-color-secondary);
}
.list-action-btn {
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 8px;
    background: var(--el-fill-color);
    color: var(--el-text-color-regular);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
}
.list-action-btn:hover {
    background: #38bdf8;
    color: white;
}
.list-action-danger:hover {
    background: var(--el-color-danger);
}
@media (max-width: 768px) {
    .list-item {
        grid-template-columns: 28px 40px 1fr auto;
        padding: 10px 8px;
        gap: 8px;
    }
    .list-col-size, .list-col-date, .list-col-tags, .list-col-channel, .list-col-channel-name, .list-col-address {
        display: none;
    }
    .list-col-actions { gap: 4px; }
    .list-action-btn { width: 28px; height: 28px; }
    .list-col-checkbox { width: 24px; min-width: 24px; }
}
</style>
