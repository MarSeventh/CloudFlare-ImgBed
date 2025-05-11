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
import { mapGetters } from 'vuex';
import DashboardTabs from '@/components/DashboardTabs.vue';
import SysConfigTabs from '@/components/SysConfigTabs.vue';
import SysCogUpload from '@/components/SysCogUpload.vue';
import SysCogSecurity from '@/components/SysCogSecurity.vue';
import SysCogPage from '@/components/SysCogPage.vue';
import SysCogOthers from '@/components/SysCogOthers.vue';

export default {
    name: 'SystemConfig',
    data() {
        return {
            activeIndex: 'upload',
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
        SysCogUpload,
        SysCogSecurity,
        SysCogPage,
        SysCogOthers
    },
    computed: {
        ...mapGetters(['credentials']),
        disableTooltip() {
            return window.innerWidth < 768;
        },
        // 根据锚点动态返回对应的组件
        currentComponent() {
            const hash = this.$route.hash.replace('#', '');
            switch (hash) {
                case 'security':
                    return SysCogSecurity;
                case 'page':
                    return SysCogPage;
                case 'others':
                    return SysCogOthers;
                default:
                    return SysCogUpload;
            }
        }
    },
    methods: {
        async fetchWithAuth(url, options = {}) {
            // 开发环境, url 前面加上 /api
            // url = `/api${url}`;
            if (this.credentials) {
                // 设置 Authorization 头
                options.headers = {
                    ...options.headers,
                    'Authorization': `Basic ${this.credentials}`
                };
                // 确保包含凭据，如 cookies
                options.credentials = 'include'; 
            }

            const response = await fetch(url, options);

            if (response.status === 401) {
                // Redirect to the login page if a 401 Unauthorized is returned
                this.$message.error('认证状态错误，请重新登录');
                this.$router.push('/adminLogin'); 
                throw new Error('Unauthorized');
            }

            return response;
        },
        handleLogout() {
            this.$store.commit('setCredentials', null);
            this.$router.push('/adminLogin');
        },
        // 设置默认锚点
        setDefaultHash() {
            const defaultHash = '#upload'; // 默认锚点
            window.location.hash = defaultHash;
            this.activeIndex = defaultHash.replace('#', '');
        },
    },
    mounted() {
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
}

.header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 10px 20px;
    background-color: var(--admin-header-content-bg-color);
    backdrop-filter: blur(10px);
    border-bottom: var(--admin-header-content-border-bottom);
    box-shadow: var(--admin-header-content-box-shadow);
    transition: background-color 0.5s ease, box-shadow 0.5s ease;
    border-bottom-left-radius: 10px;
    border-bottom-right-radius: 10px;
    position: fixed;
    top: 0;
    left: 50%; /* 将左边缘移动到页面中间 */
    transform: translateX(-50%); /* 向左移动自身宽度的一半 */
    width: 95%;
    z-index: 1000;
    min-height: 45px;
}

@media (max-width: 768px) {
    .header-content {
        flex-direction: column;
    }
}

.header-content:hover {
    background-color: var(--admin-header-content-hover-bg-color);
    box-shadow: var(--admin-header-content-hover-box-shadow);
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
  width: calc(100% - 200px); /* 默认宽度（侧边栏展开时） */
  margin-left: 130px; /* 默认左边距（侧边栏展开时） */
}

.main-container.collapsed {
  width: calc(100% - 134px); /* 折叠时的宽度 */
  margin-left: 64px; /* 折叠时的左边距 */
}
</style>