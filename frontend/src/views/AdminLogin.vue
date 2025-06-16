<template>
    <div class="login">
        <ToggleDark class="toggle-dark"/>
        <div class="login-container">
            <h1 class="login-title">管理端登录</h1>
            <div class="input-container">
                <a class="input-name">用户名</a>
                <el-input
                    v-model="username"
                    placeholder="请输入用户名"
                    class="password-input"
                ></el-input>
            </div>
            <div class="input-container">
                <a class="input-name">密码</a>
                <el-input 
                    v-model="password" 
                    placeholder="请输入密码" 
                    class="password-input"
                    type="password" 
                    show-password
                    @keyup.enter.native="login"
                    >
                </el-input>
            </div>
            <el-button class="submit" type="primary" @click="login">登录</el-button>
        </div>
        <Footer class="footer"/>
    </div>
</template>

<script>
import Footer from '@/components/Footer.vue';
import ToggleDark from '@/components/ToggleDark.vue';

export default {
    data() {
        return {
            password: '',
            username: ''
        }
    },
    components: {
        Footer,
        ToggleDark
    },
    methods: {
        async login() {
            const credentials = btoa(`${this.username}:${this.password}`); // Base64 编码
            try {
                const response = await fetch('/api/manage/check', {
                    method: 'GET',
                    headers: {
                        'Authorization': `Basic ${credentials}`
                    },
                    credentials: 'include'
                });

                if (response.status === 401) {
                    this.$message.error('用户名或密码错误');
                } else if (response.status === 200) {
                    // 认证成功，存储认证信息，跳转到管理页面
                    this.$store.commit('setCredentials', credentials);
                    this.$router.push('/dashboard');
                } else {
                    this.$message.error('用户名或密码错误');
                }
            } catch (error) {
                this.$message.error('服务器错误');
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
    height: 100vh;
    background: var(--admin-container-bg-color);
}

.login-title {
    font-size: 2.5rem;
    margin-bottom: 15px;
    color: var(--login-title-color);
    font-family: 'Noto Sans SC', sans-serif;
}
@media (max-width: 768px) {
    .login-title {
        font-size: 1.5rem;
    }
}

.login-container {
    display: flex;
    flex-direction: column;
    justify-content: space-around;
    align-items: center;
    height: 40vh;
    width: 40vw;
    border-radius: 12px;
    box-shadow: var(--login-container-box-shadow);
    background-color: var(--login-container-bg-color);
    backdrop-filter: blur(8px);
    transition: all 0.3s ease;
}
@media (max-width: 768px) {
    .login-container {
        width: 80vw;
    }
}
.login-container:hover {
    box-shadow: var(--login-container-hover-box-shadow);
    transform: translateY(-5px);
}

.input-container {
    display: flex;
    align-items: center;
    width: 35vw;
}
@media (max-width: 768px) {
    .input-container {
        width: 75vw;
    }
}

.input-name {
    width: 15%;
    color: var(--login-title-color);
    text-align: right;
    margin-right: 10px;
}
@media (max-width: 768px) {
    .input-name {
        width: 20%;
    }
}

.submit {
    margin-top: 10px;
    width: 40%;
    height: 15%;
    border-radius: 12px;
    background-color: var(--login-submit-btn-bg-color);
    transition: all 0.3s ease;
    border: none;
}
.password-input {
    width: 80%;
    height: 140%;
}
.password-input:deep(.el-input__wrapper) {
    border-radius: 12px;
    background-color: var(--password-input-bg-color);
    border: var(--password-input-border);
    box-shadow: none;
}
@media (max-width: 768px) {
    .password-input {
        width: 75%;
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
</style>