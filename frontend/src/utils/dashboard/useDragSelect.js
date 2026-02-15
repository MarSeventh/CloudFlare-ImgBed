import { ref, watch, onMounted, onBeforeUnmount, toValue } from 'vue';
import { rectIntersects, calcSelectionRect } from './rectIntersects.js';

/**
 * Vue 3 Composable：框选（rubber-band selection）核心逻辑，支持多视图模式
 *
 * @param {Object} options
 * @param {Object} options.modes - Per-view-mode configuration
 * @param {Object} options.modes.card - Card view config
 * @param {import('vue').Ref<HTMLElement>} options.modes.card.containerRef
 * @param {string} options.modes.card.itemSelector - e.g. '.img-card'
 * @param {Object} options.modes.list - List view config
 * @param {import('vue').Ref<HTMLElement>} options.modes.list.containerRef
 * @param {string} options.modes.list.itemSelector - e.g. '.list-item'
 * @param {string} [options.mainSelector='.main-container'] - 主内容区域的 CSS 选择器，框选只能从该区域内开始
 * @param {import('vue').Ref<string>} options.viewMode - 当前视图模式
 * @param {import('vue').Ref<Array>} options.items - 当前页的数据项（paginatedTableData）
 * @returns {{ isDragging: import('vue').Ref<boolean>, selectionRect: import('vue').Ref<Object> }}
 */
export function useDragSelect(options) {
  const {
    modes,
    mainSelector = '.main-container',
    viewMode,
    items,
  } = options;

  // --- Reactive state ---
  const isDragging = ref(false);
  const selectionRect = ref({ left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 });

  // --- Internal (non-reactive) state ---
  let startPoint = null;       // { x, y } viewport coordinates at mousedown
  let preSelectSnapshot = [];  // boolean[] snapshot of items[i].selected before drag
  let isAppendMode = false;    // whether Shift/Ctrl/Cmd was held at mousedown

  // --- Enable/disable state ---
  const MOBILE_BREAKPOINT = 768; // px – at or below this width, drag-select is disabled
  let listenerAttached = false;  // tracks whether the container mousedown listener is active

  // --- Auto-scroll state ---
  const EDGE_THRESHOLD = 50;   // px from viewport edge to trigger auto-scroll
  const SCROLL_SPEED = 10;     // px per frame to scroll
  let autoScrollTimer = null;  // requestAnimationFrame ID for auto-scroll

  // --- Text selection prevention state ---
  let savedUserSelect = '';    // saved document.body.style.userSelect before drag

  // ------------------------------------------------------------------
  // Mode resolution helper
  // ------------------------------------------------------------------

  /**
   * Returns the configuration for the current viewMode.
   * @returns {{ containerRef: import('vue').Ref<HTMLElement>, itemSelector: string } | undefined}
   */
  function getActiveConfig() {
    const mode = toValue(viewMode);
    return modes[mode] || undefined;
  }

  // ------------------------------------------------------------------
  // Enable / disable helpers
  // ------------------------------------------------------------------

  /**
   * Determine whether drag-select should be enabled.
   * Returns true when viewMode is 'card' or 'list' AND window width > 768px.
   */
  function shouldEnable() {
    const mode = toValue(viewMode);
    return (mode === 'card' || mode === 'list') && window.innerWidth > MOBILE_BREAKPOINT;
  }

  /**
   * Conditionally attach or detach the container listener based on shouldEnable().
   * Also cancels any active drag when detaching.
   */
  function syncListenerState() {
    if (shouldEnable()) {
      if (!listenerAttached) {
        attachContainerListener();
      }
    } else {
      if (listenerAttached) {
        cancelDrag();
        detachContainerListener();
      }
    }
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  /**
   * 判断 mousedown 目标是否为可启动框选的空白区域。
   * 必须在主内容区域内，且不在卡片、交互元素上。
   */
  function isBlankArea(event) {
    const target = event.target;
    // 必须在主内容区域（el-main）内
    const mainArea = target.closest(mainSelector);
    if (!mainArea) return false;
    // 排除当前模式的可选元素
    const config = getActiveConfig();
    if (config) {
      const itemEl = target.closest(config.itemSelector);
      if (itemEl) {
        const container = toValue(config.containerRef);
        if (container && container.contains(itemEl)) {
          return false;
        }
      }
    }
    // 排除交互元素（按钮、输入框、链接、下拉菜单、分页等）
    const interactive = target.closest('button, a, input, .el-input, .el-dropdown, .el-checkbox, .el-breadcrumb, .el-pagination, .el-pager, .header-content, .breadcrumb-container');
    if (interactive) {
      return false;
    }
    return true;
  }

  /**
   * Determine whether a modifier key for append-select is pressed.
   */
  function hasAppendModifier(event) {
    return event.shiftKey || event.ctrlKey || event.metaKey;
  }

  /**
   * Save a snapshot of the current selected state for all items.
   */
  function saveSnapshot() {
    const currentItems = toValue(items);
    preSelectSnapshot = currentItems.map((item) => !!item.selected);
  }

  // ------------------------------------------------------------------
  // Auto-scroll helpers
  // ------------------------------------------------------------------

  /** The last known clientY during a drag – updated by onMouseMove. */
  let lastClientY = 0;

  /**
   * Start the auto-scroll loop. On each animation frame we check whether the
   * mouse is within EDGE_THRESHOLD of the top or bottom of the viewport and
   * scroll accordingly. The selection rectangle and card hit-testing are also
   * updated after each scroll step so the visual feedback stays in sync.
   */
  function startAutoScroll() {
    if (autoScrollTimer !== null) return; // already running

    function scrollStep() {
      const viewportHeight = window.innerHeight;
      let scrollDelta = 0;

      if (lastClientY >= viewportHeight - EDGE_THRESHOLD) {
        // Near bottom edge → scroll down
        scrollDelta = SCROLL_SPEED;
      } else if (lastClientY <= EDGE_THRESHOLD) {
        // Near top edge → scroll up
        scrollDelta = -SCROLL_SPEED;
      }

      if (scrollDelta !== 0) {
        window.scrollBy(0, scrollDelta);

        // After scrolling, the viewport-relative positions of cards change,
        // but the mouse hasn't moved. We need to adjust the start point so
        // the selection rectangle accounts for the scroll offset, then
        // re-run hit-testing.
        if (startPoint) {
          startPoint.y -= scrollDelta;
          selectionRect.value = calcSelectionRect(startPoint, { x: selectionRect.value.right >= startPoint.x ? selectionRect.value.right : selectionRect.value.left, y: lastClientY });
          updateSelection();
        }
      }

      // Continue the loop
      autoScrollTimer = requestAnimationFrame(scrollStep);
    }

    autoScrollTimer = requestAnimationFrame(scrollStep);
  }

  /**
   * Stop the auto-scroll loop and clean up the timer.
   */
  function stopAutoScroll() {
    if (autoScrollTimer !== null) {
      cancelAnimationFrame(autoScrollTimer);
      autoScrollTimer = null;
    }
  }

  // ------------------------------------------------------------------
  // Text selection prevention helpers
  // ------------------------------------------------------------------

  /**
   * Disable text selection on the document body during drag.
   */
  function disableTextSelection() {
    savedUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none';
  }

  /**
   * Restore the original text selection behavior on the document body.
   */
  function restoreTextSelection() {
    document.body.style.userSelect = savedUserSelect;
  }

  /**
   * Update the selected state of every item based on the current selection rectangle.
   */
  function updateSelection() {
    const config = getActiveConfig();
    if (!config) return;

    const container = toValue(config.containerRef);
    if (!container) return;

    const currentItems = toValue(items);
    const rect = selectionRect.value;

    // Build the selection rect in {left, top, right, bottom} format for intersection test
    const selRect = {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
    };

    // Query all item DOM elements inside the container using the active mode's selector
    const itemElements = container.querySelectorAll(config.itemSelector);

    // Iterate over items and corresponding DOM elements
    currentItems.forEach((item, index) => {
      const itemEl = itemElements[index];
      if (!itemEl) return;

      const itemRect = itemEl.getBoundingClientRect();
      const itemBounds = {
        left: itemRect.left,
        top: itemRect.top,
        right: itemRect.right,
        bottom: itemRect.bottom,
      };

      const intersects = rectIntersects(selRect, itemBounds);

      if (isAppendMode) {
        // Append mode: keep original state, toggle on if intersects
        // If originally selected, stay selected regardless
        // If not originally selected, select if intersects
        if (preSelectSnapshot[index]) {
          item.selected = true;
        } else {
          item.selected = intersects;
        }
      } else {
        // Non-append mode: selected = intersects only
        item.selected = intersects;
      }
    });
  }

  // ------------------------------------------------------------------
  // Mouse event handlers
  // ------------------------------------------------------------------

  function onMouseDown(event) {
    // 仅响应鼠标左键
    if (event.button !== 0) return;

    // 点击在卡片上时不启动框选
    if (!isBlankArea(event)) return;

    // Record start point (viewport coordinates)
    startPoint = { x: event.clientX, y: event.clientY };

    // Determine append mode from modifier keys at the moment of mousedown
    isAppendMode = hasAppendModifier(event);

    // 保存选中状态快照
    saveSnapshot();

    // 非追加模式下先清除所有选中
    if (!isAppendMode) {
      const currentItems = toValue(items);
      currentItems.forEach((item) => {
        item.selected = false;
      });
    }

    // Start dragging
    isDragging.value = true;
    selectionRect.value = calcSelectionRect(startPoint, startPoint);

    // 防止文本选中
    disableTextSelection();

    // Attach document-level listeners for move and up
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }

  function onMouseMove(event) {
    if (!isDragging.value || !startPoint) return;

    const currentPoint = { x: event.clientX, y: event.clientY };

    // Track last clientY for auto-scroll
    lastClientY = event.clientY;

    // Update selection rectangle
    selectionRect.value = calcSelectionRect(startPoint, currentPoint);

    // Update card selection based on intersection
    updateSelection();

    // Start or continue auto-scroll if near viewport edges
    const viewportHeight = window.innerHeight;
    if (lastClientY <= EDGE_THRESHOLD || lastClientY >= viewportHeight - EDGE_THRESHOLD) {
      startAutoScroll();
    } else {
      stopAutoScroll();
    }
  }

  function onMouseUp(_event) {
    if (!isDragging.value) return;

    // 停止自动滚动
    stopAutoScroll();

    // 恢复文本选中
    restoreTextSelection();

    // End dragging
    isDragging.value = false;
    selectionRect.value = { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 };
    startPoint = null;

    // Clean up document-level listeners
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);
  }

  // ------------------------------------------------------------------
  // Lifecycle: attach / detach container listener
  // ------------------------------------------------------------------

  function attachContainerListener() {
    if (!listenerAttached) {
      document.addEventListener('mousedown', onMouseDown);
      listenerAttached = true;
    }
  }

  function detachContainerListener() {
    if (listenerAttached) {
      document.removeEventListener('mousedown', onMouseDown);
      listenerAttached = false;
    }
  }

  /**
   * Force-stop any in-progress drag (e.g. when viewMode changes).
   */
  function cancelDrag() {
    if (isDragging.value) {
      stopAutoScroll();
      restoreTextSelection();
      isDragging.value = false;
      selectionRect.value = { left: 0, top: 0, width: 0, height: 0, right: 0, bottom: 0 };
      startPoint = null;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }
  }

  // 监听 viewMode 变化，启用/禁用框选
  // Always cancel any in-progress drag when viewMode changes (Requirement 2.3),
  // then re-evaluate whether listeners should be attached for the new mode.
  watch(
    () => toValue(viewMode),
    () => {
      cancelDrag();
      syncListenerState();
    }
  );

  // --- Window resize handler ---
  function onWindowResize() {
    syncListenerState();
  }

  onMounted(() => {
    // 仅在满足条件时启用
    if (shouldEnable()) {
      attachContainerListener();
    }
    // Always listen for resize to dynamically enable/disable
    window.addEventListener('resize', onWindowResize);
  });

  onBeforeUnmount(() => {
    cancelDrag();
    restoreTextSelection();
    stopAutoScroll();
    detachContainerListener();
    window.removeEventListener('resize', onWindowResize);
  });

  return {
    isDragging,
    selectionRect,
  };
}
