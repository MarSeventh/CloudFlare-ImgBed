<template>
    <div class="tabs">
        <span class="title" @click="refreshDashboard">
            <font-awesome-icon :icon="iconName" class="fa-images"></font-awesome-icon>
            {{ titleName }}
        </span>
        <el-dropdown 
            @command="handleTabClick" 
            class="tabs-dropdown" 
            role="navigation" 
            @visible-change="handleDropdownVisible" 
            popper-class="tabs-dropdown-popper"
        >
            <span class="tabs-dropdown-link">
                <font-awesome-icon icon="bars" class="tabs-arrow"></font-awesome-icon>
            </span>
            <template #dropdown>
                <el-dropdown-menu>
                    <el-dropdown-item command="dashboard" v-if="activeTab !== 'dashboard'">
                        <font-awesome-icon icon="images" style="margin-right: 5px; width: 16px;"></font-awesome-icon>
                        文件管理
                    </el-dropdown-item>
                    <el-dropdown-item command="customerConfig" v-if="activeTab !== 'customerConfig'">
                        <font-awesome-icon icon="user-cog" style="margin-right: 5px; width: 16px;"></font-awesome-icon>
                        用户管理
                    </el-dropdown-item>
                    <el-dropdown-item command="systemConfig" v-if="activeTab !== 'systemConfig'">
                        <font-awesome-icon icon="cogs" style="margin-right: 5px; width: 16px;"></font-awesome-icon>
                        系统设置
                    </el-dropdown-item>
                    <el-dropdown-item command="">
                        <font-awesome-icon icon="upload" style="margin-right: 5px; width: 16px;"></font-awesome-icon>
                        文件上传
                    </el-dropdown-item>
                </el-dropdown-menu>
            </template>
        </el-dropdown>
        <AdminToggleDark/>
    </div>
</template>

<script>
import AdminToggleDark from './dashboard/AdminToggleDark.vue';

export default {
    name: 'DashboardTabs',
    props: {
        activeTab: {
            type: String,
            default: 'dashboard'
        }
    },
    components: {
        AdminToggleDark
    },
    computed: {
        titleName() {
            if (this.activeTab === 'dashboard') {
                return '文件管理';
            } else if (this.activeTab === 'customerConfig') {
                return '用户管理';
            } else if (this.activeTab === 'systemConfig') {
                return '系统设置';
            } else {
                return '上传页面';
            }
        },
        iconName() {
            if (this.activeTab === 'dashboard') {
                return 'images';
            } else if (this.activeTab === 'customerConfig') {
                return 'user-cog';
            } else if (this.activeTab === 'systemConfig') {
                return 'cogs';
            } else {
                return 'upload';
            }
        }
    },
    methods: {
        refreshDashboard() {
            location.reload();
        },
        handleTabClick(tab) {
            this.$router.push(`/${tab}`);
        },
        handleDropdownVisible(isVisible) {
            const arrow = document.querySelector('.tabs-dropdown-link');
            if (isVisible) {
                arrow.classList.add('rotate-up'); // 添加旋转类
            } else {
                arrow.classList.remove('rotate-up'); // 移除旋转类
            }
        }
    }
}
</script>

<style scoped>
.tabs {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
}

.title {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 1.2em;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.3s ease;
    color: var(--admin-container-color);
    padding: 6px 14px;
    border-radius: 10px;
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.08) 0%, rgba(139, 92, 246, 0.05) 100%);
    border: 1px solid rgba(99, 102, 241, 0.15);
}

.title:hover {
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.15) 0%, rgba(139, 92, 246, 0.1) 100%);
    border-color: rgba(99, 102, 241, 0.25);
    transform: translateY(-1px);
}

.title .fa-images {
    font-size: 1em;
    color: var(--el-color-primary);
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
}

.tabs-dropdown {
    display: flex;
    align-items: center;
}

.tabs-dropdown-link {
    cursor: pointer;
    font-size: 1.5em;
    transition: all 0.3s ease;
    color: var(--admin-container-color);
    padding: 6px 10px;
    border-radius: 8px;
    background: transparent;
}

.tabs-dropdown-link:hover {
    background: rgba(99, 102, 241, 0.1);
    color: var(--el-color-primary);
}

.tabs-dropdown-link.rotate-up {
    color: var(--el-color-primary);
    background: rgba(99, 102, 241, 0.1);
}

/* 移动端适配 */
@media (max-width: 768px) {
    .title {
        font-size: 1.3em;
        padding: 4px 10px;
        gap: 6px;
    }
    
    .tabs-dropdown-link {
        font-size: 1.3em;
        padding: 4px 8px;
    }
}
/* el-dropdown有关的全局样式在index.html中定义 */
</style>

<style>
.el-dropdown__popper.el-popper.tabs-dropdown-popper {
    border-radius: 12px;
    border: none;
    background-color: var(--tabs-dropdown-popper-bg-color);
    backdrop-filter: blur(10px);
    box-shadow: var(--tabs-dropdown-popper-shadow);
}
.el-dropdown__popper.el-popper.tabs-dropdown-popper .el-dropdown-menu {
    border: none;
    background: none;
}
.el-dropdown__popper.el-popper.tabs-dropdown-popper .el-dropdown-menu__item {
    border: none;
    background: none;
    font-size: 16px;
    font-weight: bold;
    transition: font-size 0.3s ease;
}
.el-dropdown__popper.el-popper.tabs-dropdown-popper .el-dropdown-menu__item:hover {
    font-size: 18px;
}
</style>