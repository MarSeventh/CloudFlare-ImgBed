/* 索引管理器 */

/**
 * 文件索引结构（分块存储）：
 * 
 * 索引元数据：
 * - key: manage@index@meta
 * - value: JSON.stringify(metadata)
 * - metadata: {
 *     lastUpdated: 1640995200000,
 *     totalCount: 1000,
 *     lastOperationId: "operation_timestamp_uuid",
 *     chunkCount: 3,
 *     chunkSize: 10000
 *   }
 * 
 * 索引分块：
 * - key: manage@index_${chunkId} (例如: manage@index_0, manage@index_1, ...)
 * - value: JSON.stringify(filesChunk)
 * - filesChunk: [
 *     {
 *       id: "file_unique_id",
 *       metadata: {}
 *     },
 *     ...
 *   ]
 * 
 * 原子操作结构（保持不变）：
 * - key: manage@index@operation_${timestamp}_${uuid}
 * - value: JSON.stringify(operation)
 * - operation: {
 *     type: "add" | "remove" | "move" | "batch_add" | "batch_remove" | "batch_move",
 *     timestamp: 1640995200000,
 *     data: {
 *       // 根据操作类型包含不同的数据
 *     }
 *   }
 */

import { getDatabase } from './databaseAdapter.js';

const INDEX_KEY = 'manage@index';
const INDEX_META_KEY = 'manage@index@meta'; // 索引元数据键
const OPERATION_KEY_PREFIX = 'manage@index@operation_';
const INDEX_CHUNK_SIZE = 10000; // 索引分块大小
const KV_LIST_LIMIT = 1000; // 数据库列出批量大小
const BATCH_SIZE = 10; // 批量处理大小

/**
 * 添加文件到索引
 * @param {Object} context - 上下文对象，包含 env 和其他信息
 * @param {string} fileId - 文件 ID
 * @param {Object} metadata - 文件元数据
 */
export async function addFileToIndex(context, fileId, metadata = null) {
    const { env } = context;
    const db = getDatabase(env);

    try {
        if (metadata === null) {
            // 如果未传入metadata，尝试从数据库中获取
            const fileData = await db.getWithMetadata(fileId);
            metadata = fileData.metadata || {};
        }

        // 记录原子操作
        const operationId = await recordOperation(context, 'add', {
            fileId,
            metadata
        });

        console.log(`File ${fileId} add operation recorded with ID: ${operationId}`);
        return { success: true, operationId };
    } catch (error) {
        console.error('Error recording add file operation:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 批量添加文件到索引
 * @param {Object} context - 上下文对象，包含 env 和其他信息
 * @param {Array} files - 文件数组，每个元素包含 { fileId, metadata }
 * @param {Object} options - 选项
 * @param {boolean} options.skipExisting - 是否跳过已存在的文件，默认为 false（更新已存在的文件）
 * @returns {Object} 返回操作结果 { operationId, totalProcessed }
 */
export async function batchAddFilesToIndex(context, files, options = {}) {
    try {
        const { env } = context;
        const { skipExisting = false } = options;
        const db = getDatabase(env);

        // 处理每个文件的metadata
        const processedFiles = [];
        for (const fileItem of files) {
            const { fileId, metadata } = fileItem;
            let finalMetadata = metadata;

            // 如果没有提供metadata，尝试从数据库中获取
            if (!finalMetadata) {
                try {
                    const fileData = await db.getWithMetadata(fileId);
                    finalMetadata = fileData.metadata || {};
                } catch (error) {
                    console.warn(`Failed to get metadata for file ${fileId}:`, error);
                    finalMetadata = {};
                }
            }

            processedFiles.push({
                fileId,
                metadata: finalMetadata
            });
        }

        // 记录批量添加操作
        const operationId = await recordOperation(context, 'batch_add', {
            files: processedFiles,
            options: { skipExisting }
        });

        console.log(`Batch add operation recorded with ID: ${operationId}, ${files.length} files`);
        return {
            success: true,
            operationId,
            totalProcessed: files.length
        };
    } catch (error) {
        console.error('Error recording batch add files operation:', error);
        return {
            success: false,
            error: error.message,
            totalProcessed: 0
        };
    }
}

/**
 * 从索引中删除文件
 * @param {Object} context - 上下文对象
 * @param {string} fileId - 文件 ID
 */
export async function removeFileFromIndex(context, fileId) {
    try {
        // 记录删除操作
        const operationId = await recordOperation(context, 'remove', {
            fileId
        });

        console.log(`File ${fileId} remove operation recorded with ID: ${operationId}`);
        return { success: true, operationId };
    } catch (error) {
        console.error('Error recording remove file operation:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 批量删除文件
 * @param {Object} context - 上下文对象
 * @param {Array} fileIds - 文件 ID 数组
 */
export async function batchRemoveFilesFromIndex(context, fileIds) {
    try {
        // 记录批量删除操作
        const operationId = await recordOperation(context, 'batch_remove', {
            fileIds
        });

        console.log(`Batch remove operation recorded with ID: ${operationId}, ${fileIds.length} files`);
        return {
            success: true,
            operationId,
            totalProcessed: fileIds.length
        };
    } catch (error) {
        console.error('Error recording batch remove files operation:', error);
        return {
            success: false,
            error: error.message,
            totalProcessed: 0
        };
    }
}

/**
 * 移动文件（修改文件ID）
 * @param {Object} context - 上下文对象，包含 env 和其他信息
 * @param {string} originalFileId - 原文件 ID
 * @param {string} newFileId - 新文件 ID
 * @param {Object} newMetadata - 新的元数据，如果为null则获取原文件的metadata
 * @returns {Object} 返回操作结果 { success, operationId?, error? }
 */
export async function moveFileInIndex(context, originalFileId, newFileId, newMetadata = null) {
    try {
        const { env } = context;
        const db = getDatabase(env);

        // 确定最终的metadata
        let finalMetadata = newMetadata;
        if (finalMetadata === null) {
            // 如果没有提供新metadata，尝试从数据库中获取
            try {
                const fileData = await db.getWithMetadata(newFileId);
                finalMetadata = fileData.metadata || {};
            } catch (error) {
                console.warn(`Failed to get metadata for new file ${newFileId}:`, error);
                finalMetadata = {};
            }
        }

        // 记录移动操作
        const operationId = await recordOperation(context, 'move', {
            originalFileId,
            newFileId,
            metadata: finalMetadata
        });

        console.log(`File move operation from ${originalFileId} to ${newFileId} recorded with ID: ${operationId}`);
        return { success: true, operationId };
    } catch (error) {
        console.error('Error recording move file operation:', error);
        return { success: false, error: error.message };
    }
}

/**
 * 批量移动文件
 * @param {Object} context - 上下文对象，包含 env 和其他信息
 * @param {Array} moveOperations - 移动操作数组，每个元素包含 { originalFileId, newFileId, metadata? }
 * @returns {Object} 返回操作结果 { operationId, totalProcessed }
 */
export async function batchMoveFilesInIndex(context, moveOperations) {
    try {
        const { env } = context;
        const db = getDatabase(env);

        // 处理每个移动操作的metadata
        const processedOperations = [];
        for (const operation of moveOperations) {
            const { originalFileId, newFileId, metadata } = operation;

            // 确定最终的metadata
            let finalMetadata = metadata;
            if (finalMetadata === null || finalMetadata === undefined) {
                // 如果没有提供新metadata，尝试从数据库中获取
                try {
                    const fileData = await db.getWithMetadata(newFileId);
                    finalMetadata = fileData.metadata || {};
                } catch (error) {
                    console.warn(`Failed to get metadata for new file ${newFileId}:`, error);
                    finalMetadata = {};
                }
            }

            processedOperations.push({
                originalFileId,
                newFileId,
                metadata: finalMetadata
            });
        }

        // 记录批量移动操作
        const operationId = await recordOperation(context, 'batch_move', {
            operations: processedOperations
        });

        console.log(`Batch move operation recorded with ID: ${operationId}, ${moveOperations.length} operations`);
        return {
            success: true,
            operationId,
            totalProcessed: moveOperations.length
        };
    } catch (error) {
        console.error('Error recording batch move files operation:', error);
        return {
            success: false,
            error: error.message,
            totalProcessed: 0
        };
    }
}

/**
 * 合并所有挂起的操作到索引中
 * @param {Object} context - 上下文对象
 * @param {Object} options - 选项
 * @param {boolean} options.cleanupAfterMerge - 合并后是否清理操作记录，默认为 true
 * @returns {Object} 合并结果
 */
export async function mergeOperationsToIndex(context, options = {}) {
    const { request } = context;
    const { cleanupAfterMerge = true } = options;
    
    try {
        console.log('Starting operations merge...');
        
        // 获取当前索引
        const currentIndex = await getIndex(context);
        if (currentIndex.success === false) {
            console.error('Failed to get current index for merge');
            return {
                success: false,
                error: 'Failed to get current index'
            };
        }

        // 获取所有待处理的操作
        const operationsResult = await getAllPendingOperations(context, currentIndex.lastOperationId);

        const operations = operationsResult.operations;
        const isALLOperations = operationsResult.isAll;

        if (operations.length === 0) {
            console.log('No pending operations to merge');
            return {
                success: true,
                processedOperations: 0,
                message: 'No pending operations'
            };
        }

        console.log(`Found ${operations.length} pending operations to merge. Is all operations: ${isALLOperations}, if there are remaining operations they will be processed in the next merge.`);

        // 按时间戳排序操作，确保按正确顺序应用
        operations.sort((a, b) => a.timestamp - b.timestamp);

        // 创建索引的副本进行操作
        const workingIndex = currentIndex;
        let operationsProcessed = 0;
        let addedCount = 0;
        let removedCount = 0;
        let movedCount = 0;
        let updatedCount = 0;
        const processedOperationIds = [];

        // 应用每个操作
        for (const operation of operations) {
            try {
                switch (operation.type) {
                    case 'add':
                        const addResult = applyAddOperation(workingIndex, operation.data);
                        if (addResult.added) addedCount++;
                        if (addResult.updated) updatedCount++;
                        break;
                        
                    case 'remove':
                        if (applyRemoveOperation(workingIndex, operation.data)) {
                            removedCount++;
                        }
                        break;
                        
                    case 'move':
                        if (applyMoveOperation(workingIndex, operation.data)) {
                            movedCount++;
                        }
                        break;
                        
                    case 'batch_add':
                        const batchAddResult = applyBatchAddOperation(workingIndex, operation.data);
                        addedCount += batchAddResult.addedCount;
                        updatedCount += batchAddResult.updatedCount;
                        break;
                        
                    case 'batch_remove':
                        removedCount += applyBatchRemoveOperation(workingIndex, operation.data);
                        break;
                        
                    case 'batch_move':
                        movedCount += applyBatchMoveOperation(workingIndex, operation.data);
                        break;
                        
                    default:
                        console.warn(`Unknown operation type: ${operation.type}`);
                        continue;
                }
                
                operationsProcessed++;
                processedOperationIds.push(operation.id);

                // 增加协作点
                if (operationsProcessed % 3 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 0));
                }
                
            } catch (error) {
                console.error(`Error applying operation ${operation.id}:`, error);
            }
        }

        // 如果有任何修改，保存索引
        if (operationsProcessed > 0) {
            workingIndex.lastUpdated = Date.now();
            workingIndex.totalCount = workingIndex.files.length;
            
            // 记录最后处理的操作ID
            if (processedOperationIds.length > 0) {
                workingIndex.lastOperationId = processedOperationIds[processedOperationIds.length - 1];
            }

            // 保存更新后的索引（使用分块格式）
            const saveSuccess = await saveChunkedIndex(context, workingIndex);
            if (!saveSuccess) {
                console.error('Failed to save chunked index');
                return {
                    success: false,
                    error: 'Failed to save index'
                };
            }

            console.log(`Index updated: ${addedCount} added, ${updatedCount} updated, ${removedCount} removed, ${movedCount} moved`);
        }

        // 清理已处理的操作记录
        if (cleanupAfterMerge && processedOperationIds.length > 0) {
            await cleanupOperations(context, processedOperationIds);
        }

        // 如果未处理完所有操作，调用 merge-operations API 递归处理
        if (!isALLOperations) {
            console.log('There are remaining operations, will process them in subsequent calls.');

            const headers = new Headers(request.headers);
            const originUrl = new URL(request.url);
            const mergeUrl = `${originUrl.protocol}//${originUrl.host}/api/manage/list?action=merge-operations`;

            await fetch(mergeUrl, { method: 'GET', headers });

            return {
                success: false,
                error: 'There are remaining operations, will process them in subsequent calls.'
            };
        }

        const result = {
            success: true,
            processedOperations: operationsProcessed,
            addedCount,
            updatedCount,
            removedCount,
            movedCount,
            totalFiles: workingIndex.totalCount
        };

        console.log('Operations merge completed:', result);
        return result;

    } catch (error) {
        console.error('Error merging operations:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * 读取文件索引，支持搜索和分页
 * @param {Object} context - 上下文对象
 * @param {Object} options - 查询选项
 * @param {string} options.search - 搜索关键字
 * @param {string} options.directory - 目录过滤
 * @param {number} options.start - 起始位置
 * @param {number} options.count - 返回数量，-1 表示返回所有
 * @param {string} options.channel - 渠道过滤
 * @param {string} options.listType - 列表类型过滤
 * @param {boolean} options.countOnly - 仅返回总数
 * @param {boolean} options.includeSubdirFiles - 是否包含子目录下的文件
 */
export async function readIndex(context, options = {}) {
    try {
        const {
            search = '',
            directory = '',
            start = 0,
            count = 50,
            channel = '',
            listType = '',
            countOnly = false,
            includeSubdirFiles = false
        } = options;
        // 处理目录满足无头有尾的格式，根目录为空
        const dirPrefix = directory === '' || directory.endsWith('/') ? directory : directory + '/';

        // 处理挂起的操作
        const mergeResult = await mergeOperationsToIndex(context);
        if (!mergeResult.success) {
            throw new Error('Failed to merge operations: ' + mergeResult.error);
        }

        // 获取当前索引
        const index = await getIndex(context);
        if (!index.success) {
            throw new Error('Failed to get index');
        }

        let filteredFiles = index.files;

        // 目录过滤
        if (directory) {
            const normalizedDir = directory.endsWith('/') ? directory : directory + '/';
            filteredFiles = filteredFiles.filter(file => {
                const fileDir = file.metadata.Directory ? file.metadata.Directory : extractDirectory(file.id);
                return fileDir.startsWith(normalizedDir) || file.metadata.Directory === directory;
            });
        }

        // 渠道过滤
        if (channel) {
            filteredFiles = filteredFiles.filter(file => 
                file.metadata.Channel?.toLowerCase() === channel.toLowerCase()
            );
        }

        // 列表类型过滤
        if (listType) {
            filteredFiles = filteredFiles.filter(file => 
                file.metadata.ListType === listType
            );
        }

        // 搜索过滤
        if (search) {
            const searchLower = search.toLowerCase();
            filteredFiles = filteredFiles.filter(file => {
                return file.metadata.FileName?.toLowerCase().includes(searchLower) ||
                    file.id.toLowerCase().includes(searchLower);
            });
        }

        // 如果只需要总数
        if (countOnly) {
            return {
                totalCount: filteredFiles.length,
                indexLastUpdated: index.lastUpdated
            };
        }

        // 分页处理
        const totalCount = filteredFiles.length;

        let resultFiles = filteredFiles;

        // 如果不包含子目录文件，获取当前目录下的直接文件
        if (!includeSubdirFiles) {
            resultFiles = filteredFiles.filter(file => {
                const fileDir = file.metadata.Directory ? file.metadata.Directory : extractDirectory(file.id);
                return fileDir === dirPrefix;
            });
        }

        if (count !== -1) {
            const startIndex = Math.max(0, start);
            const endIndex = startIndex + Math.max(1, count);
            resultFiles = resultFiles.slice(startIndex, endIndex);
        }

        // 提取目录信息
        const directories = new Set();
        filteredFiles.forEach(file => {
            const fileDir = file.metadata.Directory ? file.metadata.Directory : extractDirectory(file.id);
            if (fileDir && fileDir.startsWith(dirPrefix)) {
                const relativePath = fileDir.substring(dirPrefix.length);
                const firstSlashIndex = relativePath.indexOf('/');
                if (firstSlashIndex !== -1) {
                    const subDir = dirPrefix + relativePath.substring(0, firstSlashIndex);
                    directories.add(subDir);
                }
            }
        });

        return {
            files: resultFiles,
            directories: Array.from(directories),
            totalCount: totalCount,
            indexLastUpdated: index.lastUpdated,
            returnedCount: resultFiles.length,
            success: true
        };

    } catch (error) {
        console.error('Error reading index:', error);
        return {
            files: [],
            directories: [],
            totalCount: 0,
            indexLastUpdated: Date.now(),
            returnedCount: 0,
            success: false,
        };
    }
}

/**
 * 重建索引（从数据库中的所有文件重新构建索引）
 * @param {Object} context - 上下文对象
 * @param {Function} progressCallback - 进度回调函数
 */
export async function rebuildIndex(context, progressCallback = null) {
    const { env, waitUntil } = context;
    const db = getDatabase(env);

    try {
        console.log('Starting index rebuild...');
        
        let cursor = null;
        let processedCount = 0;
        const newIndex = {
            files: [],
            lastUpdated: Date.now(),
            totalCount: 0,
            lastOperationId: null
        };

        // 分批读取所有文件
        while (true) {
            const response = await db.list({
                limit: KV_LIST_LIMIT,
                cursor: cursor
            });

            cursor = response.cursor;

            for (const item of response.keys) {
                // 跳过管理相关的键
                if (item.name.startsWith('manage@') || item.name.startsWith('chunk_')) {
                    continue;
                }

                // 跳过没有元数据的文件
                if (!item.metadata || !item.metadata.TimeStamp) {
                    continue;
                }

                // 构建文件索引项
                const fileItem = {
                    id: item.name,
                    metadata: item.metadata || {}
                };

                newIndex.files.push(fileItem);
                processedCount++;

                // 报告进度
                if (progressCallback && processedCount % 100 === 0) {
                    progressCallback(processedCount);
                }
            }

            if (!cursor) break;
            
            // 添加协作点
            await new Promise(resolve => setTimeout(resolve, 10));
        }

        // 按时间戳倒序排序
        newIndex.files.sort((a, b) => b.metadata.TimeStamp - a.metadata.TimeStamp);

        newIndex.totalCount = newIndex.files.length;

        // 保存新索引（使用分块格式）
        const saveSuccess = await saveChunkedIndex(context, newIndex);
        if (!saveSuccess) {
            console.error('Failed to save chunked index during rebuild');
            return {
                success: false,
                error: 'Failed to save rebuilt index'
            };
        }

        // 清除旧的操作记录和多余索引
        waitUntil(deleteAllOperations(context));
        waitUntil(clearChunkedIndex(context, true));


        console.log(`Index rebuild completed. Processed ${processedCount} files, indexed ${newIndex.totalCount} files.`);
        return {
            success: true,
            processedCount,
            indexedCount: newIndex.totalCount
        };
        
    } catch (error) {
        console.error('Error rebuilding index:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * 获取索引信息
 * @param {Object} context - 上下文对象
 */
export async function getIndexInfo(context) {
    try {
        const index = await getIndex(context);

        // 检查索引是否成功获取
        if (index.success === false) {
            return {
                success: false,
                error: 'Failed to retrieve index',
                message: 'Index is not available or corrupted'
            }
        }

        // 统计各渠道文件数量
        const channelStats = {};
        const directoryStats = {};
        const typeStats = {};
        
        index.files.forEach(file => {
            // 渠道统计
            let channel = file.metadata.Channel || 'Telegraph';
            if (channel === 'TelegramNew') {
                channel = 'Telegram';
            }
            channelStats[channel] = (channelStats[channel] || 0) + 1;

            // 目录统计
            const dir = file.metadata.Directory || extractDirectory(file.id) || '/';
            directoryStats[dir] = (directoryStats[dir] || 0) + 1;
            
            // 类型统计
            let listType = file.metadata.ListType || 'None';
            const label = file.metadata.Label || 'None';
            if (listType !== 'White' && label === 'adult') {
                listType = 'Block';
            }
            typeStats[listType] = (typeStats[listType] || 0) + 1;
        });

        return {
            success: true,
            totalFiles: index.totalCount,
            lastUpdated: index.lastUpdated,
            channelStats,
            directoryStats,
            typeStats,
            oldestFile: index.files[index.files.length - 1],
            newestFile: index.files[0]
        };
    } catch (error) {
        console.error('Error getting index info:', error);
        return null;
    }
}

/* ============= 原子操作相关函数 ============= */

/**
 * 生成唯一的操作ID
 */
function generateOperationId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `${timestamp}_${random}`;
}

/**
 * 记录原子操作
 * @param {Object} context - 上下文对象，包含 env 和其他信息
 * @param {string} type - 操作类型
 * @param {Object} data - 操作数据
 */
async function recordOperation(context, type, data) {
    const { env } = context;
    const db = getDatabase(env);

    const operationId = generateOperationId();
    const operation = {
        type,
        timestamp: Date.now(),
        data
    };
    
    const operationKey = OPERATION_KEY_PREFIX + operationId;
    await db.put(operationKey, JSON.stringify(operation));

    return operationId;
}

/**
 * 获取所有待处理的操作
 * @param {Object} context - 上下文对象
 * @param {string} lastOperationId - 最后处理的操作ID
 */
async function getAllPendingOperations(context, lastOperationId = null) {
    const { env } = context;
    const db = getDatabase(env);

    const operations = [];

    let cursor = null;
    const MAX_OPERATION_COUNT = 30; // 单次获取的最大操作数量
    let isALL = true; // 是否获取了所有操作
    let operationCount = 0;

    try {
        while (true) {
            const response = await db.list({
                prefix: OPERATION_KEY_PREFIX,
                limit: KV_LIST_LIMIT,
                cursor: cursor
            });
            
            for (const item of response.keys) {
                // 如果指定了lastOperationId，跳过已处理的操作
                if (lastOperationId && item.name <= OPERATION_KEY_PREFIX + lastOperationId) {
                    continue;
                }
                
                if (operationCount >= MAX_OPERATION_COUNT) {
                    isALL = false; // 达到最大操作数量，停止获取
                    break;
                }

                try {
                    const operationData = await db.get(item.name);
                    if (operationData) {
                        const operation = JSON.parse(operationData);
                        operation.id = item.name.substring(OPERATION_KEY_PREFIX.length);
                        operations.push(operation);
                        operationCount++;
                    }
                } catch (error) {
                    isALL = false;
                    console.warn(`Failed to parse operation ${item.name}:`, error);
                }
            }
            
            cursor = response.cursor;
            if (!cursor || operationCount >= MAX_OPERATION_COUNT) break;
        }
    } catch (error) {
        console.error('Error getting pending operations:', error);
    }
    
    return {
        operations,
        isAll: isALL,
    }
}

/**
 * 应用添加操作
 * @param {Object} index - 索引对象
 * @param {Object} data - 操作数据
 */
function applyAddOperation(index, data) {
    const { fileId, metadata } = data;
    
    // 检查文件是否已存在
    const existingIndex = index.files.findIndex(file => file.id === fileId);
    
    const fileItem = {
        id: fileId,
        metadata: metadata || {}
    };
    
    if (existingIndex !== -1) {
        // 更新现有文件
        index.files[existingIndex] = fileItem;
        return { added: false, updated: true };
    } else {
        // 添加新文件
        insertFileInOrder(index.files, fileItem);
        return { added: true, updated: false };
    }
}

/**
 * 应用删除操作
 * @param {Object} index - 索引对象
 * @param {Object} data - 操作数据
 */
function applyRemoveOperation(index, data) {
    const { fileId } = data;
    const initialLength = index.files.length;
    index.files = index.files.filter(file => file.id !== fileId);
    return index.files.length < initialLength;
}

/**
 * 应用移动操作
 * @param {Object} index - 索引对象
 * @param {Object} data - 操作数据
 */
function applyMoveOperation(index, data) {
    const { originalFileId, newFileId, metadata } = data;
    
    const originalIndex = index.files.findIndex(file => file.id === originalFileId);
    if (originalIndex === -1) {
        return false; // 原文件不存在
    }
    
    // 更新文件ID和元数据
    index.files[originalIndex] = {
        id: newFileId,
        metadata: metadata || index.files[originalIndex].metadata
    };
    
    return true;
}

/**
 * 应用批量添加操作
 * @param {Object} index - 索引对象
 * @param {Object} data - 操作数据
 */
function applyBatchAddOperation(index, data) {
    const { files, options } = data;
    const { skipExisting = false } = options || {};
    
    let addedCount = 0;
    let updatedCount = 0;
    
    // 创建现有文件ID的映射以提高查找效率
    const existingFilesMap = new Map();
    index.files.forEach((file, idx) => {
        existingFilesMap.set(file.id, idx);
    });
    
    for (const fileData of files) {
        const { fileId, metadata } = fileData;
        const fileItem = {
            id: fileId,
            metadata: metadata || {}
        };
        
        const existingIndex = existingFilesMap.get(fileId);
        
        if (existingIndex !== undefined) {
            if (!skipExisting) {
                // 更新现有文件
                index.files[existingIndex] = fileItem;
                updatedCount++;
            }
        } else {
            // 添加新文件
            insertFileInOrder(index.files, fileItem);
            // 更新映射
            index.files.forEach((file, idx) => {
                existingFilesMap.set(file.id, idx);
            });
            
            addedCount++;
        }
    }
    
    return { addedCount, updatedCount };
}

/**
 * 应用批量删除操作
 * @param {Object} index - 索引对象
 * @param {Object} data - 操作数据
 */
function applyBatchRemoveOperation(index, data) {
    const { fileIds } = data;
    const fileIdSet = new Set(fileIds);
    const initialLength = index.files.length;
    
    index.files = index.files.filter(file => !fileIdSet.has(file.id));
    
    return initialLength - index.files.length;
}

/**
 * 应用批量移动操作
 * @param {Object} index - 索引对象
 * @param {Object} data - 操作数据
 */
function applyBatchMoveOperation(index, data) {
    const { operations } = data;
    let movedCount = 0;
    
    // 创建现有文件ID的映射以提高查找效率
    const existingFilesMap = new Map();
    index.files.forEach((file, idx) => {
        existingFilesMap.set(file.id, idx);
    });
    
    for (const operation of operations) {
        const { originalFileId, newFileId, metadata } = operation;
        
        const originalIndex = existingFilesMap.get(originalFileId);
        if (originalIndex !== undefined) {
            // 更新映射
            existingFilesMap.delete(originalFileId);
            existingFilesMap.set(newFileId, originalIndex);
            
            // 更新文件信息
            index.files[originalIndex] = {
                id: newFileId,
                metadata: metadata || index.files[originalIndex].metadata
            };
            
            movedCount++;
        }
    }
    
    return movedCount;
}

/**
 * 并发清理指定的原子操作记录
 * @param {Object} context - 上下文对象
 * @param {Array} operationIds - 要清理的操作ID数组
 * @param {number} concurrency - 并发数量，默认为10
 */
async function cleanupOperations(context, operationIds, concurrency = 10) {
    const { env } = context;
    const db = getDatabase(env);

    try {
        console.log(`Cleaning up ${operationIds.length} processed operations with concurrency ${concurrency}...`);
        
        let deletedCount = 0;
        let errorCount = 0;
        
        // 创建删除任务数组
        const deleteTasks = operationIds.map(operationId => {
            const operationKey = OPERATION_KEY_PREFIX + operationId;
            return async () => {
                try {
                    await db.delete(operationKey);
                    deletedCount++;
                } catch (error) {
                    console.error(`Error deleting operation ${operationId}:`, error);
                    errorCount++;
                }
            };
        });
        
        // 使用并发控制执行删除操作
        await promiseLimit(deleteTasks, concurrency);

        console.log(`Successfully cleaned up ${deletedCount} operations, ${errorCount} operations failed.`);
        return {
            success: true,
            deletedCount: deletedCount,
            errorCount: errorCount,
        };

    } catch (error) {
        console.error('Error cleaning up operations:', error);
    }
}

/**
 * 删除所有原子操作记录
 * @param {Object} context - 上下文对象，包含 env 和其他信息
 * @returns {Object} 删除结果 { success, deletedCount, errors?, totalFound? }
 */
export async function deleteAllOperations(context) {
    const { request, env } = context;
    const db = getDatabase(env);
    
    try {
        console.log('Starting to delete all atomic operations...');
        
        // 获取所有原子操作
        const allOperationIds = [];
        let cursor = null;
        let totalFound = 0;
        
        // 首先收集所有操作键
        while (true) {
            const response = await db.list({
                prefix: OPERATION_KEY_PREFIX,
                limit: KV_LIST_LIMIT,
                cursor: cursor
            });
            
            for (const item of response.keys) {
                allOperationIds.push(item.name.substring(OPERATION_KEY_PREFIX.length));
                totalFound++;
            }
            
            cursor = response.cursor;
            if (!cursor) break;
        }
        
        if (totalFound === 0) {
            console.log('No atomic operations found to delete');
            return {
                success: true,
                deletedCount: 0,
                totalFound: 0,
                message: 'No operations to delete'
            };
        }
        
        console.log(`Found ${totalFound} atomic operations to delete`);

        // 限制单次删除的数量
        const MAX_DELETE_BATCH = 40;
        const toDeleteOperationIds = allOperationIds.slice(0, MAX_DELETE_BATCH);
   
        // 批量删除原子操作
        const cleanupResult = await cleanupOperations(context, toDeleteOperationIds);

        // 剩余未删除的操作，调用 delete-operations API 进行递归删除
        if (allOperationIds.length > MAX_DELETE_BATCH || cleanupResult.errorCount > 0) {
            console.warn(`Too many operations (${allOperationIds.length}), only deleting first ${cleanupResult.deletedCount}. The remaining operations will be deleted in subsequent calls.`);
            // 复制请求头，用于鉴权
            const headers = new Headers(request.headers);

            const originUrl = new URL(request.url);
            const deleteUrl = `${originUrl.protocol}//${originUrl.host}/api/manage/list?action=delete-operations`
            
            await fetch(deleteUrl, {
                method: 'GET',
                headers: headers
            });

        } else {
            console.log(`Delete all operations completed`);
        }

    } catch (error) {
        console.error('Error deleting all operations:', error);
    }
}

/* ============= 工具函数 ============= */

/**
 * 获取索引（内部函数）
 * @param {Object} context - 上下文对象
 */
async function getIndex(context) {
    const { waitUntil } = context;
    try {
        // 首先尝试加载分块索引
        const index = await loadChunkedIndex(context);
        if (index.success) {
            return index;
        } else {
            // 如果加载失败，触发重建索引
            waitUntil(rebuildIndex(context));
        }
    } catch (error) {
        console.warn('Error reading index, creating new one:', error);
        waitUntil(rebuildIndex(context));
    }
    
    // 返回空的索引结构
    return {
        files: [],
        lastUpdated: Date.now(),
        totalCount: 0,
        lastOperationId: null,
        success: false,
    };
}

/**
 * 从文件路径提取目录（内部函数）
 * @param {string} filePath - 文件路径
 */
function extractDirectory(filePath) {
    const lastSlashIndex = filePath.lastIndexOf('/');
    if (lastSlashIndex === -1) {
        return ''; // 根目录
    }
    return filePath.substring(0, lastSlashIndex + 1); // 包含最后的斜杠
}

/**
 * 将文件按时间戳倒序插入到已排序的数组中
 * @param {Array} sortedFiles - 已按时间戳倒序排序的文件数组
 * @param {Object} fileItem - 要插入的文件项
 */
function insertFileInOrder(sortedFiles, fileItem) {
    const fileTimestamp = fileItem.metadata.TimeStamp || 0;
    
    // 如果数组为空或新文件时间戳比第一个文件更新，直接插入到开头
    if (sortedFiles.length === 0 || fileTimestamp >= (sortedFiles[0].metadata.TimeStamp || 0)) {
        sortedFiles.unshift(fileItem);
        return;
    }
    
    // 如果新文件时间戳比最后一个文件更旧，直接添加到末尾
    if (fileTimestamp <= (sortedFiles[sortedFiles.length - 1].metadata.TimeStamp || 0)) {
        sortedFiles.push(fileItem);
        return;
    }
    
    // 使用二分查找找到正确的插入位置
    let left = 0;
    let right = sortedFiles.length;
    
    while (left < right) {
        const mid = Math.floor((left + right) / 2);
        const midTimestamp = sortedFiles[mid].metadata.TimeStamp || 0;
        
        if (fileTimestamp >= midTimestamp) {
            right = mid;
        } else {
            left = mid + 1;
        }
    }
    
    // 在找到的位置插入文件
    sortedFiles.splice(left, 0, fileItem);
}

/**
 * 并发控制工具函数 - 限制同时执行的Promise数量
 * @param {Array} tasks - 任务数组，每个任务是一个返回Promise的函数
 * @param {number} concurrency - 并发数量
 * @returns {Promise<Array>} 所有任务的结果数组
 */
async function promiseLimit(tasks, concurrency = BATCH_SIZE) {
    const results = [];
    const executing = [];
    
    for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        const promise = Promise.resolve().then(() => task()).then(result => {
            results[i] = result;
            return result;
        }).finally(() => {
            const index = executing.indexOf(promise);
            if (index >= 0) {
                executing.splice(index, 1);
            }
        });
        
        executing.push(promise);
        
        if (executing.length >= concurrency) {
            await Promise.race(executing);
        }
    }
    
    // 等待所有剩余的Promise完成
    await Promise.all(executing);
    return results;
}

/**
 * 保存分块索引到数据库
 * @param {Object} context - 上下文对象，包含 env
 * @param {Object} index - 完整的索引对象
 * @returns {Promise<boolean>} 是否保存成功
 */
async function saveChunkedIndex(context, index) {
    const { env } = context;
    const db = getDatabase(env);
    
    try {
        const files = index.files || [];
        const chunks = [];
        
        // 将文件数组分块
        for (let i = 0; i < files.length; i += INDEX_CHUNK_SIZE) {
            const chunk = files.slice(i, i + INDEX_CHUNK_SIZE);
            chunks.push(chunk);
        }
        
        // 保存索引元数据
        const metadata = {
            lastUpdated: index.lastUpdated,
            totalCount: index.totalCount,
            lastOperationId: index.lastOperationId,
            chunkCount: chunks.length,
            chunkSize: INDEX_CHUNK_SIZE
        };
        
        await db.put(INDEX_META_KEY, JSON.stringify(metadata));
        
        // 保存各个分块
        const savePromises = chunks.map((chunk, chunkId) => {
            const chunkKey = `${INDEX_KEY}_${chunkId}`;
            return db.put(chunkKey, JSON.stringify(chunk));
        });
        
        await Promise.all(savePromises);
        
        console.log(`Saved chunked index: ${chunks.length} chunks, ${files.length} total files`);
        return true;
        
    } catch (error) {
        console.error('Error saving chunked index:', error);
        return false;
    }
}

/**
 * 从数据库加载分块索引
 * @param {Object} context - 上下文对象，包含 env
 * @returns {Promise<Object>} 完整的索引对象
 */
async function loadChunkedIndex(context) {
    const { env } = context;
    const db = getDatabase(env);

    try {
        // 首先获取元数据
        const metadataStr = await db.get(INDEX_META_KEY);
        if (!metadataStr) {
            throw new Error('Index metadata not found');
        }
        
        const metadata = JSON.parse(metadataStr);
        const files = [];
        
        // 并行加载所有分块
        const loadPromises = [];
        for (let chunkId = 0; chunkId < metadata.chunkCount; chunkId++) {
            const chunkKey = `${INDEX_KEY}_${chunkId}`;
            loadPromises.push(
                db.get(chunkKey).then(chunkStr => {
                    if (chunkStr) {
                        return JSON.parse(chunkStr);
                    }
                    return [];
                })
            );
        }
        
        const chunks = await Promise.all(loadPromises);
        
        // 合并所有分块
        chunks.forEach(chunk => {
            if (Array.isArray(chunk)) {
                files.push(...chunk);
            }
        });
        
        const index = {
            files,
            lastUpdated: metadata.lastUpdated,
            totalCount: metadata.totalCount,
            lastOperationId: metadata.lastOperationId,
            success: true
        };
        
        console.log(`Loaded chunked index: ${metadata.chunkCount} chunks, ${files.length} total files`);
        return index;
        
    } catch (error) {
        console.error('Error loading chunked index:', error);
        // 返回空的索引结构
        return {
            files: [],
            lastUpdated: Date.now(),
            totalCount: 0,
            lastOperationId: null,
            success: false,
        };
    }
}

/**
 * 清理分块索引
 * @param {Object} context - 上下文对象，包含 env
 * @param {boolean} onlyNonUsed - 是否仅清理未使用的分块索引，默认为 false
 * @returns {Promise<boolean>} 是否清理成功
 */
export async function clearChunkedIndex(context, onlyNonUsed = false) {
    const { env } = context;
    const db = getDatabase(env);
    
    try {
        console.log('Starting chunked index cleanup...');
        
        // 获取元数据
        const metadataStr = await db.get(INDEX_META_KEY);
        let chunkCount = 0;
        
        if (metadataStr) {
            const metadata = JSON.parse(metadataStr);
            chunkCount = metadata.chunkCount || 0;

            if (!onlyNonUsed) {
                // 删除元数据
                await db.delete(INDEX_META_KEY).catch(() => {});
            }
        }

        // 删除分块
        const recordedChunks = []; // 现有的索引分块键
        let cursor = null;
        while (true) {
            const response = await db.list({
                prefix: INDEX_KEY,
                limit: KV_LIST_LIMIT,
                cursor: cursor
            });
            
            for (const item of response.keys) {
                recordedChunks.push(item.name);
            }

            cursor = response.cursor;
            if (!cursor) break;
        }

        const reservedChunks = [];
        if (onlyNonUsed) {
            // 如果仅清理未使用的分块索引，保留当前在使用的分块
            for (let chunkId = 0; chunkId < chunkCount; chunkId++) {
                reservedChunks.push(`${INDEX_KEY}_${chunkId}`);
            }
        }

        const deletePromises = [];
        for (let chunkKey of recordedChunks) {
            if (reservedChunks.includes(chunkKey) || !chunkKey.startsWith(INDEX_KEY + '_')) {
                // 保留的分块和非分块键不删除
                continue;
            }

            deletePromises.push(
                db.delete(chunkKey).catch(() => {})
            );
        }

        if (recordedChunks.includes(INDEX_KEY)) {
            deletePromises.push(
                db.delete(INDEX_KEY).catch(() => {})
            );
        }

        await Promise.all(deletePromises);
        
        console.log(`Chunked index cleanup completed. Attempted to delete ${chunkCount} chunks.`);
        return true;
        
    } catch (error) {
        console.error('Error during chunked index cleanup:', error);
        return false;
    }
}

/**
 * 获取索引的存储统计信息
 * @param {Object} context - 上下文对象，包含 env
 * @returns {Object} 存储统计信息
 */
export async function getIndexStorageStats(context) {
    const { env } = context;
    const db = getDatabase(env);

    try {
        // 获取元数据
        const metadataStr = await db.get(INDEX_META_KEY);
        if (!metadataStr) {
            return {
                success: false,
                error: 'No chunked index metadata found',
                isChunked: false
            };
        }
        
        const metadata = JSON.parse(metadataStr);
        
        // 检查各个分块的存在情况
        const chunkChecks = [];
        for (let chunkId = 0; chunkId < metadata.chunkCount; chunkId++) {
            const chunkKey = `${INDEX_KEY}_${chunkId}`;
            chunkChecks.push(
                db.get(chunkKey).then(data => ({
                    chunkId,
                    exists: !!data,
                    size: data ? data.length : 0
                }))
            );
        }
        
        const chunkResults = await Promise.all(chunkChecks);
        
        const stats = {
            success: true,
            isChunked: true,
            metadata,
            chunks: chunkResults,
            totalChunks: metadata.chunkCount,
            existingChunks: chunkResults.filter(c => c.exists).length,
            totalSize: chunkResults.reduce((sum, c) => sum + c.size, 0)
        };
        
        return stats;
        
    } catch (error) {
        console.error('Error getting index storage stats:', error);
        return {
            success: false,
            error: error.message,
            isChunked: false
        };
    }
}