/**
 * Token 过期时间工具模块（后端）
 * 提供 Token 过期判定和自动删除过滤功能
 */

/**
 * 判定 Token 是否已过期
 * @param {string|null} expiresAt - 过期时间 ISO 8601 字符串，null 表示永不过期
 * @param {Date} [now=new Date()] - 当前时间
 * @returns {boolean} 是否已过期
 */
export function isExpired(expiresAt, now = new Date()) {
  if (expiresAt === null || expiresAt === undefined) {
    return false;
  }
  const expiresDate = new Date(expiresAt);
  const currentTime = now instanceof Date ? now : new Date(now);
  return currentTime.getTime() > expiresDate.getTime();
}

/**
 * 过滤出需要自动删除的 Token 并返回保留的 Token 列表
 * @param {Array<Object>} tokens - Token 数组
 * @param {Date} [now=new Date()] - 当前时间
 * @returns {{ toDelete: Array<Object>, toKeep: Array<Object> }}
 */
export function filterAutoDeleteTokens(tokens, now = new Date()) {
  const toDelete = [];
  const toKeep = [];

  for (const token of tokens) {
    if (isExpired(token.expiresAt, now) && token.autoDelete === true) {
      toDelete.push(token);
    } else {
      toKeep.push(token);
    }
  }

  return { toDelete, toKeep };
}
