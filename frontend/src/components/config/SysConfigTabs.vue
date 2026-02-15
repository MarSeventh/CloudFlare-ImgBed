<template>
<div class="sidebar-container" :class="{ 'is-collapsed': isCollapse }">
    <div class="menu-list">
        <div 
            v-for="item in menuItems" 
            :key="item.index"
            class="menu-item"
            :class="{ 'is-active': activeIndex === item.index }"
            @click="handleSelect(item.index)"
        >
            <font-awesome-icon :icon="item.icon" class="menu-icon" />
            <span class="menu-text">{{ item.title }}</span>
        </div>
    </div>

    <div class="toggle-button" @click="toggleCollapse">
        <font-awesome-icon :icon="isCollapse ? 'angle-double-right' : 'angle-double-left'"></font-awesome-icon>
    </div>
</div>
</template>

<script>
export default {
name: 'SysConfigTabs',
props: {
    activeIndex: {
        type: String,
        default: 'status'
    },
    isCollapse: {
        type: Boolean,
        default: false
    }
},
data() {
    return {
        menuItems: [
            { index: 'status', icon: 'chart-bar', title: '系统状态' },
            { index: 'upload', icon: 'cloud-upload', title: '上传设置' },
            { index: 'security', icon: 'shield', title: '安全设置' },
            { index: 'page', icon: 'pager', title: '网页设置' },
            { index: 'others', icon: 'cog', title: '其他设置' }
        ]
    };
},
methods: {
    toggleCollapse() {
        this.$emit('update:isCollapse', !this.isCollapse);
    },
    checkMobile() {
        const isMobile = window.innerWidth <= 768;
        this.$emit('update:isCollapse', isMobile);
    },
    handleSelect(index) {
        this.$emit('update:activeIndex', index);
    },
},
mounted() {
    this.checkMobile();
    window.addEventListener('resize', this.checkMobile);
},
beforeDestroy() {
    window.removeEventListener('resize', this.checkMobile);
}
};
</script>

<style scoped>
.sidebar-container {
    display: flex;
    flex-direction: column;
    position: fixed;
    top: 50%;
    left: 8px;
    transform: translateY(-50%);
    z-index: 2001;
    width: 140px;
    /* macOS 风格毛玻璃效果 */
    background: rgba(255, 255, 255, 0.72);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-radius: 16px;
    box-shadow: 
        0 4px 30px rgba(0, 0, 0, 0.1),
        0 1px 3px rgba(0, 0, 0, 0.05),
        inset 0 1px 0 rgba(255, 255, 255, 0.4);
    transition: width 0.3s ease, box-shadow 0.3s ease;
    overflow: hidden;
}

.sidebar-container.is-collapsed {
    width: 56px;
}

/* 深色模式 */
html.dark .sidebar-container {
    background: rgba(30, 30, 30, 0.75);
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 
        0 4px 30px rgba(0, 0, 0, 0.3),
        0 1px 3px rgba(0, 0, 0, 0.2),
        inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

.sidebar-container:hover {
    box-shadow: 
        0 8px 40px rgba(0, 0, 0, 0.12),
        0 2px 6px rgba(0, 0, 0, 0.08),
        inset 0 1px 0 rgba(255, 255, 255, 0.5);
}

html.dark .sidebar-container:hover {
    box-shadow: 
        0 8px 40px rgba(0, 0, 0, 0.4),
        0 2px 6px rgba(0, 0, 0, 0.3),
        inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.menu-list {
    padding: 8px;
}

.menu-item {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    padding: 12px 12px 12px 0;
    height: 42px;
    box-sizing: border-box;
    border-radius: 10px;
    cursor: pointer;
    transition: background 0.2s ease, color 0.2s ease;
    color: var(--admin-container-color, #333);
    gap: 0;
    overflow: hidden;
}

.menu-item:hover {
    background: rgba(0, 0, 0, 0.06);
}

html.dark .menu-item:hover {
    background: rgba(255, 255, 255, 0.1);
}

.menu-item.is-active {
    background: linear-gradient(135deg, rgba(64, 158, 255, 0.15), rgba(56, 189, 248, 0.25));
    color: #409EFF;
}

html.dark .menu-item.is-active {
    background: linear-gradient(135deg, rgba(64, 158, 255, 0.2), rgba(56, 189, 248, 0.35));
}

.menu-icon {
    width: 40px;
    min-width: 40px;
    font-size: 16px;
    flex-shrink: 0;
    text-align: center;
}

.menu-text {
    font-size: 14px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    opacity: 1;
    max-width: 100px;
    transition: opacity 0.2s ease 0.05s, max-width 0.25s ease;
}

.sidebar-container.is-collapsed .menu-text {
    opacity: 0;
    max-width: 0;
    transition: opacity 0.1s ease, max-width 0.2s ease;
}

.toggle-button {
    padding: 12px;
    text-align: center;
    cursor: pointer;
    border-top: 1px solid rgba(0, 0, 0, 0.08);
    transition: all 0.2s ease;
    color: var(--admin-container-color, #333);
}

html.dark .toggle-button {
    border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.toggle-button:hover {
    background: rgba(0, 0, 0, 0.04);
}

html.dark .toggle-button:hover {
    background: rgba(255, 255, 255, 0.06);
}

/* 移动端 */
@media (max-width: 768px) {
    .sidebar-container {
        left: 4px;
        width: 120px;
    }
    
    .sidebar-container.is-collapsed {
        width: 50px;
    }
    
    .menu-icon {
        width: 34px;
        min-width: 34px;
    }
}
</style>