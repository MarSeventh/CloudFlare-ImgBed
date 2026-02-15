// src/utils/mediaManager.js
// 全局媒体管理器：解决多媒体并发、暂停仍出声、生命周期失控等问题

const registry = new Set(); // Set<HTMLMediaElement>
let current = null;

// 音频播放模式：'stop' | 'sequence' | 'loop'
let audioPlayMode = 'stop';

function isMediaEl(el) {
  return el && (el.tagName === 'AUDIO' || el.tagName === 'VIDEO');
}

export function registerMedia(el) {
  if (!isMediaEl(el)) return;
  registry.add(el);
}

export function unregisterMedia(el) {
  if (!isMediaEl(el)) return;
  registry.delete(el);
  if (current === el) current = null;
}

/**
 * 硬停止：比 pause 更彻底
 * - pause
 * - 清 src 并 load，确保 Safari/iOS 不再继续输出音轨
 */
export function hardStop(el) {
  if (!isMediaEl(el)) return;
  
  try { el.pause(); } catch (e) {}
  try { el.currentTime = 0; } catch (e) {}
  
  // 关键：Safari/iOS 上，pause 后仍可能"幽灵出声"，必须断开 src
  try { el.removeAttribute('src'); } catch (e) {}
  try { el.load?.(); } catch (e) {}
}

export function hardStopAll(except = null) {
  for (const el of registry) {
    if (except && el === except) continue;
    hardStop(el);
  }
  current = except || null;
}

/**
 * 绑定一个媒体元素的"播放互斥"行为：
 * - 它一 play，就硬停其他所有媒体
 * - 它 pause 后如果仍没停住（极少见但你遇到了），再补一次 pause
 */
export function bindExclusivePlayback(el) {
  if (!isMediaEl(el)) return () => {};
  
  const onPlay = () => {
    current = el;
    hardStopAll(el);
  };
  
  const onPause = () => {
    // 你遇到的"按暂停仍出声"，常见原因是：不是当前这个在出声，而是另一个残留的在播
    // 这里加一个保险：pause 后短延迟检查
    setTimeout(() => {
      try {
        if (!el.paused) el.pause();
      } catch (e) {}
    }, 80);
  };
  
  el.addEventListener('play', onPlay, true);
  el.addEventListener('pause', onPause, true);
  
  return () => {
    el.removeEventListener('play', onPlay, true);
    el.removeEventListener('pause', onPause, true);
  };
}

// 页面切后台/锁屏：全部硬停（非常关键）
let installed = false;
export function installGlobalMediaGuards() {
  if (installed) return;
  installed = true;
  
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) hardStopAll(null);
  });
  
  window.addEventListener('pagehide', () => hardStopAll(null));
}

// 音频播放模式管理
export function getAudioPlayMode() {
  return audioPlayMode;
}

export function setAudioPlayMode(mode) {
  if (['stop', 'sequence', 'loop'].includes(mode)) {
    audioPlayMode = mode;
  }
}
