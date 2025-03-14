import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { purgeCFCache } from "../../../utils/purgeCache";

export async function onRequest(context) {
    const {
        request,
        env,
        params,
    } = context;

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


            // 返回处理结果
            return new Response(JSON.stringify({
                success: true,
                deleted: deletedFiles,
                failed: failedFiles
            }));

        } catch (e) {
            return new Response(JSON.stringify({
                success: false,
                error: e.message
            }), { status: 400 });
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
        }

        return new Response(JSON.stringify({
            success: true,
            fileId: fileId
        }));
    } catch (e) {
        return new Response(JSON.stringify({
            success: false,
            error: e.message
        }), { status: 400 });
    }
}

// 删除单个文件的核心函数
async function deleteFile(env, fileId, cdnUrl, url) {
    try {
        // 读取图片信息
        const img = await env.img_url.getWithMetadata(fileId);

        // 如果是R2渠道的图片，需要删除R2中对应的图片
        if (img.metadata?.Channel === 'CloudflareR2') {
            const R2DataBase = env.img_r2;
            await R2DataBase.delete(fileId);
        }

        // S3 渠道的图片，需要删除S3中对应的图片
        if (img.metadata?.Channel === 'S3') {
            const success = await deleteS3File(img);
            if (!success) {
                throw new Error('S3 Delete Failed');
            }
        }

        // 删除KV存储中的记录
        await env.img_url.delete(fileId);

        // 清除CDN缓存
        await purgeCFCache(env, cdnUrl);

        // 清除randomFileList API缓存
        try {
            const cache = caches.default;
            const nullResponse = new Response(null, {
                headers: { 'Cache-Control': 'max-age=0' },
            });
            
            const normalizedFolder = fileId.split('/').slice(0, -1).join('/');
            await cache.put(`${url.origin}/api/randomFileList?dir=${normalizedFolder}`, nullResponse);
        } catch (error) {
            console.error('Failed to clear cache:', error);
        }

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