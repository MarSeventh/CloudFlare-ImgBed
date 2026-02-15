<template>
  <div class="whitelist-container">
    <!-- 动态背景图片 -->
    <div class="background-wrapper" v-html="backgroundImagesTemplate"></div>
    
    <div class="whitelist-content">
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

      <!-- 白名单图标和动画 -->
      <div class="status-animation">
        <div class="status-icon">
          <font-awesome-icon icon="shield-alt" class="shield-icon" />
          <div class="status-badge">
            <font-awesome-icon icon="clock" class="clock-icon" />
          </div>
        </div>
      </div>
      
      <!-- 提示信息 -->
      <div class="status-info">
        <h1 class="status-title">白名单模式已启用</h1>
        <p class="status-description">
          抱歉，当前已开启白名单模式，上传的图片需要审核通过后才能展示，请等待审核通过后再进行访问。
        </p>
        <p class="status-description-en">
          Sorry, the whitelist mode is currently enabled, the uploaded images need to be audited before they can be displayed, please wait for the audit to be passed before visiting.
        </p>
        
        <!-- 操作按钮 -->
        <div class="status-actions">
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
        
        <!-- 帮助信息 -->
        <div class="help-info">
          <p class="help-text">您可以尝试：</p>
          <div class="quick-links">
            <a href="javascript:void(0)" @click="goHome" class="quick-link">
              <font-awesome-icon icon="cloud-upload-alt" />
              图片上传
            </a>
            <a href="javascript:void(0)" @click="refreshPage" class="quick-link">
              <font-awesome-icon icon="redo" />
              刷新页面
            </a>
          </div>
        </div>
        
        <!-- 项目信息 -->
        <div class="powered-by">
          <p>Powered By: 
            <a href="https://github.com/MarSeventh/CloudFlare-ImgBed" class="project-link">
              CloudFlare-ImgBed
            </a>
          </p>
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
import { useHead } from '@vueuse/head';
import { mapGetters } from 'vuex'
import backgroundManager from '@/mixins/backgroundManager'

export default {
    name: 'WhiteListOn',
    mixins: [backgroundManager],
    computed: {
        ...mapGetters(['useDarkMode', 'userConfig']),
    },
    setup() {
        useHead({
            title: 'White List On',
            meta: [
                { name: 'robots', content: 'noindex, nofollow' },
                { name: 'viewport', content: 'width=device-width, initial-scale=1' },
                { charset: 'UTF-8' }
            ],
        });
    },
    mounted() {
        // 初始化背景图
        this.initializeBackground('uploadBkImg', '.whitelist-container', false, true)
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
        refreshPage() {
            window.location.reload()
        }
    }
}
</script>

<style scoped>
.whitelist-container {
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

.whitelist-content {
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

/* 状态动画部分 */
.status-animation {
  margin-bottom: 2rem;
  position: relative;
}

.status-icon {
  position: relative;
  display: inline-block;
  margin-bottom: 1rem;
}

.shield-icon {
  font-size: 4rem;
  color: var(--primary-color, #409eff);
  animation: pulse 2s ease-in-out infinite;
  filter: drop-shadow(0 0 20px rgba(64, 158, 255, 0.3));
}

.status-badge {
  position: absolute;
  bottom: -5px;
  right: -5px;
  background: #f56c6c;
  border-radius: 50%;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 3px solid white;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
}

.clock-icon {
  color: white;
  font-size: 0.8rem;
  animation: tick 1s ease-in-out infinite;
}

/* 状态信息 */
.status-info {
  animation: fadeInUp 1s ease-out 0.5s both;
}

.status-title {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 1rem;
  color: var(--text-color, #333);
  background: var(--not-found-title-text-color, linear-gradient(45deg, #409eff, #67c23a));
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.status-description {
  font-size: 1.1rem;
  line-height: 1.6;
  margin-bottom: 1rem;
  opacity: 0.9;
  color: var(--text-color, #333);
}

.status-description-en {
  font-size: 0.95rem;
  line-height: 1.5;
  margin-bottom: 2rem;
  opacity: 0.7;
  color: var(--text-color-secondary, #666);
  font-style: italic;
}

/* 操作按钮 */
.status-actions {
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

/* 帮助信息 */
.help-info {
  animation: fadeInUp 1s ease-out 1s both;
  margin-bottom: 1.5rem;
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

/* 项目信息 */
.powered-by {
  animation: fadeInUp 1s ease-out 1.2s both;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
  opacity: 0.8;
}

.powered-by p {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-color-secondary, #666);
}

.project-link {
  color: var(--primary-color, #409eff);
  text-decoration: none;
  font-weight: 600;
  transition: all 0.3s ease;
}

.project-link:hover {
  color: #67c23a;
  text-shadow: 0 0 10px rgba(103, 194, 58, 0.3);
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
@keyframes pulse {
  0%, 100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.05);
    opacity: 0.8;
  }
}

@keyframes tick {
  0%, 100% {
    transform: rotate(0deg);
  }
  50% {
    transform: rotate(180deg);
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
  .whitelist-content {
    padding: 1.5rem;
    margin: 1rem;
    max-width: calc(100% - 2rem);
  }
  
  .back-button-wrapper {
    top: -20px;
    right: -20px;
  }
  
  .shield-icon {
    font-size: 3rem;
  }
  
  .status-title {
    font-size: 1.5rem;
  }
  
  .status-description {
    font-size: 1rem;
  }
  
  .status-description-en {
    font-size: 0.9rem;
  }
  
  .status-actions {
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
}

@media (max-width: 480px) {
  .whitelist-content {
    padding: 1rem;
    margin: 0.5rem;
    max-width: calc(100% - 1rem);
  }
  
  .status-title {
    font-size: 1.3rem;
  }
  
  .status-description {
    font-size: 0.95rem;
  }
  
  .status-description-en {
    font-size: 0.85rem;
  }
  
  .shield-icon {
    font-size: 2.5rem;
  }
}

/* 深色模式适配 */
@media (prefers-color-scheme: dark) {
  .whitelist-container {
    background: var(--bg-color, linear-gradient(135deg, #2c3e50 0%, #34495e 100%));
    color: var(--text-color, #e4e7ed);
  }
  
  .whitelist-content {
    background: rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
  
  .status-title {
    color: var(--text-color, #e4e7ed);
  }
  
  .status-description {
    color: var(--text-color, #e4e7ed);
  }
  
  .status-description-en {
    color: var(--text-color-secondary, #909399);
  }
  
  .help-text {
    color: var(--text-color-secondary, #909399);
  }
  
  .powered-by p {
    color: var(--text-color-secondary, #909399);
  }
}
</style>  