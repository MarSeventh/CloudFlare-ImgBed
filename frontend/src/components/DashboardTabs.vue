<template>
    <div class="tabs">
        <el-select :model-value="activeTab" @change="handleTabClick" class="page-select" :aria-label="$t('dashboardTabs.navigation')">
            <template #prefix><font-awesome-icon :icon="currentOption.icon" /></template>
            <el-option v-for="option in options" :key="option.value" :value="option.value" :label="$t(option.label)">
                <font-awesome-icon :icon="option.icon" class="option-icon" />{{ $t(option.label) }}
            </el-option>
        </el-select>
        <AdminToggleDark />
        <LanguageSwitcher class="tabs-language-switcher" />
    </div>
</template>
<script>
import AdminToggleDark from './dashboard/AdminToggleDark.vue';
import LanguageSwitcher from '@/components/LanguageSwitcher.vue';
export default {
    name: 'DashboardTabs',
    props: { activeTab: { type: String, default: 'dashboard' } },
    components: { AdminToggleDark, LanguageSwitcher },
    computed: {
        options() { return [
            { value: 'customerConfig', label: 'dashboardTabs.userManagement', icon: 'user-cog' },
            { value: 'dashboard', label: 'dashboardTabs.fileManagement', icon: 'images' },
            { value: 'trash', label: 'trash.title', icon: 'trash-alt' },
            { value: 'systemConfig', label: 'dashboardTabs.systemSettings', icon: 'cogs' },
            { value: '', label: 'dashboardTabs.fileUpload', icon: 'upload' }
        ]; },
        currentOption() { return this.options.find(option => option.value === this.activeTab) || this.options.find(option => option.value === ''); }
    },
    methods: { handleTabClick(tab) { if (tab !== this.activeTab) this.$router.push('/' + tab); } }
};
</script>
<style scoped>
.tabs { display: flex; align-items: center; justify-content: center; gap: 8px; }
.page-select { width: 180px; }
.page-select :deep(.el-select__wrapper) { border-radius: 10px; font-weight: 600; }
.option-icon { width: 16px; margin-right: 8px; }
.tabs-language-switcher { --lang-icon-size: 1.3em; --lang-icon-color: var(--admin-theme-toggle-color); padding: 5px; }
@media (max-width: 768px) { .tabs { gap: 6px; } .page-select { width: 158px; } .tabs-language-switcher { --lang-icon-size: 1.1em; padding: 3px; } }
</style>
