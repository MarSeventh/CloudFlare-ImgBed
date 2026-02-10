import { S3Client, CopyObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { purgeCFCache, purgeRandomFileListCache, purgePublicFileListCache } from "../../../utils/purgeCache";
import { moveFileInIndex } from "../../../utils/indexManager.js";
import { getDatabase } from '../../../utils/databaseAdapter.js';

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

    // 仅允许 POST 方法
    if (request.method !== 'POST') {
        return new Response(JSON.stringify({
            success: false,
            message: 'Method not allowed. Use POST.',
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

        // 验证请求体中包含 newFileId
        if (!body || typeof body.newFileId !== 'string' || !body.newFileId.trim()) {
            return new Response(JSON.stringify({
                success: false,
                message: 'newFileId is required and must be a non-empty string.',
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
        }

        const newFileId = body.newFileId;
        const url = new URL(request.url);
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

        // 检查目标 File_ID 是否已存在（重复性检测）
        const existingFile = await db.getWithMetadata(newFileId);
        if (existingFile && existingFile.value !== null) {
            return new Response(JSON.stringify({
                success: false,
                message: '目标文件名已存在',
            }), {
                status: 409,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
        }

        // 执行文件迁移
        const metadata = { ...fileData.metadata };

        // 如果是 R2 渠道的图片，需要移动 R2 中对应的图片
        if (metadata?.Channel === 'CloudflareR2') {
            const R2DataBase = env.img_r2;

            // 获取原文件内容
            const object = await R2DataBase.get(fileId);
            if (!object) {
                throw new Error('R2 Object Not Found');
            }

            // 复制到新位置
            await R2DataBase.put(newFileId, object.body);

            // 删除旧文件
            await R2DataBase.delete(fileId);
        }

        // S3 渠道的图片，需要移动 S3 中对应的图片
        if (metadata?.Channel === 'S3') {
            const { success, newKey, error } = await moveS3File(fileData, newFileId);
            if (success) {
                // 更新 metadata
                metadata.S3FileKey = newFileId;

                const s3ServerDomain = metadata.S3Endpoint.replace(/https?:\/\//, "");
                metadata.S3Location = `https://${metadata.S3BucketName}.${s3ServerDomain}/${newKey}`;
            } else {
                // do nothing
            }
        }

        // 旧版 Telegram 渠道和 Telegraph 渠道不支持重命名
        if (metadata?.Channel === 'Telegram' || metadata?.Channel === undefined) {
            return new Response(JSON.stringify({
                success: false,
                message: '旧版 Telegram/Telegraph 渠道不支持重命名',
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
            });
        }

        // 更新文件夹信息，根目录为空，否则为 aaa/123/ 的格式
        const DirectoryPath = newFileId.split('/').slice(0, -1).join('/') === '' ? '' : newFileId.split('/').slice(0, -1).join('/') + '/';
        metadata.Directory = DirectoryPath;

        // 更新 KV 存储
        await db.put(newFileId, fileData.value, { metadata });
        await db.delete(fileId);

        // 清除 CDN 缓存
        const cdnUrl = `https://${url.hostname}/file/${fileId}`;
        await purgeCFCache(env, cdnUrl);

        // 清除 api/randomFileList 等 API 缓存
        const normalizedFolder = fileId.split('/').slice(0, -1).join('/');
        const normalizedDist = newFileId.split('/').slice(0, -1).join('/');
        await purgeRandomFileListCache(url.origin, normalizedFolder, normalizedDist);
        await purgePublicFileListCache(url.origin, normalizedFolder, normalizedDist);

        // 更新索引
        waitUntil(moveFileInIndex(context, fileId, newFileId));

        return new Response(JSON.stringify({
            success: true,
            newFileId,
            metadata,
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });

    } catch (error) {
        console.error('Error renaming file:', error);
        return new Response(JSON.stringify({
            success: false,
            message: error.message || 'Internal server error.',
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
        });
    }
}

// 移动 S3 渠道的图片
async function moveS3File(img, newFileId) {
    const s3Client = new S3Client({
        region: img.metadata?.S3Region || "auto",
        endpoint: img.metadata?.S3Endpoint,
        credentials: {
            accessKeyId: img.metadata?.S3AccessKeyId,
            secretAccessKey: img.metadata?.S3SecretAccessKey
        },
        forcePathStyle: img.metadata?.S3PathStyle || false
    });

    const bucketName = img.metadata?.S3BucketName;
    const oldKey = img.metadata?.S3FileKey;
    const newKey = newFileId;

    try {
        // 复制文件到新位置
        await s3Client.send(new CopyObjectCommand({
            Bucket: bucketName,
            CopySource: `/${bucketName}/${oldKey}`,
            Key: newKey,
        }));

        // 复制成功后，删除旧文件
        await s3Client.send(new DeleteObjectCommand({
            Bucket: bucketName,
            Key: oldKey,
        }));

        // 返回新的 S3 文件信息
        return { success: true, newKey };
    } catch (error) {
        console.error("S3 Move Failed:", error);
        return { success: false, error: error.message };
    }
}
