<template>
    <BaseLogin
        title="管理端登录"
        :fields="loginFields"
        submit-text="登录"
        background-key="adminLoginBkImg"
        :is-admin="true"
        :loading="isLoading"
        @submit="handleLogin"
    />
</template>

<script>
import BaseLogin from '@/components/BaseLogin.vue';
import axios from '@/utils/axios'

export default {
    data() {
        return {
            isLoading: false,
            loginFields: [
                {
                    key: 'username',
                    label: '用户名',
                    placeholder: '请输入用户名',
                    type: 'text',
                    icon: 'User'
                },
                {
                    key: 'password',
                    label: '密码',
                    placeholder: '请输入密码',
                    type: 'password',
                    showPassword: true,
                    icon: 'Lock'
                }
            ]
        }
    },
    components: {
        BaseLogin
    },
    methods: {
        async handleLogin(formData) {
            const { username, password } = formData;
            const credentials = btoa(`${username}:${password}`); // Base64 编码
            
            this.isLoading = true;
            
            // Min delay promise
            const minDelayPromise = new Promise(resolve => setTimeout(resolve, 1000));
            // Request promise handling its own error to return it
            const loginPromise = axios.get('/api/manage/check', {
                headers: {
                    'Authorization': `Basic ${credentials}`
                },
                withCredentials: true
            }).then(response => ({ response })).catch(error => ({ error }));

            try {
                const [result] = await Promise.all([loginPromise, minDelayPromise]);
                
                if (result.response && result.response.status === 200) {
                    // 认证成功，存储认证信息，跳转到管理页面
                    this.$store.commit('setCredentials', credentials);
                    this.$router.push('/dashboard');
                } else {
                    const error = result.error || new Error('Unknown error');
                    this.isLoading = false;
                    if (error.response && error.response.status === 401) {
                        this.$message.error('用户名或密码错误');
                    } else {
                        this.$message.error('服务器错误');
                    }
                }
            } catch (error) {
                // Should not reach here due to inner catch, but just in case
                this.isLoading = false;
                this.$message.error('系统错误');
            }
        }
    }
}
</script>

<style scoped>
</style>