/**
 * 自适应图片方向检测模块
 * 
 * 提供设备检测和方向决策的纯函数，用于 orientation=auto 自适应模式。
 */

/**
 * 移动设备 User-Agent 关键词匹配正则
 */
const MOBILE_UA_REGEX = /Mobile|Android|iPhone|iPad|iPod|webOS|BlackBerry|Opera Mini|IEMobile/i;

/**
 * 从 HTTP 请求中检测设备信息。
 * 
 * 检测策略（按优先级）：
 * 1. 优先读取 Client Hints 头（Sec-CH-Viewport-Width / Sec-CH-Viewport-Height），
 *    两者都存在且为有效正数时，返回视口宽高比。
 * 2. 回退到 User-Agent 解析，匹配移动设备关键词判断设备类型。
 * 3. 都无法判断时返回 { source: null }。
 * 
 * @param {Request} request - Cloudflare Workers Request 对象
 * @returns {{ source: 'client-hints' | 'user-agent' | null, viewportRatio?: number, deviceType?: 'mobile' | 'desktop' }}
 */
export function detectDevice(request) {
    // 策略 1：Client Hints
    const viewportWidth = request.headers.get('Sec-CH-Viewport-Width');
    const viewportHeight = request.headers.get('Sec-CH-Viewport-Height');

    if (viewportWidth !== null && viewportHeight !== null) {
        const width = Number(viewportWidth);
        const height = Number(viewportHeight);

        if (isFinite(width) && isFinite(height) && width > 0 && height > 0) {
            return {
                source: 'client-hints',
                viewportRatio: width / height,
            };
        }
    }

    // 策略 2：User-Agent 解析
    const userAgent = request.headers.get('User-Agent');

    if (userAgent) {
        const isMobile = MOBILE_UA_REGEX.test(userAgent);
        return {
            source: 'user-agent',
            deviceType: isMobile ? 'mobile' : 'desktop',
        };
    }

    // 策略 3：无法判断
    return { source: null };
}


/**
 * 根据设备信息决定图片方向。
 * 
 * 决策逻辑：
 * - Client Hints 模式：根据视口宽高比判断
 *   - ratio > 1.1 → 'landscape'
 *   - ratio < 0.9 → 'portrait'
 *   - 0.9 <= ratio <= 1.1 → 'square'
 * - User-Agent 模式：根据设备类型判断
 *   - mobile → 'portrait'
 *   - desktop → 'landscape'
 * - 无法判断时（source === null）：返回空字符串，不进行方向过滤
 * 
 * @param {{ source: 'client-hints' | 'user-agent' | null, viewportRatio?: number, deviceType?: 'mobile' | 'desktop' }} deviceInfo
 * @returns {'landscape' | 'portrait' | 'square' | ''}
 */
export function resolveOrientation(deviceInfo) {
    if (deviceInfo.source === 'client-hints') {
        const ratio = deviceInfo.viewportRatio;
        if (ratio > 1.1) {
            return 'landscape';
        }
        if (ratio < 0.9) {
            return 'portrait';
        }
        return 'square';
    }

    if (deviceInfo.source === 'user-agent') {
        if (deviceInfo.deviceType === 'mobile') {
            return 'portrait';
        }
        if (deviceInfo.deviceType === 'desktop') {
            return 'landscape';
        }
    }

    // source === null 或无法判断
    return '';
}

/**
 * 为响应添加 Client Hints 协商头。
 *
 * - 设置 Accept-CH 头，请求浏览器在后续请求中发送视口尺寸信息
 * - 添加/追加 Vary 头，确保缓存按 Client Hints 和 User-Agent 区分
 *
 * @param {Headers} headers - 响应头对象
 * @returns {Headers} 添加了 Accept-CH 和 Vary 头的响应头对象
 */
export function addClientHintsHeaders(headers) {
    // 设置 Accept-CH 头
    headers.set('Accept-CH', 'Sec-CH-Viewport-Width, Sec-CH-Viewport-Height');

    // 添加/追加 Vary 头
    const varyValues = ['Sec-CH-Viewport-Width', 'Sec-CH-Viewport-Height', 'User-Agent'];
    const existingVary = headers.get('Vary');

    if (existingVary) {
        // 解析已有的 Vary 值，避免重复添加
        const existingValues = existingVary.split(',').map(v => v.trim().toLowerCase());
        const newValues = varyValues.filter(v => !existingValues.includes(v.toLowerCase()));

        if (newValues.length > 0) {
            headers.set('Vary', existingVary + ', ' + newValues.join(', '));
        }
    } else {
        headers.set('Vary', varyValues.join(', '));
    }

    return headers;
}
