export function createContext(url, { method = 'GET', body, env = {}, params = {}, headers = {} } = {}) {
    const backgroundTasks = [];
    return {
        request: new Request(url, { method, body, headers }),
        url: new URL(url),
        env,
        params,
        backgroundTasks,
        waitUntil(promise) { backgroundTasks.push(promise); },
    };
}
