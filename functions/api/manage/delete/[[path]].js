import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
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

    // 读取folder参数，判断是否为文件夹删除请求
    const folder = url.searchParams.get('folder');
    if (folder === 'true') {
        try {
            // 调用list API获取指定目录下的所有文件
            const folderPath = params.path.join('/');

            const listUrl = new URL(`${url.origin}/api/manage/list?count=-1&dir=${folderPath}`);
            const listRequest = new Request(listUrl, request);

            const listResponse = await fetch(listRequest);
            const listData = await listResponse.json();

            const files = listData.files;
            // 调用delete API删除文件夹下的所有文件
            for (const file of files) {
                const deleteUrl = new URL(`${url.origin}/api/manage/delete/${file.name}`);
                const deleteRequest = new Request(deleteUrl, request);

                await fetch(deleteRequest);
            }

            // 调用delete API删除所有子文件夹
            const directories = listData.directories;
            for (const dir of directories) {
                const deleteUrl = new URL(`${url.origin}/api/manage/delete/${dir}?folder=true`);
                const deleteRequest = new Request(deleteUrl, request);

                await fetch(deleteRequest);
            }

            // 返回成功信息
            return new Response('Folder Deleted');

        } catch (e) {
            return new Response('Error: Delete Folder Failed', { status: 400 });
        }
    }

    // 组装 CDN URL
    const cdnPath = url.pathname.replace('/api/manage/delete/', '');
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


    try {
        // 读取图片信息
        const img = await env.img_url.getWithMetadata(fileId);

        // 如果是R2渠道的图片，删除R2中对应的图片
        if (img.metadata?.Channel === 'CloudflareR2') {
            await env.img_r2.delete(fileId);
        }

        // S3 渠道的图片，删除S3中对应的图片
        if (img.metadata?.Channel === "S3") {
            const s3Client = new S3Client({
                region: img.metadata?.S3Region || "auto", // 默认使用 auto 区域
                endpoint: img.metadata?.S3Endpoint,
                credentials: {
                    accessKeyId: img.metadata?.S3AccessKeyId,
                    secretAccessKey: img.metadata?.S3SecretAccessKey
                },
            });

            const bucketName = img.metadata?.S3BucketName;
            const key = img.metadata?.S3FileKey;

            try {
                const command = new DeleteObjectCommand({
                    Bucket: bucketName,
                    Key: key,
                });

                await s3Client.send(command);
                
            } catch (error) {
                return new Response(`Error: S3 Delete Failed - ${error.message}`, { status: 500 });
            }
        }

        // 删除KV中的图片信息
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
        return new Response('Error: Delete Image Failed', { status: 400 });
    }
  }