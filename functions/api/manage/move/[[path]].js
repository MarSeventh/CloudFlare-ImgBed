import { S3Client, CopyObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { purgeCFCache } from "../../../utils/purgeCache";

export async function onRequest(context) {
    // Contents of context object
    const {
      request, // same as existing Worker API
      env, // same as existing Worker API
      params, // if filename includes [id] or [[path]]
      waitUntil, // same as ctx.waitUntil in existing Worker API
      next, // used for middleware or to fetch assets
      data, // arbitrary space for passing data between middlewares
    } = context;

    const url = new URL(request.url);

    // 读取目标文件夹
    const dist = url.searchParams.get('dist')
        ? url.searchParams.get('dist').replace(/^\/+/, '') // 移除开头的/
            .replace(/\/{2,}/g, '/') // 替换多个连续的/为单个/
            .replace(/\/$/, '') // 移除末尾的/
        : '';

    // 读取folder参数，判断是否为文件夹删除请求
    const folder = url.searchParams.get('folder');
    if (folder === 'true') {
        try {
            // 获取当前文件夹名称
            const curFolder = params.path[params.path.length - 1];

            // 调用list API获取指定目录下的所有文件
            const folderPath = params.path.join('/');

            const listUrl = new URL(`${url.origin}/api/manage/list?count=-1&dir=${folderPath}`);
            const listRequest = new Request(listUrl, request);

            const listResponse = await fetch(listRequest);
            const listData = await listResponse.json();

            const files = listData.files;

            const folderDist = dist === '' ? curFolder : `${dist}/${curFolder}`;
            // 调用move API移动文件夹下的所有文件
            for (const file of files) {
                const moveUrl = new URL(`${url.origin}/api/manage/move/${file.name}?dist=${folderDist}`);
                const moveRequest = new Request(moveUrl, request);

                await fetch(moveRequest);
            }        

            const directories = listData.directories;

            // 调用move API移动所有子文件夹
            for (const dir of directories) {
                const moveUrl = new URL(`${url.origin}/api/manage/move/${dir}?dist=${folderDist}&folder=true`);
                const moveRequest = new Request(moveUrl, request);

                await fetch(moveRequest);
            }

            // 返回成功信息
            return new Response('Folder Moved');

        } catch (e) {
            return new Response('Error: Move Folder Failed', { status: 400 });
        }
    }
    
    // 组装 CDN URL
    const cdnPath = url.pathname.replace('/api/manage/move/', '');
    const cdnUrl = `https://${url.hostname}/file/${cdnPath}`;

    // 从params中获取图片ID
    let fileId = '';
    try {
        // 解码params.path
        params.path = decodeURIComponent(params.path);
        // 从path中提取文件ID
        fileId = params.path.split(',').join('/');
    } catch (e) {
        return new Response('Error: Decode Image ID Failed', { status: 400 });
    }

    // 读取文件名
    const fileKey = fileId.split('/').pop();
    const newFileId = dist === '' ? fileKey : `${dist}/${fileKey}`;

    try {
        // 读取图片信息
        const img = await env.img_url.getWithMetadata(fileId);

        // 如果是R2渠道的图片，需要移动R2中对应的图片
        if (img.metadata?.Channel === 'CloudflareR2') {
            const R2DataBase = env.img_r2;

            // 获取原文件内容
            const object = await R2DataBase.get(fileId);
            if (!object) {
                return new Response('Error: R2 Object Not Found', { status: 404 });
            }

            // 复制到新位置
            await R2DataBase.put(newFileId, object.body);

            // 删除旧文件
            await R2DataBase.delete(fileId);
        }

        // S3 渠道的图片，需要移动S3中对应的图片
        if (img.metadata?.Channel === 'S3') {
            const { success, newKey, error } = await moveS3File(img, newFileId);
            if (success) {
                // 更新 metadata
                img.metadata.S3FileKey = newFileId;

                const s3ServerDomain = img.metadata.S3Endpoint.replace(/https?:\/\//, "");
                img.metadata.S3Location = `https://${img.metadata.S3BucketName}.${s3ServerDomain}/${newKey}`;
            }
        }

        // 旧版 Telegram 渠道和 Telegraph 渠道不支持移动
        if (img.metadata?.Channel === 'Telegram' || img.metadata?.Channel === undefined) {
            return new Response('Error: Move Image Failed', { status: 400 });
        }


        // 其他渠道，直接修改KV中的id为newFileId
        img.metadata.Folder = dist;
        await env.img_url.put(newFileId, img.value, { metadata: img.metadata });


        // 删除原有图片
        await env.img_url.delete(fileId);

        const info = JSON.stringify(fileId);

        // 清除CDN缓存
        await purgeCFCache(env, cdnUrl);
        
        // 清除api/randomFileList API缓存
        try {
            const cache = caches.default;
            // 通过写入一个max-age=0的response来清除缓存
            const nullResponse = new Response(null, {
                headers: { 'Cache-Control': 'max-age=0' },
            });
            
            const keys = await cache.keys();
            for (let key of keys) {
                if (key.url.includes('/api/randomFileList')) {
                    await cache.put(`${url.origin}/api/randomFileList`, nullResponse);
                }
            }
        } catch (error) {
            console.error('Failed to clear cache:', error);
        }
        
        return new Response(info);
    } catch (e) {
        return new Response('Error: Move Image Failed', { status: 400 });
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