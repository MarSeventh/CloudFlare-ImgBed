<template>
    <div class="security-settings" v-loading="loading">
        <!-- 一级设置：认证管理 -->
        <div class="first-settings">
            <h3 class="first-title">认证管理</h3>

            <h4 class="second-title">用户端认证</h4>
            <el-form 
                :model="authSettings.user" 
                :rules = "userPassRules"
                ref = "userPassForm"
                label-width="120px"
            >
                <el-form-item label="上传密码" prop="authCode">
                    <el-input v-model="authSettings.user.authCode" type="password" show-password @input="handleUserPassInput" autocomplete="new-password"/>
                </el-form-item>

                <transition name="fade-slide" mode="out-in">
                    <el-form-item label="确认密码" prop="confirmNewUserPassword" v-if="showUserPassConfirm" key="user-confirm">
                        <el-input v-model="authSettings.user.confirmNewUserPassword" type="password" show-password autocomplete="new-password"/>
                    </el-form-item>
                </transition>
            </el-form>
            
            <h4 class="second-title">管理端认证</h4>
            <el-form 
                :model="authSettings.admin"
                :rules = "adminPassRules"
                ref = "adminPassForm"
                label-width="120px"
            >
                <el-form-item label="用户名" prop="adminUsername">
                    <el-input v-model="authSettings.admin.adminUsername" autocomplete="new-password"/>
                </el-form-item>
                <el-form-item label="密码" prop="adminPassword">
                    <el-input v-model="authSettings.admin.adminPassword" type="password" show-password @input="handleAdminPassInput" autocomplete="new-password"/>
                </el-form-item>

                <transition name="fade-slide" mode="out-in">
                    <el-form-item label="确认密码" prop="confirmNewAdminPassword" v-if="showAdminPassConfirm" key="admin-confirm">
                        <el-input v-model="authSettings.admin.confirmNewAdminPassword" type="password" show-password autocomplete="new-password"/>
                    </el-form-item>
                </transition>
            </el-form>

            <h4 class="second-title token-title">API Token 管理
                <a class="token-actions">
                    <el-button type="primary" size="small" @click="showCreateTokenDialog = true" circle>
                        <font-awesome-icon icon="plus"/>
                    </el-button>
                </a>
            </h4>
            <div class="token-table-container">
                <el-table 
                    :data="apiTokens" 
                    class="token-table"
                    v-loading="tokenLoading"
                >
                    <el-table-column prop="name" label="名称" header-align="center">
                        <template #default="scope">
                            <div class="table-cell-content">{{ scope.row.name }}</div>
                        </template>
                    </el-table-column>
                    <el-table-column prop="token" label="Token" header-align="center">
                        <template #default="scope">
                            <div class="table-cell-content">
                                <span class="token-display">{{ scope.row.token }}</span>
                            </div>
                        </template>
                    </el-table-column>
                    <el-table-column prop="permissions" label="权限" header-align="center">
                        <template #default="scope">
                            <div class="table-cell-content">
                                <el-tag 
                                    v-for="perm in scope.row.permissions" 
                                    :key="perm" 
                                    size="small" 
                                    class="permission-tag"
                                >
                                    {{ getPermissionText(perm) }}
                                </el-tag>
                            </div>
                        </template>
                    </el-table-column>
                    <el-table-column prop="createdAt" label="创建时间" header-align="center">
                        <template #default="scope">
                            <div class="table-cell-content">{{ formatDate(scope.row.createdAt) }}</div>
                        </template>
                    </el-table-column>
                    <el-table-column label="操作" fixed="right" header-align="center">
                        <template #default="scope">
                            <div class="table-cell-content action-buttons">
                                <el-button class="action-button" size="small" @click="editToken(scope.row)">编辑</el-button>
                                <el-button class="action-button" size="small" type="danger" @click="deleteToken(scope.row.id)">删除</el-button>
                            </div>
                        </template>
                    </el-table-column>
                </el-table>
            </div>
        </div>

        <!-- 一级设置：上传管理 -->
        <div class="first-settings">
            <h3 class="first-title">上传管理</h3>            
            <h4 class="second-title">图像审查
                <el-tooltip content="仅对非分块上传文件生效，支持 nsfwjs 和 moderatecontent.com 渠道" placement="top">
                    <font-awesome-icon icon="question-circle" style="margin-left: 5px; cursor: pointer;"/>
                </el-tooltip>
            </h4>         
            <el-form :model="uploadSettings.moderate" label-width="120px">
                <el-form-item label="开启审查">
                    <el-switch v-model="uploadSettings.moderate.enabled"/>
                </el-form-item>
                <el-form-item label="审查渠道">
                    <el-select v-model="uploadSettings.moderate.channel" placeholder="请选择审查渠道">
                        <el-option label="moderatecontent.com" value="moderatecontent.com"></el-option>
                        <el-option label="nsfwjs" value="nsfwjs"></el-option>
                    </el-select>
                </el-form-item>
                <el-form-item v-if="uploadSettings.moderate.channel === 'moderatecontent.com'" label="API Key">
                    <el-input v-model="uploadSettings.moderate.moderateContentApiKey"/>
                </el-form-item>
                <el-form-item v-if="uploadSettings.moderate.channel === 'nsfwjs'" label="API 路径">
                    <el-input v-model="uploadSettings.moderate.nsfwApiPath" placeholder="https://nsfwjs.your.domain"/>
                </el-form-item>
            </el-form>
        </div>

        <!-- 一级设置：访问管理 -->
        <div class="first-settings">
            <h3 class="first-title">访问管理</h3>
            <h4 class="second-title">域名过滤</h4>
            <el-form :model="accessSettings" label-width="120px">
                <el-form-item>
                    <template #label>
                        放行域名
                        <el-tooltip content="1.针对访问域名设置权限 <br/> 2.留空默认全部放行，多个域名请用英文逗号分隔" placement="top" raw-content>
                            <font-awesome-icon icon="question-circle" style="margin-left: 5px; cursor: pointer;"/>
                        </el-tooltip>
                    </template>
                    <el-input v-model="accessSettings.allowedDomains"/>
                </el-form-item>
            </el-form>
            <h4 class="second-title">白名单模式</h4>
            <el-form :model="accessSettings" label-width="120px">
                <el-form-item>
                    <template #label>
                        是否开启
                        <el-tooltip content="1.针对文件设置权限 <br> 2.开启后，仅被加入白名单的文件可被访问" placement="top" raw-content>
                            <font-awesome-icon icon="question-circle" style="margin-left: 5px; cursor: pointer;"/>
                        </el-tooltip>
                    </template>
                    <el-switch v-model="accessSettings.whiteListMode"/>
                </el-form-item>
            </el-form>
        </div>

        <!-- 悬浮保存按钮 -->
        <FloatingSaveButton :show="!loading" @click="saveSettings" />

        <!-- 创建Token对话框 -->
        <el-dialog v-model="showCreateTokenDialog" title="创建新 API Token" :width="dialogWidth">
            <el-form :model="newToken" :rules="tokenRules" ref="tokenForm" label-width="100px">
                <el-form-item label="Token 名称" prop="name">
                    <el-input v-model="newToken.name" placeholder="请输入Token名称"/>
                </el-form-item>
                <el-form-item label="权限" prop="permissions">
                    <el-checkbox-group v-model="newToken.permissions">
                        <el-checkbox label="upload">上传</el-checkbox>
                        <el-checkbox label="delete">删除</el-checkbox>
                        <el-checkbox label="list">列出</el-checkbox>
                    </el-checkbox-group>
                </el-form-item>
            </el-form>
            <template #footer>
                <span class="dialog-footer">
                    <el-button @click="showCreateTokenDialog = false">取消</el-button>
                    <el-button type="primary" @click="createToken">创建</el-button>
                </span>
            </template>
        </el-dialog>

        <!-- 编辑Token对话框 -->
        <el-dialog v-model="showEditTokenDialog" title="编辑 API Token" :width="dialogWidth">
            <el-form :model="editingToken" :rules="tokenRules" ref="editTokenForm" label-width="100px">
                <el-form-item label="Token 名称">
                    <el-input v-model="editingToken.name" disabled/>
                </el-form-item>
                <el-form-item label="权限" prop="permissions">
                    <el-checkbox-group v-model="editingToken.permissions">
                        <el-checkbox label="upload">上传</el-checkbox>
                        <el-checkbox label="delete">删除</el-checkbox>
                        <el-checkbox label="list">列出</el-checkbox>
                    </el-checkbox-group>
                </el-form-item>
            </el-form>
            <template #footer>
                <span class="dialog-footer">
                    <el-button @click="showEditTokenDialog = false">取消</el-button>
                    <el-button type="primary" @click="updateToken">更新</el-button>
                </span>
            </template>
        </el-dialog>

        <!-- Token创建成功对话框 -->
        <el-dialog v-model="showTokenResultDialog" title="Token 创建成功" :width="dialogWidth">
            <div class="token-result">
                <p style="margin-bottom: 15px; color: #e6a23c;">
                    <font-awesome-icon icon="exclamation-triangle" style="margin-right: 5px;"/>
                    请妥善保存以下Token，关闭此窗口后将无法再次查看完整Token！
                </p>
                <el-form label-width="100px">
                    <el-form-item label="Token 名称">
                        <span>{{ createdToken.name }}</span>
                    </el-form-item>
                    <el-form-item label="完整Token">
                        <el-input v-model="createdToken.token" readonly>
                            <template #append>
                                <el-button @click="copyToken">复制</el-button>
                            </template>
                        </el-input>
                    </el-form-item>
                </el-form>
            </div>
            <template #footer>
                <span class="dialog-footer">
                    <el-button type="primary" @click="showTokenResultDialog = false">我已保存</el-button>
                </span>
            </template>
        </el-dialog>
    </div>
</template>

<script>
import fetchWithAuth from '@/utils/fetchWithAuth';
import FloatingSaveButton from '@/components/FloatingSaveButton.vue';

export default {
components: {
    FloatingSaveButton
},
data() {
    return {
        authSettings: {
            user: {},
            admin: {}
        },
        uploadSettings: {
            moderate: {}
        },
        accessSettings: {},
        apiTokens: [], // API Token列表
        // 加载状态
        loading: true,
        tokenLoading: false,

        // 修改密码相关
        oriUserPassword: '', // 原上传密码
        oriAdminPassword: '', // 原管理端密码

        showUserPassConfirm: false, // 显示用户密码确认框
        showAdminPassConfirm: false, // 显示管理密码确认框

        // Token对话框相关
        showCreateTokenDialog: false,
        showEditTokenDialog: false,
        showTokenResultDialog: false,
        
        newToken: {
            name: '',
            owner: '',
            permissions: []
        },
        editingToken: {
            id: '',
            name: '',
            owner: '',
            permissions: []
        },
        createdToken: {
            name: '',
            token: ''
        },

        userPassRules: {
            authCode: [
                { validator: (rule, value, callback) => {
                    // URL保留字符列表
                    const urlReservedChars = ['%', '&', '?', '#', '/'];
                    const hasReservedChar = urlReservedChars.some(char => value && value.includes(char));
                    
                    if (hasReservedChar) {
                        callback(new Error('密码不能包含部分URL保留字符: % & ? # /'));
                    } else {
                        callback();
                    }
                }, trigger: 'blur' }
            ],
            confirmNewUserPassword: [
                { message: '请再次输入上传密码', trigger: 'blur' },
                { validator: (rule, value, callback) => {
                    if (value && value !== this.authSettings.user.authCode) {
                        callback(new Error('两次输入密码不一致'));
                    } else {
                        callback();
                    }
                }, trigger: 'blur' }
            ]
        },

        adminPassRules: {
            confirmNewAdminPassword: [
                { message: '请再次输入管理密码', trigger: 'blur' },
                { validator: (rule, value, callback) => {
                    if (value && value !== this.authSettings.admin.adminPassword) {
                        callback(new Error('两次输入密码不一致'));
                    } else {
                        callback();
                    }
                }, trigger: 'blur' }
            ]
        },

        tokenRules: {
            name: [
                { required: true, message: '请输入Token名称', trigger: 'blur' }
            ],
            permissions: [
                { required: true, message: '请选择权限', trigger: 'change' }
            ]
        }
    };
},
computed: {
    dialogWidth() {
        return window.innerWidth > 768 ? '50%' : '90%';
    },
},
methods: {
    handleUserPassInput() {
        if (this.authSettings.user.authCode !== this.oriUserPassword) {
            this.showUserPassConfirm = true;
        } else {
            this.showUserPassConfirm = false;
        }
    },
    handleAdminPassInput() {
        if (this.authSettings.admin.adminPassword !== this.oriAdminPassword) {
            this.showAdminPassConfirm = true;
        } else {
            this.showAdminPassConfirm = false;
        }
    },
    
    // Token相关方法
    getPermissionText(permission) {
        const permissionMap = {
            'upload': '上传',
            'delete': '删除', 
            'list': '列出'
        };
        return permissionMap[permission] || permission;
    },
    
    formatDate(dateString) {
        return new Date(dateString).toLocaleString('zh-CN');
    },
    
    async loadApiTokens() {
        this.tokenLoading = true;
        try {
            const response = await fetchWithAuth('/api/manage/apiTokens');
            const data = await response.json();
            this.apiTokens = data.tokens || [];
        } catch (error) {
            this.$message.error('获取Token列表失败');
        } finally {
            this.tokenLoading = false;
        }
    },
    
    createToken() {
        this.$refs.tokenForm.validate(async (valid) => {
            if (!valid) return;
            
            try {
                this.newToken.owner = 'admin'; // 默认所有Token归属管理员
                const response = await fetchWithAuth('/api/manage/apiTokens', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(this.newToken)
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    this.createdToken = {
                        name: data.name,
                        token: data.token
                    };
                    this.showCreateTokenDialog = false;
                    this.showTokenResultDialog = true;
                    this.newToken = { name: '', owner: '', permissions: [] };
                    await this.loadApiTokens();
                    this.$message.success('Token创建成功');
                } else {
                    this.$message.error(data.error || 'Token创建失败');
                }
            } catch (error) {
                this.$message.error('Token创建失败');
            }
        });
    },
    
    editToken(token) {
        this.editingToken = {
            id: token.id,
            name: token.name,
            owner: token.owner,
            permissions: [...token.permissions]
        };
        this.showEditTokenDialog = true;
    },
    
    updateToken() {
        this.$refs.editTokenForm.validate(async (valid) => {
            if (!valid) return;
            
            try {
                const response = await fetchWithAuth('/api/manage/apiTokens', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        tokenId: this.editingToken.id,
                        permissions: this.editingToken.permissions
                    })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    this.showEditTokenDialog = false;
                    await this.loadApiTokens();
                    this.$message.success('Token权限更新成功');
                } else {
                    this.$message.error(data.error || 'Token更新失败');
                }
            } catch (error) {
                this.$message.error('Token更新失败');
            }
        });
    },
    
    async deleteToken(tokenId) {
        try {
            await this.$confirm('此操作将永久删除该Token，是否继续？', '提示', {
                confirmButtonText: '确定',
                cancelButtonText: '取消',
                type: 'warning'
            });
            
            const response = await fetchWithAuth(`/api/manage/apiTokens?id=${tokenId}`, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            
            if (response.ok) {
                await this.loadApiTokens();
                this.$message.success('Token删除成功');
            } else {
                this.$message.error(data.error || 'Token删除失败');
            }
        } catch (error) {
            if (error !== 'cancel') {
                this.$message.error('Token删除失败');
            }
        }
    },
    
    async copyToken() {
        try {
            await navigator.clipboard.writeText(this.createdToken.token);
            this.$message.success('Token已复制到剪贴板');
        } catch (error) {
            this.$message.error('复制失败，请手动复制');
        }
    },
    
    saveSettings() {
        // 所有表单的Promise数组
        let validationPromises = [];

        // 验证用户密码表单
        validationPromises.push(new Promise((resolve) => {
            this.$refs.userPassForm.validate((valid) => {
                resolve(valid);
            });
        }));

        // 验证管理密码表单
        validationPromises.push(new Promise((resolve) => {
            this.$refs.adminPassForm.validate((valid) => {
                resolve(valid);
            });
        }));

        // 等待所有验证完成
        Promise.all(validationPromises).then((results) => {
            const isValid = results.every(valid => valid);

            if (!isValid) {
                return;
            }

            const settings = {
                auth: this.authSettings,
                upload: this.uploadSettings,
                access: this.accessSettings
            };
            // 不保存确认密码相关字段
            delete settings.auth.user.confirmNewUserPassword;
            delete settings.auth.admin.confirmNewAdminPassword;

            fetchWithAuth('/api/manage/sysConfig/security', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(settings)
            }).then(() => {
                this.$message.success('设置已保存');
                // 更新原密码
                this.oriUserPassword = this.authSettings.user.authCode;
                this.oriAdminPassword = this.authSettings.admin.adminPassword;
                this.showUserPassConfirm = false;
                this.showAdminPassConfirm = false;
            });
        });
    }
},
mounted() {
    this.loading = true;
    // 获取上传设置
    fetchWithAuth('/api/manage/sysConfig/security')
    .then((response) => response.json())
    .then((data) => {
        this.authSettings = data.auth;
        this.uploadSettings = data.upload;
        this.accessSettings = data.access;

        // 保存原密码
        this.oriUserPassword = this.authSettings.user.authCode;
        this.oriAdminPassword = this.authSettings.admin.adminPassword;
        this.authSettings.user.confirmNewUserPassword = '';
        this.authSettings.admin.confirmNewAdminPassword = '';
        
        // 加载API Token列表
        this.loadApiTokens();
    })
    .finally(() => {
        this.loading = false;
    });
}
};
</script>

<style scoped>
.security-settings {
    padding: 20px;
    min-height: 500px;
}

.first-settings {
    margin-bottom: 40px;
}

.first-title {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 20px;
    padding-bottom: 12px;
    border-bottom: 2px solid var(--el-color-primary-light-7);
}

.second-title {
    display: flex;
    align-items: center;
    gap: 8px;
    text-align: start;
    margin-left: 0;
    margin-bottom: 16px;
    padding-bottom: 8px;
    border-bottom: 1px solid var(--el-border-color-lighter);
}

/* 表单样式 - 上下排列左对齐 */
.first-settings :deep(.el-form) {
    padding: 16px 20px;
    background: var(--glass-bg);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-radius: 12px;
    border: 1px solid var(--glass-border);
    margin-bottom: 20px;
    box-shadow: var(--glass-shadow);
    transition: all 0.3s ease;
}

.first-settings :deep(.el-form:hover) {
    box-shadow: var(--glass-shadow-hover);
    background: var(--glass-bg-hover);
}

.first-settings :deep(.el-form-item) {
    margin-bottom: 20px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
}

.first-settings :deep(.el-form-item:last-child) {
    margin-bottom: 0;
}

.first-settings :deep(.el-form-item__label) {
    text-align: left;
    padding-bottom: 8px;
    font-weight: 500;
    color: var(--el-text-color-primary);
    width: auto !important;
    display: flex;
    align-items: center;
    gap: 5px;
}

.first-settings :deep(.el-form-item__content) {
    width: 100%;
    max-width: 400px;
    margin-left: 0 !important;
}

.first-settings :deep(.el-input) {
    width: 100%;
}

.first-settings :deep(.el-select) {
    width: 100%;
}

.first-settings :deep(.el-switch) {
    --el-switch-on-color: var(--el-color-primary);
}

.token-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
}

.token-actions {
    margin-left: 5px;
}

.token-table-container {
    display: flex;
    justify-content: center;
    margin-top: 20px;
    width: 100%;
    overflow: hidden;
}

.token-table {
    width: 100%;
    border-radius: 12px !important;
    overflow: hidden;
    box-shadow: var(--glass-shadow);
    background: var(--glass-bg);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid var(--glass-border);
}

.token-table :deep(.el-table__header-wrapper) {
    border-radius: 12px 12px 0 0;
}

.token-table :deep(.el-table__body-wrapper) {
    border-radius: 0 0 12px 12px;
}

.token-table :deep(.el-table) {
    border-radius: 12px;
}

.token-table :deep(.el-table__header) {
    background-color: #f8f9fa;
}

.token-table :deep(.el-table th) {
    background-color: #f8f9fa !important;
    border-bottom: 1px solid #ebeef5;
    text-align: center;
}

.token-table :deep(.el-table td) {
    border-bottom: 1px solid #ebeef5;
}

.token-table :deep(.el-table__row:last-child td) {
    border-bottom: none;
}

.table-cell-content {
    display: flex;
    justify-content: center;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
    padding: 8px 4px;
    min-height: 40px;
}

.action-buttons {
    gap: 8px;
}

.action-button {
    margin-left: 0;
}

.permission-tag {
    margin: 2px !important;
}

.token-display {
    font-family: 'Courier New', monospace;
    background-color: var(--text-bg-color);
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 12px;
    word-break: break-all;
    text-align: center;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* 响应式布局 */
@media (max-width: 768px) {
    .security-settings {
        padding: 15px;
        padding-bottom: 80px; /* 为悬浮按钮留出空间 */
    }
    
    .first-settings :deep(.el-form) {
        padding: 12px 15px;
    }
    
    .first-settings :deep(.el-form-item__content) {
        max-width: 100%;
    }
    
    .token-table-container {
        padding: 0 10px;
    }
    
    .table-cell-content {
        padding: 6px 2px;
        min-height: 36px;
    }
    
    .token-display {
        font-size: 11px;
        padding: 3px 6px;
    }
}

@media (max-width: 480px) {
    .token-table-container {
        padding: 0 5px;
    }
    
    .table-cell-content {
        padding: 4px 2px;
        min-height: 32px;
        font-size: 12px;
    }
    
    .action-buttons .el-button {
        padding: 4px 8px;
        font-size: 12px;
    }
    
    .permission-tag {
        font-size: 11px;
        padding: 0 4px;
        height: 20px;
        line-height: 20px;
    }
}

.token-result {
    padding: 10px 0;
}

.token-result .el-form-item {
    margin-bottom: 20px;
}

.dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
}

/* 确认密码框的动画效果 */
.fade-slide-enter-active, .fade-slide-leave-active {
    transition: all 0.3s ease-in-out;
}

.fade-slide-enter-from {
    opacity: 0;
    transform: translateY(-10px);
}

.fade-slide-leave-to {
    opacity: 0;
    transform: translateY(-10px);
}

.fade-slide-enter-to, .fade-slide-leave-from {
    opacity: 1;
    transform: translateY(0);
}

:deep(.el-dialog) {
    border-radius: 12px;
    background-color: var(--dialog-bg-color);
    backdrop-filter: blur(10px);
    box-shadow: var(--dialog-box-shadow);
}
</style>