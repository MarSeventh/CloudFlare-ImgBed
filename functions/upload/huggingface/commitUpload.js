/**
 * HuggingFace 大文件提交 API
 * 
 * 在前端直接上传文件到 S3 后，调用此 API 提交 LFS 文件引用
 */

import { HuggingFaceAPI } from '../../utils/huggingfaceAPI.js';
import { fetchUploadConfig } from '../../utils/sysConfig.js';
import { getDatabase } from '../../utils/databaseAdapter.js';
import { moderateContent, endUpload, getUploadIp, getIPAddress } from '../uploadTools.js';
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

        // 路径安全检查：防止篡改 fullId 进行路径穿越
        if (fullId.includes('..') || fullId.includes('\\')) {
            return new Response(JSON.stringify({
                error: 'Invalid fullId: contains illegal path characters'
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

        // 从 fullId 中提取目录信息
        const dirParts = fullId.split('/').slice(0, -1).join('/');
        const normalizedDirectory = dirParts === '' ? '' : dirParts + '/';

        // 获取上传IP和地址
        const uploadIp = getUploadIp(request) || '';
        const uploadAddress = await getIPAddress(uploadIp);

        // 构建 metadata
        const metadata = {
            FileName: fileName || fullId,
            FileType: fileType || '',
            Channel: "HuggingFace",
            ChannelName: hfChannel.name || "HuggingFace_env",
            FileSize: (fileSize / 1024 / 1024).toFixed(2),
            FileSizeBytes: fileSize,
            UploadIP: uploadIp,
            UploadAddress: uploadAddress,
            ListType: "None",
            HfRepo: hfChannel.repo,
            HfFilePath: filePath,
            HfToken: hfChannel.token,
            HfIsPrivate: hfChannel.isPrivate || false,
            HfFileUrl: fileUrl,
            TimeStamp: Date.now(),
            Label: "None",
            Directory: normalizedDirectory,
            Tags: []
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
