<template>
    <div class="security-settings" v-loading="loading">
        <!-- 一级设置：认证管理 -->
        <div class="first-settings">
            <h3 class="first-title">{{ $t('sysSecurity.authManagement') }}</h3>

            <h4 class="second-title">{{ $t('sysSecurity.userAuth') }}</h4>
            <el-form 
                :model="authSettings.user" 
                :rules = "userPassRules"
                ref = "userPassForm"
                label-width="120px"
            >
                <el-form-item :label="$t('sysSecurity.uploadPassword')" prop="authCode">
                    <div style="display: flex; gap: 8px; width: 100%;">
                        <el-input v-model="authSettings.user.authCode" type="password" show-password @input="handleUserPassInput" autocomplete="new-password" :placeholder="authSettings.user._hasPassword ? $t('sysSecurity.passwordUnchanged') : ''" :disabled="clearUserPassword"/>
                        <el-checkbox v-if="authSettings.user._hasPassword" v-model="clearUserPassword" @change="handleClearUserPassword">{{ $t('sysSecurity.clearPassword') }}</el-checkbox>
                    </div>
                </el-form-item>

                <transition name="fade-slide" mode="out-in">
                    <el-form-item :label="$t('sysSecurity.confirmPassword')" prop="confirmNewUserPassword" v-if="showUserPassConfirm" key="user-confirm">
                        <el-input v-model="authSettings.user.confirmNewUserPassword" type="password" show-password autocomplete="new-password"/>
                    </el-form-item>
                </transition>
            </el-form>
            
            <h4 class="second-title">{{ $t('sysSecurity.adminAuth') }}</h4>
            <el-form 
                :model="authSettings.admin"
                :rules = "adminPassRules"
                ref = "adminPassForm"
                label-width="120px"
            >
                <el-form-item :label="$t('sysSecurity.adminUsername')" prop="adminUsername">
                    <el-input v-model="authSettings.admin.adminUsername" autocomplete="new-password" :disabled="clearAdminPassword"/>
                </el-form-item>
                <el-form-item :label="$t('sysSecurity.adminPassword')" prop="adminPassword">
                    <div style="display: flex; gap: 8px; width: 100%;">
                        <el-input v-model="authSettings.admin.adminPassword" type="password" show-password @input="handleAdminPassInput" autocomplete="new-password" :placeholder="authSettings.admin._hasPassword ? $t('sysSecurity.passwordUnchanged') : ''" :disabled="clearAdminPassword"/>
                        <el-checkbox v-if="authSettings.admin._hasPassword" v-model="clearAdminPassword" @change="handleClearAdminPassword">{{ $t('sysSecurity.clearPassword') }}</el-checkbox>
                    </div>
                </el-form-item>

                <transition name="fade-slide" mode="out-in">
                    <el-form-item :label="$t('sysSecurity.confirmPassword')" prop="confirmNewAdminPassword" v-if="showAdminPassConfirm" key="admin-confirm">
                        <el-input v-model="authSettings.admin.confirmNewAdminPassword" type="password" show-password autocomplete="new-password"/>
                    </el-form-item>
                </transition>
            </el-form>

            <h4 class="second-title token-title">{{ $t('sysSecurity.apiTokenManagement') }}
                <a class="token-actions">
                    <el-button type="primary" size="small" @click="showCreateTokenDialog = true" circle>
                        <font-awesome-icon icon="plus"/>
                    </el-button>
                </a>
            </h4>
            <el-alert type="info" :closable="false" style="margin-bottom: 16px">
                <p>{{ $t('sysSecurity.agentHelp') }}</p>
                <p>{{ $t('sysSecurity.permissionLegacyHint') }}</p>
                <el-button type="primary" size="small" @click="prepareAgentToken">{{ $t('sysSecurity.createAgentToken') }}</el-button>
                <el-button size="small" @click="showAgentGuide = true">{{ $t('sysSecurity.agentGuide') }}</el-button>
            </el-alert>
            <div class="token-table-container">
                <el-table 
                    :data="apiTokens" 
                    class="token-table"
                    v-loading="tokenLoading"
                >
                    <el-table-column prop="name" :label="$t('sysSecurity.tokenName')" header-align="center">
                        <template #default="scope">
                            <div class="table-cell-content">{{ scope.row.name }}</div>
                        </template>
                    </el-table-column>
                    <el-table-column prop="token" min-width="180" :label="$t('sysSecurity.tokenValue')" header-align="center">
                        <template #default="scope">
                            <div class="table-cell-content token-copy-cell">
                                <span class="token-display">{{ scope.row.token }}</span>
                                <el-tooltip :content="$t('sysSecurity.copyFullToken')" placement="top">
                                    <el-button link type="primary" :aria-label="$t('sysSecurity.copyFullToken')" :loading="copyingTokenId === scope.row.id" :disabled="!!copyingTokenId" @click="copyListedToken(scope.row)">
                                        <font-awesome-icon v-if="copyingTokenId !== scope.row.id" icon="copy"/>
                                    </el-button>
                                </el-tooltip>
                            </div>
                        </template>
                    </el-table-column>
                    <el-table-column prop="permissions" :label="$t('sysSecurity.permissions')" header-align="center">
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
                    <el-table-column prop="createdAt" :label="$t('sysSecurity.createdAt')" header-align="center">
                        <template #default="scope">
                            <div class="table-cell-content">{{ formatDate(scope.row.createdAt) }}</div>
                        </template>
                    </el-table-column>
                    <el-table-column :label="$t('sysSecurity.status')" header-align="center" width="90">
                        <template #default="scope">
                            <div class="table-cell-content">
                                <el-tag
                                    :type="getTokenStatus(scope.row.expiresAt).status === 'active' ? 'success' : 'danger'"
                                    size="small"
                                >
                                    {{ getTokenStatus(scope.row.expiresAt).label }}
                                </el-tag>
                            </div>
                        </template>
                    </el-table-column>
                    <el-table-column :label="$t('sysSecurity.expiresAt')" header-align="center">
                        <template #default="scope">
                            <div class="table-cell-content">{{ getTokenStatus(scope.row.expiresAt).expiresText }}</div>
                        </template>
                    </el-table-column>
                    <el-table-column :label="$t('sysSecurity.operation')" fixed="right" header-align="center">
                        <template #default="scope">
                            <div class="table-cell-content action-buttons">
                                <el-button class="action-button" size="small" @click="editToken(scope.row)">{{ $t('sysSecurity.editBtn') }}</el-button>
                                <el-button class="action-button" size="small" type="danger" @click="deleteToken(scope.row.id)">{{ $t('sysSecurity.deleteBtn') }}</el-button>
                            </div>
                        </template>
                    </el-table-column>
                </el-table>
            </div>
        </div>

        <!-- 一级设置：上传管理 -->
        <div class="first-settings">
            <h3 class="first-title">{{ $t('sysSecurity.uploadManagement') }}</h3>            
            <h4 class="second-title">{{ $t('sysSecurity.imageReview') }}
                <el-tooltip :content="$t('sysSecurity.imageReviewTooltip')" placement="top">
                    <font-awesome-icon icon="question-circle" style="margin-left: 5px; cursor: pointer;"/>
                </el-tooltip>
            </h4>         
            <el-form :model="uploadSettings.moderate" label-width="120px">
                <el-form-item :label="$t('sysSecurity.enableReview')">
                    <el-switch v-model="uploadSettings.moderate.enabled"/>
                </el-form-item>
                <el-form-item :label="$t('sysSecurity.reviewChannel')">
                    <el-select v-model="uploadSettings.moderate.channel" :placeholder="$t('sysSecurity.reviewChannelPlaceholder')">
                        <el-option label="moderatecontent.com" value="moderatecontent.com"></el-option>
                        <el-option label="nsfwjs" value="nsfwjs"></el-option>
                    </el-select>
                </el-form-item>
                <el-form-item v-if="uploadSettings.moderate.channel === 'moderatecontent.com'" :label="$t('sysSecurity.apiKey')">
                    <el-input v-model="uploadSettings.moderate.moderateContentApiKey"/>
                </el-form-item>
                <el-form-item v-if="uploadSettings.moderate.channel === 'nsfwjs'" :label="$t('sysSecurity.apiPath')">
                    <el-input v-model="uploadSettings.moderate.nsfwApiPath" placeholder="https://nsfwjs.your.domain"/>
                </el-form-item>
            </el-form>
        </div>

        <!-- 一级设置：访问管理 -->
        <div class="first-settings">
            <h3 class="first-title">{{ $t('sysSecurity.accessManagement') }}</h3>
            <h4 class="second-title">{{ $t('sysSecurity.domainFilter') }}</h4>
            <el-form :model="accessSettings" label-width="120px">
                <el-form-item>
                    <template #label>
                        {{ $t('sysSecurity.allowedDomains') }}
                        <el-tooltip :content="$t('sysSecurity.allowedDomainsTooltip')" placement="top" raw-content>
                            <font-awesome-icon icon="question-circle" style="margin-left: 5px; cursor: pointer;"/>
                        </el-tooltip>
                    </template>
                    <el-input v-model="accessSettings.allowedDomains"/>
                </el-form-item>
            </el-form>
            <h4 class="second-title">{{ $t('sysSecurity.whiteListMode') }}</h4>
            <el-form :model="accessSettings" :rules="accessRules" ref="accessForm" label-width="120px">
                <el-form-item>
                    <template #label>
                        {{ $t('sysSecurity.enableWhiteList') }}
                        <el-tooltip :content="$t('sysSecurity.enableWhiteListTooltip')" placement="top" raw-content>
                            <font-awesome-icon icon="question-circle" style="margin-left: 5px; cursor: pointer;"/>
                        </el-tooltip>
                    </template>
                    <el-switch v-model="accessSettings.whiteListMode"/>
                </el-form-item>
            </el-form>
            <h4 class="second-title">{{ $t('sysSecurity.sessionSecurityPolicy') }}</h4>
            <el-form :model="accessSettings" label-width="120px">
                <el-form-item>
                    <template #label>
                        {{ $t('sysSecurity.secureMode') }}
                        <el-tooltip :content="$t('sysSecurity.secureModeTooltip')" placement="top">
                            <font-awesome-icon icon="question-circle" style="margin-left: 5px; cursor: pointer;"/>
                        </el-tooltip>
                    </template>
                    <el-switch v-model="accessSettings.sessionSecure"/>
                </el-form-item>
                <el-form-item :label="$t('sysSecurity.userSessionMaxAge')" prop="userSessionMaxAge">
                    <el-input-number
                        v-model="accessSettings.userSessionMaxAge"
                        :min="1"
                        :max="3650"
                        :step="1"
                        :precision="0"
                        controls-position="right"
                    />
                    <span class="form-item-hint">{{ $t('sysSecurity.sessionMaxAgeUnit') }}</span>
                </el-form-item>
                <el-form-item :label="$t('sysSecurity.adminSessionMaxAge')" prop="adminSessionMaxAge">
                    <el-input-number
                        v-model="accessSettings.adminSessionMaxAge"
                        :min="1"
                        :max="3650"
                        :step="1"
                        :precision="0"
                        controls-position="right"
                    />
                    <span class="form-item-hint">{{ $t('sysSecurity.sessionMaxAgeUnit') }}</span>
                </el-form-item>
            </el-form>
        </div>

        <!-- 悬浮保存按钮 -->
        <FloatingSaveButton :show="!loading" @click="saveSettings" />

        <!-- 创建Token对话框 -->
        <el-dialog v-model="showCreateTokenDialog" :title="$t('sysSecurity.createTokenTitle')" :width="dialogWidth" class="token-permission-dialog" top="4vh">
            <el-form :model="newToken" :rules="tokenRules" ref="tokenForm" label-width="100px">
                <el-form-item :label="$t('sysSecurity.tokenNameLabel')" prop="name">
                    <el-input v-model="newToken.name" :placeholder="$t('sysSecurity.tokenNamePlaceholder')"/>
                </el-form-item>
                <el-form-item :label="$t('sysSecurity.permissionsLabel')" prop="permissions">
                    <TokenPermissions v-model="newToken.permissions" />
                </el-form-item>
                <el-form-item :label="$t('sysSecurity.neverExpire')">
                    <el-switch v-model="newToken.neverExpire" @change="onCreateNeverExpireChange"/>
                </el-form-item>
                <el-form-item v-if="!newToken.neverExpire" :label="$t('sysSecurity.validPeriod')" prop="expirationValue">
                    <div class="expiration-fields">
                        <el-input-number v-model="newToken.expirationValue" :min="1" :step="1" controls-position="right" :precision="0" class="expiration-number"/>
                        <el-select v-model="newToken.expirationUnit" class="expiration-unit">
                            <el-option v-for="opt in timeUnitOptions" :key="opt.value" :label="$t(opt.labelKey)" :value="opt.value"/>
                        </el-select>
                    </div>
                </el-form-item>
                <el-form-item v-if="!newToken.neverExpire" :label="$t('sysSecurity.autoDeleteOnExpire')">
                    <el-switch v-model="newToken.autoDelete"/>
                </el-form-item>
            </el-form>
            <template #footer>
                <span class="dialog-footer">
                    <el-button @click="showCreateTokenDialog = false">{{ $t('common.cancel') }}</el-button>
                    <el-button type="primary" @click="createToken">{{ $t('sysSecurity.createBtn') }}</el-button>
                </span>
            </template>
        </el-dialog>

        <!-- 编辑Token对话框 -->
        <el-dialog v-model="showEditTokenDialog" :title="$t('sysSecurity.editTokenTitle')" :width="dialogWidth" class="token-permission-dialog" top="4vh">
            <el-form :model="editingToken" :rules="editTokenRules" ref="editTokenForm" label-width="100px">
                <el-form-item :label="$t('sysSecurity.tokenNameLabel')">
                    <el-input v-model="editingToken.name" disabled/>
                </el-form-item>
                <el-form-item :label="$t('sysSecurity.permissionsLabel')" prop="permissions">
                    <TokenPermissions v-model="editingToken.permissions" />
                </el-form-item>
                <el-form-item :label="$t('sysSecurity.neverExpire')">
                    <el-switch v-model="editingToken.neverExpire" @change="onEditNeverExpireChange"/>
                </el-form-item>
                <el-form-item v-if="!editingToken.neverExpire" :label="$t('sysSecurity.validPeriod')" prop="expirationValue">
                    <div class="expiration-fields">
                        <el-input-number v-model="editingToken.expirationValue" :min="1" :step="1" controls-position="right" :precision="0" class="expiration-number"/>
                        <el-select v-model="editingToken.expirationUnit" class="expiration-unit">
                            <el-option v-for="opt in timeUnitOptions" :key="opt.value" :label="$t(opt.labelKey)" :value="opt.value"/>
                        </el-select>
                    </div>
                </el-form-item>
                <el-form-item v-if="editingToken.originalExpiresAt" :label="$t('sysSecurity.expiresAt')">
                    <span>{{ getTokenStatus(editingToken.originalExpiresAt).expiresText }}</span>
                    <small class="expiration-hint">{{ $t(editingToken.legacyExpiration ? 'sysSecurity.legacyExpirationHint' : 'sysSecurity.expirationEditHint') }}</small>
                </el-form-item>
                <el-form-item v-if="!editingToken.neverExpire" :label="$t('sysSecurity.autoDeleteOnExpire')">
                    <el-switch v-model="editingToken.autoDelete"/>
                </el-form-item>
            </el-form>
            <template #footer>
                <span class="dialog-footer">
                    <el-button @click="showEditTokenDialog = false">{{ $t('common.cancel') }}</el-button>
                    <el-button type="primary" @click="updateToken">{{ $t('sysSecurity.updateBtn') }}</el-button>
                </span>
            </template>
        </el-dialog>

        <el-dialog v-model="showAgentGuide" :title="$t('sysSecurity.agentGuide')" :width="dialogWidth">
            <p>{{ $t('sysSecurity.agentScope') }}</p>
            <el-input :model-value="agentInstructions" type="textarea" :rows="12" readonly :aria-label="$t('sysSecurity.agentGuide')" />
            <p>{{ $t('sysSecurity.agentKeyHint') }}</p>
        </el-dialog>
        <el-dialog v-model="showManualCopyDialog" :title="$t('sysSecurity.copyFullToken')" :width="dialogWidth" @closed="manualCopyToken = ''">
            <p>{{ $t('sysSecurity.copyFailed') }}</p>
            <el-input :model-value="manualCopyToken" readonly :aria-label="$t('sysSecurity.fullToken')" @focus="$event.target.select()" />
        </el-dialog>
        <!-- Token创建成功对话框 -->
        <el-dialog v-model="showTokenResultDialog" :title="$t('sysSecurity.tokenCreatedTitle')" :width="dialogWidth">
            <div class="token-result">
                <p style="margin-bottom: 15px; color: #e6a23c;">
                    <font-awesome-icon icon="exclamation-triangle" style="margin-right: 5px;"/>
                    {{ $t('sysSecurity.tokenCreatedWarning') }}
                </p>
                <el-form label-width="100px">
                    <el-form-item :label="$t('sysSecurity.tokenNameLabel')">
                        <span>{{ createdToken.name }}</span>
                    </el-form-item>
                    <el-form-item :label="$t('sysSecurity.fullToken')">
                        <el-input v-model="createdToken.token" readonly>
                            <template #append>
                                <el-button @click="copyToken">{{ $t('sysSecurity.copyBtn') }}</el-button>
                            </template>
                        </el-input>
                    </el-form-item>
                </el-form>
            </div>
            <template #footer>
                <span class="dialog-footer">
                    <el-button type="primary" @click="showTokenResultDialog = false">{{ $t('sysSecurity.savedBtn') }}</el-button>
                </span>
            </template>
        </el-dialog>
    </div>
</template>

<script>
import fetchWithAuth from '@/utils/fetchWithAuth';
import FloatingSaveButton from '@/components/FloatingSaveButton.vue';
import TokenPermissions from './TokenPermissions.vue';
import { computeExpiresAt, getTokenStatus, expirationEditor, expirationUpdate } from '@/utils/tokenExpiration';

export default {
components: {
    FloatingSaveButton,
    TokenPermissions
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
        clearUserPassword: false, // 清除用户密码开关
        clearAdminPassword: false, // 清除管理密码开关

        // Token对话框相关
        copyingTokenId: '',
        showManualCopyDialog: false,
        manualCopyToken: '',
        showAgentGuide: false,
        showCreateTokenDialog: false,
        showEditTokenDialog: false,
        showTokenResultDialog: false,
        
        timeUnitOptions: [
            { labelKey: 'sysSecurity.timeUnitSeconds', value: 's' },
            { labelKey: 'sysSecurity.timeUnitMinutes', value: 'm' },
            { labelKey: 'sysSecurity.timeUnitHours', value: 'h' },
            { labelKey: 'sysSecurity.timeUnitDays', value: 'd' },
            { labelKey: 'sysSecurity.timeUnitMonths', value: 'M' },
            { labelKey: 'sysSecurity.timeUnitYears', value: 'Y' }
        ],
        newToken: {
            name: '',
            owner: '',
            permissions: [],
            neverExpire: true,
            expirationValue: 1,
            expirationUnit: 'd',
            autoDelete: false
        },
        editingToken: {
            id: '',
            name: '',
            owner: '',
            permissions: [],
            neverExpire: true,
            expirationValue: 1,
            expirationUnit: 'd',
            autoDelete: false
        },
        createdToken: {
            name: '',
            token: ''
        }
    };
},
computed: {
    agentInstructions() {
        return this.$t('sysSecurity.agentInstructions', { base: window.location.origin });
    },

    dialogWidth() {
        return window.innerWidth > 768 ? '50%' : '90%';
    },
    userPassRules() {
        return {
            authCode: [
                { validator: (rule, value, callback) => {
                    const urlReservedChars = ['%', '&', '?', '#', '/'];
                    const hasReservedChar = urlReservedChars.some(char => value && value.includes(char));
                    if (hasReservedChar) {
                        callback(new Error(this.$t('sysSecurity.passwordUrlReserved')));
                    } else {
                        callback();
                    }
                }, trigger: 'blur' }
            ],
            confirmNewUserPassword: [
                { validator: (rule, value, callback) => {
                    if (!value) {
                        callback(new Error(this.$t('sysSecurity.confirmUploadPassword')));
                    } else if (value !== this.authSettings.user.authCode) {
                        callback(new Error(this.$t('sysSecurity.passwordMismatch')));
                    } else {
                        callback();
                    }
                }, trigger: 'blur' }
            ]
        };
    },
    adminPassRules() {
        return {
            confirmNewAdminPassword: [
                { validator: (rule, value, callback) => {
                    if (!value) {
                        callback(new Error(this.$t('sysSecurity.confirmAdminPassword')));
                    } else if (value !== this.authSettings.admin.adminPassword) {
                        callback(new Error(this.$t('sysSecurity.passwordMismatch')));
                    } else {
                        callback();
                    }
                }, trigger: 'blur' }
            ]
        };
    },
    accessRules() {
        const validateSessionMaxAge = (rule, value, callback) => {
            if (!Number.isInteger(value) || value < 1 || value > 3650) {
                callback(new Error(this.$t('sysSecurity.sessionMaxAgeInvalid')));
            } else {
                callback();
            }
        };

        return {
            userSessionMaxAge: [
                { validator: validateSessionMaxAge, trigger: 'change' }
            ],
            adminSessionMaxAge: [
                { validator: validateSessionMaxAge, trigger: 'change' }
            ]
        };
    },
    tokenRules() {
        return {
            name: [
                { required: true, message: this.$t('sysSecurity.tokenNameRequired'), trigger: 'blur' }
            ],
            permissions: [
                { required: true, message: this.$t('sysSecurity.permissionsRequired'), trigger: 'change' }
            ],
            expirationValue: [
                { validator: (rule, value, callback) => {
                    if (!this.newToken.neverExpire && (!value || value <= 0)) {
                        callback(new Error(this.$t('sysSecurity.validPeriodRequired')));
                    } else {
                        callback();
                    }
                }, trigger: 'blur' }
            ]
        };
    },
    editTokenRules() {
        return {
            permissions: [
                { required: true, message: this.$t('sysSecurity.permissionsRequired'), trigger: 'change' }
            ],
            expirationValue: [
                { validator: (rule, value, callback) => {
                    if (!this.editingToken.neverExpire && (!value || value <= 0)) {
                        callback(new Error(this.$t('sysSecurity.validPeriodRequired')));
                    } else {
                        callback();
                    }
                }, trigger: 'blur' }
            ]
        };
    },
},
methods: {
    prepareAgentToken() {
        this.newToken = { name: 'AI Agent', owner: 'Agent', permissions: ['list', 'organize'], neverExpire: false, expirationValue: 7, expirationUnit: 'd', autoDelete: false };
        this.showCreateTokenDialog = true;
    },

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
    handleClearUserPassword(checked) {
        if (checked) {
            this.authSettings.user.authCode = '';
            this.showUserPassConfirm = false;
        }
    },
    handleClearAdminPassword(checked) {
        if (checked) {
            this.authSettings.admin.adminPassword = '';
            this.authSettings.admin.adminUsername = '';
            this.showAdminPassConfirm = false;
        }
    },
    
    // Token相关方法
    getPermissionText(permission) {
        const permissionMap = {
            'upload': this.$t('sysSecurity.permUpload'),
            'organize': this.$t('sysSecurity.permOrganize'),
            'replace': this.$t('sysSecurity.permReplace'),
            'delete': this.$t('sysSecurity.permDelete'), 
            'purge': this.$t('sysSecurity.permPurge'),
            'list': this.$t('sysSecurity.permList'),
            'manage': this.$t('sysSecurity.permManage')
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
            this.$message.error(this.$t('sysSecurity.tokenListFailed'));
        } finally {
            this.tokenLoading = false;
        }
    },
    
    createToken() {
        this.$refs.tokenForm.validate(async (valid) => {
            if (!valid) return;
            
            try {
                this.newToken.owner = 'admin'; // 默认所有Token归属管理员
                
                let expiresAt = null;
                let autoDelete = false;
                if (!this.newToken.neverExpire) {
                    expiresAt = computeExpiresAt(new Date(), this.newToken.expirationValue, this.newToken.expirationUnit);
                    autoDelete = this.newToken.autoDelete;
                }
                
                const response = await fetchWithAuth('/api/manage/apiTokens', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        name: this.newToken.name,
                        owner: this.newToken.owner,
                        permissions: this.newToken.permissions,
                        expirationValue: this.newToken.neverExpire ? null : this.newToken.expirationValue,
                        expirationUnit: this.newToken.neverExpire ? null : this.newToken.expirationUnit,
                        expiresAt,
                        autoDelete
                    })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    this.createdToken = {
                        name: data.name,
                        token: data.token
                    };
                    this.showCreateTokenDialog = false;
                    this.showTokenResultDialog = true;
                    this.newToken = { name: '', owner: '', permissions: [], neverExpire: true, expirationValue: 1, expirationUnit: 'd', autoDelete: false };
                    await this.loadApiTokens();
                    this.$message.success(this.$t('sysSecurity.tokenCreateSuccess'));
                } else {
                    this.$message.error(data.error || this.$t('sysSecurity.tokenCreateFailed'));
                }
            } catch (error) {
                this.$message.error(this.$t('sysSecurity.tokenCreateFailed'));
            }
        });
    },
    
    editToken(token) {

        this.editingToken = {
            id: token.id,
            name: token.name,
            owner: token.owner,
            permissions: [...token.permissions],
            ...expirationEditor(token),
            autoDelete: token.autoDelete || false
        };
        this.showEditTokenDialog = true;
    },
    
    updateToken() {
        this.$refs.editTokenForm.validate(async (valid) => {
            if (!valid) return;
            
            try {
                const expiration = expirationUpdate(this.editingToken);

                const response = await fetchWithAuth('/api/manage/apiTokens', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        tokenId: this.editingToken.id,
                        permissions: this.editingToken.permissions,
                        ...expiration
                    })
                });
                
                const data = await response.json();
                
                if (response.ok && data.success) {
                    this.showEditTokenDialog = false;
                    const index = this.apiTokens.findIndex(token => token.id === this.editingToken.id);
                    if (index !== -1) this.apiTokens[index] = { ...this.apiTokens[index], ...data.settings };
                    this.$message.success(this.$t('sysSecurity.tokenUpdateSuccess'));
                } else {
                    this.$message.error(data.error || this.$t('sysSecurity.tokenUpdateFailed'));
                }
            } catch (error) {
                this.$message.error(this.$t('sysSecurity.tokenUpdateFailed'));
            }
        });
    },
    
    async deleteToken(tokenId) {
        try {
            await this.$confirm(this.$t('sysSecurity.tokenDeleteConfirm'), this.$t('sysSecurity.tokenDeleteConfirmTitle'), {
                confirmButtonText: this.$t('sysSecurity.tokenDeleteConfirmOk'),
                cancelButtonText: this.$t('sysSecurity.tokenDeleteConfirmCancel'),
                type: 'warning'
            });
            
            const response = await fetchWithAuth(`/api/manage/apiTokens?id=${tokenId}`, {
                method: 'DELETE'
            });
            
            const data = await response.json();
            
            if (response.ok) {
                await this.loadApiTokens();
                this.$message.success(this.$t('sysSecurity.tokenDeleteSuccess'));
            } else {
                this.$message.error(data.error || this.$t('sysSecurity.tokenDeleteFailed'));
            }
        } catch (error) {
            if (error !== 'cancel') {
                this.$message.error(this.$t('sysSecurity.tokenDeleteFailed'));
            }
        }
    },
    
    async copyListedToken(token) {
        if (this.copyingTokenId) return;
        this.copyingTokenId = token.id;
        try {
            const response = await fetchWithAuth('/api/manage/apiTokens/copy', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tokenId: token.id })
            });
            if (!response.ok) {
                this.$message.error(this.$t(response.status === 403 ? 'sysSecurity.copyAdminRequired' : response.status === 404 ? 'sysSecurity.copyTokenMissing' : 'sysSecurity.copyTokenFailed'));
                return;
            }
            const data = await response.json();
            if (typeof data.token !== 'string' || !data.token) throw new Error('Missing token');
            try {
                await navigator.clipboard.writeText(data.token);
                this.$message.success(this.$t('sysSecurity.tokenCopied'));
            } catch {
                this.manualCopyToken = data.token;
                this.showManualCopyDialog = true;
            }
        } catch { this.$message.error(this.$t('sysSecurity.copyTokenFailed')); }
        finally { this.copyingTokenId = ''; }
    },
    async copyToken() {
        try {
            await navigator.clipboard.writeText(this.createdToken.token);
            this.$message.success(this.$t('sysSecurity.tokenCopied'));
        } catch (error) {
            this.$message.error(this.$t('sysSecurity.copyFailed'));
        }
    },
    
    onCreateNeverExpireChange(val) {
        if (val) {
            this.newToken.autoDelete = false;
        }
    },
    
    onEditNeverExpireChange(val) {
        if (val) {
            this.editingToken.autoDelete = false;
        }
    },
    
    getTokenStatus(expiresAt) {
        return getTokenStatus(expiresAt);
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

        // 验证会话安全策略表单
        validationPromises.push(new Promise((resolve) => {
            this.$refs.accessForm.validate((valid) => {
                resolve(valid);
            });
        }));

        // 等待所有验证完成
        Promise.all(validationPromises).then((results) => {
            const isValid = results.every(valid => valid);

            if (!isValid) {
                return;
            }

            // 验证会话有效期为 1-3650 的正整数
            if (this.accessSettings.userSessionMaxAge < 1 ||
                !Number.isInteger(this.accessSettings.userSessionMaxAge) ||
                this.accessSettings.userSessionMaxAge > 3650 ||
                this.accessSettings.adminSessionMaxAge < 1 ||
                !Number.isInteger(this.accessSettings.adminSessionMaxAge) ||
                this.accessSettings.adminSessionMaxAge > 3650) {
                this.$message.error(this.$t('sysSecurity.sessionMaxAgeInvalid'));
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

            // 标记清除密码
            if (this.clearUserPassword) {
                settings.auth.user._clear = true;
                settings.auth.user.authCode = '';
            }
            if (this.clearAdminPassword) {
                settings.auth.admin._clear = true;
                settings.auth.admin.adminPassword = '';
            }

            fetchWithAuth('/api/manage/sysConfig/security', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(settings)
            }).then(res => res.json()).then((data) => {
                // 管理端密码变更后，当前会话已被清除，需要重新登录
                if (data.adminPasswordChanged) {
                    const msg = this.$t('sysSecurity.adminPasswordChangedRelogin');
                    this.$message.warning(msg);
                    setTimeout(() => {
                        this.$store.commit('setAdminLoggedIn', false);
                        this.$router.push('/adminLogin');
                    }, 1500);
                    return;
                }

                this.$message.success(this.$t('sysSecurity.settingsSaved'));
                // 保存成功后重置密码字段为空（后端已处理）
                this.authSettings.user.authCode = '';
                this.authSettings.admin.adminPassword = '';
                this.oriUserPassword = '';
                this.oriAdminPassword = '';
                // 标记已有密码（如果用户刚设置了密码，且不是清除操作）
                if (settings.auth.user.authCode && !settings.auth.user._clear) {
                    this.authSettings.user._hasPassword = true;
                } else if (settings.auth.user._clear) {
                    this.authSettings.user._hasPassword = false;
                }
                if (settings.auth.admin.adminPassword && !settings.auth.admin._clear) {
                    this.authSettings.admin._hasPassword = true;
                } else if (settings.auth.admin._clear) {
                    this.authSettings.admin._hasPassword = false;
                }
                this.showUserPassConfirm = false;
                this.showAdminPassConfirm = false;
                this.clearUserPassword = false;
                this.clearAdminPassword = false;
            }).catch(() => {
                // 如果请求过程中 session 已失效导致 fetchWithAuth 跳转，忽略后续错误
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

        // 密码从后端返回为空（安全考虑），记录原始空值
        this.oriUserPassword = '';
        this.oriAdminPassword = '';
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
.expiration-fields { display: flex; gap: 8px; flex-wrap: wrap; max-width: 100%; }
.expiration-number { width: 116px; }
.expiration-unit { width: 88px; }
.expiration-hint { display: block; width: 100%; color: var(--el-text-color-secondary); line-height: 1.5; }
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

.form-item-hint {
    display: inline-block;
    margin-left: 8px;
    font-size: 14px;
    color: var(--el-text-color-regular);
    line-height: 32px;
    vertical-align: middle;
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
    text-align: center;
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

:deep(.token-permission-dialog) { max-height: 92vh; display: flex; flex-direction: column; }
:deep(.token-permission-dialog .el-dialog__body) { overflow-y: auto; min-height: 0; }
.token-copy-cell { flex-wrap: nowrap; }
.token-copy-cell .token-display { min-width: 0; white-space: nowrap; }
.token-copy-cell .el-button { flex-shrink: 0; }

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
