/* ======= 客户端分块上传处理 ======= */
import { createResponse, selectConsistentChannel, getUploadIp, getIPAddress, buildUniqueFileId, endUpload } from './uploadTools';
import { TelegramAPI } from '../utils/telegramAPI';
import { DiscordAPI } from '../utils/discordAPI';
import { S3Client, CreateMultipartUploadCommand, UploadPartCommand, AbortMultipartUploadCommand } from "@aws-sdk/client-s3";
import { getDatabase, checkDatabaseConfig } from '../utils/databaseAdapter.js';

// 初始化分块上传
export async function initializeChunkedUpload(context) {
    const { request, env, url } = context;
    const db = getDatabase(env);

    try {
        // 解析表单数据
        const formdata = await request.formData();

        const originalFileName = formdata.get('originalFileName');
        const originalFileType = formdata.get('originalFileType');
        const totalChunks = parseInt(formdata.get('totalChunks'));

        if (!originalFileName || !originalFileType || !totalChunks) {
            return createResponse('Error: Missing initialization parameters', { status: 400 });
        }

        // 生成唯一的 uploadId
        const timestamp = Date.now();
        const random = Math.random().toString(36).slice(2, 11);
        const uploadId = `upload_${timestamp}_${random}`;

        // 获取上传IP
        const uploadIp = getUploadIp(request);
        const ipAddress = await getIPAddress(uploadIp);

        // 获取上传渠道
        const uploadChannel = url.searchParams.get('uploadChannel') || 'telegram';
        // 获取指定的渠道名称
        const channelName = url.searchParams.get('channelName') || '';

        // 存储上传会话信息
        const sessionInfo = {
            uploadId,
            originalFileName,
            originalFileType,
            totalChunks,
            uploadChannel,
            channelName,
            uploadIp,
            ipAddress,
            status: 'initialized',
            createdAt: timestamp,
            expiresAt: timestamp + 3600000 // 1小时过期
        };

        // 保存会话信息
        const sessionKey = `upload_session_${uploadId}`;
        await db.put(sessionKey, JSON.stringify(sessionInfo), {
            expirationTtl: 3600 // 1小时过期
        });

        return createResponse(JSON.stringify({
            success: true,
            uploadId,
            message: 'Chunked upload initialized successfully',
            sessionInfo: {
                uploadId,
                originalFileName,
                totalChunks,
                uploadChannel,
                channelName
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        return createResponse(`Error: Failed to initialize chunked upload - ${error.message}`, { status: 500 });
    }
}

// 处理客户端分块上传
export async function handleChunkUpload(context) {
    const { env, request, url, waitUntil } = context;
    const db = getDatabase(env);

    // 解析表单数据
    const formdata = await request.formData();
    context.formdata = formdata;

    try {
        const chunk = formdata.get('file');
        const chunkIndex = parseInt(formdata.get('chunkIndex'));
        const totalChunks = parseInt(formdata.get('totalChunks'));
        const uploadId = formdata.get('uploadId');
        const originalFileName = formdata.get('originalFileName');
        const originalFileType = formdata.get('originalFileType');

        if (!chunk || chunkIndex === null || !totalChunks || !uploadId || !originalFileName || !originalFileType) {
            return createResponse('Error: Missing chunk upload parameters', { status: 400 });
        }

        // 验证上传会话
        const sessionKey = `upload_session_${uploadId}`;
        const sessionData = await db.get(sessionKey);
        if (!sessionData) {
            return createResponse('Error: Invalid or expired upload session', { status: 400 });
        }

        const sessionInfo = JSON.parse(sessionData);

        // 验证会话信息
        if (sessionInfo.originalFileName !== originalFileName ||
            sessionInfo.totalChunks !== totalChunks) {
            return createResponse('Error: Session parameters mismatch', { status: 400 });
        }

        // 检查会话是否过期
        if (Date.now() > sessionInfo.expiresAt) {
            return createResponse('Error: Upload session expired', { status: 410 });
        }

        // 获取上传渠道
        const uploadChannel = url.searchParams.get('uploadChannel') || sessionInfo.uploadChannel || 'telegram';
        // 获取指定的渠道名称
        const channelName = url.searchParams.get('channelName') || sessionInfo.channelName || '';

        // 将渠道名称存入 context
        context.specifiedChannelName = channelName;

        // 立即创建分块记录，标记为"uploading"状态
        const chunkKey = `chunk_${uploadId}_${chunkIndex.toString().padStart(3, '0')}`;
        const chunkData = await chunk.arrayBuffer();
        const uploadStartTime = Date.now();
        const initialChunkMetadata = {
            uploadId,
            chunkIndex,
            totalChunks,
            originalFileName,
            originalFileType,
            chunkSize: chunkData.byteLength,
            uploadTime: uploadStartTime,
            uploadStartTime: uploadStartTime,
            status: 'uploading',
            uploadChannel,
            timeoutThreshold: uploadStartTime + 60000 // 1分钟超时阈值
        };

        // 立即保存分块记录和数据，设置过期时间
        const { usingD1 } = checkDatabaseConfig(env);
        await db.put(chunkKey, usingD1 ? '' : chunkData, {
            metadata: initialChunkMetadata,
            expirationTtl: 3600 // 1小时过期
        });

        // 同步上传分块到存储端，添加超时保护
        await uploadChunkToStorageWithTimeout(context, chunkIndex, totalChunks, uploadId, originalFileName, originalFileType, uploadChannel, usingD1 ? chunkData : undefined);

        return createResponse(JSON.stringify({
            success: true,
            message: `Chunk ${chunkIndex + 1}/${totalChunks} received and being uploaded`,
            uploadId,
            chunkIndex
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        return createResponse(`Error: Failed to upload chunk - ${error.message}`, { status: 500 });
    }
}

// 处理清理请求
export async function handleCleanupRequest(context, uploadId, totalChunks) {
    try {
        if (!uploadId) {
            return createResponse(JSON.stringify({
                error: 'Missing uploadId parameter'
            }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        // 强制清理所有相关数据
        await forceCleanupUpload(context, uploadId, totalChunks);

        return createResponse(JSON.stringify({
            success: true,
            message: `Cleanup completed for upload ${uploadId}`,
            uploadId: uploadId,
            cleanedChunks: totalChunks
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        return createResponse(JSON.stringify({
            error: `Cleanup failed: ${error.message}`,
            uploadId: uploadId
        }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}

/* ======= 单个分块上传到不同渠道的存储端 ======= */

// 带超时保护的异步上传分块到存储端
async function uploadChunkToStorageWithTimeout(context, chunkIndex, totalChunks, uploadId, originalFileName, originalFileType, uploadChannel, chunkData) {
    const { env } = context;
    const db = getDatabase(env);
    const chunkKey = `chunk_${uploadId}_${chunkIndex.toString().padStart(3, '0')}`;
    const UPLOAD_TIMEOUT = 180000; // 3分钟超时

    try {
        // 设置超时 Promise
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Upload timeout')), UPLOAD_TIMEOUT);
        });

        // 执行实际上传
        const uploadPromise = uploadChunkToStorage(context, chunkIndex, totalChunks, uploadId, originalFileName, originalFileType, uploadChannel, chunkData);

        // 竞速执行
        await Promise.race([uploadPromise, timeoutPromise]);

    } catch (error) {
        console.error(`Chunk ${chunkIndex} upload failed or timed out:`, error);

        // 超时或失败时，更新状态为超时/失败
        try {
            const chunkRecord = await db.getWithMetadata(chunkKey, { type: 'arrayBuffer' });
            if (chunkRecord && chunkRecord.metadata) {
                const isTimeout = error.message === 'Upload timeout';
                const errorMetadata = {
                    ...chunkRecord.metadata,
                    status: isTimeout ? 'timeout' : 'failed',
                    error: error.message,
                    failedTime: Date.now(),
                    isTimeout: isTimeout
                };

                // 保留原始数据以便重试
                await db.put(chunkKey, chunkRecord.value, {
                    metadata: errorMetadata,
                    expirationTtl: 3600
                });
            }
        } catch (metaError) {
            console.error('Failed to save timeout/error metadata:', metaError);
        }
    }
}

// 异步上传分块到存储端，失败自动重试
async function uploadChunkToStorage(context, chunkIndex, totalChunks, uploadId, originalFileName, originalFileType, uploadChannel, chunkData) {
    const { env } = context;
    const db = getDatabase(env);

    const chunkKey = `chunk_${uploadId}_${chunkIndex.toString().padStart(3, '0')}`;

    const MAX_RETRIES = 3;

    try {
        let chunkMetadata;

        if (chunkData !== undefined) {
            const chunkRecord = await db.getWithMetadata(chunkKey);
            chunkMetadata = (chunkRecord && chunkRecord.metadata) ? chunkRecord.metadata : {};
        } else {
            // 从数据库读取分块数据和metadata
            const chunkRecord = await db.getWithMetadata(chunkKey, { type: 'arrayBuffer' });
            if (!chunkRecord || !chunkRecord.value) {
                console.error(`Chunk ${chunkIndex} data not found in database`);
                return;
            }

            chunkData = chunkRecord.value;
            chunkMetadata = chunkRecord.metadata;
        }

        for (let retry = 0; retry < MAX_RETRIES; retry++) {
            // 根据渠道上传分块
            let uploadResult = null;

            if (uploadChannel === 'cfr2') {
                uploadResult = await uploadSingleChunkToR2Multipart(context, chunkData, chunkIndex, totalChunks, uploadId, originalFileName, originalFileType);
            } else if (uploadChannel === 's3') {
                uploadResult = await uploadSingleChunkToS3Multipart(context, chunkData, chunkIndex, totalChunks, uploadId, originalFileName, originalFileType);
            } else if (uploadChannel === 'telegram') {
                uploadResult = await uploadSingleChunkToTelegram(context, chunkData, chunkIndex, totalChunks, uploadId, originalFileName, originalFileType);
            } else if (uploadChannel === 'discord') {
                uploadResult = await uploadSingleChunkToDiscord(context, chunkData, chunkIndex, totalChunks, uploadId, originalFileName, originalFileType);
            }

            if (uploadResult && uploadResult.success) {
                // 上传成功，更新状态并保存上传信息
                const updatedMetadata = {
                    ...chunkMetadata,
                    status: 'completed',
                    uploadResult: uploadResult,
                    completedTime: Date.now()
                };

                // 只保存metadata，不保存原始数据，设置过期时间
                await db.put(chunkKey, '', {
                    metadata: updatedMetadata,
                    expirationTtl: 3600 // 1小时过期
                });

                console.log(`Chunk ${chunkIndex} uploaded successfully to ${uploadChannel}`);

                break;
            } else if (retry === MAX_RETRIES - 1) {
                // 最后一次上传失败，标记为失败状态并保留原始数据以便重试
                const failedMetadata = {
                    ...chunkMetadata,
                    status: 'failed',
                    error: uploadResult ? uploadResult.error : 'Unknown error',
                    failedTime: Date.now()
                };

                // 保留原始数据以便重试，设置过期时间
                await db.put(chunkKey, chunkData, {
                    metadata: failedMetadata,
                    expirationTtl: 3600 // 1小时过期
                });

                console.warn(`Chunk ${chunkIndex} upload failed: ${failedMetadata.error}`);
            }
        }

    } catch (error) {
        console.error(`Error uploading chunk ${chunkIndex}:`, error);

        // 发生异常时，确保保留原始数据并标记为失败
        try {
            const chunkRecord = await db.getWithMetadata(chunkKey, { type: 'arrayBuffer' });
            if (chunkRecord && chunkRecord.metadata) {
                const errorMetadata = {
                    ...chunkRecord.metadata,
                    status: 'failed',
                    error: error.message,
                    failedTime: Date.now()
                };

                await db.put(chunkKey, chunkRecord.value, {
                    metadata: errorMetadata,
                    expirationTtl: 3600 // 1小时过期
                });
            }
        } catch (metaError) {
            console.error('Failed to save error metadata:', metaError);
        }
    }
}

// 上传单个分块到R2 (Multipart Upload)
async function uploadSingleChunkToR2Multipart(context, chunkData, chunkIndex, totalChunks, uploadId, originalFileName, originalFileType) {
    const { env, uploadConfig } = context;
    const db = getDatabase(env);

    try {
        const r2Settings = uploadConfig.cfr2;
        if (!r2Settings.channels || r2Settings.channels.length === 0) {
            return { success: false, error: 'No R2 channel provided' };
        }

        const R2DataBase = env.img_r2;
        const multipartKey = `multipart_${uploadId}`;

        let finalFileId;

        // 如果是第一个分块，生成并保存 finalFileId
        if (chunkIndex === 0) {
            finalFileId = await buildUniqueFileId(context, originalFileName, originalFileType);

            const multipartUpload = await R2DataBase.createMultipartUpload(finalFileId);
            const multipartInfo = {
                uploadId: multipartUpload.uploadId,
                key: finalFileId
            };

            // 保存multipart info
            await db.put(multipartKey, JSON.stringify(multipartInfo), {
                expirationTtl: 3600 // 1小时过期
            });
        } else {
            // 其他分块需要等待第一个分块完成multipart upload初始化
            let multipartInfoData = null;
            let retryCount = 0;
            const maxRetries = 30; // 最多等待60秒

            while (!multipartInfoData && retryCount < maxRetries) {
                multipartInfoData = await db.get(multipartKey);
                if (!multipartInfoData) {
                    // 等待2秒后重试
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    retryCount++;
                    console.log(`R2 chunk ${chunkIndex} waiting for multipart initialization... (${retryCount}/${maxRetries})`);
                }
            }

            if (!multipartInfoData) {
                return { success: false, error: 'Multipart upload not initialized after waiting' };
            }

            const multipartInfo = JSON.parse(multipartInfoData);
            finalFileId = multipartInfo.key;
        }

        // 获取multipart info
        const multipartInfoData = await db.get(multipartKey);
        if (!multipartInfoData) {
            return { success: false, error: 'Multipart upload not initialized' };
        }

        const multipartInfo = JSON.parse(multipartInfoData);

        // 上传分块
        const multipartUpload = R2DataBase.resumeMultipartUpload(finalFileId, multipartInfo.uploadId);
        const uploadedPart = await multipartUpload.uploadPart(chunkIndex + 1, chunkData);

        if (!uploadedPart || !uploadedPart.etag) {
            throw new Error(`Failed to upload part ${chunkIndex + 1} to R2`);
        }

        return {
            success: true,
            partNumber: chunkIndex + 1,
            etag: uploadedPart.etag,
            size: chunkData.byteLength,
            uploadTime: Date.now(),
            multipartUploadId: multipartInfo.uploadId,
            key: finalFileId
        };

    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

// 上传单个分块到S3 (Multipart Upload)
async function uploadSingleChunkToS3Multipart(context, chunkData, chunkIndex, totalChunks, uploadId, originalFileName, originalFileType) {
    const { env, uploadConfig, specifiedChannelName } = context;
    const db = getDatabase(env);

    try {
        const s3Settings = uploadConfig.s3;
        const s3Channels = s3Settings.channels;
        
        // 优先使用指定的渠道名称
        let s3Channel;
        if (specifiedChannelName) {
            s3Channel = s3Channels.find(ch => ch.name === specifiedChannelName);
        }
        if (!s3Channel) {
            s3Channel = selectConsistentChannel(s3Channels, uploadId, s3Settings.loadBalance.enabled);
        }

        console.log(`Uploading S3 chunk ${chunkIndex} for uploadId: ${uploadId}, selected channel: ${s3Channel.name || 'default'}`);

        if (!s3Channel) {
            return { success: false, error: 'No S3 channel provided' };
        }

        const { endpoint, pathStyle, accessKeyId, secretAccessKey, bucketName, region } = s3Channel;

        const s3Client = new S3Client({
            region: region || "auto",
            endpoint,
            credentials: { accessKeyId, secretAccessKey },
            forcePathStyle: pathStyle
        });

        const multipartKey = `multipart_${uploadId}`;


        let finalFileId;

        // 如果是第一个分块，生成并保存 finalFileId
        if (chunkIndex === 0) {
            finalFileId = await buildUniqueFileId(context, originalFileName, originalFileType);

            const createResponse = await s3Client.send(new CreateMultipartUploadCommand({
                Bucket: bucketName,
                Key: finalFileId,
                ContentType: originalFileType || 'application/octet-stream'
            }));

            const multipartInfo = {
                uploadId: createResponse.UploadId,
                key: finalFileId
            };

            // 保存multipart info
            await db.put(multipartKey, JSON.stringify(multipartInfo), {
                expirationTtl: 3600 // 1小时过期
            });
        } else {
            // 其他分块需要等待第一个分块完成multipart upload初始化
            let multipartInfoData = null;
            let retryCount = 0;
            const maxRetries = 30; // 最多等待60秒

            while (!multipartInfoData && retryCount < maxRetries) {
                multipartInfoData = await db.get(multipartKey);
                if (!multipartInfoData) {
                    // 等待2秒后重试
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    retryCount++;
                    console.log(`S3 chunk ${chunkIndex} waiting for multipart initialization... (${retryCount}/${maxRetries})`);
                }
            }

            if (!multipartInfoData) {
                return { success: false, error: 'Multipart upload not initialized after waiting' };
            }

            const multipartInfo = JSON.parse(multipartInfoData);
            finalFileId = multipartInfo.key;
        }

        // 获取multipart info
        const multipartInfoData = await db.get(multipartKey);
        if (!multipartInfoData) {
            return { success: false, error: 'Multipart upload not initialized' };
        }

        const multipartInfo = JSON.parse(multipartInfoData);

        // 上传分块
        const uploadResponse = await s3Client.send(new UploadPartCommand({
            Bucket: bucketName,
            Key: finalFileId,
            PartNumber: chunkIndex + 1,
            UploadId: multipartInfo.uploadId,
            Body: new Uint8Array(chunkData)
        }));

        if (!uploadResponse || !uploadResponse.ETag) {
            throw new Error(`Failed to upload part ${chunkIndex + 1} to S3`);
        }

        return {
            success: true,
            partNumber: chunkIndex + 1,
            etag: uploadResponse.ETag,
            size: chunkData.byteLength,
            uploadTime: Date.now(),
            s3Channel: s3Channel.name,
            multipartUploadId: multipartInfo.uploadId,
            key: finalFileId
        };

    } catch (error) {
        console.error(`S3 chunk upload error (chunk ${chunkIndex}):`, error.message, error.name, error.$metadata);
        return {
            success: false,
            error: error.message
        };
    }
}

// 上传单个分块到Telegram
async function uploadSingleChunkToTelegram(context, chunkData, chunkIndex, totalChunks, uploadId, originalFileName, originalFileType) {
    const { uploadConfig, specifiedChannelName } = context;

    try {
        const tgSettings = uploadConfig.telegram;
        const tgChannels = tgSettings.channels;
        
        // 优先使用指定的渠道名称
        let tgChannel;
        if (specifiedChannelName) {
            tgChannel = tgChannels.find(ch => ch.name === specifiedChannelName);
        }
        if (!tgChannel) {
            tgChannel = selectConsistentChannel(tgChannels, uploadId, tgSettings.loadBalance.enabled);
        }

        console.log(`Uploading Telegram chunk ${chunkIndex} for uploadId: ${uploadId}, selected channel: ${tgChannel.name || 'default'}`);

        if (!tgChannel) {
            return { success: false, error: 'No Telegram channel provided' };
        }

        const tgBotToken = tgChannel.botToken;
        const tgChatId = tgChannel.chatId;
        const tgProxyUrl = tgChannel.proxyUrl || '';

        // 创建分块文件名
        const chunkFileName = `${originalFileName}.part${chunkIndex.toString().padStart(3, '0')}`;
        const chunkBlob = new Blob([chunkData], { type: 'application/octet-stream' });

        // 上传分块到Telegram（支持代理域名）
        const chunkInfo = await uploadChunkToTelegramWithRetry(
            tgBotToken,
            tgChatId,
            tgProxyUrl,
            chunkBlob,
            chunkFileName,
            chunkIndex,
            totalChunks, // 传入正确的totalChunks
            2 // maxRetries
        );

        if (!chunkInfo) {
            return { success: false, error: 'Failed to upload chunk to Telegram' };
        }

        return {
            success: true,
            fileId: chunkInfo.file_id,
            size: chunkInfo.file_size,
            fileName: chunkFileName,
            uploadTime: Date.now(),
            tgChannel: tgChannel.name
        };

    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

// 上传单个分块到Discord
async function uploadSingleChunkToDiscord(context, chunkData, chunkIndex, totalChunks, uploadId, originalFileName, originalFileType) {
    const { uploadConfig, specifiedChannelName } = context;

    try {
        const discordSettings = uploadConfig.discord;
        const discordChannels = discordSettings.channels;
        
        // 优先使用指定的渠道名称
        let discordChannel;
        if (specifiedChannelName) {
            discordChannel = discordChannels.find(ch => ch.name === specifiedChannelName);
        }
        if (!discordChannel) {
            discordChannel = selectConsistentChannel(discordChannels, uploadId, discordSettings.loadBalance?.enabled);
        }

        console.log(`Uploading Discord chunk ${chunkIndex} for uploadId: ${uploadId}, selected channel: ${discordChannel.name || 'default'}`);

        if (!discordChannel) {
            return { success: false, error: 'No Discord channel provided' };
        }

        const botToken = discordChannel.botToken;
        const channelId = discordChannel.channelId;

        // 创建分块文件名
        const chunkFileName = `${originalFileName}.part${chunkIndex.toString().padStart(3, '0')}`;
        const chunkBlob = new Blob([chunkData], { type: 'application/octet-stream' });

        // 上传分块到Discord（带重试）
        const chunkInfo = await uploadChunkToDiscordWithRetry(
            botToken,
            channelId,
            chunkBlob,
            chunkFileName,
            chunkIndex,
            totalChunks,
            2 // maxRetries
        );

        if (!chunkInfo) {
            return { success: false, error: 'Failed to upload chunk to Discord' };
        }

        return {
            success: true,
            messageId: chunkInfo.message_id,
            // 注意：不存储 attachmentId 和 url，因为它们会在约24小时后过期
            // 读取时会通过 messageId 获取新的 URL
            size: chunkInfo.file_size,
            fileName: chunkFileName,
            uploadTime: Date.now(),
            discordChannel: discordChannel.name
        };

    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

// 将每个分块上传至Discord，支持失败重试和 rate limit 处理
async function uploadChunkToDiscordWithRetry(botToken, channelId, chunkBlob, chunkFileName, chunkIndex, totalChunks, maxRetries = 2) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const discordAPI = new DiscordAPI(botToken);

            const response = await discordAPI.sendFile(chunkBlob, channelId, chunkFileName);

            if (!response || !response.id) {
                throw new Error('Invalid Discord response');
            }

            const fileInfo = discordAPI.getFileInfo(response);
            if (!fileInfo) {
                throw new Error('Failed to extract file info from response');
            }

            return fileInfo;

        } catch (error) {
            console.warn(`Discord chunk ${chunkIndex} upload attempt ${attempt + 1} failed:`, error.message);

            // 检查是否是 rate limit (429)
            if (error.message && error.message.includes('429')) {
                // 从错误消息中提取 retry_after，或使用默认值
                const retryAfter = 5000; // 默认等待 5 秒
                console.log(`Discord rate limited, waiting ${retryAfter}ms...`);
                await new Promise(resolve => setTimeout(resolve, retryAfter));
                continue; // 不计入重试次数
            }

            if (attempt === maxRetries - 1) {
                return null; // 最后一次尝试也失败了
            }

            // 指数退避延迟
            await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
        }
    }

    return null;
}

/* ======== 分块合并时与上传相关的工具函数 ======= */

// 重传失败的分块
// 并发重试失败的分块
export async function retryFailedChunks(context, failedChunks, uploadChannel, options = {}) {
    const {
        maxRetries = 5,
        retryTimeout = 60000, // 60秒重试超时
        maxConcurrency = 3, // 最大并发数
        batchSize = 6 // 每批处理的分块数
    } = options;

    if (!failedChunks || failedChunks.length === 0) {
        console.log('No failed chunks to retry');
        return { success: true, results: [] };
    }

    console.log(`Starting concurrent retry for ${failedChunks.length} failed chunks with max concurrency: ${maxConcurrency}`);

    const results = [];
    const chunksToRetry = failedChunks.filter(chunk =>
        chunk.hasData &&
        chunk.status !== 'uploading' &&
        chunk.status !== 'completed'
    );

    if (chunksToRetry.length === 0) {
        console.log('No chunks need retry (all are either uploading, completed, or have no data)');
        return { success: true, results: [] };
    }

    // 分批处理以控制并发
    for (let i = 0; i < chunksToRetry.length; i += batchSize) {
        const batch = chunksToRetry.slice(i, i + batchSize);
        console.log(`Processing batch ${Math.floor(i / batchSize) + 1}: chunks ${batch.map(c => c.index).join(', ')}`);

        // 创建并发控制的重试任务
        const retryTasks = batch.map(async (chunk) => {
            return retrySingleChunk(context, chunk, uploadChannel, maxRetries, retryTimeout);
        });

        // 限制并发数量
        const batchResults = [];
        for (let j = 0; j < retryTasks.length; j += maxConcurrency) {
            const concurrentTasks = retryTasks.slice(j, j + maxConcurrency);
            const concurrentResults = await Promise.allSettled(concurrentTasks);

            for (const result of concurrentResults) {
                if (result.status === 'fulfilled') {
                    batchResults.push(result.value);
                } else {
                    console.error('Retry task failed:', result.reason);
                    batchResults.push({
                        success: false,
                        chunk: null,
                        error: result.reason?.message || 'Task failed',
                        reason: 'task_error'
                    });
                }
            }
        }

        results.push(...batchResults);

        // 批次间稍作延迟
        if (i + batchSize < chunksToRetry.length) {
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    }

    // 统计结果
    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    console.log(`Retry completed: ${successCount} successful, ${failureCount} failed out of ${results.length} chunks`);

    // 记录失败的分块信息
    const failedResults = results.filter(r => !r.success);
    if (failedResults.length > 0) {
        console.warn('Failed chunks:', failedResults.map(r => ({
            index: r.chunk?.index,
            reason: r.reason,
            error: r.error
        })));
    }

    return {
        success: failureCount === 0,
        results,
        summary: {
            total: results.length,
            successful: successCount,
            failed: failureCount,
            failedChunks: failedResults.map(r => r.chunk?.index).filter(Boolean)
        }
    };
}

// 重试单个失败的分块
async function retrySingleChunk(context, chunk, uploadChannel, maxRetries = 5, retryTimeout = 60000) {
    const { env } = context;
    const db = getDatabase(env);

    let retryCount = 0;
    let lastError = null;

    try {
        const chunkRecord = await db.getWithMetadata(chunk.key, { type: 'arrayBuffer' });
        if (!chunkRecord || !chunkRecord.value) {
            console.error(`Chunk ${chunk.index} data missing for retry`);
            return { success: false, chunk, reason: 'data_missing', error: 'Chunk data not found' };
        }

        const chunkData = chunkRecord.value;
        const originalFileName = chunkRecord.metadata?.originalFileName || 'unknown';
        const originalFileType = chunkRecord.metadata?.originalFileType || 'application/octet-stream';
        const uploadId = chunkRecord.metadata?.uploadId;
        const totalChunks = chunkRecord.metadata?.totalChunks || 1;

        // 更新重试状态
        const retryMetadata = {
            ...chunkRecord.metadata,
            status: 'retrying',
        };

        await db.put(chunk.key, chunkData, {
            metadata: retryMetadata,
            expirationTtl: 3600
        });

        while (retryCount < maxRetries) {
            // 根据渠道重新上传，添加超时保护
            const retryPromise = (async () => {
                if (uploadChannel === 'cfr2') {
                    return await uploadSingleChunkToR2Multipart(context, chunkData, chunk.index, totalChunks, uploadId, originalFileName, originalFileType);
                } else if (uploadChannel === 's3') {
                    return await uploadSingleChunkToS3Multipart(context, chunkData, chunk.index, totalChunks, uploadId, originalFileName, originalFileType);
                } else if (uploadChannel === 'telegram') {
                    return await uploadSingleChunkToTelegram(context, chunkData, chunk.index, totalChunks, uploadId, originalFileName, originalFileType);
                } else if (uploadChannel === 'discord') {
                    return await uploadSingleChunkToDiscord(context, chunkData, chunk.index, totalChunks, uploadId, originalFileName, originalFileType);
                }
                return null;
            })();

            const timeoutPromise = new Promise((resolve) => {
                setTimeout(() => resolve({
                    success: false,
                    error: 'Retry timeout'
                }), retryTimeout);
            });

            const uploadResult = await Promise.race([retryPromise, timeoutPromise]);

            if (uploadResult && uploadResult.success) {
                // 更新状态为成功
                const updatedMetadata = {
                    ...chunkRecord.metadata,
                    status: 'completed',
                    uploadResult: uploadResult,
                    retryCount: retryCount + 1,
                    completedTime: Date.now()
                };

                // 删除原始数据，只保留上传结果，设置过期时间
                await db.put(chunk.key, '', {
                    metadata: updatedMetadata,
                    expirationTtl: 3600 // 1小时过期
                });

                console.log(`Chunk ${chunk.index} retry successful after ${retryCount + 1} attempts`);
                return { success: true, chunk, retryCount: retryCount + 1 };
            } else if (retryCount === maxRetries - 1) {
                throw new Error(uploadResult?.error || 'Unknown retry error');
            }

            retryCount++;
            lastError = uploadResult?.error || 'Unknown error';
            console.warn(`Chunk ${chunk.index} retry ${retryCount} failed: ${lastError}`);
        }
    } catch (error) {
        lastError = error;
        const isTimeout = error.message === 'Retry timeout';
        console.warn(`Chunk ${chunk.index} retry ${retryCount} ${isTimeout ? 'timed out' : 'failed'}: ${error.message}`);

        // 更新重试失败状态
        try {
            const chunkRecord = await db.getWithMetadata(chunk.key, { type: 'arrayBuffer' });
            if (chunkRecord) {
                const failedRetryMetadata = {
                    ...chunkRecord.metadata,
                    status: isTimeout ? 'retry_timeout' : 'retry_failed'
                };

                await db.put(chunk.key, chunkRecord.value, {
                    metadata: failedRetryMetadata,
                    expirationTtl: 3600
                });
            }
        } catch (metaError) {
            console.error(`Failed to update retry error metadata for chunk ${chunk.index}:`, metaError);
        }

        if (retryCount < maxRetries) {
            // 指数退避延迟
            const delay = Math.min(1000 * Math.pow(2, retryCount - 1), 10000);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    console.error(`Chunk ${chunk.index} failed after ${maxRetries} retry attempts`);
    return { success: false, chunk, retryCount, error: lastError?.message || 'Max retries exceeded' };
}


// 清理失败的multipart upload
export async function cleanupFailedMultipartUploads(context, uploadId, uploadChannel) {
    const { env, uploadConfig } = context;
    const db = getDatabase(env);

    try {
        const multipartKey = `multipart_${uploadId}`;
        const multipartInfoData = await db.get(multipartKey);

        if (!multipartInfoData) {
            return; // 没有multipart upload需要清理
        }

        const multipartInfo = JSON.parse(multipartInfoData);

        if (uploadChannel === 'cfr2') {
            // 清理R2 multipart upload
            const R2DataBase = env.img_r2;
            const multipartUpload = R2DataBase.resumeMultipartUpload(multipartInfo.key, multipartInfo.uploadId);
            await multipartUpload.abort();

        } else if (uploadChannel === 's3') {
            // 清理S3 multipart upload
            const s3Settings = uploadConfig.s3;
            const s3Channels = s3Settings.channels;
            
            // 优先使用指定的渠道名称
            let s3Channel;
            const specifiedChannelName = context.specifiedChannelName;
            if (specifiedChannelName) {
                s3Channel = s3Channels.find(ch => ch.name === specifiedChannelName);
            }
            if (!s3Channel) {
                s3Channel = selectConsistentChannel(s3Channels, uploadId, s3Settings.loadBalance.enabled);
            }

            if (s3Channel) {
                const { endpoint, pathStyle, accessKeyId, secretAccessKey, bucketName, region } = s3Channel;

                const s3Client = new S3Client({
                    region: region || "auto",
                    endpoint,
                    credentials: { accessKeyId, secretAccessKey },
                    forcePathStyle: pathStyle
                });

                await s3Client.send(new AbortMultipartUploadCommand({
                    Bucket: bucketName,
                    Key: multipartInfo.key,
                    UploadId: multipartInfo.uploadId
                }));
            }
        }

        // 清理multipart info
        await db.delete(multipartKey);
        console.log(`Cleaned up failed multipart upload for ${uploadId}`);

    } catch (error) {
        console.error(`Failed to cleanup multipart upload for ${uploadId}:`, error);
    }
}


// 检查分块上传状态
export async function checkChunkUploadStatuses(env, uploadId, totalChunks) {
    const chunkStatuses = [];
    const currentTime = Date.now();

    const db = getDatabase(env);

    for (let i = 0; i < totalChunks; i++) {
        const chunkKey = `chunk_${uploadId}_${i.toString().padStart(3, '0')}`;
        try {
            const chunkRecord = await db.getWithMetadata(chunkKey, { type: 'arrayBuffer' });
            if (chunkRecord && chunkRecord.metadata) {
                let status = chunkRecord.metadata.status || 'unknown';

                // 检查上传超时：如果状态是 uploading 但超过了超时阈值，标记为超时
                if (status === 'uploading' && chunkRecord.metadata.timeoutThreshold && currentTime > chunkRecord.metadata.timeoutThreshold) {
                    status = 'timeout';

                    // 更新状态为超时
                    const timeoutMetadata = {
                        ...chunkRecord.metadata,
                        status: 'timeout',
                        error: 'Upload timeout detected',
                        timeoutDetectedTime: currentTime
                    };

                    await db.put(chunkKey, chunkRecord.value, {
                        metadata: timeoutMetadata,
                        expirationTtl: 3600
                    }).catch(err => console.warn(`Failed to update timeout status for chunk ${i}:`, err));
                }

                let hasData = false;
                if (status === 'completed') {
                    // 已完成的分块，不存储原始数据
                    hasData = false;
                } else if (status === 'uploading' || status === 'failed' || status === 'timeout') {
                    // 正在上传、失败或超时的分块通过原始数据判断
                    hasData = (chunkRecord.value && chunkRecord.value.byteLength > 0);
                } else {
                    // 其他状态也检查是否有数据
                    hasData = (chunkRecord.value && chunkRecord.value.byteLength > 0);
                }

                chunkStatuses.push({
                    index: i,
                    key: chunkKey,
                    status: status,
                    uploadResult: chunkRecord.metadata.uploadResult,
                    error: chunkRecord.metadata.error,
                    hasData: hasData,
                    chunkSize: chunkRecord.metadata.chunkSize,
                    uploadTime: chunkRecord.metadata.uploadTime,
                    uploadStartTime: chunkRecord.metadata.uploadStartTime,
                    timeoutThreshold: chunkRecord.metadata.timeoutThreshold,
                    uploadChannel: chunkRecord.metadata.uploadChannel,
                    isTimeout: status === 'timeout'
                });
            } else {
                chunkStatuses.push({
                    index: i,
                    key: chunkKey,
                    status: 'missing',
                    hasData: false
                });
            }
        } catch (error) {
            chunkStatuses.push({
                index: i,
                key: chunkKey,
                status: 'error',
                error: error.message,
                hasData: false
            });
        }
    }

    return chunkStatuses;
}


// 清理临时分块数据
export async function cleanupChunkData(env, uploadId, totalChunks) {
    try {
        const db = getDatabase(env);

        for (let i = 0; i < totalChunks; i++) {
            const chunkKey = `chunk_${uploadId}_${i.toString().padStart(3, '0')}`;

            // 删除数据库中的分块记录
            await db.delete(chunkKey);
        }

        // 清理multipart info（如果存在）
        const multipartKey = `multipart_${uploadId}`;
        await db.delete(multipartKey);

    } catch (cleanupError) {
        console.warn('Failed to cleanup chunk data:', cleanupError);
    }
}

// 清理上传会话
export async function cleanupUploadSession(env, uploadId) {
    try {
        const db = getDatabase(env);

        const sessionKey = `upload_session_${uploadId}`;
        await db.delete(sessionKey);
        console.log(`Cleaned up upload session for ${uploadId}`);
    } catch (cleanupError) {
        console.warn('Failed to cleanup upload session:', cleanupError);
    }
}

// 强制清理所有相关数据（用于彻底清理失败的上传）
export async function forceCleanupUpload(context, uploadId, totalChunks) {
    const { env } = context;
    const db = getDatabase(env);

    try {
        // 读取 session 信息
        const sessionKey = `upload_session_${uploadId}`;
        const sessionRecord = await db.get(sessionKey);
        const uploadChannel = sessionRecord ? JSON.parse(sessionRecord).uploadChannel : 'cfr2'; // 默认使用 cfr2

        // 清理 multipart upload信息
        await cleanupFailedMultipartUploads(context, uploadId, uploadChannel);

        const cleanupPromises = [];

        // 清理所有分块
        for (let i = 0; i < totalChunks; i++) {
            const chunkKey = `chunk_${uploadId}_${i.toString().padStart(3, '0')}`;
            cleanupPromises.push(db.delete(chunkKey).catch(err =>
                console.warn(`Failed to delete chunk ${i}:`, err)
            ));
        }

        // 清理相关的键
        const keysToCleanup = [
            `upload_session_${uploadId}`,
            `multipart_${uploadId}`
        ];

        keysToCleanup.forEach(key => {
            cleanupPromises.push(db.delete(key).catch(err =>
                console.warn(`Failed to delete key ${key}:`, err)
            ));
        });

        await Promise.allSettled(cleanupPromises);
        console.log(`Force cleanup completed for ${uploadId}`);

    } catch (cleanupError) {
        console.warn('Failed to force cleanup upload:', cleanupError);
    }
}

/* ======= 单个大文件大文件分块上传到Telegram ======= */
export async function uploadLargeFileToTelegram(context, file, fullId, metadata, fileName, fileType, returnLink, tgBotToken, tgChatId, tgChannel) {
    const { env, waitUntil } = context;
    const db = getDatabase(env);

    const CHUNK_SIZE = 16 * 1024 * 1024; // 16MB (TG Bot getFile download limit: 20MB, leave 4MB safety margin)
    const fileSize = file.size;
    const totalChunks = Math.ceil(fileSize / CHUNK_SIZE);

    // 为了避免CPU超时，限制最大分片数（考虑Cloudflare Worker的CPU时间限制）
    if (totalChunks > 50) {
        return createResponse('Error: File too large (exceeds 1GB limit)', { status: 413 });
    }

    const chunks = [];
    const uploadedChunks = [];

    try {
        // 分片上传，每10个分片做一次微小延迟以避免CPU超时
        for (let i = 0; i < totalChunks; i++) {
            const start = i * CHUNK_SIZE;
            const end = Math.min(start + CHUNK_SIZE, fileSize);
            const chunkBlob = file.slice(start, end);

            // 生成分片文件名
            const chunkFileName = `${fileName}.part${i.toString().padStart(3, '0')}`;

            // 上传分片（带重试机制）
            const tgProxyUrl = tgChannel.proxyUrl || '';
            const chunkInfo = await uploadChunkToTelegramWithRetry(
                tgBotToken,
                tgChatId,
                tgProxyUrl,
                chunkBlob,
                chunkFileName,
                i,
                totalChunks
            );

            if (!chunkInfo) {
                throw new Error(`Failed to upload chunk ${i + 1}/${totalChunks} after retries`);
            }

            // 验证分片信息完整性
            if (!chunkInfo.file_id || !chunkInfo.file_size) {
                throw new Error(`Invalid chunk info for chunk ${i + 1}/${totalChunks}`);
            }

            chunks.push({
                index: i,
                fileId: chunkInfo.file_id,
                size: chunkInfo.file_size,
                fileName: chunkFileName
            });

            uploadedChunks.push(chunkInfo.file_id);

            // 每10个分片检查一下，添加微小延迟避免CPU限制
            if (i > 0 && i % 10 === 0) {
                await new Promise(resolve => setTimeout(resolve, 50)); // 50ms延迟
            }
        }

        // 所有分片上传成功，更新metadata
        metadata.Channel = "TelegramNew";
        metadata.ChannelName = tgChannel.name;
        metadata.TgChatId = tgChatId;
        metadata.TgBotToken = tgBotToken;
        metadata.TgProxyUrl = tgChannel.proxyUrl || '';
        metadata.IsChunked = true;
        metadata.TotalChunks = totalChunks;
        metadata.FileSize = (fileSize / 1024 / 1024).toFixed(2);


        // 将分片信息存储到value中
        const chunksData = JSON.stringify(chunks);

        // 验证分片完整性
        if (chunks.length !== totalChunks) {
            throw new Error(`Chunk count mismatch: expected ${totalChunks}, got ${chunks.length}`);
        }

        // 写入最终的数据库记录，分片信息作为value
        await db.put(fullId, chunksData, { metadata });

        // 异步结束上传
        waitUntil(endUpload(context, fullId, metadata));

        return createResponse(
            JSON.stringify([{ 'src': returnLink }]),
            {
                status: 200,
                headers: {
                    'Content-Type': 'application/json',
                }
            }
        );

    } catch (error) {
        return createResponse(`Telegram Channel Error: Large file upload failed - ${error.message}`, { status: 500 });
    }
}

// 将每个分块上传至Telegram，支持失败重试（支持代理域名）
async function uploadChunkToTelegramWithRetry(tgBotToken, tgChatId, tgProxyUrl, chunkBlob, chunkFileName, chunkIndex, totalChunks, maxRetries = 2) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const tgAPI = new TelegramAPI(tgBotToken, tgProxyUrl);

            const caption = `Part ${chunkIndex + 1}/${totalChunks}`;

            const response = await tgAPI.sendFile(chunkBlob, tgChatId, 'sendDocument', 'document', caption, chunkFileName);
            if (!response.ok) {
                throw new Error(response.description || 'Telegram API error');
            }

            const fileInfo = tgAPI.getFileInfo(response);
            if (!fileInfo) {
                throw new Error('Failed to extract file info from response');
            }

            return fileInfo;

        } catch (error) {
            console.warn(`Chunk ${chunkIndex} upload attempt ${attempt + 1} failed:`, error.message);

            if (attempt === maxRetries - 1) {
                return null; // 最后一次尝试也失败了
            }

            // 减少重试等待时间以节省CPU时间
            await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
        }
    }

    return null;
}
