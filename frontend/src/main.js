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

// OverlayScrollbars 悬浮滚动条
import 'overlayscrollbars/overlayscrollbars.css'


library.add(fas);

const app = createApp(App);
const head = createHead(); // 创建 head 对象

app.component('font-awesome-icon', FontAwesomeIcon);
for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
    app.component(key, component)
}

// 根据 useDarkMode 的值添加或移除 dark 类
const initDarkModeClass = () => {
    const htmlElement = document.documentElement;
    let isDarkMode;

    // 判断用户是否是自定义模式
    if (store.state.cusDarkMode && store.state.useDarkMode !== null) {
        // 用户手动设置了暗色模式
        isDarkMode = store.state.useDarkMode;
    } else {
        // 跟随系统模式或时间
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

// 预设网站标题的函数
const presetSiteTitle = (userConfig) => {
    document.title = userConfig?.siteTitle || 'Sanyue ImgHub';
};

// 预设和更新网站图标的函数
const presetSiteIcon = (isDarkMode, userConfig) => {
    // 同时更改 icon apple-touch-icon 和 mask-icon
    const existingIcons = document.querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"], link[rel="mask-icon"]');
    existingIcons.forEach(icon => icon.remove());

    const iconLink = document.createElement('link');
    const appleIconLink = document.createElement('link');
    const maskIconLink = document.createElement('link');
    iconLink.rel = 'icon';
    appleIconLink.rel = 'apple-touch-icon';
    maskIconLink.rel = 'mask-icon';

    if (isDarkMode) {
        iconLink.href = userConfig?.siteIcon || '/logo-dark.png';
        appleIconLink.href = userConfig?.siteIcon || '/logo-dark.png';
        maskIconLink.href = userConfig?.siteIcon || '/logo-dark.png';
    } else {
        iconLink.href = userConfig?.siteIcon || '/logo.png';
        appleIconLink.href = userConfig?.siteIcon || '/logo.png';
        maskIconLink.href = userConfig?.siteIcon || '/logo.png';
    }

    document.head.appendChild(iconLink);
    document.head.appendChild(appleIconLink);
    document.head.appendChild(maskIconLink);
};

store.dispatch('fetchUserConfig').then(() => {
    // 初始化时应用 dark 模式
    initDarkModeClass();

    // 预设网站标题和图标
    presetSiteTitle(store.getters.userConfig);
    presetSiteIcon(store.state.useDarkMode, store.getters.userConfig);

    // 监听 useDarkMode 和 cusDarkMode 的变化
    store.subscribe((mutation, state) => {
        if (mutation.type === 'setUseDarkMode' && store.state.cusDarkMode) {
            applyDarkModeClass(state.useDarkMode);
            // 同时更新网站图标
            presetSiteIcon(state.useDarkMode, store.getters.userConfig);
        }

        // 监听 cusDarkMode 变化，当设置为 false 时重新初始化
        if (mutation.type === 'setCusDarkMode' && !mutation.payload) {
            // 切换到跟随系统模式，重新初始化
            initDarkModeClass();
            // 同时更新网站图标
            presetSiteIcon(store.state.useDarkMode, store.getters.userConfig);
        }
    });

    app.use(store).use(router).use(ElementPlus).mount('#app');
}).catch(error => {
    console.error('Failed to load user configuration:', error);
    app.use(store).use(router).use(ElementPlus).use(head).mount('#app');
})
