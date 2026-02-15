<template>
    <a 
        :href="logoHref" 
        :target="target"
        :class="logo-link"
    >
    <img 
        :class="logoClasses"
        :alt="alt" 
        :src="logoUrl"
    />
  </a>
</template>

<script>
import { mapGetters } from 'vuex'

export default {
  name: 'Logo',
  props: {
    // Logo链接地址（可被用户配置覆盖）
    href: {
      type: String,
      default: 'https://github.com/MarSeventh/CloudFlare-ImgBed'
    },
    // 链接打开方式
    target: {
      type: String,
      default: '_blank', // _blank, _self, _parent, _top
      validator: value => ['_blank', '_self', '_parent', '_top'].includes(value)
    },
    // 图片alt文本
    alt: {
      type: String,
      default: 'Sanyue logo'
    },
    // 自定义logo图片URL（可选）
    customSrc: {
      type: String,
      default: ''
    },
    // Logo位置样式
    position: {
      type: String,
      default: 'fixed', // fixed, relative, absolute
      validator: value => ['fixed', 'relative', 'absolute', 'static'].includes(value)
    },
    // Logo大小
    size: {
      type: String,
      default: 'normal', // small, normal, large
      validator: value => ['small', 'normal', 'large'].includes(value)
    },
    // 是否启用悬停动画
    enableHover: {
      type: Boolean,
      default: true
    },
    // 是否允许使用用户配置的链接（仅上传页面启用）
    useConfigLink: {
      type: Boolean,
      default: false
    }
  },
  computed: {
    ...mapGetters(['userConfig']),
    logoUrl() {
      // 优先级：customSrc > 用户配置 > 默认图片
      return this.customSrc || 
             this.userConfig?.logoUrl || 
             require('../assets/logo.png')
    },
    logoHref() {
      // 只有启用 useConfigLink 时才使用用户配置的链接
      if (this.useConfigLink && this.userConfig?.logoLink) {
        return this.userConfig.logoLink
      }
      return this.href
    },
    logoClasses() {
      return {
        'logo': true,
        [`logo--${this.position}`]: true,
        [`logo--${this.size}`]: true,
        'logo--hover-enabled': this.enableHover
      }
    }
  }
}
</script>

<style scoped>
.logo-link {
  text-decoration: none;
  display: inline-block;
}

.logo {
  transition: all 0.3s ease;
  border-radius: 8px;
}

/* 位置样式 */
.logo--fixed {
  position: fixed;
  top: 20px;
  left: 20px;
  z-index: 100;
}

.logo--relative {
  position: relative;
}

.logo--absolute {
  position: absolute;
  top: 5px;
  left: 5px;
  z-index: 100;
}

.logo--static {
  position: static;
}

/* 大小样式 */
.logo--small {
  height: 50px;
  width: 50px;
}

.logo--normal {
  height: 70px;
  width: 70px;
}

.logo--large {
  height: 90px;
  width: 90px;
}

/* 悬停动画 */
.logo--hover-enabled:hover {
  transform: scale(1.1) rotate(5deg);
  filter: drop-shadow(0 0 10px var(--logo-glow-color));
}

/* 响应式设计 */
@media (max-width: 768px) {
  .logo--small {
    height: 40px;
    width: 40px;
  }
  
  .logo--normal {
    height: 60px;
    width: 60px;
  }
  
  .logo--large {
    height: 75px;
    width: 75px;
  }
}

/* 辅助功能支持 */
.logo:focus {
  outline: 2px solid var(--el-color-primary);
  outline-offset: 2px;
}

/* 主题适配 */
.logo {
  filter: var(--logo-filter, none);
  opacity: var(--logo-opacity, 1);
}

/* 暗色模式下的样式调整 */
@media (prefers-color-scheme: dark) {
  .logo {
    filter: var(--logo-dark-filter, brightness(0.9));
  }
}
</style>
