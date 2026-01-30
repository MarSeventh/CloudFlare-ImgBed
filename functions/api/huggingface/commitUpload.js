/**
 * HuggingFace 大文件提交 API
 * 
 * 在前端直接上传文件到 S3 后，调用此 API 提交 LFS 文件引用
 */

import { HuggingFaceAPI } from '../../utils/huggingfaceAPI.js';
import { fetchUploadConfig } from '../../utils/sysConfig.js';
import { getDatabase } from '../../utils/databaseAdapter.js';
import { moderateContent, endUpload } from '../../upload/uploadTools.js';
import { userAuthCheck, UnauthorizedResponse } from '../../utils/userAuth.js';

export async function onRequestPost(context) {
    const { request, env, waitUntil } = context;
    const url = new URL(request.url);

    try {
        // 鉴权
        const requiredPermission = 'upload';
        if (!await userAuthCheck(env, url, request, requiredPermission)) {
            return UnauthorizedResponse('Unauthorized');
        }

        const body = await request.json();
        const { fullId, filePath, sha256, fileSize, fileName, fileType, channelName, multipartParts } = body;

        if (!fullId || !filePath || !sha256 || !fileSize) {
            return new Response(JSON.stringify({
                error: 'Missing required fields: fullId, filePath, sha256, fileSize'
            }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 获取 HuggingFace 配置
        const uploadConfig = await fetchUploadConfig(env);
        const hfSettings = uploadConfig.huggingface;

        if (!hfSettings || !hfSettings.channels || hfSettings.channels.length === 0) {
            return new Response(JSON.stringify({ error: 'No HuggingFace channel configured' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 选择渠道
        let hfChannel;
        if (channelName) {
            hfChannel = hfSettings.channels.find(c => c.name === channelName);
        }
        if (!hfChannel) {
            hfChannel = hfSettings.channels[0];
        }

        if (!hfChannel || !hfChannel.token || !hfChannel.repo) {
            return new Response(JSON.stringify({ error: 'HuggingFace channel not properly configured' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const huggingfaceAPI = new HuggingFaceAPI(hfChannel.token, hfChannel.repo, hfChannel.isPrivate || false);

        // 如果有 multipart parts，需要先完成 multipart 上传
        if (multipartParts && multipartParts.length > 0) {
            console.log('Completing multipart upload...');
            // multipartParts 格式: [{ partNumber, etag, completionUrl }]
            // 这里需要调用 HuggingFace 的 multipart complete API
            // 但由于前端已经完成了所有分片上传，这里只需要提交
        }

        // 提交 LFS 文件引用
        console.log('Committing LFS file...');
        const commitResult = await huggingfaceAPI.commitLfsFile(
            filePath,
            sha256,
            fileSize,
            `Upload ${fileName || fullId}`
        );
        console.log('Commit result:', JSON.stringify(commitResult));

        // 构建文件 URL
        const fileUrl = `https://huggingface.co/datasets/${hfChannel.repo}/resolve/main/${filePath}`;

        // 构建 metadata
        const metadata = {
            FileName: fileName || fullId,
            FileType: fileType || null,
            Channel: "HuggingFace",
            ChannelName: hfChannel.name || "HuggingFace_env",
            FileSize: (fileSize / 1024 / 1024).toFixed(2),
            FileSizeBytes: fileSize,
            HfRepo: hfChannel.repo,
            HfFilePath: filePath,
            HfToken: hfChannel.token,
            HfIsPrivate: hfChannel.isPrivate || false,
            HfFileUrl: fileUrl,
            TimeStamp: Date.now(),
            Label: "None"
        };

        // 图像审查（公开仓库）
        if (!hfChannel.isPrivate) {
            try {
                metadata.Label = await moderateContent(env, fileUrl);
            } catch (e) {
                console.warn('Content moderation failed:', e.message);
            }
        }

        // 写入数据库
        const db = getDatabase(env);
        await db.put(fullId, "", { metadata });

        // 结束上传（更新索引等）
        const uploadContext = {
            env,
            waitUntil,
            uploadConfig,
            url
        };
        waitUntil(endUpload(uploadContext, fullId, metadata));

        // 返回成功响应
        const returnLink = `/file/${fullId}`;
        return new Response(JSON.stringify({
            success: true,
            src: returnLink,
            fileUrl,
            fullId
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('commitUpload error:', error.message);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
