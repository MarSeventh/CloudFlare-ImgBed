// 获取上传渠道列表 API
import { fetchUploadConfig } from '../utils/sysConfig.js';
import { getUploadConfig } from './manage/sysConfig/upload.js';
import { getDatabase } from '../utils/databaseAdapter.js';

export async function onRequest(context) {
    const { request, env } = context;
    
    // 设置CORS头部的辅助函数
    const setCorsHeaders = (response, origin) => {
        const allowedOrigins = [
            'https://editblog.3my.top'
        ];
        
        const allowedOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
        
        const headers = new Headers(response.headers);
        headers.set('Access-Control-Allow-Origin', allowedOrigin);
        headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
        headers.set('Access-Control-Allow-Credentials', 'true');
        headers.set('Vary', 'Origin');
        
        return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers,
        });
    };
    
    const origin = request.headers.get('Origin') || '';
    
    // 处理预检请求
    if (request.method === 'OPTIONS') {
        return setCorsHeaders(new Response(null, {
            headers: {
                'Access-Control-Max-Age': '86400',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            }
        }), origin);
    }
    
    // 只允许GET方法
    if (request.method !== 'GET') {
        return setCorsHeaders(new Response('Method Not Allowed', { 
            status: 405 
        }), origin);
    }

    try {
        const url = new URL(request.url);
        const includeDisabled = url.searchParams.get('includeDisabled') === 'true';

        let uploadConfig;
        if (includeDisabled) {
            const db = getDatabase(env);
            uploadConfig = await getUploadConfig(db, env);
        } else {
            uploadConfig = await fetchUploadConfig(env, context);
        }

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

        return setCorsHeaders(new Response(JSON.stringify(channels), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        }), origin);
    } catch (error) {
        console.error('Failed to get channels:', error);
        
        return setCorsHeaders(new Response(JSON.stringify({ error: 'Failed to get channels' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        }), origin);
    }
}
