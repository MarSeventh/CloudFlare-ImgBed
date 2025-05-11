import Vue from 'vue'
import axios from 'axios'
import router from '../router'
import { ElMessage } from 'element-plus'

Vue.prototype.$axios = axios
const baseURL = '/'

const api = axios.create({
    baseURL,
    timeout: 5000 // 设置超时时间
})

api.interceptors.response.use(
    response => {
        let res = response
        return res
    },
    error => {
        if (error.response && error.response.status === 401) {
            router.push('/login')
            ElMessage.error('认证状态错误！')
        }
        return Promise.reject(error)
    }
)