<template>
    <Teleport to="body">
        <Transition name="drawer-slide">
            <div v-if="modelValue" class="mobile-drawer-overlay" @click="close">
                <div class="mobile-drawer" @click.stop>
                    <div class="mobile-drawer-header">
                        <span class="mobile-drawer-title">目录导航</span>
                        <font-awesome-icon icon="times" class="mobile-drawer-close" @click="close"/>
                    </div>
                    <div class="mobile-drawer-content">
                        <!-- 根目录 -->
                        <div class="mobile-drawer-item" :class="{ active: !currentPath }" @click="navigate('')">
                            <font-awesome-icon icon="home" class="mobile-drawer-item-icon"/>
                            <span>根目录</span>
                        </div>
                        <!-- 当前路径层级 -->
                        <div 
                            v-for="(folder, index) in pathParts" 
                            :key="index"
                            class="mobile-drawer-item"
                            :class="{ active: index === pathParts.length - 1 }"
                            :style="{ paddingLeft: (index + 1) * 16 + 16 + 'px' }"
                            @click="navigate(pathParts.slice(0, index + 1).join('/'))"
                        >
                            <font-awesome-icon icon="folder" class="mobile-drawer-item-icon"/>
                            <span>{{ folder }}</span>
                        </div>
                        <!-- 返回上一级 -->
                        <div v-if="currentPath" class="mobile-drawer-back" @click="goBack">
                            <font-awesome-icon icon="arrow-left" class="mobile-drawer-item-icon"/>
                            <span>返回上一级</span>
                        </div>
                    </div>
                </div>
            </div>
        </Transition>
    </Teleport>
</template>

<script>
export default {
    name: 'MobileDirectoryDrawer',
    props: {
        modelValue: { type: Boolean, default: false },
        currentPath: { type: String, default: '' }
    },
    emits: ['update:modelValue', 'navigate', 'goBack'],
    computed: {
        pathParts() {
            return this.currentPath.split('/').filter(Boolean);
        }
    },
    methods: {
        close() {
            this.$emit('update:modelValue', false);
        },
        navigate(path) {
            this.$emit('navigate', path);
            this.close();
        },
        goBack() {
            this.$emit('goBack');
            this.close();
        }
    }
}
</script>

<style scoped>
.mobile-drawer-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 2000;
    backdrop-filter: blur(4px);
}
.mobile-drawer {
    position: absolute;
    top: 22vh;
    left: 8px;
    bottom: 8px;
    width: 280px;
    max-width: calc(85vw - 16px);
    background: var(--el-bg-color);
    border-radius: 16px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2), 0 2px 8px rgba(0, 0, 0, 0.1);
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
html.dark .mobile-drawer {
    background: rgba(40, 40, 45, 0.98);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.3);
}
.mobile-drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 20px;
    background: linear-gradient(135deg, rgba(56, 189, 248, 0.12) 0%, rgba(14, 165, 233, 0.08) 100%);
    border-bottom: 1px solid var(--el-border-color-lighter);
}
.mobile-drawer-title {
    font-size: 15px;
    font-weight: 600;
    color: #38bdf8;
    display: flex;
    align-items: center;
    gap: 8px;
}
.mobile-drawer-title::before {
    content: '';
    display: inline-block;
    width: 4px;
    height: 16px;
    background: linear-gradient(180deg, #38bdf8 0%, rgba(14, 165, 233, 0.5) 100%);
    border-radius: 2px;
}
.mobile-drawer-close {
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    color: var(--el-text-color-secondary);
    cursor: pointer;
    border-radius: 8px;
    transition: all 0.2s ease;
    background: transparent;
}
.mobile-drawer-close:active {
    background: var(--el-fill-color);
    color: var(--el-text-color-primary);
}
.mobile-drawer-content {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
}
.mobile-drawer-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    margin: 2px 0;
    cursor: pointer;
    transition: all 0.2s ease;
    color: var(--el-text-color-primary);
    border-radius: 10px;
    font-size: 14px;
}
.mobile-drawer-item:active {
    background: var(--el-fill-color-light);
    transform: scale(0.98);
}
.mobile-drawer-item.active {
    background: linear-gradient(135deg, rgba(56, 189, 248, 0.2) 0%, rgba(14, 165, 233, 0.12) 100%);
    color: #38bdf8;
    font-weight: 600;
}
.mobile-drawer-item-icon {
    font-size: 18px;
    width: 24px;
    text-align: center;
    opacity: 0.7;
}
.mobile-drawer-item.active .mobile-drawer-item-icon {
    opacity: 1;
    color: #38bdf8;
}
.mobile-drawer-back {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    margin: 8px 8px;
    border-radius: 10px;
    background: var(--el-fill-color-lighter);
    cursor: pointer;
    transition: all 0.2s ease;
    color: var(--el-text-color-secondary);
    font-size: 14px;
}
.mobile-drawer-back:active {
    background: var(--el-fill-color);
    color: var(--el-text-color-primary);
    transform: scale(0.98);
}
/* 动画 */
.drawer-slide-enter-active { transition: opacity 0.3s ease; }
.drawer-slide-leave-active { transition: opacity 0.2s ease; }
.drawer-slide-enter-active .mobile-drawer { animation: slideInLeft 0.3s ease-out; }
.drawer-slide-leave-active .mobile-drawer { animation: slideOutLeft 0.2s ease-in; }
.drawer-slide-enter-from, .drawer-slide-leave-to { opacity: 0; }
@keyframes slideInLeft { from { transform: translateX(-100%); } to { transform: translateX(0); } }
@keyframes slideOutLeft { from { transform: translateX(0); } to { transform: translateX(-100%); } }
</style>
