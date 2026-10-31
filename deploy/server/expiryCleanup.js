/**
 * Docker 文件有效期定时清理
 * Docker 没有 Cron Trigger，由服务进程按间隔清理；EXPIRY_CLEANUP_INTERVAL_MINUTES=0 时关闭
 * 没有子请求限制，每次可以多清理一些
 */

/**
 * @param {Object} options
 * @param {Function} options.runExpiryCleanupJob - functions/utils/fileExpiryService.js 的同名导出
 * @param {Function} options.createEnv - 与 HTTP 请求相同的环境构造函数
 * @param {number} options.intervalMinutes
 * @param {Function} [options.schedule] - 默认 setInterval，测试时替换
 * @returns {Function|null} 单次清理函数；未启用时返回 null
 */
export function startExpiryCleanupTimer({ runExpiryCleanupJob, createEnv, intervalMinutes, schedule = setInterval }) {
    if (!Number.isFinite(intervalMinutes) || intervalMinutes <= 0) {
        return null;
    }

    let cleanupRunning = false;
    async function runOnce() {
        if (cleanupRunning) return;
        cleanupRunning = true;
        const pending = [];
        try {
            // 定时器不经过 functions/_middleware.js，由 runExpiryCleanupJob 显式标记平台
            const result = await runExpiryCleanupJob(createEnv(), 'node', (promise) => pending.push(promise), { limit: 100 });
            await Promise.allSettled(pending);
            if (result.deleted > 0 || result.failed > 0) {
                console.log(`Expired files cleanup: ${JSON.stringify(result)}`);
            }
        } catch (error) {
            console.error('Expired files cleanup failed:', error);
        } finally {
            cleanupRunning = false;
        }
    }

    schedule(runOnce, intervalMinutes * 60 * 1000)?.unref?.();
    return runOnce;
}
