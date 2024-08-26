export async function onRequestGet(context) {
    const { request, env, params, waitUntil, next, data } = context;
    const userConfig = env.USER_CONFIG;

    // 检查 USER_CONFIG 是否为空或未定义
    if (!userConfig) {
        return new Response(JSON.stringify({}), { status: 200 });
    }

    try {
        // 尝试解析 USER_CONFIG 为 JSON
        const parsedConfig = JSON.parse(userConfig);
        // 检查解析后的结果是否为对象
        if (typeof parsedConfig === 'object' && parsedConfig !== null) {
            return new Response(JSON.stringify(parsedConfig), { status: 200 });
        } else {
            return new Response(JSON.stringify({}), { status: 200 });
        }
    } catch (error) {
        // 捕捉解析错误并返回空对象
        return new Response(JSON.stringify({}), { status: 200 });
    }
}
