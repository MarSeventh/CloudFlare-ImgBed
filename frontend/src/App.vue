<template>
  <router-view/>
</template>

<script>
import { mapGetters } from 'vuex'
import { OverlayScrollbars } from 'overlayscrollbars'

export default {
  data() {
    return {
      osInstance: null,
      imageViewerObserver: null
    }
  },
  computed: {
    ...mapGetters(['userConfig', 'useDarkMode'])
  },
  mounted() {
    // 初始化 OverlayScrollbars 悬浮滚动条
    this.$nextTick(() => {
      this.initOverlayScrollbars()
      this.setupImageViewerObserver()
    })
  },
  beforeUnmount() {
    // 清理 MutationObserver
    if (this.imageViewerObserver) {
      this.imageViewerObserver.disconnect()
    }
  },
  watch: {
  },
  methods: {
    initOverlayScrollbars() {
      try {
        // 检查是否已经初始化
        if (OverlayScrollbars.valid(document.body)) {
          this.osInstance = OverlayScrollbars(document.body)
          return
        }
        
        // 应用到 body 实现全局悬浮滚动条
        this.osInstance = OverlayScrollbars(document.body, {
          scrollbars: {
            theme: 'os-theme-dark',
            visibility: 'auto',
            autoHide: 'scroll',
            autoHideDelay: 600,
            dragScroll: true,
            clickScroll: true
          },
          overflow: {
            x: 'hidden',
            y: 'scroll'
          }
        })
        
        console.log('OverlayScrollbars initialized successfully')
      } catch (error) {
        console.error('Failed to initialize OverlayScrollbars:', error)
      }
    },
    setupImageViewerObserver() {
      // 监听图片预览器的打开/关闭，动态控制 OverlayScrollbars
      this.imageViewerObserver = new MutationObserver((mutations) => {
        const imageViewer = document.querySelector('.el-image-viewer__wrapper')
        if (imageViewer) {
          // 图片预览器打开，禁用滚动
          if (this.osInstance) {
            this.osInstance.options({ overflow: { x: 'hidden', y: 'hidden' } })
          }
        } else {
          // 图片预览器关闭，恢复滚动
          if (this.osInstance) {
            this.osInstance.options({ overflow: { x: 'hidden', y: 'scroll' } })
          }
        }
      })
      
      this.imageViewerObserver.observe(document.body, {
        childList: true,
        subtree: true
      })
    }
  }
}
</script>
