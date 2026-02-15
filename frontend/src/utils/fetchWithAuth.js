import store from '@/store'
import { ElMessage } from 'element-plus'
import router from '@/router'

export default async function fetchWithAuth(url, options = {}) {
    // 开发环境下添加 /api 前缀
    url = process.env.NODE_ENV === 'production' ? url : `/api${url}`;

    const credentials = store.getters.credentials || btoa('unset:unset');

    // 设置 Authorization 头
    options.headers = {
        ...options.headers,
        'Authorization': `Basic ${credentials}`
    };
    // 确保包含凭据，如 cookies
    options.credentials = 'include'; 

    const response = await fetch(url, options);

    if (response.status === 401) {
        // Redirect to the login page if a 401 Unauthorized is returned
        ElMessage.error('认证状态错误，请重新登录');
        router.push('/adminLogin'); 
    }

    return response;
}
