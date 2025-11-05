/* ========== 分块合并处理 ========== */
import { createResponse, getUploadIp, getIPAddress, selectConsistentChannel, buildUniqueFileId, endUpload } from './uploadTools';
import { retryFailedChunks, cleanupFailedMultipartUploads, checkChunkUploadStatuses, cleanupChunkData, cleanupUploadSession } from './chunkUpload';
import { S3Client, CompleteMultipartUploadCommand } from "@aws-sdk/client-s3";
import { getDatabase } from '../utils/databaseAdapter.js';

// 处理分块合并
export async function handleChunkMerge(context) {
    const { request, env, url, waitUntil } = context;
    const db = getDatabase(env);

    // 解析表单数据
    const formdata = await request.formData();
    context.formdata = formdata;

    let uploadId, totalChunks, originalFileName, originalFileType, uploadChannel;
    try {
        uploadId = formdata.get('uploadId');
        totalChunks = parseInt(formdata.get('totalChunks'));
        originalFileName = formdata.get('originalFileName');
        originalFileType = formdata.get('originalFileType');

        if (!uploadId || !totalChunks || !originalFileName) {
            return createResponse('Error: Missing merge parameters', { status: 400 });
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

        // 使用会话中的上传渠道，或者从URL参数获取
        uploadChannel = url.searchParams.get('uploadChannel') || sessionInfo.uploadChannel || 'telegram';

        // 检查分块上传状态
        const chunkStatuses = await checkChunkUploadStatuses(env, uploadId, totalChunks);
        
        // 输出初始状态摘要
        const initialStatusSummary = chunkStatuses.reduce((acc, chunk) => {
            acc[chunk.status] = (acc[chunk.status] || 0) + 1;
            return acc;
        }, {});
        console.log(`Initial chunk status summary: ${JSON.stringify(initialStatusSummary)}`);
        
        // 开始合并处理
        return await startMerge(context, uploadId, totalChunks, originalFileName, originalFileType, uploadChannel);

    } catch (error) {
        // 清理失败的multipart uploads
        if (uploadChannel === 'cfr2' || uploadChannel === 's3') {
            waitUntil(cleanupFailedMultipartUploads(context, uploadId, uploadChannel));
        }
        
        // 清理临时分块数据
        waitUntil(cleanupChunkData(env, uploadId, totalChunks));

        // 清理上传会话
        waitUntil(cleanupUploadSession(env, uploadId));

        return createResponse(`Error: Failed to merge chunks - ${error.message}`, { status: 500 });
    }
}

// 开始合并处理
async function startMerge(context, uploadId, totalChunks, originalFileName, originalFileType, uploadChannel) {
    const { env, url, waitUntil } = context;
    const db = getDatabase(env);

    try {
        // 创建合并任务状态记录
        const mergeStatus = {
            uploadId,
            status: 'processing',
            progress: 0,
            totalChunks,
            originalFileName,
            originalFileType,
            uploadChannel,
            createdAt: Date.now(),
            message: 'Starting merge process...'
        };

        // 存储合并状态
        const statusKey = `merge_status_${uploadId}`;
        await db.put(statusKey, JSON.stringify(mergeStatus), {
            expirationTtl: 3600 // 1小时过期
        });

        // 启动异步合并进程
        waitUntil(performAsyncMerge(context, uploadId, totalChunks, originalFileName, originalFileType, uploadChannel));

        // 立即返回处理状态
        return createResponse(JSON.stringify({
            success: true,
            uploadId,
            status: 'processing',
            message: 'File merge started in background. Please check status using statusCheck API.',
            statusCheckUrl: `${url.pathname}?uploadId=${uploadId}&statusCheck=true&chunked=true&merge=true`
        }), {
            status: 202, // Accepted
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        return createResponse(`Error: Failed to merge chunks - ${error.message}`, { status: 500 });
    }
}

// 异步合并处理
async function performAsyncMerge(context, uploadId, totalChunks, originalFileName, originalFileType, uploadChannel) {
    const { env } = context;
    const statusKey = `merge_status_${uploadId}`;
    const MERGE_TIMEOUT = 360000; // 6分钟合并超时
    const mergeStartTime = Date.now();
    
    try {
        // 更新状态：开始合并
        await updateMergeStatus(env, statusKey, {
            status: 'merging',
            progress: 10,
            message: 'Collecting uploaded chunks...',
            mergeStartTime: mergeStartTime,
            mergeTimeoutThreshold: mergeStartTime + MERGE_TIMEOUT
        });

        // 设置合并超时保护
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Merge operation timeout')), MERGE_TIMEOUT);
        });
        
        const mergePromise = handleChannelBasedMerge(context, uploadId, totalChunks, originalFileName, originalFileType, uploadChannel, statusKey);
        
        // 竞速执行合并和超时
        const result = await Promise.race([mergePromise, timeoutPromise]);

        if (result.success) {
            // 清理临时分块数据
            await cleanupChunkData(env, uploadId, totalChunks);

            // 清理上传会话
            await cleanupUploadSession(env, uploadId);

            // 最终状态
            await updateMergeStatus(env, statusKey, {
                status: 'success',
                progress: 100,
                message: 'Merge completed successfully!',
                result: result.result,
                completedTime: Date.now()
            });
        } else {
            throw new Error(result.error || 'Merge failed');
        }

    } catch (error) {
        const isTimeout = error.message === 'Merge operation timeout';
        console.error(`${isTimeout ? 'Merge timeout' : 'Direct async merge failed'}:`, error);
        
        // 清理失败的multipart uploads
        if (uploadChannel === 'cfr2' || uploadChannel === 's3') {
            await cleanupFailedMultipartUploads(context, uploadId, uploadChannel);
        }

        // 清理分块数据
        await cleanupChunkData(env, uploadId, totalChunks);

        // 清理上传会话
        await cleanupUploadSession(env, uploadId);

        // 更新状态：失败或超时
        await updateMergeStatus(env, statusKey, {
            status: isTimeout ? 'timeout' : 'error',
            progress: 0,
            message: isTimeout ? 'Merge operation timed out' : `Merge failed: ${error.message}`,
            error: error.message,
            isTimeout: isTimeout,
            failedTime: Date.now()
        });
    }
}


// 基于渠道的合并处理
async function handleChannelBasedMerge(context, uploadId, totalChunks, originalFileName, originalFileType, uploadChannel, statusKey = null) {
    const { request, env, url, waitUntil } = context;
    const db = getDatabase(env);

    try {
        // 获得上传IP
        const uploadIp = getUploadIp(request);

        const normalizedFolder = (url.searchParams.get('uploadFolder') || '').replace(/^\/+/, '').replace(/\/{2,}/g, '/').replace(/\/$/, '');

        // 构建基础metadata
        const metadata = {
            FileName: originalFileName,
            FileType: originalFileType,
            FileSize: '0', // 会在最终合并后更新
            UploadIP: uploadIp,
            UploadAddress: await getIPAddress(uploadIp),
            ListType: "None",
            TimeStamp: Date.now(),
            Label: "None",
            Directory: normalizedFolder === '' ? '' : normalizedFolder + '/',
        };

        // 更新进度
        if (statusKey) {
            await updateMergeStatus(env, statusKey, {
                progress: 20,
                message: `Collecting uploaded chunks for ${uploadChannel}...`
            });
        }

        // 收集所有已上传的分块信息
        const chunkStatuses = await checkChunkUploadStatuses(env, uploadId, totalChunks);
        let completedChunks = chunkStatuses.filter(chunk => chunk.status === 'completed');
        let uploadingChunks = chunkStatuses.filter(chunk => 
            chunk.status === 'uploading' || 
            chunk.status === 'retrying'
        );
        let failedChunks = chunkStatuses.filter(chunk => 
            chunk.status === 'failed' || 
            chunk.status === 'timeout'
        );

        // 统计不同状态的分块
        const statusSummary = chunkStatuses.reduce((acc, chunk) => {
            acc[chunk.status] = (acc[chunk.status] || 0) + 1;
            return acc;
        }, {});
        
        console.log(`Chunk status summary: ${JSON.stringify(statusSummary)}`);
        
        // 如果有失败的分块，尝试异步重试
        if (failedChunks.length > 0 && statusKey) {
            await updateMergeStatus(env, statusKey, {
                progress: 30,
                message: `Retrying ${failedChunks.length} failed chunks...`
            });
            
            console.log(`Retrying ${failedChunks.length} failed chunks...`);
            waitUntil(retryFailedChunks(context, failedChunks, uploadChannel));
        }
        
        // 等待重试和上传中的分块完成
        if (uploadingChunks.length > 0 || failedChunks.length > 0) {
            console.log(`Found ${uploadingChunks.length} chunks still uploading, and ${failedChunks.length} chunks retrying, waiting...`);

            // 等待并重试，最多等待360秒
            let retryCount = 0;
            const maxRetries = 36; // 360秒，每次等待10秒

            while (uploadingChunks.length > 0 || failedChunks.length > 0 && retryCount < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 10000)); // 等待10秒

                const updatedStatuses = await checkChunkUploadStatuses(env, uploadId, totalChunks);

                uploadingChunks = updatedStatuses.filter(chunk => 
                    chunk.status === 'uploading' || 
                    chunk.status === 'retrying'
                );
                failedChunks = updatedStatuses.filter(chunk => 
                    chunk.status === 'failed' || 
                    chunk.status === 'timeout'
                );
                completedChunks = updatedStatuses.filter(chunk => chunk.status === 'completed');

                if (completedChunks.length > chunkStatuses.filter(chunk => chunk.status === 'completed').length) {
                    console.log(`Upload progress: ${completedChunks.length}/${totalChunks} chunks completed`);

                    if (statusKey) {
                        await updateMergeStatus(env, statusKey, {
                            progress: 40 + Math.floor(completedChunks.length / totalChunks * 40),
                            message: `Waiting for upload completion: ${completedChunks.length}/${totalChunks} chunks done`
                        });
                    }
                }
                
                retryCount++;
            }

            // 最终检查分块状态
            const finalStatuses = await checkChunkUploadStatuses(env, uploadId, totalChunks);
            completedChunks = finalStatuses.filter(chunk => chunk.status === 'completed');
            uploadingChunks = finalStatuses.filter(chunk => 
                chunk.status === 'uploading' || 
                chunk.status === 'retrying'
            );

            // 如果仍然有分块在上传，标记为超时失败
            if (uploadingChunks.length > 0) {
                console.warn(`Timeout waiting for ${uploadingChunks.length} chunks to complete upload`);
                
                // 对于仍在上传的分块，标记为超时
                for (const chunk of uploadingChunks) {
                    try {
                        const chunkRecord = await db.getWithMetadata(chunk.key);
                        if (chunkRecord && chunkRecord.metadata) {
                            const timeoutMetadata = {
                                ...chunkRecord.metadata,
                                status: 'timeout',
                                error: 'Upload timeout during merge',
                                timeoutDuringMerge: true,
                                timeoutTime: Date.now()
                            };

                            await db.put(chunk.key, chunkRecord.value, {
                                metadata: timeoutMetadata,
                                expirationTtl: 3600
                            });
                        }
                    } catch (timeoutError) {
                        console.warn(`Failed to update timeout status for chunk ${chunk.index}:`, timeoutError);
                    }
                }
            }
        }
        
        // 最终检查是否所有分块都完成
        if (completedChunks.length !== totalChunks) {
            // 获取最新的状态信息
            const finalStatuses = await checkChunkUploadStatuses(env, uploadId, totalChunks);
            const finalStatusSummary = finalStatuses.reduce((acc, chunk) => {
                acc[chunk.status] = (acc[chunk.status] || 0) + 1;
                return acc;
            }, {});
            
            throw new Error(`Only ${completedChunks.length}/${totalChunks} chunks completed successfully. Final status: ${JSON.stringify(finalStatusSummary)}`);
        }

        // 更新进度
        if (statusKey) {
            await updateMergeStatus(env, statusKey, {
                progress: 80,
                message: `All chunks uploaded successfully, starting merge for ${uploadChannel}...`
            });
        }

        // 根据渠道合并分块信息
        let result;
        if (uploadChannel === 'cfr2') {
            result = await mergeR2ChunksInfo(context, uploadId, completedChunks, metadata);
        } else if (uploadChannel === 's3') {
            result = await mergeS3ChunksInfo(context, uploadId, completedChunks, metadata);
        } else if (uploadChannel === 'telegram') {
            result = await mergeTelegramChunksInfo(context, uploadId, completedChunks, metadata);
        } else {
            throw new Error(`Unsupported upload channel: ${uploadChannel}`);
        }

        return result;

    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

// 合并R2分块信息
async function mergeR2ChunksInfo(context, uploadId, completedChunks, metadata) {
    const { env, waitUntil, url } = context;
    const db = getDatabase(env);

    try {
        const R2DataBase = env.img_r2;
        const multipartKey = `multipart_${uploadId}`;
        
        // 获取multipart info
        const multipartInfoData = await db.get(multipartKey);
        if (!multipartInfoData) {
            throw new Error('Multipart upload info not found');
        }
        
        const multipartInfo = JSON.parse(multipartInfoData);

        // 组织所有分块
        const sortedChunks = completedChunks.sort((a, b) => a.index - b.index);
        const parts = [];
        
        for (const chunk of sortedChunks) {
            const part = {
                etag: chunk.uploadResult.etag,
                partNumber: chunk.uploadResult.partNumber,
            };
            parts.push(part);
        }
        
        // 完成multipart upload
        const multipartUpload = R2DataBase.resumeMultipartUpload(multipartInfo.key, multipartInfo.uploadId);
        await multipartUpload.complete(parts);
        
        // 计算总大小
        const totalSize = completedChunks.reduce((sum, chunk) => sum + chunk.uploadResult.size, 0);
        
        // 使用multipart info中的finalFileId更新metadata
        const finalFileId = multipartInfo.key;
        metadata.Channel = "CloudflareR2";
        metadata.ChannelName = "R2_env";
        metadata.FileSize = (totalSize / 1024 / 1024).toFixed(2);
        
        // 清理multipart info
        await db.delete(multipartKey);

        // 写入数据库
        await db.put(finalFileId, "", { metadata });

        // 结束上传
        waitUntil(endUpload(context, finalFileId, metadata));

        // 更新返回链接
        const returnFormat = url.searchParams.get('returnFormat') || 'default';
        let updatedReturnLink = '';
        if (returnFormat === 'full') {
            updatedReturnLink = `${url.origin}/file/${finalFileId}`;
        } else {
            updatedReturnLink = `/file/${finalFileId}`;
        }
        
        return {
            success: true,
            result: [{ 'src': updatedReturnLink }]
        };
        
    } catch (error) {
        throw new Error(`R2 merge failed: ${error.message}`);
    }
}

// 合并S3分块信息
async function mergeS3ChunksInfo(context, uploadId, completedChunks, metadata) {
    const { env, waitUntil, uploadConfig, url } = context;
    const db = getDatabase(env);

    try {
        const s3Settings = uploadConfig.s3;
        const s3Channels = s3Settings.channels;
        const s3Channel = selectConsistentChannel(s3Channels, uploadId, s3Settings.loadBalance.enabled);
        
        console.log(`Merging S3 chunks for uploadId: ${uploadId}, selected channel: ${s3Channel.name || 'default'}`);

        const { endpoint, pathStyle, accessKeyId, secretAccessKey, bucketName, region } = s3Channel;
        
        const s3Client = new S3Client({
            region: region || "auto",
            endpoint,
            credentials: { accessKeyId, secretAccessKey },
            forcePathStyle: pathStyle
        });

        const multipartKey = `multipart_${uploadId}`;
        
        // 获取multipart info
        const multipartInfoData = await db.get(multipartKey);
        if (!multipartInfoData) {
            throw new Error('Multipart upload info not found');
        }
        
        const multipartInfo = JSON.parse(multipartInfoData);
        
        // 组织所有分块
        const sortedChunks = completedChunks.sort((a, b) => a.index - b.index);
        const parts = [];
        
        for (const chunk of sortedChunks) {
            const part = {
                ETag: chunk.uploadResult.etag,
                PartNumber: chunk.uploadResult.partNumber
            };
            parts.push(part);
        }

        // 完成multipart upload
        await s3Client.send(new CompleteMultipartUploadCommand({
            Bucket: bucketName,
            Key: multipartInfo.key,
            UploadId: multipartInfo.uploadId,
            MultipartUpload: { Parts: parts }
        }));

        // 计算总大小
        const totalSize = completedChunks.reduce((sum, chunk) => sum + chunk.uploadResult.size, 0);
        
        // 使用multipart info中的finalFileId更新metadata
        const finalFileId = multipartInfo.key;
        metadata.Channel = "S3";
        metadata.ChannelName = s3Channel.name;
        metadata.FileSize = (totalSize / 1024 / 1024).toFixed(2);

        const s3ServerDomain = endpoint.replace(/https?:\/\//, "");
        if (pathStyle) {
            metadata.S3Location = `https://${s3ServerDomain}/${bucketName}/${finalFileId}`;
        } else {
            metadata.S3Location = `https://${bucketName}.${s3ServerDomain}/${finalFileId}`;
        }
        metadata.S3Endpoint = endpoint;
        metadata.S3PathStyle = pathStyle;
        metadata.S3AccessKeyId = accessKeyId;
        metadata.S3SecretAccessKey = secretAccessKey;
        metadata.S3Region = region || "auto";
        metadata.S3BucketName = bucketName;
        metadata.S3FileKey = finalFileId;

        // 清理multipart info
        await db.delete(multipartKey);

        // 写入数据库
        await db.put(finalFileId, "", { metadata });

        // 异步结束上传
        waitUntil(endUpload(context, finalFileId, metadata));

        // 更新返回链接
        const returnFormat = url.searchParams.get('returnFormat') || 'default';
        let updatedReturnLink = '';
        if (returnFormat === 'full') {
            updatedReturnLink = `${url.origin}/file/${finalFileId}`;
        } else {
            updatedReturnLink = `/file/${finalFileId}`;
        }

        return {
            success: true,
            result: [{ src: updatedReturnLink }]
        };
        
    } catch (error) {
        throw new Error(`S3 merge failed: ${error.message}`);
    }
}

// 合并Telegram分块信息
async function mergeTelegramChunksInfo(context, uploadId, completedChunks, metadata) {
    const { env, waitUntil, uploadConfig, url } = context;
    const db = getDatabase(env);

    try {
        const tgSettings = uploadConfig.telegram;
        const tgChannels = tgSettings.channels;
        const tgChannel = selectConsistentChannel(tgChannels, uploadId, tgSettings.loadBalance.enabled);
        
        console.log(`Merging Telegram chunks for uploadId: ${uploadId}, selected channel: ${tgChannel.name || 'default'}`);

        const tgBotToken = tgChannel.botToken;
        const tgChatId = tgChannel.chatId;
        
        // 按顺序排列分块
        const sortedChunks = completedChunks.sort((a, b) => a.index - b.index);
        
        // 计算总大小
        const totalSize = sortedChunks.reduce((sum, chunk) => sum + chunk.uploadResult.size, 0);
        
        // 构建分块信息数组
        const chunks = sortedChunks.map(chunk => ({
            index: chunk.index,
            fileId: chunk.uploadResult.fileId,
            size: chunk.uploadResult.size,
            fileName: chunk.uploadResult.fileName
        }));
        
        // 生成 finalFileId
        const finalFileId = await buildUniqueFileId(context, metadata.FileName, metadata.FileType);

        // 更新metadata
        metadata.Channel = "TelegramNew";
        metadata.ChannelName = tgChannel.name;
        metadata.TgChatId = tgChatId;
        metadata.TgBotToken = tgBotToken;
        metadata.IsChunked = true;
        metadata.TotalChunks = completedChunks.length;
        metadata.FileSize = (totalSize / 1024 / 1024).toFixed(2);

        // 将分片信息存储到value中
        const chunksData = JSON.stringify(chunks);
        
        // 写入数据库
        await db.put(finalFileId, chunksData, { metadata });

        // 异步结束上传
        waitUntil(endUpload(context, finalFileId, metadata));

        // 生成返回链接
        const returnFormat = url.searchParams.get('returnFormat') || 'default';
        let updatedReturnLink = '';
        if (returnFormat === 'full') {
            updatedReturnLink = `${url.origin}/file/${finalFileId}`;
        } else {
            updatedReturnLink = `/file/${finalFileId}`;
        }

        return {
            success: true,
            result: [{ 'src': updatedReturnLink }]
        };
        
    } catch (error) {
        throw new Error(`Telegram merge failed: ${error.message}`);
    }
}


// 检查合并状态
export async function checkMergeStatus(env, uploadId) {
    const db = getDatabase(env);

    try {
        const statusKey = `merge_status_${uploadId}`;
        const statusData = await db.get(statusKey);
        
        if (!statusData) {
            return createResponse(JSON.stringify({
                error: 'Merge task not found or expired',
                uploadId: uploadId,
                recommendedAction: 'restart_upload'
            }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        }

        const status = JSON.parse(statusData);
        const currentTime = Date.now();
        
        // 检查是否超时
        const mergeTimeoutThreshold = status.mergeTimeoutThreshold;
        const mergeStartTime = status.mergeStartTime;
        
        // 如果任务正在处理但已经超过超时阈值，标记为超时
        if (status.status === 'processing' || status.status === 'merging') {
            if (mergeTimeoutThreshold && currentTime > mergeTimeoutThreshold) {
                // 更新状态为超时
                const timeoutStatus = {
                    ...status,
                    status: 'timeout',
                    error: 'Merge operation timed out',
                    timeoutDetectedTime: currentTime,
                    isTimeout: true,
                    recommendedAction: 'restart_upload'
                };
                
                // 更新状态
                await db.put(statusKey, JSON.stringify(timeoutStatus), {
                    expirationTtl: 3600
                }).catch(err => console.warn('Failed to update timeout status:', err));
                
                return createResponse(JSON.stringify(timeoutStatus), {
                    status: 408, // Request Timeout
                    headers: { 'Content-Type': 'application/json' }
                });
            }
            
            // 检查是否长时间无更新（超过6分钟没有状态更新）
            const lastUpdate = status.updatedAt || status.createdAt || mergeStartTime;
            if (lastUpdate && currentTime - lastUpdate > 360000) { // 6分钟
                const staleStatus = {
                    ...status,
                    status: 'stale',
                    error: 'Merge operation appears to be stale (no updates for 6+ minutes)',
                    staleDetectedTime: currentTime,
                    isStale: true,
                    recommendedAction: 'check_and_restart'
                };
                
                return createResponse(JSON.stringify(staleStatus), {
                    status: 408, // Request Timeout
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }
        
        // 添加额外的状态信息
        const enhancedStatus = {
            ...status,
            currentTime: currentTime,
            elapsedTime: mergeStartTime ? currentTime - mergeStartTime : 0,
            timeRemaining: mergeTimeoutThreshold ? Math.max(0, mergeTimeoutThreshold - currentTime) : null
        };
        
        return createResponse(JSON.stringify(enhancedStatus), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        return createResponse(JSON.stringify({
            error: `Failed to check status: ${error.message}`,
            uploadId: uploadId,
            recommendedAction: 'retry_status_check'
        }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}

// 更新合并状态
async function updateMergeStatus(env, statusKey, updates) {
    const db = getDatabase(env);
    
    try {
        const currentData = await db.get(statusKey);
        if (currentData) {
            const status = JSON.parse(currentData);
            const updatedStatus = { ...status, ...updates, updatedAt: Date.now() };
            await db.put(statusKey, JSON.stringify(updatedStatus), {
                expirationTtl: 3600 // 1小时过期
            });
        }
    } catch (error) {
        console.error('Failed to update merge status:', error);
    }
}
