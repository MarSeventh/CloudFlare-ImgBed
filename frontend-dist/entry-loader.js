/* 原生入口控制器：每次文档加载创建一次，不绑定路由或组件的挂载事件。 */
(() => {
  const loader = document.getElementById('entry-loader');
  const app = document.getElementById('app');
  if (!loader || !app) return;

  const root = document.documentElement;
  const startedAt = performance.now();
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  let title = '';
  let titleUpdatedAt = startedAt;
  let completion;
  const animations = new Set();

  root.classList.add('entry-loading');

  const configText = value => typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value))
    ? String(value).trim()
    : '';
  const updateConfig = (config, locale, ready = false) => {
    // ownerName 对应后台的“图床名称”，siteTitle 是网页标题，只作为备用。
    // 数字也可以作为自定义名称；缓存缺失时等配置返回，避免闪现默认品牌。
    const nextTitle = configText(config?.ownerName) || configText(config?.siteTitle) || (ready ? 'Sanyue ImgHub' : '');
    loader.setAttribute('aria-label', `${locale === 'zh-CN' ? '正在加载' : 'Loading'}${nextTitle ? ` ${nextTitle}` : ''}`);
    if (title === nextTitle) return;

    title = nextTitle;
    titleUpdatedAt = performance.now();
    // 按字素分割，避免把 emoji 或组合字符拆开；配置内容始终作为文本写入。
    const letters = typeof Intl.Segmenter === 'function'
      ? Array.from(new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(title), item => item.segment)
      : Array.from(title);
    const name = loader.querySelector('.entry-loader-name');
    const waveDuration = 1800;
    name.style.setProperty('--entry-wave-duration', `${waveDuration}ms`);
    name.replaceChildren(...letters.map((letter, index) => {
      const span = document.createElement('span');
      span.className = 'entry-loader-letter';
      span.textContent = letter;
      // 每个字占一份完整周期，相邻字与首尾之间的相位差相同。
      span.style.setProperty('--letter-delay', `${(index / letters.length - 1) * waveDuration}ms`);
      return span;
    }));
    // 无缓存或配置较晚返回时，名称也渐显，不突然出现在已经亮起的画面中。
    if (performance.now() - startedAt >= 420 && !motionPreference.matches && typeof name.animate === 'function') {
      const reveal = name.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 280, easing: 'ease-out' });
      animations.add(reveal);
      reveal.finished.catch(() => {}).finally(() => {
        reveal.cancel();
        animations.delete(reveal);
      });
    }
  };

  // 复用 Vuex 持久化的配置，让再次访问时在应用下载前就显示正确名称与主题。
  try {
    const cached = JSON.parse(localStorage.getItem('vuex') || '{}');
    const hour = new Date().getHours();
    const dark = cached.cusDarkMode && cached.useDarkMode !== null && cached.useDarkMode !== undefined
      ? cached.useDarkMode
      : window.matchMedia('(prefers-color-scheme: dark)').matches || hour >= 22 || hour < 6;
    root.classList.toggle('dark', Boolean(dark));
    updateConfig(cached.userConfig);
  } catch {
    // 隐私模式禁用存储或缓存损坏时，等待最新配置后再显示名称。
    root.classList.toggle('dark', window.matchMedia('(prefers-color-scheme: dark)').matches);
    updateConfig(null);
  }

  const sleep = duration => new Promise(resolve => setTimeout(resolve, duration));
  const preserveAnimations = mutate => {
    // 滚动条初始化会搬动 body 内的节点，使 CSS 动画重新创建。
    // 保存原始时间轴，并在同一次同步操作中恢复，避免下一帧进度回零。
    const timelines = loader.getAnimations({ subtree: true })
      .filter(animation => animation.animationName && animation.startTime !== null)
      .map(animation => ({
        target: animation.effect.target,
        name: animation.animationName,
        startTime: animation.startTime
      }));
    try {
      return mutate();
    } finally {
      timelines.forEach(({ target, name, startTime }) => {
        const animation = target.getAnimations().find(item => item.animationName === name);
        if (animation) animation.startTime = startTime;
      });
    }
  };
  const nextFrame = () => new Promise(resolve => {
    // 后台标签页也能完成清理，不无限等待被浏览器暂停的 rAF。
    const timeout = setTimeout(resolve, 120);
    requestAnimationFrame(() => {
      clearTimeout(timeout);
      resolve();
    });
  });

  const flyIn = () => {
    const selector = '[data-entry], [data-entry-children]';
    const elements = Array.from(app.querySelectorAll(selector))
      // 同一组内只动画一层，避免父子位移叠加。
      .filter(element => !element.parentElement.closest(selector))
      // 设置页单独动画内容块，让其悬浮保存按钮继续相对视口定位。
      .flatMap(element => element.hasAttribute('data-entry-children')
        ? Array.from(element.children)
          .filter(child => !child.classList.contains('el-loading-mask'))
          .map(child => ({ element: child, direction: element.dataset.entryChildren, group: element.dataset.entryGroup }))
        : [{ element, direction: element.dataset.entry, group: element.dataset.entryGroup }])
      .map(target => ({ ...target, rect: target.element.getBoundingClientRect() }))
      .filter(({ rect }) => rect.width && rect.height && rect.bottom > 0 && rect.top < window.innerHeight)
      .map(target => ({ ...target, offset: ({ left: [-48, 0], right: [48, 0], down: [0, -36], up: [0, 44] })[target.direction] || [0, 44] }))
      .sort((a, b) => a.rect.top - b.rect.top || a.rect.left - b.rect.left);

    // 相邻元素同步进入；其他内容的位移也限制在邻居间距内，防止交错。
    const groupDelays = new Map();
    elements.forEach(({ element, rect, offset, group }, index) => {
      if (typeof element.animate !== 'function') return;
      let [x, y] = offset;
      elements.forEach(other => {
        if (other.element === element) return;
        const bounds = other.rect;
        const overlapsY = rect.top < bounds.bottom + Math.max(0, other.offset[1]) && rect.bottom > bounds.top + Math.min(0, other.offset[1]);
        const overlapsX = rect.left < bounds.right + Math.max(0, other.offset[0]) && rect.right > bounds.left + Math.min(0, other.offset[0]);
        if (overlapsY && x > 0 && rect.right <= bounds.left) x = Math.min(x, Math.max(0, (bounds.left - rect.right) / 2 - 1));
        if (overlapsY && x < 0 && rect.left >= bounds.right) x = Math.max(x, -Math.max(0, (rect.left - bounds.right) / 2 - 1));
        if (overlapsX && y > 0 && rect.bottom <= bounds.top) y = Math.min(y, Math.max(0, (bounds.top - rect.bottom) / 2 - 1));
        if (overlapsX && y < 0 && rect.top >= bounds.bottom) y = Math.max(y, -Math.max(0, (rect.top - bounds.bottom) / 2 - 1));
      });
      const delay = 100 + Math.min(index * 45, 270);
      if (group && !groupDelays.has(group)) groupDelays.set(group, delay);
      // 独立 translate/scale 保留组件原有 transform（居中、悬停、标题浮动等）。
      const animation = element.animate([
        { opacity: 0, translate: `${x}px ${y}px`, scale: '0.97' },
        { opacity: getComputedStyle(element).opacity, translate: '0px 0px', scale: '1' }
      ], {
        duration: 680,
        delay: group ? groupDelays.get(group) : delay,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
        fill: 'backwards'
      });
      animations.add(animation);
      animation.finished.catch(() => {}).finally(() => {
        animation.cancel();
        animations.delete(animation);
      });
    });
  };

  const finish = () => {
    if (completion) return completion;
    completion = (async () => {
      try {
        if (!motionPreference.matches) {
          // 快速启动也留一小段阅读时间；慢请求无需再额外等待完整一轮。
          await sleep(Math.max(0, 900 - (performance.now() - startedAt), 450 - (performance.now() - titleUpdatedAt)));
        }
        await nextFrame();
        await nextFrame();
        if (!motionPreference.matches) flyIn();
      } finally {
        root.classList.remove('entry-loading');
        app.removeAttribute('inert');
        loader.classList.add('is-leaving');
        await sleep(motionPreference.matches ? 150 : 420);
        loader.remove();
      }
    })();
    return completion;
  };

  // 页面被放入往返缓存时取消尚未结束的动画，返回网站不会重播。
  window.addEventListener('pagehide', () => {
    animations.forEach(animation => animation.cancel());
    animations.clear();
  });

  window.__siteEntry = { updateConfig, finish, preserveAnimations };
})();
