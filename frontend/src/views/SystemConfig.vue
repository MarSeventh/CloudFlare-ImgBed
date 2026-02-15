<template>
    <div class="container">
        <el-header>
            <div class="header-content">
                <DashboardTabs activeTab="systemConfig"></DashboardTabs>
                <div class="header-action">
                    <el-tooltip :disabled="disableTooltip" content="退出登录" placement="bottom">
                        <font-awesome-icon icon="sign-out-alt" class="header-icon" @click="handleLogout"></font-awesome-icon>
                    </el-tooltip>
                </div>
            </div>
        </el-header>
        <SysConfigTabs
            v-model:activeIndex="activeIndex"
            v-model:isCollapse="isSidebarCollapse"
        />
        <!-- 根据锚点动态渲染子页面 -->
        <component :is="currentComponent" :class="['main-container', { 'collapsed': isSidebarCollapse }]" />
    </div>
</template>
<script>
import DashboardTabs from '@/components/DashboardTabs.vue';
import SysConfigTabs from '@/components/config/SysConfigTabs.vue';
import SysCogStatus from '@/components/config/SysCogStatus.vue';
import SysCogUpload from '@/components/config/SysCogUpload.vue';
import SysCogSecurity from '@/components/config/SysCogSecurity.vue';
import SysCogPage from '@/components/config/SysCogPage.vue';
import SysCogOthers from '@/components/config/SysCogOthers.vue';
import backgroundManager from '@/mixins/backgroundManager';

export default {
    name: 'SystemConfig',
    mixins: [backgroundManager],
    data() {
        return {
            activeIndex: 'status',
            isSidebarCollapse: false
        }
    },
    watch: {
        // 监听锚点变化
        '$route.hash': {
            immediate: true,
            handler(newHash) {
                this.activeIndex = newHash.replace('#', '');
                window.scrollTo(0, 0); // 滚动到页面顶部
            }
        },
        activeIndex(newIndex) {
            // 更新锚点
            const hash = `#${newIndex}`;
            this.$router.push({ hash });
        }
    },
    components: {
        DashboardTabs,
        SysConfigTabs,
        SysCogStatus,
        SysCogUpload,
        SysCogSecurity,
        SysCogPage,
        SysCogOthers
    },
    computed: {
        disableTooltip() {
            return window.innerWidth < 768;
        },
        // 根据锚点动态返回对应的组件
        currentComponent() {
            const hash = this.$route.hash.replace('#', '');
            switch (hash) {
                case 'status':
                    return SysCogStatus;
                case 'upload':
                    return SysCogUpload;
                case 'security':
                    return SysCogSecurity;
                case 'page':
                    return SysCogPage;
                case 'others':
                    return SysCogOthers;
                default:
                    return SysCogStatus;
            }
        }
    },
    methods: {
        handleLogout() {
            this.$store.commit('setCredentials', null);
            this.$router.push('/adminLogin');
        },
        // 设置默认锚点
        setDefaultHash() {
            const defaultHash = '#status'; // 默认锚点
            window.location.hash = defaultHash;
            this.activeIndex = defaultHash.replace('#', '');
        },
    },
    mounted() {
        // 初始化背景图
        this.initializeBackground('adminBkImg', '.container', false, true);

        // 如果 URL 中没有锚点，则设置默认锚点
        if (!window.location.hash) {
            this.setDefaultHash();
        }
    },
}
</script>
<style scoped>
.container {
    background: var(--admin-container-bg-color);
    min-height: 100vh;
    font-family: 'Arial', sans-serif;
    color: var(--admin-container-color);
    margin: 0;
    padding: 0;
    overflow-x: hidden;
}

.header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 24px;
    /* macOS 风格毛玻璃效果 */
    background: rgba(255, 255, 255, 0.72);
    backdrop-filter: blur(20px) saturate(180%);
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    /* 顶部边框形成玻璃边缘光泽 */
    border: 1px solid rgba(255, 255, 255, 0.3);
    border-top: 1px solid rgba(255, 255, 255, 0.5);
    /* 悬浮阴影效果 */
    box-shadow: 
        0 4px 30px rgba(0, 0, 0, 0.1),
        0 1px 3px rgba(0, 0, 0, 0.05),
        inset 0 1px 0 rgba(255, 255, 255, 0.4);
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    border-radius: 16px;
    position: fixed;
    top: 8px;
    left: 50%;
    transform: translateX(-50%);
    width: calc(95% - 16px);
    z-index: 2001;
    min-height: 45px;
}

/* 深色模式毛玻璃效果 */
html.dark .header-content {
    background: rgba(30, 30, 30, 0.75);
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-top: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: 
        0 4px 30px rgba(0, 0, 0, 0.3),
        0 1px 3px rgba(0, 0, 0, 0.2),
        inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

@media (max-width: 768px) {
    .header-content {
        flex-direction: column;
        top: 6px;
        width: calc(100% - 32px);
        border-radius: 14px;
        padding: 6px 12px;
        gap: 4px;
    }
    
    .header-icon {
        font-size: 0.95em;
    }
}

.header-content:hover {
    background: rgba(255, 255, 255, 0.82);
    box-shadow: 
        0 8px 40px rgba(0, 0, 0, 0.12),
        0 2px 6px rgba(0, 0, 0, 0.08),
        inset 0 1px 0 rgba(255, 255, 255, 0.5);
    transform: translateX(-50%) translateY(-1px);
}

html.dark .header-content:hover {
    background: rgba(35, 35, 35, 0.85);
    box-shadow: 
        0 8px 40px rgba(0, 0, 0, 0.4),
        0 2px 6px rgba(0, 0, 0, 0.3),
        inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.header-icon {
    font-size: 1.5em;
    cursor: pointer;
    transition: all 0.3s ease;
    color: var(--admin-container-color);
    outline: none;
}

.header-icon:hover {
    color: #B39DDB; /* 使用柔和的淡紫色 */
    transform: scale(1.2);
}

.header-action {
    display: flex;
    gap: 10px;
}

.main-container {
  margin-top: 60px;
  transition: margin-left 0.3s ease, width 0.3s ease; /* 添加过渡效果 */
  width: calc(100% - 280px); /* 默认宽度（侧边栏展开时） */
  margin-left: 170px; /* 默认左边距（侧边栏展开时） */
}

.main-container.collapsed {
  width: calc(100% - 150px); /* 折叠时的宽度 */
  margin-left: 80px; /* 折叠时的左边距 */
}

/* 移动端不压缩内容，但让出折叠侧边栏宽度 */
@media (max-width: 768px) {
  .main-container,
  .main-container.collapsed {
    width: auto;
    margin-left: 65px;
    margin-right: 15px;
    padding: 0;
    min-height: calc(100vh - 60px);
    box-sizing: border-box;
  }
}
</style>