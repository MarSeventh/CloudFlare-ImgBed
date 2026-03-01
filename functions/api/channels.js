// 获取上传渠道列表 API
import { fetchUploadConfig } from '../utils/sysConfig.js';
import { getUploadConfig } from './manage/sysConfig/upload.js';
import { getDatabase } from '../utils/databaseAdapter.js';
import { dualAuthCheck } from '../utils/dualAuth.js';

export async function onRequest(context) {
    const { request, env } = context;

    if (request.method !== 'GET') {
        return new Response('Method Not Allowed', { status: 405 });
    }

    // 双重鉴权检查
    const url = new URL(request.url);
    const { authorized } = await dualAuthCheck(env, url, request);
    if (!authorized) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    try {
        const includeDisabled = url.searchParams.get('includeDisabled') === 'true';

        let uploadConfig;
        if (includeDisabled) {
            // 获取所有上传配置（包括禁用的渠道）
            const db = getDatabase(env);
            uploadConfig = await getUploadConfig(db, env);
        } else {
            // 获取上传配置（已过滤禁用的渠道）
            uploadConfig = await fetchUploadConfig(env, context);
        }

        // 构建渠道列表，返回渠道名称和实际的 Channel 类型
        const channels = {
            telegram: uploadConfig.telegram.channels.map(ch => ({
                name: ch.name,
                type: 'TelegramNew'
            })),
            cfr2: uploadConfig.cfr2.channels.map(ch => ({
                name: ch.name,
                type: 'CloudflareR2'
            })),
            s3: uploadConfig.s3.channels.map(ch => ({
                name: ch.name,
                type: 'S3'
            })),
            discord: uploadConfig.discord.channels.map(ch => ({
                name: ch.name,
                type: 'Discord'
            })),
            huggingface: uploadConfig.huggingface.channels.map(ch => ({
                name: ch.name,
                type: 'HuggingFace'
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
