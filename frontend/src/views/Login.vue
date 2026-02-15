<template>
    <BaseLogin
        :title="loginTitle"
        :fields="loginFields"
        submit-text="登录"
        background-key="loginBkImg"
        :is-admin="false"
        :loading="isLoading"
        @submit="handleLogin"
    />
</template>

<script>
import cookies from 'vue-cookies'
import axios from '@/utils/axios'
import { mapGetters } from 'vuex'
import BaseLogin from '@/components/BaseLogin.vue'

export default {
    data() {
        return {
            isLoading: false,
            loginFields: [
                {
                    key: 'password',
                    label: '密码',
                    placeholder: '请输入认证码',
                    type: 'password',
                    showPassword: true,
                    icon: 'Lock'
                }
            ]
        }
    },
    computed: {
        ...mapGetters(['userConfig']),
        ownerName() {
            return this.userConfig?.ownerName || 'Sanyue'
        },
        loginTitle() {
            return `登录到 ${this.ownerName} 图床`
        }
    },
    components: {
        BaseLogin
    },
    methods: {
        async handleLogin(formData) {
            const { password } = formData;
            const writtenPass = password === '' ? 'unset' : password;
            
            this.isLoading = true;
            
            const minDelayPromise = new Promise(resolve => setTimeout(resolve, 500));
            const loginPromise = axios.post('/api/login', {
                authCode: password
            }).then(res => ({ res })).catch(err => ({ err }));

            try {
                const [result] = await Promise.all([loginPromise, minDelayPromise]);
                
                if (result.res && result.res.status === 200) {
                    cookies.set('authCode', writtenPass, '14d')
                    this.$router.push('/')
                    this.$message.success('登录成功')
                    // Keep loading true to show animation relative to redirect
                } else {
                    this.isLoading = false;
                    this.$message.error('登录失败，请检查密码是否正确')
                }
            } catch (err) {
                this.isLoading = false;
                this.$message.error('系统错误')
            }
        }
    }
}
</script>

<style scoped>
</style>