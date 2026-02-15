/**
 * 矩形工具函数
 * 用于框选（rubber-band selection）功能中的矩形计算和相交检测
 */

/**
 * 判断两个矩形是否相交
 * @param {Object} rectA - { left, top, right, bottom }
 * @param {Object} rectB - { left, top, right, bottom }
 * @returns {boolean} 是否存在重叠区域
 */
export function rectIntersects(rectA, rectB) {
  return !(
    rectA.right <= rectB.left ||
    rectA.left >= rectB.right ||
    rectA.bottom <= rectB.top ||
    rectA.top >= rectB.bottom
  );
}

/**
 * 根据起始点和当前点计算选区矩形
 * @param {Object} start - { x, y } 起始鼠标坐标
 * @param {Object} current - { x, y } 当前鼠标坐标
 * @returns {Object} { left, top, width, height, right, bottom }
 */
export function calcSelectionRect(start, current) {
  const left = Math.min(start.x, current.x);
  const top = Math.min(start.y, current.y);
  const width = Math.abs(current.x - start.x);
  const height = Math.abs(current.y - start.y);
  return { left, top, width, height, right: left + width, bottom: top + height };
}
