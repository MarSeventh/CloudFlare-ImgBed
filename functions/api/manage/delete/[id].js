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
    // 组装 CDN URL
    const url = new URL(request.url);
    const cdnUrl = `https://${url.hostname}/file/${params.id}`;

    // 解码params.id
    params.id = decodeURIComponent(params.id);

    try {
      // 读取图片信息
      const img = await env.img_url.getWithMetadata(params.id);

      // 如果是R2渠道的图片，删除R2中对应的图片
      if (img.metadata?.Channel === 'CloudflareR2') {
          await env.img_r2.delete(params.id);
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
              forcePathStyle: true
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
      await env.img_url.delete(params.id);
      const info = JSON.stringify(params.id);

      // 清除CDN缓存
      await purgeCFCache(env, cdnUrl);
      
      // 清除api/randomFileList API缓存
      try {
          const cache = caches.default;
          // 通过写入一个max-age=0的response来清除缓存
          const nullResponse = new Response(null, {
              headers: { 'Cache-Control': 'max-age=0' },
          });
          await cache.put(`${url.origin}/api/randomFileList`, nullResponse);
      } catch (error) {
          console.error('Failed to clear cache:', error);
      }
      
      return new Response(info);
    } catch (e) {
      return new Response('Error: Delete Image Failed', { status: 400 });
    }
  }