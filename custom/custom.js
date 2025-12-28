/**
 * CloudFlare ImgBed - 自定义脚本
 * 用于动态注入自定义样式和功能增强
 */

(function() {
  'use strict';

  // 等待 DOM 加载完成
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    console.log('🎨 自定义美化脚本已加载');

    // 注入自定义 CSS
    injectCustomCSS();

    // 添加动态效果
    addDynamicEffects();
  }

  // 注入自定义 CSS
  function injectCustomCSS() {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/custom/custom.css';
    link.id = 'custom-styles';
    document.head.appendChild(link);
    console.log('✅ 自定义样式已注入');
  }

  // 添加动态效果
  function addDynamicEffects() {
    // 添加页面加载动画
    document.body.style.opacity = '0';
    setTimeout(() => {
      document.body.style.transition = 'opacity 0.5s ease-in';
      document.body.style.opacity = '1';
    }, 100);

    // 监听 Vue 应用挂载
    observeAppMount();
  }

  // 监听 Vue 应用挂载
  function observeAppMount() {
    const observer = new MutationObserver((mutations) => {
      const app = document.getElementById('app');
      if (app && app.children.length > 0) {
        console.log('✅ Vue 应用已挂载，应用自定义样式');
        observer.disconnect();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

})();
