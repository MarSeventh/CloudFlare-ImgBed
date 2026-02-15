<template>
    <div class="login" :class="{ 'is-focused': isFocused }">
        <ToggleDark class="toggle-dark"/>
        <Logo />
        <div class="login-container">
            <h1 class="login-title" tabindex="0">{{ title }}</h1>
            
            <!-- 动态渲染输入字段 -->
            <div v-for="(field, index) in fields" :key="field.key" class="input-container">
                <label 
                    class="input-name" 
                    :ref="`inputLabel${index}`"
                    :style="{ '--underline-width': labelUnderlineWidths[index] + 'px' }"
                >
                    {{ field.label }}
                </label>
                <div class="input-wrapper">
                    <el-input
                        v-model="formData[field.key]"
                        :placeholder="field.placeholder"
                        :type="field.type || 'text'"
                        :show-password="field.showPassword"
                        class="password-input"
                        @keyup.enter.native="handleSubmit"
                        @focus="handleInputFocus"
                        @blur="handleInputBlur"
                    >
                        <template #prefix v-if="field.icon">
                            <el-icon class="el-input__icon"><component :is="field.icon" /></el-icon>
                        </template>
                    </el-input>
                </div>
            </div>
            
            <el-button 
                class="submit" 
                :class="{ 'is-loading': loading }"
                type="primary" 
                @click="handleSubmit"
                :disabled="loading"
            >
                <div v-if="loading" class="loading-ring"></div>
                <span v-else>{{ submitText }}</span>
            </el-button>
        </div>
        <Footer class="footer"/>
    </div>
</template>

<script>
import Footer from '@/components/Footer.vue';
import ToggleDark from '@/components/ToggleDark.vue';
import Logo from '@/components/Logo.vue';
import { mapGetters } from 'vuex';
import backgroundManager from '@/mixins/backgroundManager';

export default {
    name: 'BaseLogin',
    mixins: [backgroundManager],
    props: {
        // 页面标题
        title: {
            type: String,
            required: true
        },
        // 输入字段配置
        fields: {
            type: Array,
            required: true,
            // fields 格式: [{ key: 'username', label: '用户名', placeholder: '请输入用户名', type: 'text', showPassword: false }]
        },
        // 提交按钮文本
        submitText: {
            type: String,
            default: '登录'
        },
        // 背景图配置键名
        backgroundKey: {
            type: String,
            required: true
        },
        // 是否为管理端登录（影响背景样式）
        isAdmin: {
            type: Boolean,
            default: false
        },
        // 是否正在加载
        loading: {
            type: Boolean,
            default: false
        }
    },
    data() {
        return {
            formData: {},
            labelUnderlineWidths: [],
            isFocused: false
        }
    },
    computed: {
        ...mapGetters(['userConfig']),
    },
    watch: {
        fields: {
            handler() {
                this.$nextTick(() => {
                    this.calculateLabelWidths();
                });
            },
            deep: true
        }
    },
    components: {
        Footer,
        ToggleDark,
        Logo
    },
    mounted() {
        // 初始化表单数据
        this.initFormData();
        // 初始化背景图
        this.initializeBackground(this.backgroundKey, '.login', !this.isAdmin, true);
        // 在下一个tick计算标签宽度，确保DOM已经渲染
        this.$nextTick(() => {
            this.calculateLabelWidths();
        });
    },
    methods: {
        initFormData() {
            // 根据字段配置初始化表单数据
            const newFormData = {};
            this.fields.forEach(field => {
                newFormData[field.key] = '';
            });
            this.formData = newFormData;
            // 初始化下划线宽度数组
            this.labelUnderlineWidths = new Array(this.fields.length).fill(0);
        },
        calculateLabelWidths() {
            // 计算每个标签的文字宽度
            this.$nextTick(() => {
                this.fields.forEach((field, index) => {
                    const labelRef = this.$refs[`inputLabel${index}`];
                    if (labelRef && labelRef[0]) {
                        // 创建一个临时的canvas来测量文字宽度
                        const canvas = document.createElement('canvas');
                        const context = canvas.getContext('2d');
                        
                        // 获取标签的计算样式
                        const labelElement = labelRef[0];
                        const computedStyle = window.getComputedStyle(labelElement);
                        
                        // 设置font样式以匹配标签
                        context.font = `${computedStyle.fontWeight} ${computedStyle.fontSize} ${computedStyle.fontFamily}`;
                        
                        // 测量文字宽度
                        const textWidth = context.measureText(field.label).width;
                        
                        // 添加一些额外的边距，确保下划线覆盖整个文字
                        this.labelUnderlineWidths[index] = Math.ceil(textWidth) + 3;
                    }
                });
            });
        },
        handleSubmit() {
            if (this.loading) return;
            // 触发父组件的提交事件，传递表单数据
            this.$emit('submit', { ...this.formData });
        },
        handleInputFocus(event) {
            this.isFocused = true;
            const container = event.target.closest('.input-container');
            if (container) {
                const wrapper = container.querySelector('.input-wrapper');
                if (wrapper) {
                    wrapper.classList.add('focused');
                }
            }
        },
        handleInputBlur(event) {
            this.isFocused = false;
            const container = event.target.closest('.input-container');
            if (container) {
                const wrapper = container.querySelector('.input-wrapper');
                if (wrapper) {
                    wrapper.classList.remove('focused');
                }
            }
        }
    }
}
</script>

<style scoped>
.login {
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;
    min-height: 100vh;
    height: auto;
    background: var(--admin-container-bg-color, var(--bg-color));
    overflow-y: auto;
    padding: 20px 0;
    box-sizing: border-box;
}

.login-title {
    font-size: 2.3rem;
    margin-bottom: 15px;
    color: var(--login-title-color);
    font-family: 'Righteous', 'Noto Sans SC', sans-serif;
    cursor: pointer;
    transition: all 0.3s ease;
    letter-spacing: 2px;
}
@media (max-width: 768px) {
    .login-title {
        font-size: 1.5rem;
    }
    .login {
        transition: background-color 0.4s ease-out;
    }
    .login.is-focused {
        justify-content: flex-start;
        padding-top: 10vh;
    }
    .login-container {
        transition: transform 0.4s ease-out, 
                    box-shadow 0.4s ease-out;
    }
    .login.is-focused .login-container {
        transform: translateY(-20px);
        box-shadow: var(--login-container-hover-box-shadow), 0 20px 40px rgba(0, 0, 0, 0.15);
    }
}

.login-title:hover,
.login-title:focus {
    transform: translateY(-2px);
    text-shadow: 0 0 10px var(--login-title-glow-color, rgba(52, 152, 219, 0.5));
}

.login-container {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    min-height: auto;
    height: auto;
    width: 600px;
    border-radius: 12px;
    box-shadow: var(--login-container-box-shadow);
    background-color: var(--login-container-bg-color);
    backdrop-filter: blur(8px);
    transition: all 0.3s ease;
    padding: 40px 0;
    gap: 20px;
    position: relative;
    z-index: 101;
}
@media (max-width: 768px) {
    .login-container {
        width: 85vw;
    }
}
.login-container:hover {
    box-shadow: var(--login-container-hover-box-shadow);
    transform: translateY(-5px);
}

.input-container {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    width: 80%;
    margin-bottom: 15px;
    position: relative;
    gap: 8px;
}
@media (max-width: 768px) {
    .input-container {
        width: 85%;
        gap: 6px;
    }
}

.input-wrapper {
    position: relative;
    width: 100%;
    display: flex;
    flex-direction: column;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.input-icon {
    margin-right: 6px;
    font-size: 1rem;
}

.input-name {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--login-title-color);
    text-align: left;
    transition: all 0.3s ease;
    letter-spacing: 0.5px;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: flex-start;
    padding-left: 2px;
}

.input-name::after {
    content: '';
    position: absolute;
    left: 0;
    bottom: -2px;
    width: 0;
    height: 2px;
    background: linear-gradient(90deg, var(--login-input-underline-color, #5b9bd3), var(--login-input-underline-secondary-color, #7ba9d8));
    transition: width 0.3s linear;
    border-radius: 1px;
}

.input-container:has(.input-wrapper.focused) .input-name::after,
.input-container:hover .input-name::after {
    width: var(--underline-width, 50px);
}

.input-container:has(.input-wrapper.focused) .input-name,
.input-container:hover .input-name {
    color: var(--login-input-label-focus-color, #5b9bd3);
}

@media (max-width: 768px) {
    .input-name {
        font-size: 0.85rem;
    }
}

.submit {
    margin-bottom: 10px;
    width: 50%;
    height: 48px;
    font-size: 1.1rem;
    font-weight: 600;
    letter-spacing: 2px;
    border-radius: 12px;
    background-color: var(--login-submit-btn-bg-color);
    transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    border: none;
    overflow: hidden;
    position: relative;
    padding: 0;
    display: flex;
    justify-content: center;
    align-items: center;
}

.submit.is-loading {
    width: 48px;
    border-radius: 50%;
    background-color: transparent !important;
    box-shadow: none !important;
    pointer-events: none;
}

/* Custom Ring Spinner */
.loading-ring {
    display: inline-block;
    width: 34px;
    height: 34px;
    border: 4px solid transparent;
    border-radius: 50%;
    border-top-color: var(--login-title-color, #ffffff);
    animation: spin 1s ease-in-out infinite;
    box-sizing: border-box;
}

@keyframes spin {
    to { transform: rotate(360deg); }
}

@media (max-width: 768px) {
    .submit {
        width: 50%;
    }
}

.submit:not(.is-loading):hover,
.submit:not(.is-loading):focus {
    transform: translateY(-3px) scale(1.05);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.submit:disabled {
    cursor: default;
    transform: none;
}

.password-input {
    width: 100%;
    height: 50px;
    position: relative;
}

.password-input:deep(.el-input__prefix) {
    color: var(--login-input-icon-color, #909399);
    font-size: 1rem;
    transition: color 0.3s ease;
}

.password-input:deep(.el-input__wrapper):focus-within .el-input__prefix {
    color: var(--login-input-label-focus-color, #5b9bd3);
}

.password-input:deep(.el-input__wrapper) {
    border-radius: 12px;
    background-color: var(--password-input-bg-color);
    border: 2px solid transparent;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    padding: 12px 16px;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    backdrop-filter: blur(10px);
    position: relative;
    overflow: hidden;
}

.password-input:deep(.el-input__wrapper)::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
    transition: left 0.5s;
}

.password-input:deep(.el-input__wrapper):hover::before {
    left: 100%;
}

.password-input:deep(.el-input__wrapper):hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    border-color: var(--login-input-underline-color, #5b9bd3);
}

.password-input:deep(.el-input__wrapper):focus-within {
    border-color: var(--login-input-underline-color, #5b9bd3);
    box-shadow: 0 0 0 3px rgba(91, 155, 211, 0.1);
    transform: translateY(-1px);
}

.password-input:deep(.el-input__inner) {
    color: var(--text-color, var(--login-input-text-color, #333));
    font-size: 1rem;
    font-weight: 500;
    background: transparent;
    border: none;
    box-shadow: none;
}

/* 深色模式下输入文字颜色增强 */
[data-theme="dark"] .password-input:deep(.el-input__inner),
.dark .password-input:deep(.el-input__inner) {
    color: var(--text-color, #ffffff) !important;
}

.password-input:deep(.el-input__inner)::placeholder {
    color: var(--placeholder-color, var(--text-color-secondary, rgba(150, 150, 150, 0.8)));
    font-weight: 400;
    transition: opacity 0.3s ease;
}

.password-input:deep(.el-input__wrapper):focus-within .el-input__inner::placeholder {
    opacity: 0.7;
}

.password-input:deep(.el-input__suffix) {
    color: var(--icon-color, #666);
}

.password-input:deep(.el-input__suffix-inner) {
    transition: color 0.3s ease;
}

.password-input:deep(.el-input__wrapper):hover .el-input__suffix-inner {
    color: var(--login-input-label-focus-color, #5b9bd3);
}

@media (max-width: 768px) {
    .password-input {
        width: 100%;
        height: 45px;
    }
    
    .password-input:deep(.el-input__wrapper) {
        padding: 10px 14px;
    }
}

.footer {
    position: fixed;
    bottom: 0;
    width: 100vw;
}
.toggle-dark {
    position: fixed;
    top: 30px;
    right: 30px;
    border: none;
    transition: all 0.3s ease;
    background-color: var(--toolbar-button-bg-color);
    box-shadow: var(--toolbar-button-shadow);
    backdrop-filter: blur(10px);
    border-radius: 12px;
}
.toggle-dark:hover {
    transform: scale(1.05);
    box-shadow: var(--toolbar-button-shadow-hover);
}
</style>
