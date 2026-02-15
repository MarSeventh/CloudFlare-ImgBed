import { createRouter, createWebHistory } from 'vue-router'
import { ElMessage } from 'element-plus'
import cookies from 'vue-cookies'
import store from '../store'
import axios from '@/utils/axios'

// 通用的管理员认证守卫
const adminAuthGuard = (to, from, next) => {
  // 从store中获取凭据
  const credentials = store.getters.credentials
  if (credentials === null && to.name !== 'adminLogin') {
    // 尝试未设置密码的情况
    const credentials = btoa('unset:unset')
    axios.get('/api/manage/check', {
      headers: {
        'Authorization': 'Basic ' + credentials
      },
      withCredentials: true
    }).then(res => {
      if (res.status !== 200) {
        throw new Error('认证失败！')
      }
      store.commit('setCredentials', credentials)
      next()
    }).catch(err => {
      ElMessage.error('请先认证！')
      next({ name: 'adminLogin' })
    })
  } else {
    next()
  }
}

// 通用的用户认证守卫
const userAuthGuard = (to, from, next) => {
  let authCode = cookies.get('authCode');
  if (authCode === null && to.name !== 'login') {
    // 尝试未设置密码的情况
    axios.post('/api/login', {
      authCode: 'unset'
    }).then(res => {
      if (res.status !== 200) {
        throw new Error('认证失败！')
      }
      cookies.set('authCode', 'unset', '14d')
      authCode = 'unset'
      next()
    }).catch(err => {
      ElMessage.error('请先认证！')
      next({ name: 'login' })
    })
  } else {
    next()
  }
}

const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('../views/UploadHome.vue'),
    beforeEnter: userAuthGuard
  },
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/Login.vue')
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    component: () => import('../views/AdminDashBoard.vue'),
    beforeEnter: adminAuthGuard
  },
  {
    path: '/customerConfig',
    name: 'customerConfig',
    component: () => import('../views/CustomerConfig.vue'),
    beforeEnter: adminAuthGuard
  },
  {
    path: '/systemConfig',
    name: 'systemConfig',
    component: () => import('../views/SystemConfig.vue'),
    beforeEnter: adminAuthGuard
  },
  {
    path: '/adminLogin',
    name: 'adminLogin',
    component: () => import('../views/AdminLogin.vue'),
  },
  {
    path: '/blockimg',
    name: 'blockimg',
    component: () => import('../views/BlockImage.vue'),
  },
  {
    path: '/whiteliston',
    name: 'whiteliston',
    component: () => import('../views/WhiteListOn.vue'),
  },
  {
    path: '/browse/:dir*',
    name: 'publicBrowse',
    component: () => import('../views/PublicBrowse.vue'),
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'notFound',
    component: () => import('../views/NotFound.vue'),
  },
]

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes
})

export default router
