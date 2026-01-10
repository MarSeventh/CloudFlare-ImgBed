// 获取可用上传渠道列表 API
import { fetchUploadConfig } from '../utils/sysConfig.js';

export async function onRequest(context) {
    const { request, env } = context;

    if (request.method !== 'GET') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    try {
        // 获取上传配置（已过滤禁用的渠道）
        const uploadConfig = await fetchUploadConfig(env, context);

        // 构建渠道列表，只返回渠道名称
        const channels = {
            telegram: uploadConfig.telegram.channels.map(ch => ({
                name: ch.name,
                type: 'telegram'
            })),
            cfr2: uploadConfig.cfr2.channels.map(ch => ({
                name: ch.name,
                type: 'cfr2'
            })),
            s3: uploadConfig.s3.channels.map(ch => ({
                name: ch.name,
                type: 's3'
            })),
            discord: uploadConfig.discord.channels.map(ch => ({
                name: ch.name,
                type: 'discord'
            })),
            huggingface: uploadConfig.huggingface.channels.map(ch => ({
                name: ch.name,
                type: 'huggingface'
            }))
        };

        return new Response(JSON.stringify(channels), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        console.error('Failed to get channels:', error);
        return new Response(JSON.stringify({ error: 'Failed to get channels' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
