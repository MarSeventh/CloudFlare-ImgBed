<template>
  <div
    class="tm-viewport"
    ref="viewport"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @dblclick.prevent="onDblClick"
  >
    <!-- 图片 -->
    <img
      v-if="isImage"
      class="tm-media"
      :src="src"
      draggable="false"
      :style="mediaStyle"
      @load="onLoad"
    />
    
    <!-- 视频：使用 Plyr -->
    <div v-else-if="isVideo && isActive" class="tm-video-wrap" @pointerdown.stop>
      <video
        ref="videoEl"
        class="plyr-video"
        :src="src"
        playsinline
      ></video>
    </div>
    <div v-else-if="isVideo" class="video-placeholder">
      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
    </div>
    
    <!-- 音频：使用 Plyr -->
    <div v-else-if="isAudio && isActive" class="tm-audio-wrap" @pointerdown.stop>
      <div class="audio-cover">
        <img v-if="audioCover" :src="audioCover" class="cover-img" />
        <svg v-else class="audio-icon-large" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
        </svg>
      </div>
      <div class="audio-info">
        <div class="audio-title">{{ audioTitle }}</div>
        <div class="audio-artist" v-if="audioArtist">{{ audioArtist }}</div>
      </div>
      <audio ref="audioEl" class="plyr-audio" :src="src"></audio>
    </div>
    <div v-else-if="isAudio" class="audio-placeholder">
      <svg class="audio-icon-large" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
      </svg>
      <span class="audio-name">{{ audioTitle }}</span>
    </div>
  </div>
</template>

<script>
import Plyr from 'plyr';
import 'plyr/dist/plyr.css';
import { getAudioPlayMode, setAudioPlayMode } from '@/utils/mediaManager';

export default {
  name: "TransformMedia",
  props: {
    file: { type: Object, required: true },
    src: { type: String, required: true },
    isImage: { type: Boolean, default: true },
    isVideo: { type: Boolean, default: false },
    isAudio: { type: Boolean, default: false },
    isActive: { type: Boolean, default: false },
  },
  data() {
    return {
      // 手势状态
      pointers: new Map(),
      scale: 1,
      rotation: 0,
      rotatePreview: 0,
      tx: 0,
      ty: 0,
      naturalWidth: 0,
      naturalHeight: 0,
      startScale: 1,
      startRotation: 0,
      startTx: 0,
      startTy: 0,
      startCenter: null,
      startDist: 0,
      startAngle: 0,
      dragging: false,
      dragStart: null,
      viewportRect: null,
      minScale: 1,
      maxScale: 4,
      gestureMode: null,
      edgeOverflow: 0,
      edgeDir: 0,
      // Plyr 实例
      player: null,
      // 音频信息
      audioCover: null,
      audioTitle: '',
      audioArtist: '',
      // 菜单是否已添加
      menuAdded: false,
    };
  },
  computed: {
    isActiveTransform() {
      return this.scale > 1.001 || this.pointers.size >= 2 || this.dragging;
    },
    displayRotation() {
      return this.rotation + this.rotatePreview;
    },
    rotateShrink() {
      const p = Math.min(1, Math.abs(this.rotatePreview) / 90);
      const k = Math.sin(Math.PI * p);
      return 1 - 0.12 * k;
    },
    mediaStyle() {
      const finalScale = this.scale * this.rotateShrink;
      const inGesture = this.pointers.size > 0;
      return {
        transform: `translate3d(${this.tx}px, ${this.ty}px, 0) scale(${finalScale}) rotate(${this.displayRotation}deg)`,
        transition: inGesture ? "none" : "transform 0.25s ease",
        transformOrigin: "center center",
      };
    },
  },
  watch: {
    isActiveTransform(v) {
      this.$emit(v ? "lock" : "unlock");
    },
    isActive(active) {
      if (!active) {
        this.destroyPlayer();
      } else {
        this.$nextTick(() => this.initPlayer());
      }
    },
  },
  mounted() {
    if (this.isAudio) {
      this.initAudioInfo();
    }
    if (this.isActive) {
      this.$nextTick(() => this.initPlayer());
    }
  },
  beforeUnmount() {
    this.destroyPlayer();
    if (this.audioCover) {
      URL.revokeObjectURL(this.audioCover);
      this.audioCover = null;
    }
  },
  methods: {
    // ===== Plyr 播放器 =====
    initPlayer() {
      if (this.player) return;
      
      const el = this.$refs.videoEl || this.$refs.audioEl;
      if (!el) return;
      
      // 重置重试计数器
      this.retryCount = 0;
      this.maxRetries = 3;
      
      // 音频不需要全屏按钮
      const controls = this.isAudio
        ? ['play', 'progress', 'current-time', 'mute', 'volume']
        : ['play', 'progress', 'current-time', 'mute', 'volume', 'fullscreen'];
      
      this.player = new Plyr(el, {
        controls,
        autoplay: this.isVideo,
        resetOnEnd: true,
      });
      
      // 监听加载错误，自动重试
      el.addEventListener('error', () => {
        if (this.retryCount < this.maxRetries) {
          this.retryCount++;
          console.warn(`Media load failed, retrying (${this.retryCount}/${this.maxRetries})...`);
          setTimeout(() => {
            if (el && this.src && this.player) {
              const baseSrc = this.src.split('?_retry=')[0];
              const retrySrc = baseSrc + (baseSrc.includes('?') ? '&' : '?') + '_retry=' + Date.now();
              el.src = retrySrc;
              el.load();
            }
          }, 500 * this.retryCount);
        }
      });
      
      // 等待 Plyr ready 后添加自定义菜单
      this.player.on('ready', () => {
        this.tryAddCustomMenu();
      });
      
      // 备用方案：多次尝试
      this.scheduleMenuRetry();
      
      // 音频播放结束事件
      if (this.isAudio) {
        this.player.on('ended', this.onAudioEnded);
      }
    },
    
    // 多次尝试添加菜单
    scheduleMenuRetry() {
      const tryAdd = (attempt) => {
        if (attempt >= 5 || this.menuAdded) return;
        setTimeout(() => {
          if (!this.menuAdded) {
            this.tryAddCustomMenu();
            tryAdd(attempt + 1);
          }
        }, 200 * (attempt + 1));
      };
      tryAdd(0);
    },
    
    // 尝试添加自定义菜单
    tryAddCustomMenu() {
      if (this.menuAdded) return;
      if (!this.player?.elements?.controls) return;
      
      const controls = this.player.elements.controls;
      if (!controls || controls.querySelector('.plyr-custom-menu')) return;
      
      this.addCustomMenu(controls);
      this.menuAdded = true;
    },
    
    // 添加自定义三点菜单
    addCustomMenu(controls) {
      const currentMode = getAudioPlayMode();
      
      // 播放模式选项（仅音频）
      const playModeHtml = this.isAudio ? `
        <div class="plyr-menu-item plyr-menu-playmode">
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
            <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
          </svg>
          <span>播放模式</span>
          <svg class="arrow" viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
            <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
          </svg>
        </div>
        <div class="plyr-playmode-submenu">
          <div class="plyr-menu-item plyr-playmode-option ${currentMode === 'stop' ? 'active' : ''}" data-mode="stop">播完停止</div>
          <div class="plyr-menu-item plyr-playmode-option ${currentMode === 'sequence' ? 'active' : ''}" data-mode="sequence">顺序播放</div>
          <div class="plyr-menu-item plyr-playmode-option ${currentMode === 'loop' ? 'active' : ''}" data-mode="loop">单曲循环</div>
        </div>
      ` : '';
      
      // 创建菜单容器
      const menuContainer = document.createElement('div');
      menuContainer.className = 'plyr-custom-menu';
      menuContainer.innerHTML = `
        <button type="button" class="plyr__controls__item plyr__control plyr-menu-btn" aria-label="更多">
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
            <circle cx="12" cy="5" r="2"/>
            <circle cx="12" cy="12" r="2"/>
            <circle cx="12" cy="19" r="2"/>
          </svg>
        </button>
        <div class="plyr-menu-dropdown">
          <div class="plyr-menu-item" data-action="download">
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
              <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
            </svg>
            <span>下载</span>
          </div>
          <div class="plyr-menu-item plyr-menu-speed">
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
              <path d="M10 8v8l6-4-6-4zm1.5 4l2-1.33v2.67l-2-1.34z"/>
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/>
            </svg>
            <span>播放速度</span>
            <svg class="arrow" viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
              <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
            </svg>
          </div>
          <div class="plyr-speed-submenu">
            <div class="plyr-menu-item plyr-speed-option" data-speed="0.5">0.5x</div>
            <div class="plyr-menu-item plyr-speed-option" data-speed="0.75">0.75x</div>
            <div class="plyr-menu-item plyr-speed-option active" data-speed="1">正常</div>
            <div class="plyr-menu-item plyr-speed-option" data-speed="1.25">1.25x</div>
            <div class="plyr-menu-item plyr-speed-option" data-speed="1.5">1.5x</div>
            <div class="plyr-menu-item plyr-speed-option" data-speed="2">2x</div>
          </div>
          ${playModeHtml}
        </div>
      `;
      
      controls.appendChild(menuContainer);
      this.bindMenuEvents(menuContainer);
    },
    
    // 绑定菜单事件
    bindMenuEvents(menuContainer) {
      const menuBtn = menuContainer.querySelector('.plyr-menu-btn');
      const dropdown = menuContainer.querySelector('.plyr-menu-dropdown');
      const speedItem = menuContainer.querySelector('.plyr-menu-speed');
      const speedSubmenu = menuContainer.querySelector('.plyr-speed-submenu');
      const downloadItem = menuContainer.querySelector('[data-action="download"]');
      const playModeItem = menuContainer.querySelector('.plyr-menu-playmode');
      const playModeSubmenu = menuContainer.querySelector('.plyr-playmode-submenu');
      
      // 点击三点按钮切换菜单
      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('show');
        speedSubmenu.classList.remove('show');
        if (playModeSubmenu) playModeSubmenu.classList.remove('show');
      });
      
      // 下载
      downloadItem.addEventListener('click', () => {
        this.downloadMedia();
        dropdown.classList.remove('show');
      });
      
      // 播放速度子菜单
      speedItem.addEventListener('click', (e) => {
        e.stopPropagation();
        speedSubmenu.classList.toggle('show');
        if (playModeSubmenu) playModeSubmenu.classList.remove('show');
      });
      
      // 选择速度
      menuContainer.querySelectorAll('.plyr-speed-option').forEach(opt => {
        opt.addEventListener('click', () => {
          const speed = parseFloat(opt.dataset.speed);
          if (this.player?.media) {
            this.player.media.playbackRate = speed;
          }
          menuContainer.querySelectorAll('.plyr-speed-option').forEach(o => o.classList.remove('active'));
          opt.classList.add('active');
          dropdown.classList.remove('show');
          speedSubmenu.classList.remove('show');
        });
      });
      
      // 播放模式（仅音频）
      if (playModeItem && playModeSubmenu) {
        playModeItem.addEventListener('click', (e) => {
          e.stopPropagation();
          playModeSubmenu.classList.toggle('show');
          speedSubmenu.classList.remove('show');
        });
        
        menuContainer.querySelectorAll('.plyr-playmode-option').forEach(opt => {
          opt.addEventListener('click', () => {
            const mode = opt.dataset.mode;
            setAudioPlayMode(mode);
            menuContainer.querySelectorAll('.plyr-playmode-option').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            dropdown.classList.remove('show');
            playModeSubmenu.classList.remove('show');
          });
        });
      }
      
      // 点击外部关闭菜单
      document.addEventListener('click', () => {
        dropdown.classList.remove('show');
        speedSubmenu.classList.remove('show');
        if (playModeSubmenu) playModeSubmenu.classList.remove('show');
      });
    },
    
    // 下载媒体文件
    downloadMedia() {
      const link = document.createElement('a');
      link.href = this.src;
      link.download = this.file?.name?.split('/').pop() || 'download';
      link.click();
    },
    
    // 音频播放结束
    onAudioEnded() {
      const mode = getAudioPlayMode();
      if (mode === 'loop') {
        // 单曲循环
        if (this.player?.media) {
          this.player.media.currentTime = 0;
          this.player.play();
        }
      } else if (mode === 'sequence') {
        // 顺序播放：通知父组件
        this.$emit('audio-ended', 'next');
      }
      // stop 模式不做任何操作
    },
    
    destroyPlayer() {
      // 先获取原生媒体元素
      const mediaEl = this.$refs.videoEl || this.$refs.audioEl;
      
      // 销毁 Plyr 实例
      if (this.player) {
        try {
          this.player.pause();
          this.player.destroy();
        } catch (e) {}
        this.player = null;
      }
      
      // 彻底清理原生媒体元素（防止后台继续播放）
      if (mediaEl) {
        try {
          mediaEl.pause();
          mediaEl.currentTime = 0;
          mediaEl.src = '';
          mediaEl.load();
        } catch (e) {}
      }
    },
    
    // 供父组件调用的停止方法
    stopAndCleanMedia() {
      this.destroyPlayer();
    },

    // ===== 音频信息 =====
    initAudioInfo() {
      const fileName = this.file?.name || this.src;
      const name = fileName.split('/').pop().replace(/\.[^.]+$/, '');
      this.audioTitle = name;
      this.audioArtist = '';
      this.audioCover = null;
      if (this.isActive) {
        this.tryReadMetadata();
      }
    },

    async tryReadMetadata() {
      try {
        const response = await fetch(this.src);
        const blob = await response.blob();
        const arrayBuffer = await blob.slice(0, 128 * 1024).arrayBuffer();
        const dataView = new DataView(arrayBuffer);
        if (dataView.getUint8(0) === 0x49 && dataView.getUint8(1) === 0x44 && dataView.getUint8(2) === 0x33) {
          this.parseID3v2(dataView, arrayBuffer);
        }
      } catch (e) {}
    },

    parseID3v2(dataView, arrayBuffer) {
      const size = ((dataView.getUint8(6) & 0x7f) << 21) |
                   ((dataView.getUint8(7) & 0x7f) << 14) |
                   ((dataView.getUint8(8) & 0x7f) << 7) |
                   (dataView.getUint8(9) & 0x7f);
      let offset = 10;
      while (offset < Math.min(size + 10, arrayBuffer.byteLength - 10)) {
        const frameId = String.fromCharCode(
          dataView.getUint8(offset), dataView.getUint8(offset + 1),
          dataView.getUint8(offset + 2), dataView.getUint8(offset + 3)
        );
        if (frameId === '\0\0\0\0') break;
        const frameSize = (dataView.getUint8(offset + 4) << 24) |
                         (dataView.getUint8(offset + 5) << 16) |
                         (dataView.getUint8(offset + 6) << 8) |
                         dataView.getUint8(offset + 7);
        if (frameSize <= 0 || frameSize > arrayBuffer.byteLength) break;
        const frameData = new Uint8Array(arrayBuffer, offset + 10, Math.min(frameSize, arrayBuffer.byteLength - offset - 10));
        if (frameId === 'TIT2') this.audioTitle = this.decodeText(frameData) || this.audioTitle;
        else if (frameId === 'TPE1') this.audioArtist = this.decodeText(frameData);
        else if (frameId === 'APIC') this.extractCover(frameData);
        offset += 10 + frameSize;
      }
    },

    decodeText(data) {
      if (data.length < 2) return '';
      const encoding = data[0];
      const textData = data.slice(1);
      try {
        if (encoding === 0) return new TextDecoder('iso-8859-1').decode(textData).replace(/\0/g, '');
        if (encoding === 1) return new TextDecoder('utf-16').decode(textData).replace(/\0/g, '');
        if (encoding === 3) return new TextDecoder('utf-8').decode(textData).replace(/\0/g, '');
      } catch (e) {}
      return '';
    },

    extractCover(data) {
      try {
        let offset = 1;
        while (offset < data.length && data[offset] !== 0) offset++;
        offset += 2;
        while (offset < data.length && data[offset] !== 0) offset++;
        offset++;
        if (offset < data.length) {
          const imageData = data.slice(offset);
          const blob = new Blob([imageData], { type: 'image/jpeg' });
          this.audioCover = URL.createObjectURL(blob);
        }
      } catch (e) {}
    },

    // ===== 图片手势 =====
    onLoad(e) {
      const img = e.target;
      this.naturalWidth = img.naturalWidth;
      this.naturalHeight = img.naturalHeight;
    },

    reset() {
      this.scale = 1;
      this.rotation = 0;
      this.rotatePreview = 0;
      this.tx = 0;
      this.ty = 0;
      this.pointers.clear();
      this.dragging = false;
      this.edgeOverflow = 0;
      this.edgeDir = 0;
      this.$emit("unlock");
    },

    clamp(v, min, max) { return Math.max(min, Math.min(max, v)); },

    rubberBand(distance, dimension, constant = 0.55) {
      return (distance * dimension * constant) / (dimension + constant * distance);
    },

    getViewportRect() { return this.$refs.viewport?.getBoundingClientRect(); },

    getPanBounds() {
      const rect = this.$refs.viewport?.getBoundingClientRect();
      if (!rect) return { maxX: 0, maxY: 0, vw: 0, vh: 0 };
      const vw = rect.width, vh = rect.height;
      const img = this.$el.querySelector('img');
      let iw = img?.clientWidth || vw;
      let ih = img?.clientHeight || vh;
      const rot = this.rotation % 360;
      if (rot === 90 || rot === 270) [iw, ih] = [ih, iw];
      const sw = iw * this.scale;
      const sh = ih * this.scale;
      const maxX = Math.max(0, (sw - vw) / 2);
      const maxY = Math.max(0, (sh - vh) / 2);
      return { maxX, maxY, vw, vh };
    },

    applyBoundWithRubber(value, max, dimension) {
      if (value > max) return max + this.rubberBand(value - max, dimension, 0.55);
      if (value < -max) return -max - this.rubberBand(-max - value, dimension, 0.55);
      return value;
    },

    calcTwoPointer() {
      const sorted = Array.from(this.pointers.entries()).sort((a, b) => a[0] - b[0]);
      const p0 = sorted[0][1], p1 = sorted[1][1];
      const dx = p1.x - p0.x, dy = p1.y - p0.y;
      const dist = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx) * (180 / Math.PI);
      const center = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
      return { dist, angle, center };
    },

    normalizeAngle(deg) {
      deg = ((deg % 360) + 360) % 360;
      return deg > 180 ? deg - 360 : deg;
    },

    onPointerDown(e) {
      if (!this.isImage) return; // 只有图片支持手势
      e.currentTarget.setPointerCapture?.(e.pointerId);
      this.viewportRect = this.getViewportRect();
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 2) {
        const { dist, angle, center } = this.calcTwoPointer();
        this.startDist = dist;
        this.startAngle = angle;
        this.startCenter = center;
        this.startScale = this.scale;
        this.startRotation = this.rotation;
        this.startTx = this.tx;
        this.startTy = this.ty;
        this.dragging = false;
        this.gestureMode = null;
        this.rotatePreview = 0;
        return;
      }
      if (this.scale > 1.001) {
        this.dragging = true;
        this.dragStart = { x: e.clientX, y: e.clientY };
        this.startTx = this.tx;
        this.startTy = this.ty;
      }
    },

    onPointerMove(e) {
      if (!this.isImage) return;
      if (!this.pointers.has(e.pointerId)) return;
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 2) {
        e.preventDefault();
        const { dist, angle, center } = this.calcTwoPointer();
        const scaleFactor = dist / (this.startDist || dist);
        const scaleChange = Math.abs(scaleFactor - 1);
        const deltaAngle = this.normalizeAngle(angle - this.startAngle);
        const angleChange = Math.abs(deltaAngle);
        if (!this.gestureMode) {
          if (angleChange >= 8) this.gestureMode = 'rotate';
          else if (scaleChange >= 0.08) this.gestureMode = 'pinch';
          else return;
        }
        if (this.gestureMode === 'rotate') {
          this.scale = this.startScale;
          this.rotatePreview = this.clamp(deltaAngle, -90, 90);
          return;
        }
        if (this.gestureMode === 'pinch') {
          this.scale = this.clamp(this.startScale * scaleFactor, this.minScale, this.maxScale);
          this.rotatePreview = 0;
        }
        if (this.startCenter && this.viewportRect) {
          const cx0 = this.startCenter.x - this.viewportRect.left - this.viewportRect.width / 2;
          const cy0 = this.startCenter.y - this.viewportRect.top - this.viewportRect.height / 2;
          const cx1 = center.x - this.viewportRect.left - this.viewportRect.width / 2;
          const cy1 = center.y - this.viewportRect.top - this.viewportRect.height / 2;
          this.tx = this.startTx + (cx1 - cx0);
          this.ty = this.startTy + (cy1 - cy0);
        }
        return;
      }
      if (this.dragging && this.scale > 1.001) {
        e.preventDefault();
        const dx = e.clientX - this.dragStart.x;
        const dy = e.clientY - this.dragStart.y;
        const rawX = this.startTx + dx;
        const rawY = this.startTy + dy;
        const { maxX, maxY, vw, vh } = this.getPanBounds();
        let overflow = 0, dir = 0;
        if (rawX > maxX) { overflow = rawX - maxX; dir = -1; }
        else if (rawX < -maxX) { overflow = -maxX - rawX; dir = +1; }
        this.edgeOverflow = overflow;
        this.edgeDir = dir;
        this.tx = this.applyBoundWithRubber(rawX, maxX, vw);
        this.ty = this.applyBoundWithRubber(rawY, maxY, vh);
      }
    },

    onPointerUp(e) {
      if (!this.isImage) return;
      if (this.pointers.has(e.pointerId)) this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2 && this.gestureMode === 'rotate') {
        this.finishRotate();
        this.gestureMode = null;
      }
      if (this.pointers.size < 2) {
        this.startCenter = null;
        this.startDist = 0;
        this.startAngle = 0;
        this.gestureMode = null;
      }
      if (this.pointers.size === 0) {
        this.dragging = false;
        if (this.edgeOverflow > 60 && this.edgeDir !== 0) {
          const dir = this.edgeDir;
          this.reset();
          this.$emit('edge-swipe', dir);
          return;
        }
        this.edgeOverflow = 0;
        this.edgeDir = 0;
        if (this.scale <= 1.001) {
          this.scale = 1;
          this.tx = 0;
          this.ty = 0;
        } else {
          const { maxX, maxY } = this.getPanBounds();
          this.tx = Math.max(-maxX, Math.min(maxX, this.tx));
          this.ty = Math.max(-maxY, Math.min(maxY, this.ty));
        }
      }
    },

    finishRotate() {
      const d = this.rotatePreview;
      let target = 0;
      if (Math.abs(d) >= 30) target = d > 0 ? 90 : -90;
      const newRot = ((this.rotation + target) % 360 + 360) % 360;
      this.rotation = newRot;
      this.rotatePreview = 0;
      this.updateFillScale();
    },

    updateFillScale() {
      const rot = this.rotation % 360;
      const isRotated = (rot === 90 || rot === 270);
      if (isRotated) { this.scale = 2; this.tx = 0; this.ty = 0; }
      else { this.scale = 1; this.tx = 0; this.ty = 0; }
    },

    onDblClick() {
      if (!this.isImage) return;
      if (this.scale > 1.001) { this.scale = 1; this.tx = 0; this.ty = 0; }
      else { this.scale = 2; }
    },
  },
};
</script>

<style scoped>
.tm-viewport {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  touch-action: none;
  user-select: none;
}

.tm-media {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  -webkit-user-drag: none;
}

.tm-video-wrap {
  width: 100%;
  max-width: 800px;
  touch-action: auto;
}

.plyr-video {
  width: 100%;
}

.tm-audio-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 24px;
  width: 100%;
  max-width: 400px;
  touch-action: auto;
}

.plyr-audio {
  width: 100%;
}

.audio-cover {
  width: 200px;
  height: 200px;
  border-radius: 12px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.cover-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.audio-icon-large {
  width: 80px;
  height: 80px;
  color: rgba(255, 255, 255, 0.4);
}

.audio-info {
  text-align: center;
  width: 100%;
}

.audio-title {
  font-size: 18px;
  font-weight: 600;
  color: #fff;
  margin-bottom: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.audio-artist {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
}

.video-placeholder,
.audio-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: rgba(255, 255, 255, 0.4);
}

.video-placeholder svg {
  width: 80px;
  height: 80px;
}

.audio-placeholder .audio-name {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.6);
  text-align: center;
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>

<style>
/* Plyr 深色主题覆盖 */
.plyr {
  --plyr-color-main: #3b82f6;
}
.plyr--audio .plyr__controls {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 8px;
}

/* 自定义三点菜单 */
.plyr-custom-menu {
  position: relative;
  display: flex;
  align-items: center;
}

.plyr-menu-btn {
  background: none;
  border: none;
  cursor: pointer;
  padding: 8px;
  color: inherit;
  display: flex;
  align-items: center;
  justify-content: center;
}

.plyr-menu-btn:hover {
  opacity: 0.8;
}

.plyr-menu-dropdown {
  position: absolute;
  bottom: 100%;
  right: 0;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  min-width: 160px;
  display: none;
  z-index: 100;
  overflow: hidden;
  margin-bottom: 8px;
}

.plyr-menu-dropdown.show {
  display: block;
}

.plyr-menu-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  color: #333;
  font-size: 14px;
  transition: background 0.15s;
}

.plyr-menu-item:hover {
  background: #f5f5f5;
}

.plyr-menu-item svg {
  flex-shrink: 0;
}

.plyr-menu-item .arrow {
  margin-left: auto;
}

.plyr-speed-submenu,
.plyr-playmode-submenu {
  display: none;
  border-top: 1px solid #eee;
}

.plyr-speed-submenu.show,
.plyr-playmode-submenu.show {
  display: block;
}

.plyr-speed-option,
.plyr-playmode-option {
  padding-left: 32px;
  position: relative;
}

.plyr-speed-option.active,
.plyr-playmode-option.active {
  color: #3b82f6;
  font-weight: 600;
}

.plyr-speed-option.active::before,
.plyr-playmode-option.active::before {
  content: '✓';
  position: absolute;
  left: 12px;
}

/* 手机端音量条向上显示 */
@media (pointer: coarse), (max-width: 768px) {
  .plyr--audio .plyr__volume {
    position: relative;
  }
  
  .plyr--audio .plyr__volume input[type="range"] {
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%) rotate(-90deg);
    transform-origin: center center;
    width: 80px;
    margin-bottom: 40px;
    display: none;
  }
  
  .plyr--audio .plyr__volume:hover input[type="range"],
  .plyr--audio .plyr__volume:focus-within input[type="range"] {
    display: block;
  }
  
  /* 音量滑块容器背景 */
  .plyr--audio .plyr__volume::before {
    content: '';
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    width: 36px;
    height: 100px;
    background: rgba(0, 0, 0, 0.8);
    border-radius: 8px;
    display: none;
    margin-bottom: 8px;
  }
  
  .plyr--audio .plyr__volume:hover::before,
  .plyr--audio .plyr__volume:focus-within::before {
    display: block;
  }
}
</style>
