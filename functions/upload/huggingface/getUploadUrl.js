/**
 * HuggingFace 大文件直传 API
 *
 * 流程：
 * 1. 前端计算 SHA256 和文件样本
 * 2. 前端调用此 API 获取 LFS 上传 URL
 * 3. 前端直接上传到 HuggingFace S3
 * 4. 前端调用 commitUpload API 提交文件引用
 *
 * 这样可以绕过 CF Workers 的 100MB 请求体限制和 CPU 时间限制
 */

import { HuggingFaceAPI } from '../../utils/huggingfaceAPI.js';
import { fetchUploadConfig } from '../../utils/sysConfig.js';
import { userAuthCheck, UnauthorizedResponse } from '../../utils/userAuth.js';
import { buildUniqueFileId, getUploadIp, isBlockedUploadIp } from '../uploadTools.js';

export async function onRequestPost(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    context.url = url;  // 将 url 添加到 context 以便 buildUniqueFileId 使用

    try {
        // 鉴权
        const requiredPermission = 'upload';
        if (!await userAuthCheck(env, url, request, requiredPermission)) {
            return UnauthorizedResponse('Unauthorized');
        }

        // 检查上传IP是否被封禁
        const uploadIp = getUploadIp(request);
        if (await isBlockedUploadIp(env, uploadIp)) {
            return new Response(JSON.stringify({ error: 'IP blocked' }), {
                status: 403,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const body = await request.json();
        const { fileSize, fileName, fileType, sha256, fileSample, channelName, uploadNameType, uploadFolder } = body;

        if (!fileSize || !fileName || !fileType || !sha256 || !fileSample) {
            return new Response(JSON.stringify({
                error: 'Missing required fields: fileSize, fileName, fileType, sha256, fileSample'
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
            hfChannel = hfSettings.loadBalance?.enabled
                ? hfSettings.channels[Math.floor(Math.random() * hfSettings.channels.length)]
                : hfSettings.channels[0];
        }

        if (!hfChannel || !hfChannel.token || !hfChannel.repo) {
            return new Response(JSON.stringify({ error: 'HuggingFace channel not properly configured' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // 将命名参数添加到 URL 以便 buildUniqueFileId 使用
        if (uploadNameType) {
            url.searchParams.set('uploadNameType', uploadNameType);
        }
        if (uploadFolder) {
            url.searchParams.set('uploadFolder', uploadFolder);
        }

        // 使用统一的文件命名函数生成文件ID
        const fullId = await buildUniqueFileId(context, fileName, fileType || 'application/octet-stream');

        // 构建 HuggingFace 文件路径：直接使用 fullId（与其他渠道保持一致）
        const filePath = fullId;

        // 获取 LFS 上传信息
        const huggingfaceAPI = new HuggingFaceAPI(hfChannel.token, hfChannel.repo, hfChannel.isPrivate || false);
        const uploadInfo = await huggingfaceAPI.getLfsUploadInfo(fileSize, filePath, sha256, fileSample);

        // 返回上传信息
        return new Response(JSON.stringify({
            success: true,
            fullId,
            filePath,
            channelName: hfChannel.name,
            repo: hfChannel.repo,
            isPrivate: hfChannel.isPrivate || false,
            ...uploadInfo
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('getUploadUrl error:', error.message);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}
