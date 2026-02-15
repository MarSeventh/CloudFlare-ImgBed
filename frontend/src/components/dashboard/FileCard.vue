<template>
    <el-card 
        class="img-card"
        @touchstart="$emit('touchstart', $event)"
        @touchend="$emit('touchend', $event)"
        @touchmove="$emit('touchmove', $event)"
    >
        <el-checkbox v-model="localSelected" @change="$emit('update:selected', localSelected)"></el-checkbox>
        <div class="file-short-info">
            <div v-if="item.metadata?.ListType === 'White'" class="success-tag">{{ channelTag }}</div>
            <div v-else-if="item.metadata?.ListType === 'Block' || item.metadata?.Label === 'adult'" class="fail-tag">{{ channelTag }}</div>
            <div v-else class="success-tag">{{ channelTag }}</div>
            <div v-if="item.metadata?.Tags && item.metadata?.Tags.length > 0" class="primary-tag">
                <font-awesome-icon icon="tag" style="margin-right: 3px; font-size: 12px;"></font-awesome-icon>
                {{ item.metadata.Tags[0] }}
                <span v-if="item.metadata.Tags.length > 1" style="margin-left: 2px;">
                    (+{{ item.metadata.Tags.length - 1 }})
                </span>
            </div>
        </div>
        
        <!-- 视频预览 -->
        <template v-if="isVideo">
            <div v-if="videoLoading" class="skeleton-wrapper"></div>
            <div v-else-if="videoError" class="error-wrapper" @click="$emit('detail')">
                <font-awesome-icon icon="exclamation-triangle" class="error-icon"/>
                <span class="error-text">加载失败</span>
            </div>
            <video 
                v-show="!videoLoading && !videoError"
                :src="fileLink" 
                muted 
                loop 
                preload="metadata" 
                class="video-preview" 
                @click="handleVideoClick"
                @mouseenter="handleVideoHover($event, true)" 
                @mouseleave="handleVideoHover($event, false)"
                @fullscreenchange="handleFullscreenChange"
                @webkitfullscreenchange="handleFullscreenChange"
                @loadeddata="videoLoading = false"
                @error="handleVideoError"
            ></video>
        </template>
        
        <!-- 音频预览 -->
        <div v-else-if="isAudio" class="file-preview audio-card-preview" @click="$emit('detail')">
            <font-awesome-icon icon="music" class="file-icon audio-icon"/>
        </div>
        
        <!-- 图片预览 -->
        <el-image 
            v-else-if="isImage"
            :preview-teleported="true" 
            :src="fileLink" 
            :preview-src-list="previewSrcList" 
            fit="cover" 
            lazy 
            class="image-preview"
        >
            <template #placeholder>
                <div class="skeleton-wrapper"></div>
            </template>
            <template #error>
                <div class="error-wrapper" @click.stop="$emit('detail')">
                    <font-awesome-icon icon="image" class="error-icon"/>
                    <span class="error-text">加载失败</span>
                </div>
            </template>
        </el-image>
        
        <!-- 其他文件 -->
        <div v-else class="file-preview">
            <font-awesome-icon icon="file" class="file-icon"/>
        </div>
        
        <!-- 底部覆盖层 -->
        <div class="card-bottom-overlay">
            <div class="file-name-row">
                <span class="file-name">{{ displayName }}</span>
            </div>
            <div class="action-bar">
                <div class="action-bar-left">
                    <el-tooltip :disabled="disableTooltip" content="详情" placement="top">
                        <button class="action-btn" @click.stop="$emit('detail')">
                            <font-awesome-icon icon="info-circle"></font-awesome-icon>
                        </button>
                    </el-tooltip>
                </div>
                <div class="action-bar-right">
                    <el-tooltip :disabled="disableTooltip" content="移动" placement="top">
                        <button class="action-btn" @click.stop="$emit('move')">
                            <font-awesome-icon icon="file-export"></font-awesome-icon>
                        </button>
                    </el-tooltip>
                    <el-tooltip :disabled="disableTooltip" content="删除" placement="top">
                        <button class="action-btn action-btn-danger" @click.stop="$emit('delete')">
                            <font-awesome-icon icon="trash-alt"></font-awesome-icon>
                        </button>
                    </el-tooltip>
                    <el-tooltip :disabled="disableTooltip" content="下载" placement="top">
                        <button class="action-btn" @click.stop="$emit('download')">
                            <font-awesome-icon icon="download"></font-awesome-icon>
                        </button>
                    </el-tooltip>
                    <el-tooltip :disabled="disableTooltip" content="复制链接" placement="top">
                        <button class="action-btn" @click.stop="$emit('copy')">
                            <font-awesome-icon icon="copy"></font-awesome-icon>
                        </button>
                    </el-tooltip>
                </div>
            </div>
        </div>
    </el-card>
</template>

<script>
export default {
    name: 'FileCard',
    props: {
        item: { type: Object, required: true },
        selected: { type: Boolean, default: false },
        fileLink: { type: String, required: true },
        previewSrcList: { type: Array, default: () => [] },
        disableTooltip: { type: Boolean, default: false }
    },
    emits: ['update:selected', 'detail', 'copy', 'move', 'delete', 'download', 'touchstart', 'touchend', 'touchmove'],
    data() {
        return {
            localSelected: this.selected,
            videoLoading: true,
            videoError: false
        }
    },
    computed: {
        channelTag() {
            return this.item.channelTag || '';
        },
        isVideo() {
            // 先通过 content-type 判断
            const fileType = this.item.metadata?.FileType?.toLowerCase() || '';
            if (fileType.includes('video')) return true;
            // 再通过文件后缀判断
            const name = this.item.name?.toLowerCase() || '';
            return name.endsWith('.mp4') || name.endsWith('.webm') || name.endsWith('.mov') || name.endsWith('.avi');
        },
        isAudio() {
            // 先通过 content-type 判断
            const fileType = this.item.metadata?.FileType?.toLowerCase() || '';
            if (fileType.includes('audio')) return true;
            // 再通过文件后缀判断
            const name = this.item.name?.toLowerCase() || '';
            return name.endsWith('.mp3') || name.endsWith('.wav') || name.endsWith('.ogg') || name.endsWith('.flac');
        },
        isImage() {
            // 先通过 content-type 判断
            const fileType = this.item.metadata?.FileType?.toLowerCase() || '';
            if (fileType.includes('image')) return true;
            // 再通过文件后缀判断
            const name = this.item.name?.toLowerCase() || '';
            return name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || 
                   name.endsWith('.gif') || name.endsWith('.webp') || name.endsWith('.svg') || 
                   name.endsWith('.bmp') || name.endsWith('.avif') || name.endsWith('.heic') || name.endsWith('.heif');
        },
        displayName() {
            const fileName = this.item.metadata?.FileName || this.item.name || '';
            const parts = fileName.split('/');
            return parts[parts.length - 1];
        }
    },
    watch: {
        selected(val) {
            this.localSelected = val;
        },
        fileLink() {
            // 链接变化时重置加载状态
            this.videoLoading = true;
            this.videoError = false;
        }
    },
    methods: {
        handleVideoError() {
            this.videoLoading = false;
            this.videoError = true;
        },
        handleVideoClick(e) {
            const video = e.target;
            if (video.requestFullscreen) {
                video.requestFullscreen();
            } else if (video.webkitRequestFullscreen) {
                video.webkitRequestFullscreen();
            } else if (video.mozRequestFullScreen) {
                video.mozRequestFullScreen();
            } else if (video.msRequestFullscreen) {
                video.msRequestFullscreen();
            }
        },
        handleFullscreenChange(e) {
            const video = e.target;
            const isFullscreen = document.fullscreenElement || 
                                 document.webkitFullscreenElement ||
                                 document.mozFullScreenElement ||
                                 document.msFullscreenElement;
            
            if (isFullscreen) {
                // 进入全屏：取消静音和循环
                video.muted = false;
                video.loop = false;
            } else {
                // 退出全屏：恢复静音和循环，暂停并重置
                video.muted = true;
                video.loop = true;
                video.pause();
                video.currentTime = 0;
            }
        },
        handleVideoHover(e, isEnter) {
            const video = e.target;
            if (isEnter) {
                video.play().catch(() => {});
            } else {
                video.pause();
                video.currentTime = 0;
            }
        }
    }
}
</script>

<style scoped>
.img-card {
    width: 100%;
    height: 22vh;
    background: var(--admin-dashboard-imgcard-bg-color);
    border-radius: 8px;
    box-shadow: var(--admin-dashboard-imgcard-shadow);
    overflow: hidden;
    position: relative;
    transition: transform 0.3s ease;
}
.img-card :deep(.el-card__body) {
    padding: 0;
    height: 100%;
    overflow: hidden;
}
.img-card :deep(.el-checkbox) {
    position: absolute;
    top: 10px;
    right: 10px;
    transform: scale(1.5);
    z-index: 10;
}
.img-card:hover {
    transform: scale(1.05);
}
.image-preview, .video-preview {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.4s ease, opacity 0.3s ease;
    filter: var(--image-preview-filter);
}
.video-preview {
    cursor: pointer;
}
.img-card:hover .image-preview,
.img-card:hover .video-preview,
.img-card:hover .file-icon {
    transform: scale(1.08);
}
.image-preview:hover {
    opacity: 0.8;
}
.file-short-info {
    position: absolute;
    z-index: 10;
    top: 3px;
    left: 3px;
    display: flex;
    gap: 5px;
    align-items: start;
}
.success-tag {
    background-color: rgba(34, 139, 34, 0.6);
    color: rgba(255, 255, 255, 0.95);
    border: 1px solid rgba(34, 139, 34, 0.7);
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 500;
    height: auto;
    line-height: 1.2;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(4px);
}
.fail-tag {
    background-color: rgba(220, 53, 69, 0.6);
    color: rgba(255, 255, 255, 0.95);
    border: 1px solid rgba(220, 53, 69, 0.7);
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 500;
    height: auto;
    line-height: 1.2;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(4px);
}
.primary-tag {
    background-color: rgba(250, 82, 194, 0.6);
    color: rgba(255, 255, 255, 0.95);
    border: 1px solid rgba(250, 82, 194, 0.7);
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 500;
    display: flex;
    align-items: center;
    height: auto;
    line-height: 1.2;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    backdrop-filter: blur(4px);
}
.file-preview {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 100%;
}
.file-icon {
    opacity: 0.6;
    font-size: clamp(40px, 4vw, 64px);
    transition: transform 0.4s ease;
}
.audio-icon {
    color: var(--el-color-primary);
    opacity: 0.8;
}
.audio-card-preview {
    cursor: pointer;
}
.card-bottom-overlay {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    background: linear-gradient(transparent, rgba(0, 0, 0, 0.7));
    padding: clamp(15px, 2.5vh, 30px) clamp(6px, 1vw, 12px) clamp(5px, 0.8vh, 10px);
    display: flex;
    flex-direction: column;
    gap: clamp(3px, 0.5vh, 6px);
    z-index: 10;
}
.file-name-row {
    display: flex;
    align-items: center;
    justify-content: center;
}
.file-name {
    color: white;
    font-size: clamp(10px, 1.1vw, 14px);
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
}
.action-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    opacity: 0;
    transform: translateY(4px);
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    pointer-events: none;
}
.el-card:hover .action-bar {
    opacity: 1;
    transform: translateY(0);
    pointer-events: auto;
}
.action-bar-left, .action-bar-right {
    display: flex;
    align-items: center;
    gap: clamp(3px, 0.4vw, 6px);
}
.action-btn {
    width: clamp(24px, 2.5vw, 28px);
    height: clamp(24px, 2.5vw, 28px);
    border: none;
    border-radius: clamp(5px, 0.6vw, 8px);
    background: rgba(255, 255, 255, 0.15);
    color: white;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
    font-size: clamp(11px, 1.1vw, 14px);
}
.action-btn:hover {
    background: rgba(255, 255, 255, 0.25);
    transform: scale(1.08);
}
.action-btn:active {
    transform: scale(0.95);
}
.action-btn-danger:hover {
    background: rgba(239, 68, 68, 0.6);
}
@media (max-width: 768px) {
    .action-bar {
        display: none !important;
    }
}

/* 骨架图加载动画 */
@keyframes skeleton-shimmer {
    0% {
        background-position: -200% 0;
    }
    100% {
        background-position: 200% 0;
    }
}

.skeleton-wrapper {
    width: 100%;
    height: 100%;
    background: linear-gradient(
        90deg,
        var(--skeleton-bg-color) 25%,
        color-mix(in srgb, var(--skeleton-bg-color) 70%, var(--skeleton-shimmer-color)) 50%,
        var(--skeleton-bg-color) 75%
    );
    background-size: 200% 100%;
    animation: skeleton-shimmer 1.5s ease-in-out infinite;
}

/* 加载失败提示 */
.error-wrapper {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: var(--skeleton-bg-color);
    cursor: pointer;
    gap: 8px;
}
.error-icon {
    font-size: 32px;
    color: var(--el-color-warning);
    opacity: 0.7;
}
.error-text {
    font-size: 12px;
    color: var(--el-text-color-secondary);
}
</style>
