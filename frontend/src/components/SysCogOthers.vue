<template>
    <div class="others-settings" v-loading="loading">
        <!-- 一级设置：其他设置 -->
        <div class="first-settings">
            <h3 class="first-title">其他设置</h3>
            <h4 class="second-title">远端遥测
                <el-tooltip content="便于问题查找和定位，建议开启" placement="right">
                    <font-awesome-icon icon="question-circle" style="margin-left: 5px; cursor: pointer;"/>
                </el-tooltip>
            </h4>
            <el-form :model="settings.telemetry" label-width="120px">
                <el-form-item label="启用">
                    <el-switch v-model="settings.telemetry.enabled" :disabled="settings.telemetry.fixed"></el-switch>
                </el-form-item>
            </el-form>
            <h4 class="second-title">随机图像API
                <el-tooltip content="API具体用法请查阅文档" placement="right">
                    <font-awesome-icon icon="question-circle" style="margin-left: 5px; cursor: pointer;"/>
                </el-tooltip>
            </h4>
            <el-form :model="settings.randomImageAPI" label-width="120px">
                <el-form-item label="启用">
                    <el-switch v-model="settings.randomImageAPI.enabled" :disabled="settings.randomImageAPI.fixed"></el-switch>
                </el-form-item>
                <el-form-item prop="randomImageAPI.allowedDir">
                    <template #label>
                        <span>目录</span>
                        <el-tooltip content="1. 开放随机图权限的目录，默认为根目录，多个目录用逗号分隔 <br/> 2. 目录均采用绝对路径，例如/img/cover，表示该目录及其所有子目录的文件可被随机图API访问" placement="right" raw-content>
                            <font-awesome-icon icon="question-circle" style="margin-left: 5px; cursor: pointer;"/>
                        </el-tooltip>
                    </template>
                    <el-input v-model="settings.randomImageAPI.allowedDir" :disabled="settings.randomImageAPI.fixed"></el-input>
                </el-form-item>
            </el-form>
            <h4 class="second-title">CloudFlare API Token
                <el-tooltip content="设置后可以使后端拉黑、删除等操作不受CDN缓存限制 <br/> 建议设置,设置方式请查阅文档" placement="right" raw-content>
                    <font-awesome-icon icon="question-circle" style="margin-left: 5px; cursor: pointer;"/>
                </el-tooltip>
            </h4>
            <el-form :model="settings.cloudflareApiToken" label-width="120px">
                <el-form-item label="区域ID">
                    <el-input v-model="settings.cloudflareApiToken.CF_ZONE_ID" :disabled="settings.cloudflareApiToken.fixed"></el-input>
                </el-form-item>
                <el-form-item label="账户邮箱">
                    <el-input v-model="settings.cloudflareApiToken.CF_EMAIL" :disabled="settings.cloudflareApiToken.fixed"></el-input>
                </el-form-item>
                <el-form-item label="API Key">
                    <el-input v-model="settings.cloudflareApiToken.CF_API_KEY" :disabled="settings.cloudflareApiToken.fixed" type="password" show-password autocomplete="new-password"></el-input>
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
            telemetry: {},
            randomImageAPI: {},
            cloudflareApiToken: {},
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
        this.fetchWithAuth('/api/manage/sysConfig/others', {
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
    this.fetchWithAuth('/api/manage/sysConfig/others')
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
.others-settings {
    padding: 20px;
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