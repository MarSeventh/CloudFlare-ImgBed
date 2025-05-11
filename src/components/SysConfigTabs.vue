<template>
<div class="sidebar-container">
    <el-menu
    :default-active="activeIndex"
    class="el-menu-vertical"
    :collapse="isCollapse"
    @select="handleSelect"
    >
        <el-menu-item index="upload" class="menu-item">
            <font-awesome-icon icon="cloud-upload"></font-awesome-icon>
            <span slot="title">上传设置</span>
        </el-menu-item>
        <el-menu-item index="security" class="menu-item">
            <font-awesome-icon icon="shield"></font-awesome-icon>
            <span slot="title">安全设置</span>
        </el-menu-item>
        <el-menu-item index="page" class="menu-item">
            <font-awesome-icon icon="pager"></font-awesome-icon>
            <span slot="title">页面设置</span>
        </el-menu-item>
        <el-menu-item index="others" class="menu-item">
            <font-awesome-icon icon="cog"></font-awesome-icon>
            <span slot="title">其他设置</span>
        </el-menu-item>
    </el-menu>

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
        default: 'upload'
    },
    isCollapse: {
        type: Boolean,
        default: false
    }
},
data() {
    return {
        isCollapse: false
    };
},
methods: {
    toggleCollapse() {
        this.isCollapse = !this.isCollapse;
        this.$emit('update:isCollapse', this.isCollapse);
    },
    checkMobile() {
        const isMobile = window.innerWidth <= 768; // 假设移动端宽度小于等于768px
        this.isCollapse = isMobile;
        this.$emit('update:isCollapse', this.isCollapse);
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
    top: 30vh;
    left: 0;
    border-right: 1px dashed var(--admin-syscfg-tabs-border-color);
}

.el-menu-vertical {
    background: none;
    border: none;
    width: 64px;
    min-height: 300px;
}
.el-menu-vertical:not(.el-menu--collapse) {
    width: 130px;
    min-height: 300px;
}

.menu-item {
    gap: 10px;
    border-radius: 0 20px 20px 0;
}

.toggle-button {
    padding: 10px;
    text-align: center;
    cursor: pointer;
}

.toggle-button i {
    font-size: 20px;
}
</style>