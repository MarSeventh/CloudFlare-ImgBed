/* ======= 客户端分块上传处理 ======= */
import { createResponse, selectConsistentChannel } from './uploadTools';
import { TelegramAPI } from './telegramAPI';
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

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

        // 获取上传渠道
        const uploadChannel = url.searchParams.get('uploadChannel') || 'telegram';

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
    const { env, uploadConfig } = context;
    
    const chunkData = await chunk.arrayBuffer();
    const chunkKey = `chunk_${uploadId}_${chunkIndex.toString().padStart(3, '0')}`;
    
    // 存储分块状态信息
    const chunkMetadata = {
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

    try {
        // 先将分块数据暂存到KV中
        await env.img_url.put(chunkKey, chunkData, { metadata: chunkMetadata });

        let uploadResult = null;
        
        // 根据渠道上传分块
        if (uploadChannel === 'cfr2') {
            uploadResult = await uploadSingleChunkToR2(context, chunkData, chunkIndex, uploadId, originalFileName);
        } else if (uploadChannel === 's3') {
            uploadResult = await uploadSingleChunkToS3(context, chunkData, chunkIndex, uploadId, originalFileName);
        } else if (uploadChannel === 'telegram') {
            uploadResult = await uploadSingleChunkToTelegram(context, chunkData, chunkIndex, uploadId, originalFileName, originalFileType);
        }

        if (uploadResult && uploadResult.success) {
            // 上传成功，更新状态并保存上传信息
            chunkMetadata.status = 'completed';
            chunkMetadata.uploadResult = uploadResult;
            
            // 更新KV中的状态，但删除原始数据（只保留上传结果）
            await env.img_url.put(chunkKey, '', { metadata: chunkMetadata });
            
            console.log(`Chunk ${chunkIndex} uploaded successfully to ${uploadChannel}`);
        } else {
            // 上传失败，标记为失败状态
            chunkMetadata.status = 'failed';
            chunkMetadata.error = uploadResult ? uploadResult.error : 'Unknown error';
            
            // 保留原始数据以便重试
            await env.img_url.put(chunkKey, chunkData, { metadata: chunkMetadata });
            
            console.warn(`Chunk ${chunkIndex} upload failed: ${chunkMetadata.error}`);
        }
        
    } catch (error) {
        console.error(`Error uploading chunk ${chunkIndex}:`, error);
        
        // 发生异常时，确保保留原始数据并标记为失败
        try {
            const errorMetadata = {
                ...chunkMetadata,
                status: 'failed',
                error: error.message,
                stackTrace: error.stack
            };
            
            await env.img_url.put(chunkKey, chunkData, { metadata: errorMetadata });
        } catch (metaError) {
            console.error('Failed to save error metadata:', metaError);
        }
    }
}

// 上传单个分块到R2
async function uploadSingleChunkToR2(context, chunkData, chunkIndex, uploadId, originalFileName) {
    const { env, uploadConfig } = context;
    
    try {
        const r2Settings = uploadConfig.cfr2;
        if (!r2Settings.channels || r2Settings.channels.length === 0) {
            return { success: false, error: 'No R2 channel provided' };
        }

        const R2DataBase = env.img_r2;
        const chunkKey = `temp_chunk_${uploadId}_${chunkIndex.toString().padStart(3, '0')}`;
        
        // 上传到R2
        await R2DataBase.put(chunkKey, chunkData);
        
        return {
            success: true,
            chunkKey,
            size: chunkData.byteLength,
            uploadTime: Date.now()
        };
        
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

// 上传单个分块到S3
async function uploadSingleChunkToS3(context, chunkData, chunkIndex, uploadId, originalFileName) {
    const { env, uploadConfig } = context;
    
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

        const chunkKey = `temp_chunk_${uploadId}_${chunkIndex.toString().padStart(3, '0')}`;
        
        // 上传到S3
        await s3Client.send(new PutObjectCommand({
            Bucket: bucketName,
            Key: chunkKey,
            Body: new Uint8Array(chunkData),
            ContentType: 'application/octet-stream'
        }));
        
        return {
            success: true,
            chunkKey,
            size: chunkData.byteLength,
            uploadTime: Date.now(),
            s3Channel: s3Channel.name
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
            0, // totalChunks暂时不需要
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
                
                let uploadResult = null;
                
                // 根据渠道重新上传
                if (uploadChannel === 'cfr2') {
                    uploadResult = await uploadSingleChunkToR2(context, chunkData, chunk.index, uploadId, originalFileName);
                } else if (uploadChannel === 's3') {
                    uploadResult = await uploadSingleChunkToS3(context, chunkData, chunk.index, uploadId, originalFileName);
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
