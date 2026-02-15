<template>
  <div class="not-found-container">
    <!-- 动态背景图片 -->
    <div class="background-wrapper" v-html="backgroundImagesTemplate"></div>
    
    <div class="not-found-content">
      <!-- 返回首页按钮 -->
      <div class="back-button-wrapper">
        <el-button 
          class="back-button" 
          @click="goHome"
          circle
          size="large"
        >
          <font-awesome-icon icon="home" />
        </el-button>
      </div>

      <!-- 404动画图标 -->
      <div class="error-animation">
        <div class="error-number">
          <span class="four">4</span>
          <span class="zero">0</span>
          <span class="four">4</span>
        </div>
        <div class="error-image">
          <img :src="errorImage" alt="404" class="floating-image" />
        </div>
      </div>
      
      <!-- 错误信息 -->
      <div class="error-info">
        <h1 class="error-title">页面走丢了</h1>
        <p class="error-description">
          抱歉，您访问的页面可能已被删除、更名或暂时不可用
        </p>
        
        <!-- 操作按钮 -->
        <div class="error-actions">
          <el-button 
            type="primary" 
            size="large" 
            class="action-btn primary-btn" 
            @click="goHome"
          >
            <font-awesome-icon icon="home" class="btn-icon" />
            返回首页
          </el-button>
          
          <el-button 
            size="large" 
            class="action-btn secondary-btn" 
            @click="goBack"
          >
            <font-awesome-icon icon="arrow-left" class="btn-icon" />
            返回上页
          </el-button>
        </div>
        
        <!-- 帮助链接 -->
        <div class="help-links">
          <p class="help-text">也许您想要：</p>
          <div class="quick-links">
            <a href="javascript:void(0)" @click="goHome" class="quick-link">
              <font-awesome-icon icon="cloud-upload-alt" />
              图片上传
            </a>
            <a href="javascript:void(0)" @click="goDashboard" class="quick-link">
              <font-awesome-icon icon="tachometer-alt" />
              管理面板
            </a>
            <a href="javascript:void(0)" @click="refreshPage" class="quick-link">
              <font-awesome-icon icon="redo" />
              刷新页面
            </a>
          </div>
        </div>
      </div>
    </div>
    
    <!-- 装饰性元素 -->
    <div class="floating-elements">
      <div class="floating-shape shape-1"></div>
      <div class="floating-shape shape-2"></div>
      <div class="floating-shape shape-3"></div>
      <div class="floating-shape shape-4"></div>
      <div class="floating-shape shape-5"></div>
    </div>
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import backgroundManager from '@/mixins/backgroundManager'

export default {
  name: 'NotFound',
  mixins: [backgroundManager],
  computed: {
    ...mapGetters(['useDarkMode', 'userConfig']),
    errorImage() {
      // 使用项目中已有的404图片
      return require('@/assets/404.png')
    }
  },
  mounted() {
    // 初始化背景图
    this.initializeBackground('uploadBkImg', '.not-found-container', false, true)
  },
  beforeUnmount() {
    // 清理背景轮播定时器
    this.clearBackgroundInterval()
  },
  methods: {
    goHome() {
      this.$router.push('/')
    },
    goBack() {
      if (window.history.length > 1) {
        this.$router.go(-1)
      } else {
        this.$router.push('/')
      }
    },
    goDashboard() {
      this.$router.push('/dashboard')
    },
    refreshPage() {
      window.location.reload()
    }
  }
}
</script>

<style scoped>
.not-found-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  background: var(--bg-color, linear-gradient(135deg, #667eea 0%, #764ba2 100%));
  color: var(--text-color, #333);
}

.background-wrapper {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: -1;
}

.not-found-content {
  text-align: center;
  z-index: 10;
  max-width: 600px;
  padding: 2rem;
  position: relative;
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(20px);
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
}

/* 返回按钮 */
.back-button-wrapper {
  position: absolute;
  top: -25px;
  right: -25px;
  z-index: 15;
}

.back-button {
  background: var(--toolbar-button-bg-color, rgba(255, 255, 255, 0.9));
  border: none;
  color: var(--toolbar-button-text-color, #333);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.back-button:hover {
  transform: translateY(-2px) scale(1.1);
  box-shadow: 0 6px 25px rgba(0, 0, 0, 0.2);
  background: var(--primary-color, #409eff);
  color: white;
}

/* 404动画部分 */
.error-animation {
  margin-bottom: 2rem;
  position: relative;
}

.error-number {
  font-size: 6rem;
  font-weight: 900;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
  text-shadow: 0 0 20px rgba(0, 0, 0, 0.3);
  color: var(--primary-color, #409eff);
}

.error-number span {
  display: inline-block;
  animation: bounce 2s infinite;
  background: var(--not-found-title-text-color, linear-gradient(45deg, #409eff, #67c23a));
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.error-number .four:first-child {
  animation-delay: -0.5s;
}

.error-number .zero {
  animation-delay: -0.25s;
  color: #f56c6c;
  -webkit-text-fill-color: #f56c6c;
}

.error-number .four:last-child {
  animation-delay: 0s;
}

.error-image {
  display: flex;
  justify-content: center;
  margin: 1.5rem 0;
}

.floating-image {
  width: 100px;
  height: 100px;
  object-fit: contain;
  animation: float 3s ease-in-out infinite;
  filter: drop-shadow(0 10px 20px rgba(0, 0, 0, 0.2));
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.1);
  padding: 10px;
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

/* 错误信息 */
.error-info {
  animation: fadeInUp 1s ease-out 0.5s both;
}

.error-title {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 1rem;
  color: var(--text-color, #333);
  background: var(--not-found-title-text-color, linear-gradient(45deg, #409eff, #67c23a));
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.error-description {
  font-size: 1.1rem;
  line-height: 1.6;
  margin-bottom: 2rem;
  opacity: 0.8;
  color: var(--text-color-secondary, #666);
}

/* 操作按钮 */
.error-actions {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 2rem;
}

.action-btn {
  border-radius: 25px;
  padding: 12px 24px;
  font-weight: 600;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  border: none;
  min-width: 140px;
}

.primary-btn {
  background: var(--primary-color, #409eff);
  color: white;
}

.secondary-btn {
  background: var(--toolbar-button-bg-color, rgba(255, 255, 255, 0.9));
  color: var(--text-color, #333);
}

.action-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
}

.btn-icon {
  margin-right: 8px;
}

/* 帮助链接 */
.help-links {
  animation: fadeInUp 1s ease-out 1s both;
}

.help-text {
  margin-bottom: 1rem;
  opacity: 0.7;
  font-size: 0.9rem;
  color: var(--text-color-secondary, #666);
}

.quick-links {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.quick-link {
  color: var(--primary-color, #409eff);
  text-decoration: none;
  font-weight: 500;
  padding: 0.5rem 1rem;
  border-radius: 15px;
  background: var(--toolbar-button-bg-color, rgba(255, 255, 255, 0.8));
  backdrop-filter: blur(10px);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  border: 1px solid rgba(64, 158, 255, 0.2);
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.quick-link:hover {
  background: var(--primary-color, #409eff);
  color: white;
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(64, 158, 255, 0.3);
}

/* 装饰性元素 */
.floating-elements {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1;
}

.floating-shape {
  position: absolute;
  background: rgba(64, 158, 255, 0.1);
  border-radius: 50%;
  animation: floatShapes 8s ease-in-out infinite;
}

.shape-1 {
  width: 60px;
  height: 60px;
  top: 15%;
  left: 10%;
  animation-delay: 0s;
}

.shape-2 {
  width: 80px;
  height: 80px;
  top: 60%;
  right: 15%;
  animation-delay: -2s;
  background: rgba(103, 194, 58, 0.1);
}

.shape-3 {
  width: 40px;
  height: 40px;
  bottom: 25%;
  left: 20%;
  animation-delay: -4s;
}

.shape-4 {
  width: 70px;
  height: 70px;
  top: 25%;
  right: 25%;
  animation-delay: -1s;
  background: rgba(245, 108, 108, 0.1);
}

.shape-5 {
  width: 50px;
  height: 50px;
  bottom: 15%;
  right: 10%;
  animation-delay: -3s;
  background: rgba(230, 162, 60, 0.1);
}

/* 动画定义 */
@keyframes bounce {
  0%, 20%, 50%, 80%, 100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-15px);
  }
  60% {
    transform: translateY(-8px);
  }
}

@keyframes float {
  0%, 100% {
    transform: translateY(0) rotate(0deg);
  }
  50% {
    transform: translateY(-15px) rotate(5deg);
  }
}

@keyframes floatShapes {
  0%, 100% {
    transform: translateY(0) rotate(0deg);
    opacity: 0.6;
  }
  50% {
    transform: translateY(-25px) rotate(180deg);
    opacity: 0.3;
  }
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .not-found-content {
    padding: 1.5rem;
    margin: 1rem;
    max-width: calc(100% - 2rem);
  }
  
  .back-button-wrapper {
    top: -20px;
    right: -20px;
  }
  
  .error-number {
    font-size: 4rem;
    gap: 0.3rem;
  }
  
  .error-title {
    font-size: 1.5rem;
  }
  
  .error-description {
    font-size: 1rem;
  }
  
  .error-actions {
    flex-direction: column;
    align-items: center;
  }
  
  .action-btn {
    width: 200px;
  }
  
  .quick-links {
    flex-direction: column;
    gap: 0.5rem;
    align-items: center;
  }
  
  .quick-link {
    width: fit-content;
    min-width: 120px;
    justify-content: center;
  }
  
  .floating-image {
    width: 80px;
    height: 80px;
    border-radius: 15px;
    padding: 8px;
  }
}

/* 深色模式适配 */
@media (prefers-color-scheme: dark) {
  .not-found-container {
    background: var(--bg-color, linear-gradient(135deg, #2c3e50 0%, #34495e 100%));
    color: var(--text-color, #e4e7ed);
  }
  
  .not-found-content {
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .error-title {
    color: var(--text-color, #e4e7ed);
  }
  
  .error-description {
    color: var(--text-color-secondary, #909399);
  }
  
  .help-text {
    color: var(--text-color-secondary, #909399);
  }
}
</style>
