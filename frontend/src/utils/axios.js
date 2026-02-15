import axios from 'axios';
import cookies from 'vue-cookies';
import router from '@/router/index';
import { ElMessage } from 'element-plus'

// 创建axios实例
const instance = axios.create({
  baseURL: process.env.NODE_ENV === 'production' ? '/' : '/api',
});

// 请求拦截器
instance.interceptors.request.use(
  (config) => {
    // 如果配置中标记了withAuthCode，则添加authCode到header
    if (config.withAuthCode) {
      const authCode = cookies.get('authCode');
      if (authCode) {
        config.headers['authCode'] = authCode;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
instance.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // 如果请求配置了withAuthCode且返回401，则跳转到登录页
    if (error.config?.withAuthCode && error.response?.status === 401) {
      ElMessage.error('认证失败，请重新登录！');
      router.push('/login');
    }
    return Promise.reject(error);
  }
);

export default instance;
