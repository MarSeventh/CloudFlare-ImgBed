/**
 * 密码哈希工具
 * 使用 Web Crypto API 的 SHA-256 + 盐值进行密码哈希
 * 兼容已有的明文密码存储
 */

const HASH_PREFIX = '$sha256$';

/**
 * 生成随机盐值
 * @returns {string} 16字节的十六进制盐值
 */
function generateSalt() {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 使用 SHA-256 对密码进行哈希
 * @param {string} password - 明文密码
 * @param {string} salt - 盐值
 * @returns {Promise<string>} 哈希后的密码字符串（格式：$sha256$salt$hash）
 */
export async function hashPassword(password, salt = null) {
    if (!salt) {
        salt = generateSalt();
    }
    const encoder = new TextEncoder();
    const data = encoder.encode(salt + password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return `${HASH_PREFIX}${salt}$${hashHex}`;
}

/**
 * 判断密码是否已经是哈希格式
 * @param {string} password - 密码字符串
 * @returns {boolean}
 */
export function isHashed(password) {
    return typeof password === 'string' && password.startsWith(HASH_PREFIX);
}

/**
 * 验证密码是否匹配
 * 兼容明文密码和哈希密码两种存储格式
 * @param {string} inputPassword - 用户输入的明文密码
 * @param {string} storedPassword - 数据库中存储的密码（可能是明文或哈希）
 * @returns {Promise<boolean>} 是否匹配
 */
export async function verifyPassword(inputPassword, storedPassword) {
    if (!storedPassword || !inputPassword) {
        return false;
    }

    if (isHashed(storedPassword)) {
        // 存储的是哈希密码，提取盐值后重新哈希比对
        const parts = storedPassword.split('$');
        // 格式: $sha256$salt$hash -> ['', 'sha256', salt, hash]
        if (parts.length !== 4) {
            return false;
        }
        const salt = parts[2];
        const expectedHash = await hashPassword(inputPassword, salt);
        return expectedHash === storedPassword;
    } else {
        // 存储的是明文密码，直接比对（向后兼容）
        return inputPassword === storedPassword;
    }
}

/**
 * 生成安全的会话 Token
 * @returns {string} 随机会话 Token
 */
export function generateSessionToken() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}
