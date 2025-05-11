import { createApp } from 'vue'
import { createHead } from '@vueuse/head'; // 导入 createHead
import ElementPlus from 'element-plus'
import 'element-plus/es/components/message/style/css'
import 'element-plus/es/components/message-box/style/css'

import { library } from '@fortawesome/fontawesome-svg-core';
import { fas } from '@fortawesome/free-solid-svg-icons'; // 引入所有 solid 图标
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome';

import App from './App.vue'
import router from './router'
import store from './store'

import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import 'element-plus/theme-chalk/dark/css-vars.css'
import './styles/global.css'


library.add(fas);

const app = createApp(App);
const head = createHead(); // 创建 head 对象

app.component('font-awesome-icon', FontAwesomeIcon);
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
    app.component(key, component)
}

// 根据 useDarkMode 的值添加或移除 dark 类
const initDarkModeClass = (isDarkMode) => {
    const htmlElement = document.documentElement;
    // 判断用户是否自定义过 dark 模式
    if (store.state.cusDarkMode && store.state.useDarkMode !== null) {
        isDarkMode = store.state.useDarkMode;
    } else {
        // 默认跟随系统 dark 模式；若系统 dark 模式未开启，判断时间是否在 22:00 到 6:00 之间
        isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (!isDarkMode) {
            const now = new Date();
            const hour = now.getHours();
            isDarkMode = hour >= 22 || hour < 6;
        }
        // 更新 useDarkMode 的值
        store.commit('setUseDarkMode', isDarkMode);
    }
    if (isDarkMode) {
        htmlElement.classList.add('dark');
    } else {
        htmlElement.classList.remove('dark');
    }
};

const applyDarkModeClass = (isDarkMode) => {
    const htmlElement = document.documentElement;
    if (isDarkMode) {
        htmlElement.classList.add('dark');
    } else {
        htmlElement.classList.remove('dark');
    }
};

store.dispatch('fetchUserConfig').then(() => {
    // 初始化时应用 dark 模式
    initDarkModeClass(store.state.useDarkMode);
    // 监听 useDarkMode 的变化
    store.subscribe((mutation, state) => {
        if (mutation.type === 'setUseDarkMode') {
          applyDarkModeClass(state.useDarkMode);
        }
    });

    app.use(store).use(router).use(ElementPlus).mount('#app');
}).catch(error => {
    console.error('Failed to load user configuration:', error);
    app.use(store).use(router).use(ElementPlus).use(head).mount('#app');
})
