/**
 * File_ID 验证器模块
 * 提供 File_ID 格式验证功能，用于重命名操作的前端校验
 * 非法字符规则复用 pathValidator 的字符集
 */

/**
 * 非法字符正则表达式
 * 非法字符包括: \ : * ? " ' < > | 空格 ( ) [ ] { } # % ^ ` ~ ; @ & = + $ ,
 * 与 pathValidator.js 保持一致
 */
const INVALID_CHARS = /[\\:\*\?"'<>\| \(\)\[\]\{\}#%\^`~;@&=\+\$,]/;

/**
 * 验证 File_ID 格式
 * @param {string} newFileId - 新的 File_ID
 * @param {string} currentFileId - 当前 File_ID
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateFileId(newFileId, currentFileId) {
  // 1. 空值/纯空白检测
  if (!newFileId || newFileId.trim() === '') {
    return {
      valid: false,
      error: '文件名不能为空'
    };
  }

  // 2. 与当前 File_ID 相同检测
  if (newFileId === currentFileId) {
    return {
      valid: false,
      error: '文件名未发生变化'
    };
  }

  // 3. 非法字符检测（复用 pathValidator 的字符规则）
  if (INVALID_CHARS.test(newFileId)) {
    return {
      valid: false,
      error: '文件名包含非法字符，请使用合法的文件名格式'
    };
  }

  // 4. 连续斜杠检测
  if (newFileId.includes('//')) {
    return {
      valid: false,
      error: '文件名不能包含连续的斜杠'
    };
  }

  return { valid: true };
}
