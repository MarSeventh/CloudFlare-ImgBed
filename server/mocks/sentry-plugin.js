/**
 * Mock for @cloudflare/pages-plugin-sentry
 * Docker 模式下不使用 Sentry，提供空实现
 */
export default function sentryPlugin(config) {
    return function(context) {
        // 提供一个空的 sentry 对象以兼容 telemetryData 中的调用
        if (!context.data) context.data = {};
        context.data.sentry = {
            setTag: () => {},
            setContext: () => {},
            startTransaction: () => ({
                startChild: () => ({ finish: () => {} }),
                finish: () => {}
            })
        };
        return context.next();
    };
}
