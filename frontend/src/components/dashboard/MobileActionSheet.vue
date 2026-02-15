<template>
    <Teleport to="body">
        <Transition name="bottom-sheet">
            <div v-if="modelValue" class="bottom-sheet-overlay" @click="close">
                <div class="bottom-sheet" @click.stop>
                    <div class="bottom-sheet-header">
                        <div class="bottom-sheet-handle"></div>
                        <span class="bottom-sheet-title">{{ title }}</span>
                    </div>
                    <div class="bottom-sheet-content">
                        <!-- 文件操作 -->
                        <template v-if="!isFolder">
                            <div class="bottom-sheet-item" @click="handleAction('detail')">
                                <font-awesome-icon icon="info-circle" class="bottom-sheet-icon"></font-awesome-icon>
                                <span>查看详情</span>
                            </div>
                            <div class="bottom-sheet-item" @click="handleAction('copy')">
                                <font-awesome-icon icon="copy" class="bottom-sheet-icon"></font-awesome-icon>
                                <span>复制链接</span>
                            </div>
                            <div class="bottom-sheet-item" @click="handleAction('download')">
                                <font-awesome-icon icon="download" class="bottom-sheet-icon"></font-awesome-icon>
                                <span>下载文件</span>
                            </div>
                            <div class="bottom-sheet-item" @click="handleAction('move')">
                                <font-awesome-icon icon="file-export" class="bottom-sheet-icon"></font-awesome-icon>
                                <span>移动文件</span>
                            </div>
                            <div class="bottom-sheet-item" @click="handleAction('tag')">
                                <font-awesome-icon icon="tags" class="bottom-sheet-icon"></font-awesome-icon>
                                <span>标签管理</span>
                            </div>
                        </template>
                        <!-- 文件夹操作 -->
                        <template v-else>
                            <div class="bottom-sheet-item" @click="handleAction('folderCopy')">
                                <font-awesome-icon icon="copy" class="bottom-sheet-icon"></font-awesome-icon>
                                <span>复制链接</span>
                            </div>
                            <div class="bottom-sheet-item" @click="handleAction('move')">
                                <font-awesome-icon icon="file-export" class="bottom-sheet-icon"></font-awesome-icon>
                                <span>移动文件夹</span>
                            </div>
                        </template>
                        <!-- 删除操作 -->
                        <div class="bottom-sheet-item bottom-sheet-danger" @click="handleAction('delete')">
                            <font-awesome-icon icon="trash-alt" class="bottom-sheet-icon"></font-awesome-icon>
                            <span>{{ isFolder ? '删除文件夹' : '删除文件' }}</span>
                        </div>
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<script>
export default {
    name: 'MobileActionSheet',
    props: {
        modelValue: { type: Boolean, default: false },
        title: { type: String, default: '' },
        isFolder: { type: Boolean, default: false }
    },
    emits: ['update:modelValue', 'action'],
    methods: {
        close() {
            this.$emit('update:modelValue', false);
        },
        handleAction(action) {
            this.$emit('action', action);
            this.close();
        }
    }
}
</script>

<style scoped>
.bottom-sheet-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 9999;
    display: flex;
    align-items: flex-end;
    justify-content: center;
}
.bottom-sheet {
    width: 100%;
    max-width: 100%;
    background: var(--bottom-sheet-bg, rgba(255, 255, 255, 0.95));
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-radius: 20px 20px 0 0;
    max-height: 70vh;
    overflow: hidden;
    box-shadow: 0 -4px 30px rgba(0, 0, 0, 0.15);
    border-top: 1px solid var(--bottom-sheet-border, rgba(0, 0, 0, 0.05));
}
html.dark .bottom-sheet {
    --bottom-sheet-bg: rgba(40, 44, 52, 0.95);
    --bottom-sheet-border: rgba(255, 255, 255, 0.1);
    box-shadow: 0 -4px 30px rgba(0, 0, 0, 0.4);
}
.bottom-sheet-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 16px 20px 12px;
    border-bottom: 1px solid var(--el-border-color-lighter);
}
.bottom-sheet-handle {
    width: 40px;
    height: 4px;
    background: var(--el-border-color);
    border-radius: 2px;
}
.bottom-sheet-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--el-text-color-primary);
    text-align: center;
    max-width: 80%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
html.dark .bottom-sheet-title {
    color: #f0f0f0;
}
.bottom-sheet-content {
    padding: 12px 16px;
    padding-bottom: calc(20px + env(safe-area-inset-bottom));
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.bottom-sheet-item {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px 20px;
    border-radius: 14px;
    cursor: pointer;
    transition: all 0.2s ease;
    background: var(--bottom-sheet-item-bg, rgba(0, 0, 0, 0.04));
    color: var(--el-text-color-primary);
}
html.dark .bottom-sheet-item {
    --bottom-sheet-item-bg: rgba(255, 255, 255, 0.08);
}
.bottom-sheet-item:active {
    transform: scale(0.98);
    background: var(--bottom-sheet-item-active-bg, rgba(0, 0, 0, 0.08));
}
html.dark .bottom-sheet-item:active {
    --bottom-sheet-item-active-bg: rgba(255, 255, 255, 0.15);
}
.bottom-sheet-icon {
    font-size: 20px;
    width: 28px;
    text-align: center;
    color: #38bdf8;
}
.bottom-sheet-danger {
    color: var(--el-color-danger);
}
.bottom-sheet-danger .bottom-sheet-icon {
    color: var(--el-color-danger);
}
/* 动画 */
.bottom-sheet-enter-active { transition: all 0.3s ease-out; }
.bottom-sheet-leave-active { transition: all 0.2s ease-in; }
.bottom-sheet-enter-active .bottom-sheet { animation: slideUp 0.3s ease-out; }
.bottom-sheet-leave-active .bottom-sheet { animation: slideDown 0.2s ease-in; }
.bottom-sheet-enter-from, .bottom-sheet-leave-to { opacity: 0; }
.bottom-sheet-enter-from .bottom-sheet, .bottom-sheet-leave-to .bottom-sheet { transform: translateY(100%); }
@keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
@keyframes slideDown { from { transform: translateY(0); } to { transform: translateY(100%); } }
</style>
