/* ========== 分块合并处理 ========== */
import { createResponse, buildUniqueFileId, getUploadIp, getIPAddress, isExtValid, selectConsistentChannel } from './uploadTools';
import { retryFailedChunks } from './chunkUpload';
import { S3Client, CreateMultipartUploadCommand, UploadPartCommand, CompleteMultipartUploadCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

// 处理分块合并
export async function handleChunkMerge(context) {
    const { request, env, url, waitUntil } = context;

    // 解析表单数据
    const formdata = await request.formData();
    context.formdata = formdata;

    let uploadId, totalChunks, originalFileName, originalFileType, originalFileSize, uploadChannel;
    try {
        uploadId = formdata.get('uploadId');
        totalChunks = parseInt(formdata.get('totalChunks'));
        originalFileName = formdata.get('originalFileName');
        originalFileType = formdata.get('originalFileType');
        originalFileSize = parseInt(formdata.get('originalFileSize'));
        uploadChannel = url.searchParams.get('uploadChannel') || 'telegram'; // 默认Telegram渠道

        if (!uploadId || !totalChunks || !originalFileName) {
            return createResponse('Error: Missing merge parameters', { status: 400 });
        }

        // 检查分块上传状态并处理失败的分块
        const chunkStatuses = await checkChunkUploadStatuses(env, uploadId, totalChunks);
        
        // 输出初始状态摘要
        const initialStatusSummary = chunkStatuses.reduce((acc, chunk) => {
            acc[chunk.status] = (acc[chunk.status] || 0) + 1;
            return acc;
        }, {});
        console.log(`Initial chunk status summary: ${JSON.stringify(initialStatusSummary)}`);
        
        // 区分失败的分块和仍在上传中的分块
        const failedChunks = chunkStatuses.filter(chunk => chunk.status === 'failed' && chunk.hasData);
        const uploadingChunks = chunkStatuses.filter(chunk => chunk.status === 'uploading');
        
        if (failedChunks.length > 0) {
            console.log(`Found ${failedChunks.length} failed chunks, retrying...`);
            
            // 输出详细的状态信息用于调试
            const statusDetails = failedChunks.map(chunk => ({
                index: chunk.index,
                status: chunk.status,
                hasData: chunk.hasData,
                error: chunk.error
            }));
            console.log('Failed chunks before retry:', JSON.stringify(statusDetails, null, 2));
            
            await retryFailedChunks(context, failedChunks, uploadChannel);
        }
        
        if (uploadingChunks.length > 0) {
            console.log(`Found ${uploadingChunks.length} chunks still uploading, will wait for completion...`);
        }

        // 直接进行合并处理（因为分块已经异步上传到存储端）
        return await handleDirectMerge(context, uploadId, totalChunks, originalFileName, originalFileType, uploadChannel);

    } catch (error) {
        // 清理临时分块数据
        waitUntil(cleanupChunkData(env, uploadId, totalChunks));

        return createResponse(`Error: Failed to merge chunks - ${error.message}`, { status: 500 });
    }
}

// 直接合并处理（分块已经异步上传到存储端）
async function handleDirectMerge(context, uploadId, totalChunks, originalFileName, originalFileType, uploadChannel) {
    const { env, url, waitUntil } = context;

    try {
        // 对于分块较多的情况，使用异步处理避免超时
        if (totalChunks > 5) {
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
            await env.img_url.put(statusKey, JSON.stringify(mergeStatus), {
                expirationTtl: 3600 // 1小时过期
            });

            // 启动异步合并进程
            waitUntil(performDirectAsyncMerge(context, uploadId, totalChunks, originalFileName, originalFileType, uploadChannel));

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
        } else {
            // 分块较少，直接同步处理
            return await performDirectSyncMerge(context, uploadId, totalChunks, originalFileName, originalFileType, uploadChannel);
        }

    } catch (error) {
        return createResponse(`Error: Failed to merge chunks - ${error.message}`, { status: 500 });
    }
}

// 直接异步合并处理
async function performDirectAsyncMerge(context, uploadId, totalChunks, originalFileName, originalFileType, uploadChannel) {
    const { env } = context;
    const statusKey = `merge_status_${uploadId}`;
    
    try {
        // 更新状态：开始合并
        await updateMergeStatus(env, statusKey, {
            status: 'merging',
            progress: 10,
            message: 'Collecting uploaded chunks...'
        });

        const result = await handleChannelBasedDirectMerge(context, uploadId, totalChunks, originalFileName, originalFileType, uploadChannel, statusKey);
        
        if (result.success) {
            // 清理临时分块数据
            await cleanupChunkData(env, uploadId, totalChunks);

            // 最终状态
            await updateMergeStatus(env, statusKey, {
                status: 'success',
                progress: 100,
                message: 'Merge completed successfully!',
                result: result.result
            });
        } else {
            throw new Error(result.error || 'Merge failed');
        }

    } catch (error) {
        console.error('Direct async merge failed:', error);
        
        // 清理分块数据
        await cleanupChunkData(env, uploadId, totalChunks);

        // 更新状态：失败
        await updateMergeStatus(env, statusKey, {
            status: 'error',
            progress: 0,
            message: `Merge failed: ${error.message}`,
            error: error.message
        });
    }
}

// 直接同步合并处理
async function performDirectSyncMerge(context, uploadId, totalChunks, originalFileName, originalFileType, uploadChannel) {
    const { env, waitUntil } = context;

    try {
        const result = await handleChannelBasedDirectMerge(context, uploadId, totalChunks, originalFileName, originalFileType, uploadChannel);
        
        if (result.success) {
            // 清理临时分块数据
            waitUntil(cleanupChunkData(env, uploadId, totalChunks));
            
            return createResponse(JSON.stringify(result.result), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        } else {
            throw new Error(result.error || 'Merge failed');
        }

    } catch (error) {
        // 清理分块数据
        waitUntil(cleanupChunkData(env, uploadId, totalChunks));
        return createResponse(`Error: Failed to merge chunks - ${error.message}`, { status: 500 });
    }
}

// 基于渠道的直接合并处理
async function handleChannelBasedDirectMerge(context, uploadId, totalChunks, originalFileName, originalFileType, uploadChannel, statusKey = null) {
    const { request, env, url } = context;

    try {
        // 生成文件ID
        const time = new Date().getTime();
        let fileExt = originalFileName.split('.').pop();
        if (!isExtValid(fileExt)) {
            fileExt = originalFileType.split('/').pop();
            if (fileExt === originalFileType || fileExt === '' || fileExt === null || fileExt === undefined) {
                fileExt = 'unknown';
            }
        }

        const nameType = url.searchParams.get('uploadNameType') || 'default';
        const uploadFolder = url.searchParams.get('uploadFolder') || '';
        const normalizedFolder = uploadFolder 
            ? uploadFolder.replace(/^\/+/, '').replace(/\/{2,}/g, '/').replace(/\/$/, '') 
            : '';

        const finalFileId = await buildUniqueFileId(env, nameType, normalizedFolder, originalFileName, fileExt, time);

        // 获得上传IP
        const uploadIp = getUploadIp(request);

        // 构建metadata
        const metadata = {
            FileName: originalFileName,
            FileType: originalFileType,
            FileSize: '0', // 会在最终合并后更新
            UploadIP: uploadIp,
            UploadAddress: await getIPAddress(uploadIp),
            ListType: "None",
            TimeStamp: time,
            Label: "None",
            Folder: normalizedFolder || 'root',
            finalFileId: finalFileId
        };

        // 获得返回链接格式
        const returnFormat = url.searchParams.get('returnFormat') || 'default';
        let returnLink = '';
        if (returnFormat === 'full') {
            returnLink = `${url.origin}/file/${finalFileId}`;
        } else {
            returnLink = `/file/${finalFileId}`;
        }

        // 更新进度（如果有状态跟踪）
        if (statusKey) {
            await updateMergeStatus(env, statusKey, {
                progress: 20,
                message: `Collecting uploaded chunks for ${uploadChannel}...`
            });
        }

        // 收集所有已上传的分块信息
        const chunkStatuses = await checkChunkUploadStatuses(env, uploadId, totalChunks);
        let completedChunks = chunkStatuses.filter(chunk => chunk.status === 'completed');
        
        // 如果还有分块在上传中，等待一段时间后重试
        const uploadingChunks = chunkStatuses.filter(chunk => chunk.status === 'uploading');
        if (uploadingChunks.length > 0) {
            console.log(`Found ${uploadingChunks.length} chunks still uploading, waiting...`);
            
            // 等待并重试，最多等待60秒
            let retryCount = 0;
            const maxRetries = 12; // 60秒，每次等待5秒
            
            while (uploadingChunks.length > 0 && retryCount < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 5000)); // 等待5秒
                
                const updatedStatuses = await checkChunkUploadStatuses(env, uploadId, totalChunks);
                const stillUploading = updatedStatuses.filter(chunk => chunk.status === 'uploading');
                
                if (stillUploading.length < uploadingChunks.length) {
                    console.log(`Upload progress: ${totalChunks - stillUploading.length}/${totalChunks} chunks completed`);
                }
                
                if (stillUploading.length === 0) {
                    completedChunks = updatedStatuses.filter(chunk => chunk.status === 'completed');
                    break;
                }
                
                retryCount++;
            }
            
            // 如果仍然有分块在上传，更新状态信息
            if (uploadingChunks.length > 0) {
                const finalStatuses = await checkChunkUploadStatuses(env, uploadId, totalChunks);
                completedChunks = finalStatuses.filter(chunk => chunk.status === 'completed');
                const stillUploading = finalStatuses.filter(chunk => chunk.status === 'uploading');
                
                if (stillUploading.length > 0) {
                    console.warn(`Timeout waiting for ${stillUploading.length} chunks to complete upload`);
                }
            }
        }
        
        if (completedChunks.length !== totalChunks) {
            // 获取详细的状态信息用于调试
            const statusSummary = chunkStatuses.reduce((acc, chunk) => {
                acc[chunk.status] = (acc[chunk.status] || 0) + 1;
                return acc;
            }, {});
            
            throw new Error(`Only ${completedChunks.length}/${totalChunks} chunks completed successfully. Status summary: ${JSON.stringify(statusSummary)}`);
        }

        // 根据渠道合并分块信息
        let result;
        if (uploadChannel === 'cfr2') {
            result = await mergeR2ChunksInfo(context, uploadId, completedChunks, metadata, returnLink);
        } else if (uploadChannel === 's3') {
            result = await mergeS3ChunksInfo(context, uploadId, completedChunks, metadata, returnLink);
        } else if (uploadChannel === 'telegram') {
            result = await mergeTelegramChunksInfo(context, uploadId, completedChunks, metadata, returnLink);
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
async function mergeR2ChunksInfo(context, uploadId, completedChunks, metadata, returnLink) {
    const { env, uploadConfig } = context;
    
    try {
        const r2Settings = uploadConfig.cfr2;
        const R2DataBase = env.img_r2;
        
        // 创建multipart upload
        const multipartUpload = await R2DataBase.createMultipartUpload(metadata.finalFileId);
        const uploadedParts = [];
        
        // 按顺序处理分块
        for (const chunk of completedChunks.sort((a, b) => a.index - b.index)) {
            const tempChunkKey = chunk.uploadResult.chunkKey;
            
            // 从R2获取临时分块数据
            const chunkObject = await R2DataBase.get(tempChunkKey);
            if (!chunkObject) {
                throw new Error(`Temp chunk ${chunk.index} not found in R2`);
            }
            
            // 将R2Object转换为ArrayBuffer
            const chunkData = await chunkObject.arrayBuffer();
            
            // 上传为multipart的一部分
            const uploadPart = await multipartUpload.uploadPart(chunk.index + 1, chunkData);
            uploadedParts.push(uploadPart);
            
            // 清理临时分块
            await R2DataBase.delete(tempChunkKey);
        }
        
        // 完成multipart upload
        await multipartUpload.complete(uploadedParts);
        
        // 计算总大小
        const totalSize = completedChunks.reduce((sum, chunk) => sum + chunk.uploadResult.size, 0);
        
        // 更新metadata
        metadata.Channel = "CloudflareR2";
        metadata.ChannelName = "R2_env";
        metadata.FileSize = (totalSize / 1024 / 1024).toFixed(2);
        
        // 写入KV数据库
        await env.img_url.put(metadata.finalFileId, "", { metadata });
        
        return {
            success: true,
            result: [{ 'src': returnLink }]
        };
        
    } catch (error) {
        throw new Error(`R2 merge failed: ${error.message}`);
    }
}

// 合并S3分块信息
async function mergeS3ChunksInfo(context, uploadId, completedChunks, metadata, returnLink) {
    const { env, uploadConfig } = context;
    
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

        const s3FileName = metadata.finalFileId;
        
        // 创建multipart upload
        const createResponse = await s3Client.send(new CreateMultipartUploadCommand({
            Bucket: bucketName,
            Key: s3FileName,
            ContentType: metadata.FileType
        }));

        const uploadId_s3 = createResponse.UploadId;
        const uploadedParts = [];

        // 按顺序处理分块
        for (const chunk of completedChunks.sort((a, b) => a.index - b.index)) {
            const tempChunkKey = chunk.uploadResult.chunkKey;
            
            // 从S3获取临时分块数据
            const getResponse = await s3Client.send(new GetObjectCommand({
                Bucket: bucketName,
                Key: tempChunkKey
            }));
            
            const chunkData = await getResponse.Body.transformToByteArray();
            
            // 上传为multipart的一部分
            const uploadResponse = await s3Client.send(new UploadPartCommand({
                Bucket: bucketName,
                Key: s3FileName,
                PartNumber: chunk.index + 1,
                UploadId: uploadId_s3,
                Body: chunkData
            }));

            uploadedParts.push({
                PartNumber: chunk.index + 1,
                ETag: uploadResponse.ETag
            });
            
            // 清理临时分块
            await s3Client.send(new DeleteObjectCommand({
                Bucket: bucketName,
                Key: tempChunkKey
            }));
        }

        // 完成multipart upload
        await s3Client.send(new CompleteMultipartUploadCommand({
            Bucket: bucketName,
            Key: s3FileName,
            UploadId: uploadId_s3,
            MultipartUpload: { Parts: uploadedParts }
        }));

        // 计算总大小
        const totalSize = completedChunks.reduce((sum, chunk) => sum + chunk.uploadResult.size, 0);
        
        // 更新metadata
        metadata.Channel = "S3";
        metadata.ChannelName = s3Channel.name;
        metadata.FileSize = (totalSize / 1024 / 1024).toFixed(2);

        const s3ServerDomain = endpoint.replace(/https?:\/\//, "");
        if (pathStyle) {
            metadata.S3Location = `https://${s3ServerDomain}/${bucketName}/${s3FileName}`;
        } else {
            metadata.S3Location = `https://${bucketName}.${s3ServerDomain}/${s3FileName}`;
        }
        metadata.S3Endpoint = endpoint;
        metadata.S3PathStyle = pathStyle;
        metadata.S3AccessKeyId = accessKeyId;
        metadata.S3SecretAccessKey = secretAccessKey;
        metadata.S3Region = region || "auto";
        metadata.S3BucketName = bucketName;
        metadata.S3FileKey = s3FileName;

        // 写入KV数据库
        await env.img_url.put(metadata.finalFileId, "", { metadata });

        return {
            success: true,
            result: [{ src: returnLink }]
        };
        
    } catch (error) {
        throw new Error(`S3 merge failed: ${error.message}`);
    }
}

// 合并Telegram分块信息
async function mergeTelegramChunksInfo(context, uploadId, completedChunks, metadata, returnLink) {
    const { env, uploadConfig } = context;
    
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
        
        // 写入KV数据库
        await env.img_url.put(metadata.finalFileId, chunksData, { metadata });

        return {
            success: true,
            result: [{ 'src': returnLink }]
        };
        
    } catch (error) {
        throw new Error(`Telegram merge failed: ${error.message}`);
    }
}


// 检查合并状态
export async function checkMergeStatus(env, uploadId) {
    try {
        const statusKey = `merge_status_${uploadId}`;
        const statusData = await env.img_url.get(statusKey);
        
        if (!statusData) {
            return createResponse(JSON.stringify({
                error: 'Merge task not found or expired'
            }), { status: 404, headers: { 'Content-Type': 'application/json' } });
        }

        const status = JSON.parse(statusData);
        return createResponse(JSON.stringify(status), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        return createResponse(JSON.stringify({
            error: `Failed to check status: ${error.message}`
        }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
}

// 更新合并状态
async function updateMergeStatus(env, statusKey, updates) {
    try {
        const currentData = await env.img_url.get(statusKey);
        if (currentData) {
            const status = JSON.parse(currentData);
            const updatedStatus = { ...status, ...updates, updatedAt: Date.now() };
            await env.img_url.put(statusKey, JSON.stringify(updatedStatus), {
                expirationTtl: 3600 // 1小时过期
            });
        }
    } catch (error) {
        console.error('Failed to update merge status:', error);
    }
}

// 检查分块上传状态
async function checkChunkUploadStatuses(env, uploadId, totalChunks) {
    const chunkStatuses = [];
    
    for (let i = 0; i < totalChunks; i++) {
        const chunkKey = `chunk_${uploadId}_${i.toString().padStart(3, '0')}`;
        try {
            const chunkRecord = await env.img_url.getWithMetadata(chunkKey);
            if (chunkRecord && chunkRecord.metadata) {
                const status = chunkRecord.metadata.status || 'unknown';
                const hasData = status === 'completed' 
                    ? !!chunkRecord.metadata.uploadResult  // 已完成的分块通过uploadResult判断
                    : (chunkRecord.value && chunkRecord.value.byteLength > 0); // 未完成的分块通过原始数据判断
                
                chunkStatuses.push({
                    index: i,
                    key: chunkKey,
                    status: status,
                    uploadResult: chunkRecord.metadata.uploadResult,
                    error: chunkRecord.metadata.error,
                    hasData: hasData
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

// 清理分块数据
async function cleanupChunkData(env, uploadId, totalChunks) {
    try {
        for (let i = 0; i < totalChunks; i++) {
            const chunkKey = `chunk_${uploadId}_${i.toString().padStart(3, '0')}`;
            
            // 获取分块信息以确定是否需要清理存储端的临时文件
            try {
                const chunkRecord = await env.img_url.getWithMetadata(chunkKey);
                if (chunkRecord && chunkRecord.metadata && chunkRecord.metadata.uploadResult) {
                    const uploadResult = chunkRecord.metadata.uploadResult;
                    const uploadChannel = chunkRecord.metadata.uploadChannel;
                    
                    // 根据渠道清理存储端的临时文件
                    if (uploadChannel === 'cfr2' && uploadResult.chunkKey) {
                        try {
                            await env.img_r2.delete(uploadResult.chunkKey);
                        } catch (r2Error) {
                            console.warn(`Failed to cleanup R2 temp chunk ${uploadResult.chunkKey}:`, r2Error);
                        }
                    }
                    // S3和Telegram的临时文件会在合并过程中清理，这里不需要额外处理
                }
            } catch (metaError) {
                console.warn(`Failed to get metadata for chunk ${chunkKey}:`, metaError);
            }
            
            // 删除KV中的分块记录
            await env.img_url.delete(chunkKey);
        }
    } catch (cleanupError) {
        console.warn('Failed to cleanup chunk data:', cleanupError);
    }
}