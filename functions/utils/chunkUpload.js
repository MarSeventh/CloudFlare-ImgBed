/* ======= 客户端分块上传处理 ======= */
import { createResponse, selectConsistentChannel, getUploadIp, getIPAddress, buildUniqueFileId } from './uploadTools';
import { TelegramAPI } from './telegramAPI';
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
        const initialChunkMetadata = {
            uploadId,
            chunkIndex,
            totalChunks,
            originalFileName,
            originalFileType,
            chunkSize: chunkData.byteLength,
            uploadTime: Date.now(),
            status: 'uploading',
            uploadChannel
        };

        // 立即保存分块记录和数据，避免状态检查时显示missing
        await env.img_url.put(chunkKey, chunkData, { metadata: initialChunkMetadata });

        // 异步上传分块到存储端
        waitUntil(uploadChunkToStorage(context, chunk, chunkIndex, totalChunks, uploadId, originalFileName, originalFileType, uploadChannel));

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

/* ======= 单个分块上传到不同渠道的存储端 ======= */

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
            uploadResult = await uploadSingleChunkToTelegram(context, chunkData, chunkIndex, uploadId, originalFileName, originalFileType);
        }

        if (uploadResult && uploadResult.success) {
            // 上传成功，更新状态并保存上传信息
            const updatedMetadata = {
                ...chunkMetadata,
                status: 'completed',
                uploadResult: uploadResult,
                completedTime: Date.now()
            };
            
            // 只保存metadata，不保存原始数据
            await env.img_url.put(chunkKey, '', { metadata: updatedMetadata });
            
            console.log(`Chunk ${chunkIndex} uploaded successfully to ${uploadChannel}`);
        } else {
            // 上传失败，标记为失败状态并保留原始数据以便重试
            const failedMetadata = {
                ...chunkMetadata,
                status: 'failed',
                error: uploadResult ? uploadResult.error : 'Unknown error',
                failedTime: Date.now()
            };
            
            // 保留原始数据以便重试
            await env.img_url.put(chunkKey, chunkData, { metadata: failedMetadata });
            
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
                
                await env.img_url.put(chunkKey, chunkRecord.value, { metadata: errorMetadata });
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
                parts: [],
                finalFileId: finalFileId
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
            finalFileId = multipartInfo.finalFileId;
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
            key: finalFileId,
            finalFileId: finalFileId
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
                parts: [],
                finalFileId: finalFileId
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
            finalFileId = multipartInfo.finalFileId;
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
            key: finalFileId,
            finalFileId: finalFileId
        };
        
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

// 上传单个分块到Telegram
async function uploadSingleChunkToTelegram(context, chunkData, chunkIndex, uploadId, originalFileName, originalFileType) {
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
    
    for (const chunk of failedChunks) {
        // 只重试真正失败且有数据的分块
        if (!chunk.hasData) {
            console.warn(`Chunk ${chunk.index} has no data, skipping retry (status: ${chunk.status})`);
            continue;
        }
        
        if (chunk.status === 'uploading') {
            console.warn(`Chunk ${chunk.index} is still uploading, skipping retry`);
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
                
                let uploadResult = null;
                
                // 根据渠道重新上传
                if (uploadChannel === 'cfr2') {
                    uploadResult = await uploadSingleChunkToR2Multipart(context, chunkData, chunk.index, totalChunks, uploadId, originalFileName, originalFileType);
                } else if (uploadChannel === 's3') {
                    uploadResult = await uploadSingleChunkToS3Multipart(context, chunkData, chunk.index, totalChunks, uploadId, originalFileName, originalFileType);
                } else if (uploadChannel === 'telegram') {
                    uploadResult = await uploadSingleChunkToTelegram(context, chunkData, chunk.index, uploadId, originalFileName, originalFileType);
                }
                
                if (uploadResult && uploadResult.success) {
                    // 更新状态为成功
                    const updatedMetadata = {
                        ...chunkRecord.metadata,
                        status: 'completed',
                        uploadResult: uploadResult,
                        retryCount: retryCount + 1
                    };
                    
                    // 删除原始数据，只保留上传结果
                    await env.img_url.put(chunk.key, '', { metadata: updatedMetadata });
                    success = true;
                    console.log(`Chunk ${chunk.index} retry successful after ${retryCount + 1} attempts`);
                } else {
                    retryCount++;
                    console.warn(`Chunk ${chunk.index} retry ${retryCount} failed: ${uploadResult?.error || 'Unknown error'}`);
                    
                    if (retryCount < maxRetries) {
                        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // 递增延迟
                    }
                }
                
            } catch (error) {
                retryCount++;
                console.error(`Chunk ${chunk.index} retry ${retryCount} error:`, error);
                
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
    
    for (let i = 0; i < totalChunks; i++) {
        const chunkKey = `chunk_${uploadId}_${i.toString().padStart(3, '0')}`;
        try {
            const chunkRecord = await env.img_url.getWithMetadata(chunkKey);
            if (chunkRecord && chunkRecord.metadata) {
                const status = chunkRecord.metadata.status || 'unknown';
                
                let hasData = false;
                if (status === 'completed') {
                    // 已完成的分块通过uploadResult判断
                    hasData = !!chunkRecord.metadata.uploadResult;
                } else if (status === 'uploading' || status === 'failed') {
                    // 正在上传或失败的分块通过原始数据判断
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
                    uploadChannel: chunkRecord.metadata.uploadChannel
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
