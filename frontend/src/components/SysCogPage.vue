<template>
    <div class="page-settings" v-loading="loading">
        <!-- 一级设置：页面设置 -->
        <div class="first-settings">
            <h3 class="first-title">页面设置</h3>
            <el-form :model="settings" label-width="120px">
                <el-form-item v-for="(setting, index) in settings.config" :key="index">
                    <template #label>
                        {{ setting.label }}
                        <el-tooltip v-if="setting.tooltip" :content="setting.tooltip" placement="top" raw-content>
                            <font-awesome-icon icon="question-circle" style="margin-left: 5px; cursor: pointer;"/>
                        </el-tooltip>
                    </template>
                    <el-input v-model="setting.value" :disabled="setting.fixed" :placeholder="setting.placeholder"></el-input>
                </el-form-item>
            </el-form>
        </div>

    
        <!-- 保存按钮 -->
        <div class="actions">
            <el-button type="primary" @click="saveSettings">保存设置</el-button>
        </div>
    </div>
</template>

<script>
import { mapGetters } from 'vuex';

export default {
data() {
    return {
        settings: {
            config: []
        },
        // 加载状态
        loading: false
    };
},
computed: {
    ...mapGetters(['credentials']),
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
    saveSettings() {
        this.fetchWithAuth('/api/manage/sysConfig/page', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(this.settings)
        })
        .then(() => this.$message.success('设置已保存'));
    }
},
mounted() {
    this.loading = true;
    // 获取上传设置
    this.fetchWithAuth('/api/manage/sysConfig/page')
    .then((response) => response.json())
    .then((data) => {
        this.settings = data;
    })
    .finally(() => {
        this.loading = false;
    });
}
};
</script>

<style scoped>
.page-settings {
    padding: 20px;
    min-height: 500px;
}

.first-settings {
    margin-bottom: 40px;
}

.second-title {
    text-align: start;
    margin-left: 20px;
}

.actions {
    margin-top: 20px;
    text-align: right;
}
</style>