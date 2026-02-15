<template>
    <el-card 
        class="img-card folder-card"
        @touchstart="$emit('touchstart', $event)"
        @touchend="$emit('touchend', $event)"
        @touchmove="$emit('touchmove', $event)"
    >
        <el-checkbox v-model="localSelected" @change="$emit('update:selected', localSelected)"></el-checkbox>
        <div class="folder-icon" @click="$emit('enter')">
            <font-awesome-icon icon="folder-open" class="folder-icon-svg"/>
        </div>
        <div class="card-bottom-overlay">
            <div class="file-name-row">
                <span class="file-name">{{ folderName }}</span>
            </div>
            <div v-if="showActions" class="action-bar">
                <div class="action-bar-left"></div>
                <div class="action-bar-right">
                    <el-tooltip :disabled="disableTooltip" content="复制链接" placement="top">
                        <button class="action-btn" @click.stop="$emit('copy')">
                            <font-awesome-icon icon="copy"></font-awesome-icon>
                        </button>
                    </el-tooltip>
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
                </div>
            </div>
        </div>
    </el-card>
</template>

<script>
export default {
    name: 'FolderCard',
    props: {
        name: { type: String, required: true },
        selected: { type: Boolean, default: false },
        showActions: { type: Boolean, default: true },
        disableTooltip: { type: Boolean, default: false }
    },
    emits: ['update:selected', 'enter', 'copy', 'move', 'delete', 'touchstart', 'touchend', 'touchmove'],
    data() {
        return {
            localSelected: this.selected
        }
    },
    computed: {
        folderName() {
            const parts = this.name.split('/').filter(Boolean);
            return parts[parts.length - 1] || this.name;
        }
    },
    watch: {
        selected(val) {
            this.localSelected = val;
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
.folder-card {
    cursor: pointer;
}
.folder-icon {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 100%;
    color: var(--el-color-primary);
}
.folder-icon-svg {
    font-size: clamp(40px, 4vw, 64px);
    transition: transform 0.4s ease;
}
.img-card:hover .folder-icon-svg {
    transform: scale(1.08);
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
</style>
