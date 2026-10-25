import { addFileToIndex } from '../../../utils/indexManager.js';
import { getDatabase } from '../../../utils/databaseAdapter.js';
import { buildFileMetadataForManagement } from '../../../utils/metadata/metadataView.js';
import { cleanPersistedMetadata } from '../../../utils/metadata/metadataSecurity.js';
import { trackFileExpiry } from '../../../utils/fileExpiryService.js';

// CORS 跨域响应头
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, PUT, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
};

export async function onRequest(context) {
    const { request, env, params, waitUntil } = context;

    // OPTIONS 预检请求
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: corsHeaders,
        });
    }

    // 仅允许 PATCH 方法
    if (request.method !== 'PATCH') {
        return new Response(JSON.stringify({
            success: false,
            message: 'Method not allowed. Use PATCH.',
        }), {
            status: 405,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
    }

    try {
        // 从 params.path 解析 fileId（需要 decodeURIComponent 处理中文等特殊字符）
        const fileId = decodeURIComponent(params.path).split(',').join('/');

        if (!fileId) {
            return new Response(JSON.stringify({
                success: false,
                message: 'File ID is required.',
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
        }

        // 解析请求体
        let body;
        try {
            body = await request.json();
        } catch (e) {
            return new Response(JSON.stringify({
                success: false,
                message: 'Invalid request body. Expected JSON.',
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
        }

        // 验证请求体中包含可更新的字段
        const hasExpiresAt = !!body && Object.hasOwn(body, 'ExpiresAt');
        if (!body || (typeof body.FileName !== 'string' && typeof body.FileType !== 'string' && !hasExpiresAt)) {
            return new Response(JSON.stringify({
                success: false,
                message: 'At least one of FileName, FileType or ExpiresAt is required.',
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
        }

        // ExpiresAt：毫秒时间戳设置到期时间，null 改回永久
        if (hasExpiresAt && body.ExpiresAt !== null &&
            !(Number.isSafeInteger(body.ExpiresAt) && body.ExpiresAt > Date.now())) {
            return new Response(JSON.stringify({
                success: false,
                message: 'ExpiresAt must be a future timestamp in milliseconds, or null for no expiry.',
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
        }

        const db = getDatabase(env);

        // 获取当前文件数据
        const fileData = await db.getWithMetadata(fileId);

        if (!fileData || !fileData.metadata) {
            return new Response(JSON.stringify({
                success: false,
                message: 'File not found.',
            }), {
                status: 404,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
        }

        // 合并允许更新的字段到现有 metadata
        const updatedMetadata = { ...fileData.metadata };
        if (typeof body.FileName === 'string') {
            updatedMetadata.FileName = body.FileName;
        }
        if (typeof body.FileType === 'string') {
            updatedMetadata.FileType = body.FileType;
        }
        if (hasExpiresAt) {
            if (body.ExpiresAt === null) {
                delete updatedMetadata.ExpiresAt;
            } else {
                updatedMetadata.ExpiresAt = body.ExpiresAt;
            }
        }
        const metadataToSave = cleanPersistedMetadata(updatedMetadata);

        // 保存更新后的 metadata
        await db.put(fileId, fileData.value, { metadata: metadataToSave });

        // 修改了有效期时，KV 存储下写入新的到期标记（旧标记在清理时发现不一致会自动移除）
        if (hasExpiresAt) {
            await trackFileExpiry(db, fileId, metadataToSave);
        }

        // 更新索引
        waitUntil(addFileToIndex(context, fileId, metadataToSave));

        return new Response(JSON.stringify({
            success: true,
            metadata: await buildFileMetadataForManagement(db, env, metadataToSave),
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });

    } catch (error) {
        console.error('Error updating metadata:', error);
        return new Response(JSON.stringify({
            success: false,
            message: error.message || 'Internal server error.',
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
    }
}
