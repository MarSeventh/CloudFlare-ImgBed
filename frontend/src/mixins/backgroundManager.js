/**
 * 背景图管理 Mixin
 * 用于统一管理页面背景图的加载和轮播逻辑
 */

import { mapGetters } from 'vuex'

export default {
  data() {
    return {
      bingWallPaperIndex: 0,
      customWallPaperIndex: 0,
      backgroundInterval: null, // 存储轮播定时器
      // 存储初始化参数，用于主题切换时重新初始化
      backgroundInitParams: null,
    }
  },
  computed: {
    ...mapGetters(['userConfig', 'bingWallPapers', 'useDarkMode']),
    bkInterval() {
      return this.userConfig?.bkInterval || 3000
    },
    bkOpacity() {
      return this.userConfig?.bkOpacity || 1
    },
    // 提供背景图片元素的模板
    backgroundImagesTemplate() {
      return `
        <img id="bg1" class="background-image1" alt="Background Image"/>
        <img id="bg2" class="background-image2" alt="Background Image"/>
      `
    },
    // 提供背景图片的CSS样式
    backgroundImagesStyles() {
      return `
        .background-image1 {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          z-index: -1;
          opacity: 0;
          transition: opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1), filter 0.3s ease;
          filter: var(--background-image-filter, brightness(1));
        }
        .background-image2 {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          z-index: -1;
          opacity: 0;
          transition: opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1), filter 0.3s ease;
          filter: var(--background-image-filter, brightness(1));
        }
      `
    }
  },

  watch: {
    // 监听深色模式切换
    useDarkMode(newVal, oldVal) {
      // 只有在值真正改变且已经初始化过背景时才平滑切换主题
      if (newVal !== oldVal && this.backgroundInitParams) {
        this.$nextTick(() => {
          this.smoothThemeTransition(
            this.backgroundInitParams.configKey,
            this.backgroundInitParams.containerSelector,
            this.backgroundInitParams.useDefaultBackground,
            this.backgroundInitParams.autoCreateElements
          )
        })
      }
    }
  },

  mounted() {
    // 动态注入背景图片的CSS样式
    this.injectBackgroundStyles()
  },

  beforeUnmount() {
    // 组件销毁前清除定时器
    if (this.backgroundInterval) {
      clearInterval(this.backgroundInterval)
    }
    // 立即清除背景图片，不使用过渡效果
    this.clearBackgroundImages(true)
    // 移除动态注入的样式
    this.removeBackgroundStyles()
  },

  methods: {
    /**
     * 动态注入背景图片样式
     */
    injectBackgroundStyles() {
      const styleId = 'background-manager-styles'
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style')
        style.id = styleId
        style.textContent = this.backgroundImagesStyles
        document.head.appendChild(style)
      }
    },

    /**
     * 移除动态注入的样式
     */
    removeBackgroundStyles() {
      const styleId = 'background-manager-styles'
      const existingStyle = document.getElementById(styleId)
      if (existingStyle) {
        existingStyle.remove()
      }
    },

    /**
     * 动态创建背景图片元素
     * @param {HTMLElement} container - 要插入背景图片的容器元素
     */
    createBackgroundElements(container) {
      if (!container) {
        console.warn('未提供有效的容器元素')
        return
      }

      // 检查是否已经存在背景图片元素
      if (document.getElementById('bg1') || document.getElementById('bg2')) {
        return
      }

      // 创建 bg1 元素
      const bg1 = document.createElement('img')
      bg1.id = 'bg1'
      bg1.className = 'background-image1'
      bg1.alt = 'Background Image'
      
      // 创建 bg2 元素
      const bg2 = document.createElement('img')
      bg2.id = 'bg2'
      bg2.className = 'background-image2'
      bg2.alt = 'Background Image'

      // 将元素插入到容器的开头
      container.insertBefore(bg1, container.firstChild)
      container.insertBefore(bg2, container.firstChild)
    },
    /**
     * 初始化背景图
     * @param {string} configKey - 用户配置中的背景图配置键名
     * @param {string} containerSelector - 容器选择器，用于设置透明背景
     * @param {boolean} useDefaultBackground - 是否使用默认背景图
     * @param {boolean} autoCreateElements - 是否自动创建背景元素
     */
    initializeBackground(configKey, containerSelector = '.login', useDefaultBackground = false, autoCreateElements = false) {
      // 保存初始化参数，用于主题切换时重新初始化
      this.backgroundInitParams = {
        configKey,
        containerSelector,
        useDefaultBackground,
        autoCreateElements
      }

      // 如果需要自动创建元素且元素不存在，则创建
      if (autoCreateElements) {
        const container = document.querySelector(containerSelector)
        if (container && (!document.getElementById('bg1') || !document.getElementById('bg2'))) {
          this.createBackgroundElements(container)
        }
      }

      const bg1 = document.getElementById('bg1')
      const bg2 = document.getElementById('bg2')
      
      if (!bg1 || !bg2) {
        console.warn('背景图元素 #bg1 或 #bg2 未找到，请确保页面中包含这些元素或启用 autoCreateElements')
        return
      }

      const backgroundConfig = this.userConfig?.[configKey]

      if (backgroundConfig === 'bing') {
        this.setupBingWallpaper(bg1, bg2, containerSelector)
      } else if (Array.isArray(backgroundConfig) && backgroundConfig.length > 1) {
        this.setupCustomWallpaperCarousel(bg1, bg2, backgroundConfig, containerSelector)
      } else if (Array.isArray(backgroundConfig) && backgroundConfig.length === 1) {
        this.setupSingleCustomWallpaper(bg1, backgroundConfig[0], containerSelector)
      } else if (useDefaultBackground) {
        this.setupDefaultWallpaper(bg1, containerSelector)
      }
    },

    /**
     * 设置 Bing 壁纸轮播
     */
    setupBingWallpaper(bg1, bg2, containerSelector) {
      this.$store.dispatch('fetchBingWallPapers').then(() => {
        if (this.bingWallPapers.length === 0) return

        this.loadBackgroundImage(bg1, this.bingWallPapers[this.bingWallPaperIndex]?.url, containerSelector)
        
        this.backgroundInterval = setInterval(() => {
          this.switchBingWallpaper(bg1, bg2)
        }, this.bkInterval)
      })
    },

    /**
     * 设置自定义壁纸轮播
     */
    setupCustomWallpaperCarousel(bg1, bg2, wallpapers, containerSelector) {
      this.loadBackgroundImage(bg1, wallpapers[this.customWallPaperIndex], containerSelector)
      
      this.backgroundInterval = setInterval(() => {
        this.switchCustomWallpaper(bg1, bg2, wallpapers)
      }, this.bkInterval)
    },

    /**
     * 设置单张自定义壁纸
     */
    setupSingleCustomWallpaper(bg1, wallpaperUrl, containerSelector) {
      this.loadBackgroundImage(bg1, wallpaperUrl, containerSelector)
    },

    /**
     * 设置默认壁纸
     */
    setupDefaultWallpaper(bg1, containerSelector) {
      // 根据当前深色模式状态选择背景图
      const isDark = this.useDarkMode
      const defaultImage = isDark 
        ? require('@/assets/background.jpg') 
        : require('@/assets/background-light.jpg')
      
      this.loadBackgroundImage(bg1, defaultImage, containerSelector)
    },

    /**
     * 加载背景图片
     */
    loadBackgroundImage(imgElement, imageSrc, containerSelector) {
      imgElement.src = imageSrc
      imgElement.onload = () => {
        imgElement.style.opacity = this.bkOpacity
        // 设置容器背景为透明
        const container = document.querySelector(containerSelector)
        if (container) {
          container.style.background = 'transparent'
        }
      }
    },

    /**
     * 切换 Bing 壁纸
     */
    switchBingWallpaper(bg1, bg2) {
      if (this.bingWallPapers.length === 0) return

      const curBg = bg1.style.opacity != 0 ? bg1 : bg2
      const nextBg = bg1.style.opacity != 0 ? bg2 : bg1
      
      curBg.style.opacity = 0
      this.bingWallPaperIndex = (this.bingWallPaperIndex + 1) % this.bingWallPapers.length
      
      nextBg.src = this.bingWallPapers[this.bingWallPaperIndex]?.url
      nextBg.onload = () => {
        nextBg.style.opacity = this.bkOpacity
      }
    },

    /**
     * 切换自定义壁纸
     */
    switchCustomWallpaper(bg1, bg2, wallpapers) {
      const curBg = bg1.style.opacity != 0 ? bg1 : bg2
      const nextBg = bg1.style.opacity != 0 ? bg2 : bg1
      
      curBg.style.opacity = 0
      this.customWallPaperIndex = (this.customWallPaperIndex + 1) % wallpapers.length
      
      nextBg.src = wallpapers[this.customWallPaperIndex]
      nextBg.onload = () => {
        nextBg.style.opacity = this.bkOpacity
      }
    },

    /**
     * 清除背景轮播定时器
     */
    clearBackgroundInterval() {
      if (this.backgroundInterval) {
        clearInterval(this.backgroundInterval)
        this.backgroundInterval = null
      }
    },

    /**
     * 清除背景图片显示（带过渡效果）
     * @param {boolean} immediate - 是否立即清除，不使用过渡效果
     */
    clearBackgroundImages(immediate = false) {
      const bg1 = document.getElementById('bg1')
      const bg2 = document.getElementById('bg2')
      
      if (immediate) {
        // 立即清除，不使用过渡效果
        if (bg1) {
          bg1.style.transition = 'none'
          bg1.style.opacity = 0
          bg1.src = ''
          // 恢复过渡效果
          setTimeout(() => {
            if (bg1) bg1.style.transition = 'opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
          }, 50)
        }
        if (bg2) {
          bg2.style.transition = 'none'
          bg2.style.opacity = 0
          bg2.src = ''
          // 恢复过渡效果
          setTimeout(() => {
            if (bg2) bg2.style.transition = 'opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
          }, 50)
        }
      } else {
        // 使用过渡效果淡出
        if (bg1) {
          bg1.style.opacity = 0
          setTimeout(() => {
            if (bg1) bg1.src = ''
          }, 800) // 等待过渡完成后清除src
        }
        if (bg2) {
          bg2.style.opacity = 0
          setTimeout(() => {
            if (bg2) bg2.src = ''
          }, 800) // 等待过渡完成后清除src
        }
      }
    },

    /**
     * 平滑主题切换（用于响应主题模式变化）
     * @param {string} configKey - 用户配置中的背景图配置键名
     * @param {string} containerSelector - 容器选择器
     * @param {boolean} useDefaultBackground - 是否使用默认背景图
     * @param {boolean} autoCreateElements - 是否自动创建背景元素
     */
    smoothThemeTransition(configKey, containerSelector = '.login', useDefaultBackground = false, autoCreateElements = false) {
      const backgroundConfig = this.userConfig?.[configKey]
      
      // 如果不是默认背景配置，则直接重新初始化（自定义背景不受主题影响）
      if (!useDefaultBackground || backgroundConfig !== undefined) {
        this.reinitializeBackground(configKey, containerSelector, useDefaultBackground, autoCreateElements)
        return
      }

      // 对于默认背景，执行平滑过渡
      const bg1 = document.getElementById('bg1')
      const bg2 = document.getElementById('bg2')
      
      if (!bg1 || !bg2) {
        // 如果背景元素不存在，直接重新初始化
        this.reinitializeBackground(configKey, containerSelector, useDefaultBackground, autoCreateElements)
        return
      }

      // 确定当前显示的背景和下一个背景
      const currentBg = bg1.style.opacity != 0 ? bg1 : bg2
      const nextBg = bg1.style.opacity != 0 ? bg2 : bg1

      // 获取新主题对应的背景图
      const isDark = this.useDarkMode
      const newThemeImage = isDark 
        ? require('@/assets/background.jpg') 
        : require('@/assets/background-light.jpg')

      // 预加载新背景图
      const preloadImg = new Image()
      preloadImg.onload = () => {
        // 设置下一个背景的图片源
        nextBg.src = newThemeImage
        
        // 等待图片加载完成后执行淡入淡出过渡
        nextBg.onload = () => {
          // 淡出当前背景
          currentBg.style.opacity = 0
          
          // 稍微延迟后淡入新背景，确保过渡效果平滑
          setTimeout(() => {
            nextBg.style.opacity = this.bkOpacity
            
            // 设置容器背景为透明
            const container = document.querySelector(containerSelector)
            if (container) {
              container.style.background = 'transparent'
            }
          }, 50) // 50ms 延迟，让淡出效果先开始
        }
      }
      
      preloadImg.onerror = () => {
        // 如果预加载失败，回退到直接重新初始化
        console.warn('主题背景图预加载失败，回退到直接切换')
        this.reinitializeBackground(configKey, containerSelector, useDefaultBackground, autoCreateElements)
      }
      
      preloadImg.src = newThemeImage
    },

    /**
     * 重新初始化背景图（用于响应配置变化）
     */
    reinitializeBackground(configKey, containerSelector = '.login', useDefaultBackground = false, autoCreateElements = false) {
      this.clearBackgroundInterval()
      this.clearBackgroundImages(true) // 使用立即清除
      this.bingWallPaperIndex = 0
      this.customWallPaperIndex = 0
      
      // 延迟一小段时间确保清理完成
      setTimeout(() => {
        this.initializeBackground(configKey, containerSelector, useDefaultBackground, autoCreateElements)
      }, 100)
    }
  }
}
