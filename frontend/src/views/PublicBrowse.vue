<template>
  <div class="public-browse">
    <!-- 顶部导航栏 -->
    <header class="header">
      <div class="header-left">
        <a class="logo" href="https://github.com/MarSeventh/CloudFlare-ImgBed" target="_blank" rel="noopener">{{ siteName }}</a>
      </div>
      <div class="header-center">
        <div class="breadcrumb">
          <span class="breadcrumb-item" @click="goToRoot">{{ rootDirName }}</span>
          <template v-for="(part, index) in pathParts" :key="index">
            <span class="breadcrumb-sep">/</span>
            <span class="breadcrumb-item" @click="goToPath(index)">{{ part }}</span>
          </template>
        </div>
      </div>
      <div class="header-right">
        <!-- 搜索框：默认只显示放大镜，点击展开 -->
        <div class="search-box" :class="{ expanded: searchExpanded }">
          <span class="search-icon" @click="toggleSearch" v-if="!searchExpanded">
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
          </span>
          <template v-else>
            <input 
              type="text" 
              v-model="searchInput" 
              @keyup.enter="handleSearch"
              placeholder="搜索文件名 或 #页码"
              class="search-input"
              ref="searchInputRef"
            />
            <span class="search-icon" @click="handleSearch">
              <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
            </span>
          </template>
        </div>
        <ToggleDark class="theme-toggle-btn" />
        <span class="file-count">{{ totalCount }} 个文件</span>
      </div>
    </header>

    <!-- 加载状态 -->
    <div v-if="loading && files.length === 0" class="loading-container">
      <div class="loading-spinner"></div>
      <p>加载中...</p>
    </div>

    <!-- 错误提示 -->
    <div v-else-if="error" class="error-container">
      <p>{{ error }}</p>
      <button v-if="canRetry" @click="loadFiles" class="retry-btn">重试</button>
      <div class="error-credit">
        <p>该图库由林酱贡献代码</p>
        <div class="error-credit-links">
          <a href="https://github.com/axibayuit-a11y" target="_blank" rel="noopener">
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            GitHub
          </a>
          <a href="https://linux.do/u/yuit_axiba/summary" target="_blank" rel="noopener">
            <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
            Linux.do
          </a>
        </div>
      </div>
    </div>

    <!-- 瀑布流容器 -->
    <div v-else class="gallery-container" ref="galleryContainer">
      <!-- 文件夹区域 -->
      <div v-if="folders.length > 0" class="folders-section">
        <div class="folders-grid">
          <div 
            v-for="folder in folders" 
            :key="folder.name"
            class="folder-card"
            @click="enterFolder(folder.name)"
          >
            <div class="folder-icon">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
            </div>
            <span class="folder-name">{{ getFolderName(folder.name) }}</span>
          </div>
        </div>
      </div>

      <!-- 瀑布流图片区域 -->
      <div class="waterfall" ref="waterfall">
        <div 
          v-for="(column, colIndex) in columns" 
          :key="colIndex" 
          class="waterfall-column"
        >
          <div 
            v-for="file in column" 
            :key="file.name"
            class="waterfall-item"
            @click="openPreview(file)"
          >
            <div class="image-wrapper" :class="{ loaded: file.loaded }">
              <img 
                v-if="isImage(file)"
                :src="getFileUrl(file.name)" 
                :alt="file.name"
                loading="lazy"
                @load="onImageLoad($event, file)"
                @error="handleImageError"
              />
              <video 
                v-else-if="isVideo(file)"
                :src="getFileUrl(file.name)"
                muted
                loop
                preload="metadata"
                @loadedmetadata="onVideoLoad($event, file)"
                @pointerenter="e => e.pointerType === 'mouse' && e.target.play()"
                @pointerleave="e => e.pointerType === 'mouse' && e.target.pause()"
              ></video>
              <div v-else-if="isAudio(file)" class="audio-placeholder">
                <svg class="audio-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
                <span class="audio-name">{{ getFileName(file.name) }}</span>
              </div>
              <div v-else class="file-placeholder">
                <svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z"/></svg>
                <span class="file-name">{{ getFileName(file.name) }}</span>
              </div>
              <!-- 悬浮操作层 -->
              <div class="overlay">
                <div class="overlay-actions">
                  <button class="action-btn" @click.stop="copyLink(file.name)" title="复制链接">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"/></svg>
                  </button>
                  <button class="action-btn" @click.stop="downloadFile(file.name)" title="下载">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 浮动页码指示器 -->
      <div class="floating-page-indicator" v-if="mediaFiles.length > pageSize">
        <span>{{ displayCurrentPage }} / {{ totalPages }}</span>
      </div>

      <!-- 加载更多指示器 -->
      <div ref="loadTrigger" class="load-trigger">
        <div v-if="loading && files.length > 0" class="loading-more">
          <div class="loading-spinner-small"></div>
          <span>加载中...</span>
        </div>
        <div v-else-if="!hasMore && mediaFiles.length > 0" class="no-more">
          已加载全部
        </div>
        <a v-if="!hasMore && mediaFiles.length > 0" class="credit-link" href="https://github.com/axibayuit-a11y" target="_blank" rel="noopener">
          林酱贡献
        </a>
      </div>
    </div>

    <!-- 图片预览弹窗 -->
    <div v-if="previewVisible" class="preview-modal" @click.self="closePreview">
      <button class="preview-close" @click.stop="closePreview">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
      </button>
      
      <!-- 桌面端：简单单图显示（用 v-if 而非 CSS 隐藏，避免全屏时问题） -->
      <div v-if="!isMobile" class="preview-content" @click.stop @wheel.prevent="handleWheel">
        <img 
          v-if="currentPreviewFile && isImage(currentPreviewFile)"
          :key="'img-' + currentPreviewFile.name"
          :src="getFileUrl(currentPreviewFile.name)" 
          class="preview-image"
          :style="desktopImageStyle"
          draggable="false"
          @mousedown="onImageMouseDown"
          @mousemove="onImageMouseMove"
          @mouseup="onImageMouseUp"
          @mouseleave="onImageMouseUp"
        />
        <!-- 桌面端视频：加 key 强制切换时重新挂载，避免混播 -->
        <video 
          v-else-if="currentPreviewFile && isVideo(currentPreviewFile)"
          ref="desktopVideo"
          :key="'video-' + currentPreviewFile.name"
          :src="getFileUrl(currentPreviewFile.name)"
          controls
          class="preview-video"
          :style="desktopImageStyle"
          @play="onDesktopVideoPlay"
        ></video>
        <!-- 桌面端音频：加 key 强制切换时重新挂载 -->
        <TransformMedia
          v-else-if="currentPreviewFile && isAudio(currentPreviewFile)"
          ref="desktopAudio"
          :key="'audio-' + currentPreviewFile.name"
          :file="currentPreviewFile"
          :src="getFileUrl(currentPreviewFile.name)"
          :is-image="false"
          :is-video="false"
          :is-audio="true"
          :is-active="true"
          @audio-ended="onAudioEnded"
        />
      </div>
      
      <!-- 手机端预览：视频和音频完全独立（用 v-if 确保只渲染一个） -->
      <div v-if="isMobile" class="preview-content preview-content-mobile" @click.stop>
        <!-- 视频：纯原生播放，不包裹任何额外UI -->
        <video
          v-if="currentPreviewFile && isVideo(currentPreviewFile)"
          ref="mobileVideo"
          :key="'m-video-' + currentPreviewFile.name"
          :src="getFileUrl(currentPreviewFile.name)"
          controls
          playsinline
          webkit-playsinline
          x5-video-player-type="h5"
          x5-video-player-fullscreen="true"
          class="mobile-video-native"
          @play="onMobileMediaPlay"
        ></video>
        
        <!-- 音频：使用 TransformMedia 组件（带 Plyr 和三点菜单） -->
        <div
          v-else-if="currentPreviewFile && isAudio(currentPreviewFile)"
          class="mobile-audio-wrap"
          @touchstart="onAudioSwipeStart"
          @touchmove="onAudioSwipeMove"
          @touchend="onAudioSwipeEnd"
        >
          <TransformMedia
            ref="mobileAudio"
            :key="'m-audio-' + currentPreviewFile.name"
            :file="currentPreviewFile"
            :src="getFileUrl(currentPreviewFile.name)"
            :is-image="false"
            :is-video="false"
            :is-audio="true"
            :is-active="true"
            @audio-ended="onAudioEnded"
          />
          <div class="swipe-hint">← 滑动切换 →</div>
        </div>
        
        <!-- 其他文件：直接显示 -->
        <div v-else-if="currentPreviewFile && !isImage(currentPreviewFile)" class="other-file-preview">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zm-1 7V3.5L18.5 9H13z"/></svg>
          <span class="file-name">{{ getFileName(currentPreviewFile.name) }}</span>
        </div>
        
        <!-- 图片：三页轨道轮播 -->
        <div
          v-else
          class="swipe-viewport"
          ref="mobileViewport"
          @touchstart="onSwipeStart"
          @touchmove="onSwipeMove"
          @touchend="onSwipeEnd"
        >
          <div class="swipe-track" :style="swipeTrackStyle" @transitionend="onSwipeTransitionEnd">
            <div 
              class="swipe-slide" 
              v-for="(f, i) in swipeWindow" 
              :key="getSlideKey(f, i)"
            >
              <TransformMedia
                v-if="f"
                :file="f"
                :src="getFileUrl(f.name)"
                :is-image="isImage(f)"
                :is-video="false"
                :is-audio="false"
                :is-active="i === 1"
                @lock="gestureLocked = true"
                @unlock="gestureLocked = false"
                @edge-swipe="onEdgeSwipe"
              />
            </div>
          </div>
        </div>
      </div>
      
      <!-- 桌面端按钮 -->
      <button class="preview-prev" @click.stop="prevImage" v-if="!isMobile && previewIndex > 0">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
      </button>
      <button class="preview-next" @click.stop="nextImage" v-if="!isMobile && previewIndex < mediaFiles.length - 1">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
      </button>
      
      <!-- 桌面端旋转按钮 -->
      <button class="rotate-btn" @click.stop="rotateImage" v-if="!isMobile" title="旋转90°">
        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.89 8.53l1.41-1.42C19.2 8.27 19.76 9.61 19.93 11h-2.02c-.14-.87-.49-1.72-1.02-2.47zM17.91 13h2.02c-.17 1.39-.72 2.73-1.62 3.89l-1.41-1.42c.52-.75.87-1.59 1.01-2.47zm-1.01 5.32c-1.16.9-2.51 1.44-3.9 1.61V17.9c.87-.15 1.71-.49 2.46-1.03l1.44 1.45zM11 4.07V1l4.55 4.55L11 10V6.09c-2.84.48-5 2.94-5 5.91s2.16 5.43 5 5.91v2.02c-3.95-.49-7-3.85-7-7.93s3.05-7.44 7-7.93z"/></svg>
      </button>
      
      <!-- 页码指示器 -->
      <div class="page-indicator">
        {{ previewIndex + 1 }} / {{ mediaFiles.length }}
      </div>
    </div>
  </div>
</template>

<script>
import axios from 'axios';
import { mapGetters } from 'vuex';
import TransformMedia from '@/components/browse/TransformMedia.vue';
import ToggleDark from '@/components/ToggleDark.vue';
import { hardStopAll, installGlobalMediaGuards } from '@/utils/mediaManager';

export default {
  name: 'PublicBrowse',
  components: {
    TransformMedia,
    ToggleDark
  },
  data() {
    return {
      files: [],
      allowedDirs: [],
      rootDir: '',
      currentPath: '',
      totalCount: 0,
      loading: false,
      error: null,
      canRetry: true,
      hasMore: true,
      previewVisible: false,
      previewIndex: 0,
      observer: null,
      pageSize: 24,
      searchInput: '',
      searchKeyword: '',
      currentStartIndex: 0,
      searchExpanded: false,
      filterType: '',
      lastScrollY: 0,
      scrollPage: 0,
      columnCount: 4,
      columnHeights: [0, 0, 0, 0],
      // 桌面端旋转和缩放
      imageRotation: 0,
      imageScale: 1,
      // 桌面端拖拽
      imageTx: 0,
      imageTy: 0,
      imageDragging: false,
      imageDragStart: null,
      imageStartTx: 0,
      imageStartTy: 0,
      // 手机端滑动
      swipeX: 0,
      swipeStartX: 0,
      swipeStartY: 0,
      swipeStartT: 0,
      swipeActive: false,
      swipeAnimating: false,
      swipeDir: 0,
      viewportW: 0,
      // 手势锁定（子组件缩放/旋转时锁住轮播）
      gestureLocked: false,
      // 音频滑动切换
      audioSwipeStartX: 0,
      audioSwipeStartT: 0,
      audioSwipeActive: false,
      // 设备类型判断（用 JS 而非纯 CSS，避免全屏时媒体查询失效）
      isMobile: false,
    };
  },
  computed: {
    ...mapGetters(['userConfig']),
    siteName() {
      return this.userConfig?.siteTitle || 'Sanyue ImgHub';
    },
    rootDirName() {
      return this.rootDir.split('/').filter(Boolean).pop() || '根目录';
    },
    pathParts() {
      if (!this.currentPath || !this.rootDir) return [];
      const relative = this.currentPath.replace(this.rootDir, '').replace(/^\/+/, '');
      return relative.split('/').filter(Boolean);
    },
    folders() {
      return this.files.filter(f => f.isFolder);
    },
    mediaFiles() {
      return this.files.filter(f => !f.isFolder);
    },
    totalPages() {
      return Math.ceil(this.totalCount / this.pageSize);
    },
    displayCurrentPage() {
      // 基于滚动位置计算当前页码
      const startPage = Math.floor(this.currentStartIndex / this.pageSize) + 1;
      const loadedPages = Math.ceil(this.mediaFiles.length / this.pageSize);
      // 根据滚动比例计算当前在第几页
      return Math.min(startPage + Math.floor(this.scrollPage * loadedPages), this.totalPages);
    },
    columns() {
      const cols = Array.from({ length: this.columnCount }, () => []);
      for (const file of this.mediaFiles) {
        const idx = file.columnIndex ?? 0;
        if (idx < this.columnCount) {
          cols[idx].push(file);
        } else {
          cols[0].push(file);
        }
      }
      return cols;
    },
    currentPreviewFile() {
      return this.mediaFiles[this.previewIndex];
    },
    prevPreviewFile() {
      return this.previewIndex > 0 ? this.mediaFiles[this.previewIndex - 1] : null;
    },
    nextPreviewFile() {
      return this.previewIndex < this.mediaFiles.length - 1 ? this.mediaFiles[this.previewIndex + 1] : null;
    },
    desktopImageStyle() {
      const inDrag = this.imageDragging;
      return {
        transform: `translate(${this.imageTx}px, ${this.imageTy}px) rotate(${this.imageRotation}deg) scale(${this.imageScale})`,
        transition: inDrag ? 'none' : 'transform 0.3s ease',
        cursor: this.imageScale > 1 ? (this.imageDragging ? 'grabbing' : 'grab') : 'default'
      };
    },
    swipeWindow() {
      return [this.prevPreviewFile, this.currentPreviewFile, this.nextPreviewFile];
    },
    swipeTrackStyle() {
      // 默认停在中间那页（-viewportW）
      const base = -this.viewportW;
      const x = base + this.swipeX;
      return {
        transform: `translate3d(${x}px, 0, 0)`,
        transition: this.swipeAnimating ? 'transform 0.28s ease' : 'none',
      };
    }
  },
  watch: {
    '$route.params.dir': {
      handler() {
        this.initFromRoute();
      }
    }
  },
  mounted() {
    // 安装全局媒体守卫
    installGlobalMediaGuards();
    this.checkMobile();
    this.initFromRoute();
    this.setupIntersectionObserver();
    this.updateColumnCount();
    window.addEventListener('resize', this.updateColumnCount);
    window.addEventListener('resize', this.checkMobile);
    window.addEventListener('scroll', this.handleScroll);
  },
  beforeUnmount() {
    if (this.observer) {
      this.observer.disconnect();
    }
    window.removeEventListener('resize', this.updateColumnCount);
    window.removeEventListener('resize', this.checkMobile);
    window.removeEventListener('scroll', this.handleScroll);
  },
  methods: {
    // 搜索处理
    handleSearch() {
      const input = this.searchInput.trim();
      if (!input) {
        // 清空搜索，重置
        this.searchKeyword = '';
        this.filterType = '';
        this.currentStartIndex = 0;
        this.resetAndLoad();
        return;
      }
      
      // 检查是否是页码跳转 #数字
      const pageMatch = input.match(/^#(\d+)$/);
      if (pageMatch) {
        const page = parseInt(pageMatch[1], 10);
        const maxPage = Math.ceil(this.totalCount / this.pageSize);
        const targetPage = Math.min(Math.max(1, page), maxPage || 1);
        this.currentStartIndex = (targetPage - 1) * this.pageSize;
        this.searchKeyword = '';
        this.filterType = '';
        this.searchInput = '';
        this.resetAndLoad();
        return;
      }
      
      // 检查是否是类型关键词
      const typeKeywords = {
        '图片': 'image', '图': 'image', 'image': 'image', 'img': 'image', '照片': 'image',
        '视频': 'video', 'video': 'video', '影片': 'video', '电影': 'video',
        '音乐': 'audio', '音频': 'audio', 'audio': 'audio', 'music': 'audio', '歌曲': 'audio'
      };
      
      const lowerInput = input.toLowerCase();
      if (typeKeywords[lowerInput]) {
        this.filterType = typeKeywords[lowerInput];
        this.searchKeyword = '';
        this.currentStartIndex = 0;
        this.resetAndLoad();
        return;
      }
      
      // 普通文件名搜索
      this.filterType = '';
      this.searchKeyword = input;
      this.currentStartIndex = 0;
      this.resetAndLoad();
    },
    
    // 重置并加载
    resetAndLoad() {
      this.files = [];
      this.hasMore = true;
      this.columnHeights = new Array(this.columnCount).fill(0);
      this.loadFiles().then(() => {
        // 重新观察加载触发器，确保无限滚动继续工作
        this.observeLoadTrigger();
      });
    },
    
    // 搜索框展开/收起
    toggleSearch() {
      this.searchExpanded = !this.searchExpanded;
      if (this.searchExpanded) {
        this.$nextTick(() => {
          this.$refs.searchInputRef?.focus();
        });
      }
    },
    
    // 监听滚动收起搜索框 + 计算当前页码
    handleScroll() {
      const currentScrollY = window.scrollY;
      
      // 收起搜索框
      if (this.searchExpanded) {
        if (currentScrollY > this.lastScrollY + 20) {
          this.searchExpanded = false;
        }
      }
      this.lastScrollY = currentScrollY;
      
      // 计算滚动页码比例
      const gallery = this.$refs.galleryContainer;
      if (gallery && this.mediaFiles.length > 0) {
        const galleryRect = gallery.getBoundingClientRect();
        const galleryTop = gallery.offsetTop;
        const scrollableHeight = gallery.scrollHeight - window.innerHeight;
        
        if (scrollableHeight > 0) {
          const scrolled = Math.max(0, currentScrollY - galleryTop);
          this.scrollPage = Math.min(1, scrolled / scrollableHeight);
        } else {
          this.scrollPage = 0;
        }
      }
    },
    
    // 检测是否为移动设备（用 JS 判断，避免全屏时 CSS 媒体查询失效）
    checkMobile() {
      // 只有屏幕宽度 ≤600px 才算手机端（与瀑布流2列的断点一致）
      // 不用 pointer: coarse，因为很多电脑也有触摸屏
      this.isMobile = window.innerWidth <= 600;
    },

    // 生成 slide key，切换时让子组件重新挂载以重置 transform
    getSlideKey(f, i) {
      if (!f) return `empty-${i}`;
      // 中间那张用 previewIndex 作为 key 的一部分，确保切换时重新挂载
      if (i === 1) return `${f.name}-${this.previewIndex}`;
      return f.name;
    },

    updateColumnCount() {
      const width = window.innerWidth;
      let newCount;
      if (width < 600) {
        newCount = 2;
      } else if (width < 900) {
        newCount = 3;
      } else {
        newCount = 4;
      }
      
      if (newCount !== this.columnCount) {
        this.columnCount = newCount;
        this.columnHeights = new Array(this.columnCount).fill(0);
        this.mediaFiles.forEach(f => {
          f.columnIndex = undefined;
          this.assignToColumn(f);
        });
      }
    },

    getShortestColumn() {
      let minIndex = 0;
      let minHeight = this.columnHeights[0];
      for (let i = 1; i < this.columnCount; i++) {
        if (this.columnHeights[i] < minHeight) {
          minHeight = this.columnHeights[i];
          minIndex = i;
        }
      }
      return minIndex;
    },

    assignToColumn(file, height = 200) {
      const colIndex = this.getShortestColumn();
      file.columnIndex = colIndex;
      this.columnHeights[colIndex] += height;
      // 音频和其他文件直接标记为已加载（没有 load 事件）
      if (this.isAudio(file) || (!this.isImage(file) && !this.isVideo(file))) {
        file.loaded = true;
      }
    },

    onImageLoad(event, file) {
      const img = event.target;
      const ratio = img.naturalHeight / img.naturalWidth;
      const height = 280 * ratio;
      if (file.columnIndex === undefined) {
        this.assignToColumn(file, height);
      }
      file.loaded = true;
    },

    onVideoLoad(event, file) {
      const video = event.target;
      const ratio = video.videoHeight / video.videoWidth;
      const height = 280 * ratio;
      if (file.columnIndex === undefined) {
        this.assignToColumn(file, height);
      }
      file.loaded = true;
    },

    setupIntersectionObserver() {
      this.observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (entry.isIntersecting && this.hasMore && !this.loading) {
            this.loadMore();
          }
        },
        { rootMargin: '200px' }
      );
    },

    observeLoadTrigger() {
      this.$nextTick(() => {
        if (this.$refs.loadTrigger && this.observer) {
          this.observer.observe(this.$refs.loadTrigger);
        }
      });
    },

    async initFromRoute() {
      const dirParam = this.$route.params.dir || '';
      const dirPath = Array.isArray(dirParam) ? dirParam.join('/') : dirParam;
      
      // 支持根目录访问（dirPath 可以为空）
      const parts = dirPath.split('/').filter(Boolean);
      this.rootDir = parts[0] || '';
      this.currentPath = dirPath;
      this.files = [];
      this.hasMore = true;
      this.columnHeights = new Array(this.columnCount).fill(0);
      // 重置搜索状态
      this.searchInput = '';
      this.searchKeyword = '';
      this.filterType = '';
      this.currentStartIndex = 0;
      
      await this.loadFiles();
      this.observeLoadTrigger();
    },

    async loadFiles() {
      this.loading = true;
      this.error = null;
      this.canRetry = true;
      
      try {
        let url = `/api/public/list?dir=${encodeURIComponent(this.currentPath)}&start=${this.currentStartIndex}&count=${this.pageSize}`;
        if (this.searchKeyword) {
          url += `&search=${encodeURIComponent(this.searchKeyword)}`;
        }
        if (this.filterType) {
          url += `&type=${this.filterType}`;
        }
        const res = await axios.get(url);
        
        if (res.data.allowedDirs) {
          this.allowedDirs = res.data.allowedDirs;
        }
        
        const dirs = (res.data.directories || []).map(d => ({
          name: d,
          isFolder: true
        }));
        const files = (res.data.files || []).map(f => ({
          name: f.name,
          isFolder: false,
          metadata: f.metadata,
          columnIndex: undefined
        }));
        
        files.forEach(f => this.assignToColumn(f));
        
        this.files = [...dirs, ...files];
        this.totalCount = res.data.totalCount || this.files.length;
        this.hasMore = (this.currentStartIndex + this.mediaFiles.length) < this.totalCount;
      } catch (err) {
        if (err.response?.status === 403) {
          const msg = err.response?.data?.error || '';
          if (msg.includes('disabled')) {
            this.error = '公开浏览功能未启用';
          } else if (msg.includes('not allowed') || msg.includes('No public')) {
            this.error = '该目录不允许公开访问';
          } else {
            this.error = '访问被拒绝';
          }
          this.canRetry = false;
        } else {
          this.error = '加载失败，请重试';
        }
      } finally {
        this.loading = false;
      }
    },

    async loadMore() {
      if (this.loading || !this.hasMore) return;
      this.loading = true;
      try {
        const start = this.currentStartIndex + this.mediaFiles.length;
        let url = `/api/public/list?dir=${encodeURIComponent(this.currentPath)}&start=${start}&count=${this.pageSize}`;
        if (this.searchKeyword) {
          url += `&search=${encodeURIComponent(this.searchKeyword)}`;
        }
        if (this.filterType) {
          url += `&type=${this.filterType}`;
        }
        const res = await axios.get(url);
        const moreFiles = (res.data.files || []).map(f => ({
          name: f.name,
          isFolder: false,
          metadata: f.metadata,
          columnIndex: undefined
        }));
        
        moreFiles.forEach(f => this.assignToColumn(f));
        this.files.push(...moreFiles);
        this.hasMore = (this.currentStartIndex + this.mediaFiles.length) < this.totalCount;
      } catch (err) {
        console.error('加载更多失败', err);
      } finally {
        this.loading = false;
      }
    },

    enterFolder(folderPath) {
      const newPath = folderPath.replace(/\/+$/, '');
      this.$router.push(`/browse/${newPath}`);
    },

    goToRoot() {
      this.$router.push(`/browse/${this.rootDir}`);
    },

    goToPath(index) {
      const parts = this.pathParts.slice(0, index + 1);
      const newPath = this.rootDir + (parts.length ? '/' + parts.join('/') : '');
      this.$router.push(`/browse/${newPath}`);
    },

    getFolderName(path) {
      return path.split('/').filter(Boolean).pop() || path;
    },

    getFileUrl(name) {
      return `${window.location.origin}/file/${encodeURI(name)}`;
    },

    isImage(file) {
      const ext = file.name.split('.').pop().toLowerCase();
      return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif'].includes(ext);
    },

    isVideo(file) {
      const ext = file.name.split('.').pop().toLowerCase();
      // 浏览器原生支持的视频格式 + 部分浏览器支持的格式
      return ['mp4', 'webm', 'ogg', 'mov', 'm4v', 'mkv', 'avi', '3gp', 'mpeg', 'mpg'].includes(ext);
    },

    isAudio(file) {
      const ext = file.name.split('.').pop().toLowerCase();
      return ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma', 'ape', 'opus'].includes(ext);
    },

    getFileName(name) {
      return name.split('/').pop();
    },

    handleImageError(e) {
      const img = e.target;
      const retryCount = parseInt(img.dataset.retryCount || '0');
      const maxRetries = 3;
      
      if (retryCount < maxRetries) {
        // 重试：添加时间戳避免缓存
        img.dataset.retryCount = retryCount + 1;
        const originalSrc = img.src.split('?_retry=')[0];
        setTimeout(() => {
          img.src = originalSrc + '?_retry=' + Date.now();
        }, 500 * (retryCount + 1));
      } else {
        // 重试次数用完，隐藏图片
        img.style.display = 'none';
      }
    },

    copyLink(name) {
      const url = this.getFileUrl(name);
      navigator.clipboard?.writeText(url).then(() => {
        this.showToast('已复制');
      }).catch(() => {
        const input = document.createElement('input');
        input.value = url;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        this.showToast('已复制');
      });
    },

    showToast(msg) {
      const existing = document.querySelector('.copy-toast');
      if (existing) existing.remove();
      
      const toast = document.createElement('div');
      toast.className = 'copy-toast';
      toast.textContent = msg;
      document.body.appendChild(toast);
      
      setTimeout(() => toast.classList.add('show'), 10);
      setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
      }, 1500);
    },

    downloadFile(name) {
      const link = document.createElement('a');
      link.href = this.getFileUrl(name);
      link.download = name.split('/').pop();
      link.click();
    },

    openPreview(file) {
      if (file.isFolder) return;
      // 打开预览前先硬停全站（防止瀑布流 hover video 或旧实例残留）
      hardStopAll(null);
      
      const mediaIndex = this.mediaFiles.findIndex(f => f.name === file.name);
      if (mediaIndex >= 0) {
        this.previewIndex = mediaIndex;
        this.previewVisible = true;
        this.imageRotation = 0;
        this.imageScale = 1;
        this.imageTx = 0;
        this.imageTy = 0;
        this.gestureLocked = false;
        document.body.style.overflow = 'hidden';
        this.$nextTick(() => {
          this.viewportW = this.$refs.mobileViewport?.getBoundingClientRect().width || window.innerWidth;
        });
      }
    },

    closePreview() {
      // 关闭预览先硬停全站，再关弹窗
      hardStopAll(null);
      this.previewVisible = false;
      this.imageRotation = 0;
      this.imageScale = 1;
      this.imageTx = 0;
      this.imageTy = 0;
      this.gestureLocked = false;
      document.body.style.overflow = '';
    },

    prevImage() {
      // 切换前硬停全站
      hardStopAll(null);
      if (this.previewIndex > 0) {
        this.previewIndex--;
        this.imageRotation = 0;
        this.imageScale = 1;
        this.imageTx = 0;
        this.imageTy = 0;
      }
    },

    nextImage() {
      // 切换前硬停全站
      hardStopAll(null);
      if (this.previewIndex < this.mediaFiles.length - 1) {
        this.previewIndex++;
        this.imageRotation = 0;
        this.imageScale = 1;
        this.imageTx = 0;
        this.imageTy = 0;
      }
    },

    rotateImage() {
      // 持续累加旋转角度，不重置，这样动画永远是顺时针
      // 0 → 90 → 180 → 270 → 360 → 450 → ...
      this.imageRotation += 90;
    },

    // 桌面端滚轮缩放
    handleWheel(e) {
      // 只对图片生效
      if (!this.currentPreviewFile || !this.isImage(this.currentPreviewFile)) return;
      
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      let newScale = this.imageScale + delta;
      
      // 限制缩放范围 0.5 ~ 4
      newScale = Math.max(0.5, Math.min(4, newScale));
      this.imageScale = newScale;
      
      // 缩放到1以下时重置位移
      if (newScale <= 1) {
        this.imageTx = 0;
        this.imageTy = 0;
      }
    },

    // 桌面端鼠标拖拽：开始
    onImageMouseDown(e) {
      // 只有放大时才能拖拽
      if (this.imageScale <= 1) return;
      
      e.preventDefault();
      this.imageDragging = true;
      this.imageDragStart = { x: e.clientX, y: e.clientY };
      this.imageStartTx = this.imageTx;
      this.imageStartTy = this.imageTy;
    },

    // 桌面端鼠标拖拽：移动
    onImageMouseMove(e) {
      if (!this.imageDragging) return;
      
      const dx = e.clientX - this.imageDragStart.x;
      const dy = e.clientY - this.imageDragStart.y;
      
      this.imageTx = this.imageStartTx + dx;
      this.imageTy = this.imageStartTy + dy;
    },

    // 桌面端鼠标拖拽：结束
    onImageMouseUp() {
      this.imageDragging = false;
    },

    // 手机端滑动：开始
    onSwipeStart(e) {
      if (this.gestureLocked) return;
      if (this.swipeAnimating) return;
      
      const t = e.touches[0];
      this.swipeStartX = t.clientX;
      this.swipeStartY = t.clientY;
      this.swipeStartT = performance.now();
      this.swipeX = 0;
      this.swipeActive = false;
      
      this.viewportW = this.$refs.mobileViewport?.getBoundingClientRect().width || window.innerWidth;
    },

    // 手机端滑动：移动
    onSwipeMove(e) {
      if (this.gestureLocked) return;
      if (this.swipeAnimating) return;
      
      const t = e.touches[0];
      const dx = t.clientX - this.swipeStartX;
      const dy = t.clientY - this.swipeStartY;
      
      if (!this.swipeActive) {
        if (Math.abs(dx) < 8) return;
        if (Math.abs(dx) <= Math.abs(dy)) return;
        this.swipeActive = true;
      }
      
      e.preventDefault();
      
      let x = dx;
      // 边界阻尼：用 rubberBand 代替线性 *0.3
      if (this.previewIndex === 0 && x > 0) {
        x = this.rubberBand(x, this.viewportW, 0.55);
      } else if (this.previewIndex === this.mediaFiles.length - 1 && x < 0) {
        x = -this.rubberBand(-x, this.viewportW, 0.55);
      }
      
      this.swipeX = x;
    },

    // 手机端滑动：结束
    onSwipeEnd() {
      if (this.gestureLocked) return;
      if (this.swipeAnimating) return;
      
      if (!this.swipeActive) {
        this.swipeX = 0;
        return;
      }
      
      const dt = Math.max(1, performance.now() - this.swipeStartT);
      const vx = this.swipeX / dt;
      const threshold = this.viewportW * 0.2;
      
      let dir = 0;
      if (this.swipeX <= -threshold || vx <= -0.8) dir = +1;
      if (this.swipeX >= threshold || vx >= 0.8) dir = -1;
      
      if ((dir === -1 && this.previewIndex === 0) ||
          (dir === +1 && this.previewIndex === this.mediaFiles.length - 1)) {
        dir = 0;
      }
      
      this.swipeDir = dir;
      this.swipeAnimating = true;
      
      if (dir === +1) this.swipeX = -this.viewportW;
      else if (dir === -1) this.swipeX = +this.viewportW;
      else this.swipeX = 0;
    },

    onSwipeTransitionEnd() {
      if (!this.swipeAnimating) return;
      
      if (this.swipeDir === +1) this.previewIndex++;
      if (this.swipeDir === -1) this.previewIndex--;
      
      this.swipeAnimating = false;
      this.swipeDir = 0;
      this.swipeX = 0;
    },

    // iOS 风格橡皮筋阻尼函数
    rubberBand(distance, dimension, constant = 0.55) {
      return (distance * dimension * constant) / (dimension + constant * distance);
    },

    // 放大状态下边界滑动翻页（带动画）
    onEdgeSwipe(dir) {
      // dir: +1 下一页, -1 上一页
      if ((dir === -1 && this.previewIndex === 0) ||
          (dir === +1 && this.previewIndex === this.mediaFiles.length - 1)) {
        return;
      }
      
      // 触发轮播动画
      this.swipeDir = dir;
      this.swipeAnimating = true;
      
      if (dir === +1) this.swipeX = -this.viewportW;
      else if (dir === -1) this.swipeX = +this.viewportW;
    },

    // ========== 音频滑动切换 ==========
    // 音频滑动开始
    onAudioSwipeStart(e) {
      const t = e.touches[0];
      this.audioSwipeStartX = t.clientX;
      this.audioSwipeStartT = performance.now();
      this.audioSwipeActive = false;
    },

    // 音频滑动移动
    onAudioSwipeMove(e) {
      if (!this.audioSwipeStartX) return;
      const t = e.touches[0];
      const dx = t.clientX - this.audioSwipeStartX;
      // 水平滑动超过 30px 才激活
      if (Math.abs(dx) > 30) {
        this.audioSwipeActive = true;
      }
    },

    // 音频滑动结束：切换上一首/下一首
    onAudioSwipeEnd(e) {
      if (!this.audioSwipeActive) {
        this.audioSwipeStartX = 0;
        return;
      }
      
      const t = e.changedTouches[0];
      const dx = t.clientX - this.audioSwipeStartX;
      const dt = Math.max(1, performance.now() - this.audioSwipeStartT);
      const vx = dx / dt;
      
      // 滑动距离超过 80px 或速度超过 0.5 触发切换
      const threshold = 80;
      if (dx > threshold || vx > 0.5) {
        // 右滑 → 上一首
        this.prevImage();
      } else if (dx < -threshold || vx < -0.5) {
        // 左滑 → 下一首
        this.nextImage();
      }
      
      this.audioSwipeStartX = 0;
      this.audioSwipeActive = false;
    },

    // 桌面端视频播放时，硬停其他所有媒体
    onDesktopVideoPlay(e) {
      hardStopAll(e.target);
    },

    // 手机端媒体播放时，硬停其他所有媒体
    onMobileMediaPlay(e) {
      hardStopAll(e.target);
    },

    // 音频播放结束：顺序播放模式下切换下一首
    onAudioEnded(action) {
      if (action === 'next') {
        // 顺序播放：切换到下一首
        if (this.previewIndex < this.mediaFiles.length - 1) {
          this.previewIndex++;
          // 等待 DOM 更新后自动播放下一首
          this.$nextTick(() => {
            setTimeout(() => {
              const audioRef = this.isMobile ? this.$refs.mobileAudio : this.$refs.desktopAudio;
              if (audioRef?.player) {
                audioRef.player.play();
              }
            }, 100);
          });
        }
      }
    }
  }
};
</script>


<style scoped>
.public-browse {
  min-height: 100vh;
  background: #0a0a0a;
  color: #fff;
}

.header {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: rgba(15, 15, 15, 0.95);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid #1a1a1a;
  position: relative;
}

.header-left {
  flex: 0 0 auto;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-right {
  flex: 0 0 auto;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 10px;
}

/* 搜索框：默认只显示放大镜图标 */
.search-box {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.1);
  border-radius: 50%;
  width: 28px;
  height: 28px;
  padding: 0;
  transition: all 0.3s ease;
  cursor: pointer;
}

.search-box .search-icon {
  color: rgba(255,255,255,0.8);
  display: flex;
  align-items: center;
  justify-content: center;
}

.search-box .search-icon svg {
  width: 14px;
  height: 14px;
}

/* 搜索框展开状态 */
.search-box.expanded {
  width: auto;
  min-width: 160px;
  border-radius: 14px;
  padding: 4px 10px;
  background: rgba(30, 30, 30, 0.98);
  box-shadow: 0 2px 12px rgba(0,0,0,0.3);
}

.search-box.expanded .search-icon svg {
  width: 12px;
  height: 12px;
}

.search-box.expanded .search-input {
  width: 110px;
  font-size: 12px;
}

.search-box:focus-within {
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.5);
}

.search-input {
  background: transparent;
  border: none;
  outline: none;
  color: #fff;
  font-size: 12px;
  transition: width 0.3s;
}

.search-input::placeholder {
  color: rgba(255,255,255,0.5);
  font-size: 11px;
}

/* 主题切换按钮对齐 */
.theme-toggle-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border-radius: 8px;
  transition: background 0.2s;
}

.theme-toggle-btn:hover {
  background: rgba(255, 255, 255, 0.1);
}

/* 手机端搜索框更小 */
@media (max-width: 600px) {
  .header-right {
    gap: 8px;
  }
  
  .search-box {
    width: 26px;
    height: 26px;
  }
  
  .search-box .search-icon svg {
    width: 12px;
    height: 12px;
  }
  
  .search-box.expanded {
    min-width: 140px;
    padding: 3px 8px;
  }
  
  .search-box.expanded .search-input {
    width: 90px;
    font-size: 11px;
  }
  
  .search-box.expanded .search-icon svg {
    width: 11px;
    height: 11px;
  }
}

.header-center {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  z-index: 0;
}

.logo {
  font-size: 20px;
  font-weight: 600;
  color: #fff;
  text-decoration: none;
  cursor: pointer;
  transition: opacity 0.2s;
}

.logo:hover {
  opacity: 0.8;
}

.breadcrumb {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
}

.breadcrumb-item {
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
  color: #ccc;
}

.breadcrumb-item:hover {
  background: #252525;
  color: #fff;
}

.breadcrumb-sep {
  color: #444;
}

.file-count {
  color: #666;
  font-size: 14px;
}

.loading-container, .error-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
  color: #666;
}

.error-credit {
  margin-top: 40px;
  text-align: center;
  color: rgba(255, 255, 255, 0.4);
  font-size: 14px;
}

.error-credit p {
  margin-bottom: 12px;
}

.error-credit-links {
  display: flex;
  gap: 24px;
  justify-content: center;
}

.error-credit-links a {
  display: flex;
  align-items: center;
  gap: 6px;
  color: rgba(255, 255, 255, 0.5);
  text-decoration: none;
  transition: color 0.2s;
}

.error-credit-links a:hover {
  color: #3b82f6;
}

.loading-spinner {
  width: 48px;
  height: 48px;
  border: 3px solid #222;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.loading-spinner-small {
  width: 24px;
  height: 24px;
  border: 2px solid #222;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.retry-btn {
  margin-top: 20px;
  padding: 10px 32px;
  background: #3b82f6;
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.2s;
}

.retry-btn:hover {
  background: #2563eb;
}

.gallery-container {
  padding: 8px;
}

@media (min-width: 1200px) {
  .gallery-container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 24px;
  }
}

.folders-section {
  margin-bottom: 24px;
}

.folders-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 16px;
}

.folder-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  background: #141414;
  border-radius: 12px;
  border: 1px solid #1a1a1a;
  cursor: pointer;
  transition: all 0.2s;
}

.folder-card:hover {
  background: #1a1a1a;
  border-color: #333;
  transform: translateY(-2px);
}

.folder-icon {
  width: 48px;
  height: 48px;
  margin-bottom: 12px;
  color: #555;
}

.folder-icon svg {
  width: 100%;
  height: 100%;
}

.folder-name {
  font-size: 14px;
  color: #999;
  text-align: center;
  word-break: break-all;
}

.waterfall {
  display: flex;
  gap: 16px;
}

.waterfall-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.waterfall-item {
  cursor: pointer;
}

.image-wrapper {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  background: #141414;
  border: 1px solid #1a1a1a;
  min-height: 180px;
}

.image-wrapper::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, #141414 25%, #1a1a1a 50%, #141414 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  z-index: 1;
  pointer-events: none;
}

.image-wrapper.loaded::before {
  display: none;
}

.image-wrapper.loaded {
  min-height: auto;
}

.image-wrapper img, .image-wrapper video {
  width: 100%;
  display: block;
  position: relative;
  z-index: 2;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.image-wrapper:hover {
  border-color: #333;
}

.overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(transparent 50%, rgba(0,0,0,0.85));
  opacity: 0;
  transition: opacity 0.2s;
  display: flex;
  align-items: flex-end;
  justify-content: flex-end;
  padding: 12px;
  z-index: 10;
}

.image-wrapper:hover .overlay {
  opacity: 1;
}

.file-placeholder {
  width: 100%;
  height: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: #141414;
  color: #555;
  gap: 12px;
  padding: 16px;
  box-sizing: border-box;
}

.file-placeholder svg {
  width: 48px;
  height: 48px;
}

.file-name {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  text-align: center;
  word-break: break-all;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.audio-placeholder {
  width: 100%;
  height: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  gap: 12px;
  padding: 16px;
  box-sizing: border-box;
}

.audio-icon {
  width: 48px;
  height: 48px;
  color: rgba(255, 255, 255, 0.6);
}

.audio-name {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  text-align: center;
  word-break: break-all;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.overlay-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 50%;
  background: rgba(255,255,255,0.08);
  backdrop-filter: blur(8px);
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255,255,255,0.6);
}

.action-btn svg {
  width: 16px;
  height: 16px;
}

.action-btn:hover {
  background: rgba(255,255,255,0.2);
  color: #fff;
  transform: scale(1.1);
}

.load-trigger {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 48px;
  min-height: 100px;
}

/* 浮动页码指示器 */
.floating-page-indicator {
  position: fixed;
  bottom: 24px;
  right: 24px;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  color: rgba(255, 255, 255, 0.85);
  padding: 6px 12px;
  border-radius: 16px;
  font-size: 12px;
  z-index: 50;
  pointer-events: none;
  user-select: none;
  transition: opacity 0.3s;
}

@media (max-width: 600px) {
  .floating-page-indicator {
    bottom: 16px;
    right: 16px;
    padding: 4px 10px;
    font-size: 11px;
    border-radius: 12px;
  }
}

.loading-more {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #666;
  font-size: 14px;
}

.no-more {
  color: #444;
  font-size: 14px;
}

.credit-link {
  display: block;
  margin-top: 8px;
  color: #555;
  font-size: 12px;
  text-decoration: none;
  transition: color 0.2s;
  text-align: center;
}

.credit-link:hover {
  color: #888;
}

/* 预览弹窗 */
.preview-modal {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0,0,0,0.97);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.preview-content {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 80px;
  box-sizing: border-box;
  overflow: hidden;
}

/* 手机端预览容器 */
.preview-content-mobile {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 0;
  position: absolute;
  top: 0;
  left: 0;
}

/* 手机端视频：完全原生，占满屏幕 */
.mobile-video-native {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
}

/* 手机端音频容器 */
.mobile-audio-wrap {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  box-sizing: border-box;
}

.mobile-audio-wrap .swipe-hint {
  margin-top: 20px;
}

.swipe-hint {
  font-size: 12px;
  color: rgba(255,255,255,0.4);
}

/* 手机端其他文件预览 */
.other-file-preview {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.6);
  gap: 16px;
}

.other-file-preview svg {
  width: 64px;
  height: 64px;
}

.other-file-preview .file-name {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
  text-align: center;
  padding: 0 20px;
  word-break: break-all;
}

.swipe-viewport {
  width: 100%;
  height: 100%;
  overflow: hidden;
  position: relative;
}

.swipe-track {
  width: 300%;
  height: 100%;
  display: flex;
  will-change: transform;
}

.swipe-slide {
  width: 33.333%;
  flex-shrink: 0;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-image, .preview-video {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  user-select: none;
  -webkit-user-drag: none;
}

.preview-close {
  position: fixed;
  top: 20px;
  right: 20px;
  background: rgba(255,255,255,0.1);
  border: none;
  color: #fff;
  cursor: pointer;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
  z-index: 1010;
}

.preview-close:hover {
  background: rgba(255,255,255,0.2);
}

.preview-close svg {
  width: 28px;
  height: 28px;
}

.page-indicator {
  position: fixed;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0,0,0,0.6);
  color: rgba(255,255,255,0.8);
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 14px;
  z-index: 1010;
}

.preview-prev, .preview-next {
  position: fixed;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(255,255,255,0.1);
  border: none;
  color: #fff;
  padding: 16px;
  cursor: pointer;
  border-radius: 50%;
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
  z-index: 1010;
}

.preview-prev:hover, .preview-next:hover {
  background: rgba(255,255,255,0.2);
}

.preview-prev svg, .preview-next svg {
  width: 32px;
  height: 32px;
}

.preview-prev { left: 20px; }
.preview-next { right: 20px; }

.rotate-btn {
  position: fixed;
  bottom: 30px;
  right: 20px;
  background: rgba(255,255,255,0.1);
  border: none;
  color: #fff;
  cursor: pointer;
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
  z-index: 1010;
}

.rotate-btn:hover {
  background: rgba(255,255,255,0.2);
}

.rotate-btn svg {
  width: 24px;
  height: 24px;
}

/* 手机端响应式调整 */
@media (max-width: 768px) {
  .page-indicator {
    bottom: 40px;
  }
}

/* 平板端 */
@media (max-width: 1199px) and (min-width: 601px) {
  .gallery-container {
    padding: 12px;
  }
  
  .waterfall {
    gap: 10px;
  }
  
  .waterfall-column {
    gap: 10px;
  }
  
  .image-wrapper {
    border-radius: 8px;
  }
}

/* 手机端 */
@media (max-width: 600px) {
  .header {
    padding: 10px 12px;
  }
  
  .header-left .logo {
    font-size: 16px;
  }
  
  .breadcrumb {
    font-size: 12px;
  }
  
  .breadcrumb-item {
    padding: 4px 8px;
  }
  
  .file-count {
    font-size: 12px;
  }
  
  .gallery-container {
    padding: 6px;
  }
  
  .waterfall {
    gap: 6px;
  }
  
  .waterfall-column {
    gap: 6px;
  }
  
  .image-wrapper {
    border-radius: 6px;
    min-height: 120px;
  }
  
  .folders-section {
    margin-bottom: 12px;
  }
  
  .folders-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }
  
  .folder-card {
    padding: 16px 12px;
    border-radius: 8px;
  }
  
  .folder-icon {
    width: 36px;
    height: 36px;
    margin-bottom: 8px;
  }
  
  .folder-name {
    font-size: 12px;
  }
  
  .load-trigger {
    padding: 24px;
    min-height: 60px;
  }
}

/* Toast 提示 */
:global(.copy-toast) {
  position: fixed;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%) translateY(20px);
  background: rgba(0,0,0,0.8);
  color: #fff;
  padding: 10px 24px;
  border-radius: 20px;
  font-size: 14px;
  opacity: 0;
  transition: all 0.3s ease;
  z-index: 9999;
  pointer-events: none;
}

:global(.copy-toast.show) {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

/* 白天模式（跟随全局 dark class） */
:root:not(.dark) .public-browse {
  background: #f5f5f5;
  color: #333;
}

:root:not(.dark) .header {
  background: rgba(255, 255, 255, 0.95);
  border-bottom-color: #e0e0e0;
}

:root:not(.dark) .logo {
  color: #333;
}

:root:not(.dark) .breadcrumb-item {
  color: #666;
}

:root:not(.dark) .breadcrumb-item:hover {
  background: #e8e8e8;
  color: #333;
}

:root:not(.dark) .breadcrumb-sep {
  color: #ccc;
}

:root:not(.dark) .file-count {
  color: #999;
}

:root:not(.dark) .search-box {
  background: rgba(0,0,0,0.08);
}

:root:not(.dark) .search-box.expanded {
  background: rgba(255, 255, 255, 0.98);
  box-shadow: 0 4px 20px rgba(0,0,0,0.15);
}

:root:not(.dark) .search-box.expanded .search-input {
  color: #333;
}

:root:not(.dark) .search-box.expanded .search-input::placeholder {
  color: rgba(0,0,0,0.4);
}

:root:not(.dark) .search-box .search-icon {
  color: rgba(0,0,0,0.6);
}

:root:not(.dark) .search-box .search-icon:hover {
  color: #333;
}

:root:not(.dark) .loading-container,
:root:not(.dark) .error-container {
  color: #999;
}

:root:not(.dark) .error-credit {
  color: rgba(0, 0, 0, 0.4);
}

:root:not(.dark) .error-credit-links a {
  color: rgba(0, 0, 0, 0.5);
}

:root:not(.dark) .loading-spinner {
  border-color: #ddd;
  border-top-color: #3b82f6;
}

:root:not(.dark) .loading-spinner-small {
  border-color: #ddd;
  border-top-color: #3b82f6;
}

:root:not(.dark) .folder-card {
  background: #fff;
  border-color: #e0e0e0;
}

:root:not(.dark) .folder-card:hover {
  background: #fafafa;
  border-color: #ccc;
}

:root:not(.dark) .folder-icon {
  color: #999;
}

:root:not(.dark) .folder-name {
  color: #666;
}

:root:not(.dark) .image-wrapper {
  background: #fff;
  border-color: #e0e0e0;
}

:root:not(.dark) .image-wrapper::before {
  background: linear-gradient(90deg, #f5f5f5 25%, #fff 50%, #f5f5f5 75%);
}

:root:not(.dark) .image-wrapper:hover {
  border-color: #ccc;
}

:root:not(.dark) .file-placeholder {
  background: #f5f5f5;
  color: #999;
}

:root:not(.dark) .file-name {
  color: rgba(0, 0, 0, 0.6);
}

:root:not(.dark) .audio-placeholder {
  background: linear-gradient(135deg, #e8f4f8 0%, #d4e5f7 100%);
}

:root:not(.dark) .audio-icon {
  color: rgba(0, 0, 0, 0.4);
}

:root:not(.dark) .audio-name {
  color: rgba(0, 0, 0, 0.6);
}

:root:not(.dark) .no-more {
  color: #bbb;
}

:root:not(.dark) .credit-link {
  color: #aaa;
}

:root:not(.dark) .credit-link:hover {
  color: #666;
}

:root:not(.dark) .loading-more {
  color: #999;
}

:root:not(.dark) .theme-toggle-btn:hover {
  background: rgba(0, 0, 0, 0.08);
}

:root:not(.dark) .floating-page-indicator {
  background: rgba(255, 255, 255, 0.85);
  color: rgba(0, 0, 0, 0.7);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}
</style>
