import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { purgeCFCache, purgeRandomFileListCache, purgePublicFileListCache } from "../../../utils/purgeCache";
import { removeFileFromIndex, batchRemoveFilesFromIndex } from "../../../utils/indexManager.js";
import { getDatabase } from '../../../utils/databaseAdapter.js';
import { DiscordAPI } from '../../../utils/discordAPI.js';
import { HuggingFaceAPI } from '../../../utils/huggingfaceAPI.js';

// CORS 跨域响应头
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
};

export async function onRequest(context) {
    const { request, env, params, waitUntil } = context;

    const url = new URL(request.url);

    // 读取folder参数，判断是否为文件夹删除请求
    const folder = url.searchParams.get('folder');
    if (folder === 'true') {
        try {
            params.path = decodeURIComponent(params.path);
            // 使用队列存储需要处理的文件夹
            const folderQueue = [{
                path: params.path.split(',').join('/')
            }];

            const deletedFiles = [];
            const failedFiles = [];

            while (folderQueue.length > 0) {
                const currentFolder = folderQueue.shift();

                // 获取指定目录下的所有文件
                const listUrl = new URL(`${url.origin}/api/manage/list?count=-1&dir=${currentFolder.path}`);
                const listRequest = new Request(listUrl, request);
                const listResponse = await fetch(listRequest);
                const listData = await listResponse.json();

                const files = listData.files;

                // 处理当前文件夹下的所有文件
                for (const file of files) {
                    const fileId = file.name;
                    const cdnUrl = `https://${url.hostname}/file/${fileId}`;

                    const success = await deleteFile(env, fileId, cdnUrl, url);
                    if (success) {
                        deletedFiles.push(fileId);
                    } else {
                        failedFiles.push(fileId);
                    }
                }

                // 将子文件夹添加到队列
                const directories = listData.directories;
                for (const dir of directories) {
                    folderQueue.push({
                        path: dir
                    });
                }
            }

            // 批量从索引中删除文件
            if (deletedFiles.length > 0) {
                waitUntil(batchRemoveFilesFromIndex(context, deletedFiles));
            }

            return new Response(JSON.stringify({
                success: true,
                deleted: deletedFiles,
                failed: failedFiles
            }), {
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });

        } catch (e) {
            return new Response(JSON.stringify({
                success: false,
                error: e.message
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', ...corsHeaders }
            });
        }
    }

    // 单个文件删除处理
    try {
        // 解码params.path
        params.path = decodeURIComponent(params.path);
        const fileId = params.path.split(',').join('/');
        const cdnUrl = `https://${url.hostname}/file/${fileId}`;

        const success = await deleteFile(env, fileId, cdnUrl, url);
        if (!success) {
            throw new Error('Delete file failed');
        } else {
            // 从索引中删除文件
            waitUntil(removeFileFromIndex(context, fileId));
        }

        return new Response(JSON.stringify({
            success: true,
            fileId: fileId
        }), {
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    } catch (e) {
        return new Response(JSON.stringify({
            success: false,
            error: e.message
        }), {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
    }
}

// 删除单个文件的核心函数
async function deleteFile(env, fileId, cdnUrl, url) {
    try {
        // 读取图片信息
        const db = getDatabase(env);
        const img = await db.getWithMetadata(fileId);

        // 如果文件记录不存在，直接返回成功（幂等删除）
        if (!img) {
            console.warn(`File ${fileId} not found in database, skipping delete`);
            return true;
        }

        // 如果是R2渠道的图片，需要删除R2中对应的图片
        if (img.metadata?.Channel === 'CloudflareR2') {
            const R2DataBase = env.img_r2;
            await R2DataBase.delete(fileId);
        }

        // S3 渠道的图片，需要删除S3中对应的图片
        if (img.metadata?.Channel === 'S3') {
            await deleteS3File(img);
        }

        // Discord 渠道的图片，需要删除 Discord 中对应的消息
        if (img.metadata?.Channel === 'Discord') {
            await deleteDiscordFile(img);
        }

        // HuggingFace 渠道的图片，需要删除 HuggingFace 中对应的文件
        if (img.metadata?.Channel === 'HuggingFace') {
            await deleteHuggingFaceFile(img);
        }

        // 删除数据库中的记录
        // 注意：容量统计现在由索引自动维护，删除文件后索引更新时会自动重新计算
        await db.delete(fileId);

        // 清除CDN缓存
        await purgeCFCache(env, cdnUrl);

        // 清除 api/randomFileList 等API缓存
        const normalizedFolder = fileId.split('/').slice(0, -1).join('/');
        await purgeRandomFileListCache(url.origin, normalizedFolder);
        await purgePublicFileListCache(url.origin, normalizedFolder);

        return true;
    } catch (e) {
        console.error('Delete file failed:', e);
        return false;
    }
}

// 删除 S3 渠道的图片
async function deleteS3File(img) {
    const s3Client = new S3Client({
        region: img.metadata?.S3Region || "auto",
        endpoint: img.metadata?.S3Endpoint,
        credentials: {
            accessKeyId: img.metadata?.S3AccessKeyId,
            secretAccessKey: img.metadata?.S3SecretAccessKey
        },
        forcePathStyle: img.metadata?.S3PathStyle || false // 是否启用路径风格
    });

    const bucketName = img.metadata?.S3BucketName;
    const key = img.metadata?.S3FileKey;

    try {
        await s3Client.send(new DeleteObjectCommand({
            Bucket: bucketName,
            Key: key,
        }));
        return true;
    } catch (error) {
        console.error("S3 Delete Failed:", error);
        return false;
    }
}

// 删除 Discord 渠道的图片（删除 Discord 消息）
async function deleteDiscordFile(img) {
    const botToken = img.metadata?.DiscordBotToken;
    const channelId = img.metadata?.DiscordChannelId;
    const messageId = img.metadata?.DiscordMessageId;

    if (!botToken || !channelId || !messageId) {
        console.warn('Discord file missing required metadata for deletion');
        return false;
    }

    try {
        const discordAPI = new DiscordAPI(botToken);
        const success = await discordAPI.deleteMessage(channelId, messageId);
        if (!success) {
            console.error('Discord Delete Failed: API returned false');
        }
        return success;
    } catch (error) {
        console.error("Discord Delete Failed:", error);
        return false;
    }
}


// 删除 HuggingFace 渠道的图片
async function deleteHuggingFaceFile(img) {
    const token = img.metadata?.HfToken;
    const repo = img.metadata?.HfRepo;
    const filePath = img.metadata?.HfFilePath;
    const isPrivate = img.metadata?.HfIsPrivate || false;

    if (!token || !repo || !filePath) {
        console.warn('HuggingFace file missing required metadata for deletion');
        return false;
    }

    try {
        const huggingfaceAPI = new HuggingFaceAPI(token, repo, isPrivate);
        const success = await huggingfaceAPI.deleteFile(filePath, `Delete ${filePath}`);
        if (!success) {
            console.error('HuggingFace Delete Failed: API returned false');
        }
        return success;
    } catch (error) {
        console.error("HuggingFace Delete Failed:", error);
        return false;
    }
}
