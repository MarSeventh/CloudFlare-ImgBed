/* ======= 客户端分块上传处理 ======= */
import { createResponse, selectConsistentChannel, getUploadIp, getIPAddress, buildUniqueFileId } from './uploadTools';
import { TelegramAPI } from '../utils/telegramAPI';
import { S3Client, CreateMultipartUploadCommand, UploadPartCommand, AbortMultipartUploadCommand } from "@aws-sdk/client-s3";

// 初始化分块上传
export async function initializeChunkedUpload(context) {
    const { request, env, url } = context;
    
    try {
        // 解析表单数据
        const formdata = await request.formData();
        
        const originalFileName = formdata.get('originalFileName');
        const originalFileType = formdata.get('originalFileType');
        const originalFileSize = parseInt(formdata.get('originalFileSize'));
        const totalChunks = parseInt(formdata.get('totalChunks'));
        
        if (!originalFileName || !originalFileType || !originalFileSize || !totalChunks) {
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
        
        // 存储上传会话信息
        const sessionInfo = {
            uploadId,
            originalFileName,
            originalFileType,
            originalFileSize,
            totalChunks,
            uploadChannel,
            uploadIp,
            ipAddress,
            status: 'initialized',
            createdAt: timestamp,
            expiresAt: timestamp + 3600000 // 1小时过期
        };
        
        // 保存会话信息
        const sessionKey = `upload_session_${uploadId}`;
        await env.img_url.put(sessionKey, JSON.stringify(sessionInfo), {
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
                uploadChannel
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

        if (!chunk || chunkIndex === null || !totalChunks || !uploadId || !originalFileName) {
            return createResponse('Error: Missing chunk upload parameters', { status: 400 });
        }

        // 验证上传会话
        const sessionKey = `upload_session_${uploadId}`;
        const sessionData = await env.img_url.get(sessionKey);
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
        await env.img_url.put(chunkKey, chunkData, { 
            metadata: initialChunkMetadata,
            expirationTtl: 3600 // 1小时过期
        });

        // 异步上传分块到存储端，添加超时保护
        waitUntil(uploadChunkToStorageWithTimeout(context, chunk, chunkIndex, totalChunks, uploadId, originalFileName, originalFileType, uploadChannel));

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
export async function handleCleanupRequest(env, uploadId, totalChunks) {
    try {
        if (!uploadId) {
            return createResponse(JSON.stringify({
                error: 'Missing uploadId parameter'
            }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        // 强制清理所有相关数据
        await forceCleanupUpload(env, uploadId, totalChunks);

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
async function uploadChunkToStorageWithTimeout(context, chunk, chunkIndex, totalChunks, uploadId, originalFileName, originalFileType, uploadChannel) {
    const { env } = context;
    const chunkKey = `chunk_${uploadId}_${chunkIndex.toString().padStart(3, '0')}`;
    const UPLOAD_TIMEOUT = 45000; // 45秒超时
    
    try {
        // 设置超时 Promise
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Upload timeout')), UPLOAD_TIMEOUT);
        });
        
        // 执行实际上传
        const uploadPromise = uploadChunkToStorage(context, chunk, chunkIndex, totalChunks, uploadId, originalFileName, originalFileType, uploadChannel);
        
        // 竞速执行
        await Promise.race([uploadPromise, timeoutPromise]);
        
    } catch (error) {
        console.error(`Chunk ${chunkIndex} upload failed or timed out:`, error);
        
        // 超时或失败时，更新状态为超时/失败
        try {
            const chunkRecord = await env.img_url.getWithMetadata(chunkKey, { type: 'arrayBuffer' });
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
                await env.img_url.put(chunkKey, chunkRecord.value, { 
                    metadata: errorMetadata,
                    expirationTtl: 3600
                });
            }
        } catch (metaError) {
            console.error('Failed to save timeout/error metadata:', metaError);
        }
    }
}

// 异步上传分块到存储端
async function uploadChunkToStorage(context, chunk, chunkIndex, totalChunks, uploadId, originalFileName, originalFileType, uploadChannel) {
    const { env, url } = context;
    
    const chunkKey = `chunk_${uploadId}_${chunkIndex.toString().padStart(3, '0')}`;
    
    try {
        // 从KV获取分块数据和metadata
        const chunkRecord = await env.img_url.getWithMetadata(chunkKey, { type: 'arrayBuffer' });
        if (!chunkRecord || !chunkRecord.value) {
            console.error(`Chunk ${chunkIndex} data not found in KV`);
            return;
        }

        const chunkData = chunkRecord.value;
        const chunkMetadata = chunkRecord.metadata;

        // 根据渠道上传分块
        let uploadResult = null;
        
        if (uploadChannel === 'cfr2') {
            uploadResult = await uploadSingleChunkToR2Multipart(context, chunkData, chunkIndex, totalChunks, uploadId, originalFileName, originalFileType);
        } else if (uploadChannel === 's3') {
            uploadResult = await uploadSingleChunkToS3Multipart(context, chunkData, chunkIndex, totalChunks, uploadId, originalFileName, originalFileType);
        } else if (uploadChannel === 'telegram') {
            uploadResult = await uploadSingleChunkToTelegram(context, chunkData, chunkIndex, totalChunks, uploadId, originalFileName, originalFileType);
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
            await env.img_url.put(chunkKey, '', { 
                metadata: updatedMetadata,
                expirationTtl: 3600 // 1小时过期
            });
            
            console.log(`Chunk ${chunkIndex} uploaded successfully to ${uploadChannel}`);
        } else {
            // 上传失败，标记为失败状态并保留原始数据以便重试
            const failedMetadata = {
                ...chunkMetadata,
                status: 'failed',
                error: uploadResult ? uploadResult.error : 'Unknown error',
                failedTime: Date.now()
            };
            
            // 保留原始数据以便重试，设置过期时间
            await env.img_url.put(chunkKey, chunkData, { 
                metadata: failedMetadata,
                expirationTtl: 3600 // 1小时过期
            });
            
            console.warn(`Chunk ${chunkIndex} upload failed: ${failedMetadata.error}`);
        }
        
    } catch (error) {
        console.error(`Error uploading chunk ${chunkIndex}:`, error);
        
        // 发生异常时，确保保留原始数据并标记为失败
        try {
            const chunkRecord = await env.img_url.getWithMetadata(chunkKey, { type: 'arrayBuffer' });
            if (chunkRecord && chunkRecord.metadata) {
                const errorMetadata = {
                    ...chunkRecord.metadata,
                    status: 'failed',
                    error: error.message,
                    stackTrace: error.stack,
                    failedTime: Date.now()
                };
                
                await env.img_url.put(chunkKey, chunkRecord.value, { 
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
                key: finalFileId,
                parts: []
            };
            
            // 保存multipart info
            await env.img_url.put(multipartKey, JSON.stringify(multipartInfo), {
                expirationTtl: 3600 // 1小时过期
            });
        } else {
            // 其他分块需要等待第一个分块完成multipart upload初始化
            let multipartInfoData = null;
            let retryCount = 0;
            const maxRetries = 30; // 最多等待30秒
            
            while (!multipartInfoData && retryCount < maxRetries) {
                multipartInfoData = await env.img_url.get(multipartKey);
                if (!multipartInfoData) {
                    // 等待1秒后重试
                    await new Promise(resolve => setTimeout(resolve, 1000));
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
        const multipartInfoData = await env.img_url.get(multipartKey);
        if (!multipartInfoData) {
            return { success: false, error: 'Multipart upload not initialized' };
        }
        
        const multipartInfo = JSON.parse(multipartInfoData);
        
        // 上传分块
        const multipartUpload = R2DataBase.resumeMultipartUpload(finalFileId, multipartInfo.uploadId);
        const uploadedPart = await multipartUpload.uploadPart(chunkIndex + 1, chunkData);
        
        // 更新parts信息 - 使用重试机制处理并发冲突
        let updateSuccess = false;
        let updateRetries = 0;
        const maxUpdateRetries = 3;
        
        while (!updateSuccess && updateRetries < maxUpdateRetries) {
            try {
                // 重新获取最新的multipart info
                const latestMultipartInfoData = await env.img_url.get(multipartKey);
                if (latestMultipartInfoData) {
                    const latestMultipartInfo = JSON.parse(latestMultipartInfoData);
                    latestMultipartInfo.parts[chunkIndex] = uploadedPart;
                    
                    await env.img_url.put(multipartKey, JSON.stringify(latestMultipartInfo), {
                        expirationTtl: 3600
                    });
                    updateSuccess = true;
                } else {
                    throw new Error('Multipart info disappeared during update');
                }
            } catch (updateError) {
                updateRetries++;
                console.warn(`R2 chunk ${chunkIndex} multipart info update attempt ${updateRetries} failed:`, updateError.message);
                
                if (updateRetries < maxUpdateRetries) {
                    await new Promise(resolve => setTimeout(resolve, 100 * updateRetries)); // 递增延迟
                }
            }
        }
        
        if (!updateSuccess) {
            console.error(`Failed to update R2 multipart info for chunk ${chunkIndex} after ${maxUpdateRetries} attempts`);
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
    const { env, uploadConfig, url } = context;
    
    try {
        const s3Settings = uploadConfig.s3;
        const s3Channels = s3Settings.channels;
        const s3Channel = selectConsistentChannel(s3Channels, uploadId, s3Settings.loadBalance.enabled);
        
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
                key: finalFileId,
                parts: []
            };
            
            // 保存multipart info
            await env.img_url.put(multipartKey, JSON.stringify(multipartInfo), {
                expirationTtl: 3600 // 1小时过期
            });
        } else {
            // 其他分块需要等待第一个分块完成multipart upload初始化
            let multipartInfoData = null;
            let retryCount = 0;
            const maxRetries = 30; // 最多等待30秒
            
            while (!multipartInfoData && retryCount < maxRetries) {
                multipartInfoData = await env.img_url.get(multipartKey);
                if (!multipartInfoData) {
                    // 等待1秒后重试
                    await new Promise(resolve => setTimeout(resolve, 1000));
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
        const multipartInfoData = await env.img_url.get(multipartKey);
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
        
        // 更新parts信息 - 使用重试机制处理并发冲突
        let updateSuccess = false;
        let updateRetries = 0;
        const maxUpdateRetries = 3;
        
        while (!updateSuccess && updateRetries < maxUpdateRetries) {
            try {
                // 重新获取最新的multipart info
                const latestMultipartInfoData = await env.img_url.get(multipartKey);
                if (latestMultipartInfoData) {
                    const latestMultipartInfo = JSON.parse(latestMultipartInfoData);
                    latestMultipartInfo.parts[chunkIndex] = {
                        PartNumber: chunkIndex + 1,
                        ETag: uploadResponse.ETag
                    };
                    
                    await env.img_url.put(multipartKey, JSON.stringify(latestMultipartInfo), {
                        expirationTtl: 3600
                    });
                    updateSuccess = true;
                } else {
                    throw new Error('Multipart info disappeared during update');
                }
            } catch (updateError) {
                updateRetries++;
                console.warn(`S3 chunk ${chunkIndex} multipart info update attempt ${updateRetries} failed:`, updateError.message);
                
                if (updateRetries < maxUpdateRetries) {
                    await new Promise(resolve => setTimeout(resolve, 100 * updateRetries)); // 递增延迟
                }
            }
        }
        
        if (!updateSuccess) {
            console.error(`Failed to update S3 multipart info for chunk ${chunkIndex} after ${maxUpdateRetries} attempts`);
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
        return {
            success: false,
            error: error.message
        };
    }
}

// 上传单个分块到Telegram
async function uploadSingleChunkToTelegram(context, chunkData, chunkIndex, totalChunks, uploadId, originalFileName, originalFileType) {
    const { env, uploadConfig } = context;
    
    try {
        const tgSettings = uploadConfig.telegram;
        const tgChannels = tgSettings.channels;
        const tgChannel = selectConsistentChannel(tgChannels, uploadId, tgSettings.loadBalance.enabled);
        
        console.log(`Uploading Telegram chunk ${chunkIndex} for uploadId: ${uploadId}, selected channel: ${tgChannel.name || 'default'}`);

        if (!tgChannel) {
            return { success: false, error: 'No Telegram channel provided' };
        }

        const tgBotToken = tgChannel.botToken;
        const tgChatId = tgChannel.chatId;
        
        // 创建分块文件名
        const chunkFileName = `${originalFileName}.part${chunkIndex.toString().padStart(3, '0')}`;
        const chunkBlob = new Blob([chunkData], { type: 'application/octet-stream' });

        // 上传分块到Telegram
        const chunkInfo = await uploadChunkToTelegramWithRetry(
            tgBotToken,
            tgChatId,
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

/* ======== 分块合并时与上传相关的工具函数 ======= */

// 重传失败的分块
export async function retryFailedChunks(context, failedChunks, uploadChannel) {
    const { env } = context;
    const maxRetries = 3;
    const RETRY_TIMEOUT = 30000; // 30秒重试超时
    
    for (const chunk of failedChunks) {
        // 只重试真正失败、超时且有数据的分块
        if (!chunk.hasData) {
            console.warn(`Chunk ${chunk.index} has no data, skipping retry (status: ${chunk.status})`);
            continue;
        }
        
        if (chunk.status === 'uploading') {
            console.warn(`Chunk ${chunk.index} is still uploading, skipping retry`);
            continue;
        }
        
        // 跳过已完成的分块
        if (chunk.status === 'completed') {
            continue;
        }
        
        let retryCount = 0;
        let success = false;
        
        while (retryCount < maxRetries && !success) {
            try {
                const chunkRecord = await env.img_url.getWithMetadata(chunk.key, { type: 'arrayBuffer' });
                if (!chunkRecord || !chunkRecord.value) {
                    console.error(`Chunk ${chunk.index} data missing for retry`);
                    break;
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
                    retryCount: retryCount + 1,
                    retryStartTime: Date.now(),
                    retryTimeoutThreshold: Date.now() + RETRY_TIMEOUT
                };
                
                await env.img_url.put(chunk.key, chunkData, { 
                    metadata: retryMetadata,
                    expirationTtl: 3600
                });
                
                let uploadResult = null;
                
                // 根据渠道重新上传，添加超时保护
                const retryPromise = (async () => {
                    if (uploadChannel === 'cfr2') {
                        return await uploadSingleChunkToR2Multipart(context, chunkData, chunk.index, totalChunks, uploadId, originalFileName, originalFileType);
                    } else if (uploadChannel === 's3') {
                        return await uploadSingleChunkToS3Multipart(context, chunkData, chunk.index, totalChunks, uploadId, originalFileName, originalFileType);
                    } else if (uploadChannel === 'telegram') {
                        return await uploadSingleChunkToTelegram(context, chunkData, chunk.index, totalChunks, uploadId, originalFileName, originalFileType);
                    }
                    return null;
                })();
                
                const timeoutPromise = new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('Retry timeout')), RETRY_TIMEOUT);
                });
                
                uploadResult = await Promise.race([retryPromise, timeoutPromise]);
                
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
                    await env.img_url.put(chunk.key, '', { 
                        metadata: updatedMetadata,
                        expirationTtl: 3600 // 1小时过期
                    });
                    success = true;
                    console.log(`Chunk ${chunk.index} retry successful after ${retryCount + 1} attempts`);
                } else {
                    throw new Error(uploadResult?.error || 'Unknown retry error');
                }
                
            } catch (error) {
                retryCount++;
                const isTimeout = error.message === 'Retry timeout';
                console.warn(`Chunk ${chunk.index} retry ${retryCount} ${isTimeout ? 'timed out' : 'failed'}: ${error.message}`);
                
                // 更新重试失败状态
                try {
                    const chunkRecord = await env.img_url.getWithMetadata(chunk.key, { type: 'arrayBuffer' });
                    if (chunkRecord) {
                        const failedRetryMetadata = {
                            ...chunkRecord.metadata,
                            status: isTimeout ? 'retry_timeout' : 'retry_failed',
                            retryCount: retryCount,
                            lastRetryError: error.message,
                            lastRetryTime: Date.now(),
                            isRetryTimeout: isTimeout
                        };
                        
                        await env.img_url.put(chunk.key, chunkRecord.value, { 
                            metadata: failedRetryMetadata,
                            expirationTtl: 3600
                        });
                    }
                } catch (metaError) {
                    console.error(`Failed to update retry error metadata for chunk ${chunk.index}:`, metaError);
                }
                
                if (retryCount < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // 递增延迟
                }
            }
        }
        
        if (!success) {
            console.error(`Chunk ${chunk.index} failed after ${maxRetries} retry attempts`);
        }
    }
}

// 清理失败的multipart upload
export async function cleanupFailedMultipartUploads(context, uploadId, uploadChannel) {
    const { env, uploadConfig } = context;
    
    try {
        const multipartKey = `multipart_${uploadId}`;
        const multipartInfoData = await env.img_url.get(multipartKey);
        
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
            const s3Channel = selectConsistentChannel(s3Channels, uploadId, s3Settings.loadBalance.enabled);
            
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
        await env.img_url.delete(multipartKey);
        console.log(`Cleaned up failed multipart upload for ${uploadId}`);
        
    } catch (error) {
        console.error(`Failed to cleanup multipart upload for ${uploadId}:`, error);
    }
}


// 检查分块上传状态
export async function checkChunkUploadStatuses(env, uploadId, totalChunks) {
    const chunkStatuses = [];
    const currentTime = Date.now();
    
    for (let i = 0; i < totalChunks; i++) {
        const chunkKey = `chunk_${uploadId}_${i.toString().padStart(3, '0')}`;
        try {
            const chunkRecord = await env.img_url.getWithMetadata(chunkKey);
            if (chunkRecord && chunkRecord.metadata) {
                let status = chunkRecord.metadata.status || 'unknown';
                
                // 检查上传超时：如果状态是 uploading 但超过了超时阈值，标记为超时
                if (status === 'uploading' && chunkRecord.metadata.timeoutThreshold && currentTime > chunkRecord.metadata.timeoutThreshold) {
                    status = 'timeout';
                    
                    // 异步更新状态为超时，不阻塞主流程
                    const timeoutMetadata = {
                        ...chunkRecord.metadata,
                        status: 'timeout',
                        error: 'Upload timeout detected',
                        timeoutDetectedTime: currentTime
                    };
                    
                    env.img_url.put(chunkKey, chunkRecord.value, { 
                        metadata: timeoutMetadata,
                        expirationTtl: 3600
                    }).catch(err => console.warn(`Failed to update timeout status for chunk ${i}:`, err));
                }
                
                let hasData = false;
                if (status === 'completed') {
                    // 已完成的分块通过uploadResult判断
                    hasData = !!chunkRecord.metadata.uploadResult;
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
        for (let i = 0; i < totalChunks; i++) {
            const chunkKey = `chunk_${uploadId}_${i.toString().padStart(3, '0')}`;
            
            // 删除KV中的分块记录
            await env.img_url.delete(chunkKey);
        }
        
        // 清理multipart info（如果存在）
        const multipartKey = `multipart_${uploadId}`;
        await env.img_url.delete(multipartKey);
        
    } catch (cleanupError) {
        console.warn('Failed to cleanup chunk data:', cleanupError);
    }
}

// 清理上传会话
export async function cleanupUploadSession(env, uploadId) {
    try {
        const sessionKey = `upload_session_${uploadId}`;
        await env.img_url.delete(sessionKey);
        console.log(`Cleaned up upload session for ${uploadId}`);
    } catch (cleanupError) {
        console.warn('Failed to cleanup upload session:', cleanupError);
    }
}

// 清理超时和失败的分块数据
export async function cleanupTimeoutChunks(env, uploadId, totalChunks) {
    try {
        const currentTime = Date.now();
        const cleanupPromises = [];
        
        for (let i = 0; i < totalChunks; i++) {
            const chunkKey = `chunk_${uploadId}_${i.toString().padStart(3, '0')}`;
            
            const cleanupPromise = (async () => {
                try {
                    const chunkRecord = await env.img_url.getWithMetadata(chunkKey);
                    if (chunkRecord && chunkRecord.metadata) {
                        const status = chunkRecord.metadata.status;
                        const timeoutThreshold = chunkRecord.metadata.timeoutThreshold;
                        
                        // 清理超时、失败或长时间未完成的分块
                        const shouldCleanup = 
                            status === 'timeout' ||
                            status === 'failed' ||
                            status === 'retry_timeout' ||
                            status === 'retry_failed' ||
                            (status === 'uploading' && timeoutThreshold && currentTime > timeoutThreshold + 300000); // 超时5分钟后清理
                        
                        if (shouldCleanup) {
                            await env.img_url.delete(chunkKey);
                            console.log(`Cleaned up timeout/failed chunk ${i} for ${uploadId}`);
                        }
                    }
                } catch (chunkError) {
                    console.warn(`Failed to cleanup chunk ${i}:`, chunkError);
                }
            })();
            
            cleanupPromises.push(cleanupPromise);
        }
        
        await Promise.allSettled(cleanupPromises);
        console.log(`Cleanup completed for timeout chunks of ${uploadId}`);
        
    } catch (cleanupError) {
        console.warn('Failed to cleanup timeout chunks:', cleanupError);
    }
}

// 强制清理所有相关数据（用于彻底清理失败的上传）
export async function forceCleanupUpload(env, uploadId, totalChunks) {
    try {
        const cleanupPromises = [];
        
        // 清理所有分块
        for (let i = 0; i < totalChunks; i++) {
            const chunkKey = `chunk_${uploadId}_${i.toString().padStart(3, '0')}`;
            cleanupPromises.push(env.img_url.delete(chunkKey).catch(err => 
                console.warn(`Failed to delete chunk ${i}:`, err)
            ));
        }
        
        // 清理相关的键
        const keysToCleanup = [
            `upload_session_${uploadId}`,
            `multipart_${uploadId}`,
            `merge_status_${uploadId}`
        ];
        
        keysToCleanup.forEach(key => {
            cleanupPromises.push(env.img_url.delete(key).catch(err => 
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
    const { env } = context;

    const CHUNK_SIZE = 20 * 1024 * 1024; // 20MB
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
            const chunkInfo = await uploadChunkToTelegramWithRetry(
                tgBotToken, 
                tgChatId, 
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
        metadata.IsChunked = true;
        metadata.TotalChunks = totalChunks;
        metadata.FileSize = (fileSize / 1024 / 1024).toFixed(2);

        
        // 将分片信息存储到value中
        const chunksData = JSON.stringify(chunks);
        
        // 验证分片完整性
        if (chunks.length !== totalChunks) {
            throw new Error(`Chunk count mismatch: expected ${totalChunks}, got ${chunks.length}`);
        }
        
        // 写入最终的KV记录，分片信息作为value
        await env.img_url.put(fullId, chunksData, { metadata });
        
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

// 将每个分块上传至Telegram，支持失败重试
async function uploadChunkToTelegramWithRetry(tgBotToken, tgChatId, chunkBlob, chunkFileName, chunkIndex, totalChunks, maxRetries = 2) {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            const tgAPI = new TelegramAPI(tgBotToken);

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
