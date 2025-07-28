/* 索引管理器 */

/**
 * 文件索引结构：
 * - key: manage@index
 * - value: JSON.stringify(fileIndex)
 * - fileIndex: {
 *     files: [
 *       {
 *         id: "file_unique_id",
 *         metadata: {}
 *       }
 *     ],
 *     lastUpdated: 1640995200000,
 *     totalCount: 1000
 *   }
 */

const INDEX_KEY = 'manage@index';
const BATCH_SIZE = 1000; // 批量处理大小

/**
 * 添加文件到索引
 * @param {Object} context - 上下文对象，包含 env 和其他信息
 * @param {string} fileId - 文件 ID
 * @param {Object} metadata - 文件元数据
 */
export async function addFileToIndex(context, fileId, metadata = null) {
    return await performLockedIndexOperation(context, async (index, lockId) => {
        try {
            if (metadata === null) {
                // 如果为传入metadata，尝试从KV中获取
                const fileData = await context.env.img_url.getWithMetadata(fileId);
                metadata = fileData.metadata || {};
            }

            // 构建文件索引项
            const fileItem = {
                id: fileId,
                metadata: metadata,
            };

            // 检查文件是否已存在
            const existingIndex = index.files.findIndex(file => file.id === fileId);
            if (existingIndex !== -1) {
                // 更新现有文件
                index.files[existingIndex] = fileItem;
            } else {
                // 添加新文件
                index.files.push(fileItem);
            }

            // 按时间戳倒序排序（最新的在前面）
            index.files.sort((a, b) => b.metadata.TimeStamp - a.metadata.TimeStamp);
            index.lastUpdated = Date.now();
            index.totalCount = index.files.length;

            console.log(`File ${fileId} added to index successfully`);
            return { success: true, indexModified: true };
        } catch (error) {
            console.error('Error adding file to index:', error);
            return { success: false, error: error.message };
        }
    });
}

/**
 * 批量添加文件到索引
 * @param {Object} context - 上下文对象，包含 env 和其他信息
 * @param {Array} files - 文件数组，每个元素包含 { fileId, metadata }
 * @param {Object} options - 选项
 * @param {boolean} options.skipExisting - 是否跳过已存在的文件，默认为 false（更新已存在的文件）
 * @returns {Object} 返回操作结果 { addedCount, updatedCount, skippedCount, totalProcessed }
 */
export async function batchAddFilesToIndex(context, files, options = {}) {
    return await performLockedIndexOperation(context, async (index, lockId) => {
        const { env } = context;
        const { 
            skipExisting = false
        } = options;

        try {
            let addedCount = 0;
            let updatedCount = 0;
            let skippedCount = 0;
            let totalProcessed = 0;

            // 创建现有文件ID的映射以提高查找效率
            const existingFilesMap = new Map();
            index.files.forEach((file, idx) => {
                existingFilesMap.set(file.id, idx);
            });

            // 处理每个文件
            for (const fileItem of files) {
                const { fileId, metadata } = fileItem;
                totalProcessed++;

                // 检查是否提供了有效的文件ID
                if (!fileId) {
                    console.warn(`Skipping file with invalid ID: ${fileId}`);
                    skippedCount++;
                    continue;
                }

                let finalMetadata = metadata;

                // 如果没有提供metadata，尝试从KV中获取
                if (!finalMetadata) {
                    try {
                        const fileData = await env.img_url.getWithMetadata(fileId);
                        finalMetadata = fileData.metadata || {};
                    } catch (error) {
                        console.warn(`Failed to get metadata for file ${fileId}:`, error);
                        finalMetadata = {};
                    }
                }

                // 构建文件索引项
                const newFileItem = {
                    id: fileId,
                    metadata: finalMetadata,
                };

                // 检查文件是否已存在
                const existingIndex = existingFilesMap.get(fileId);
                
                if (existingIndex !== undefined) {
                    if (skipExisting) {
                        skippedCount++;
                        console.log(`Skipping existing file: ${fileId}`);
                    } else {
                        // 更新现有文件
                        index.files[existingIndex] = newFileItem;
                        updatedCount++;
                        console.log(`Updated existing file: ${fileId}`);
                    }
                } else {
                    // 添加新文件
                    index.files.push(newFileItem);
                    existingFilesMap.set(fileId, index.files.length - 1);
                    addedCount++;
                    console.log(`Added new file: ${fileId}`);
                }

                // 添加小延迟以避免阻塞
                if (totalProcessed % 100 === 0) {
                    await new Promise(resolve => setTimeout(resolve, 5));
                }
            }

            let indexModified = false;

            // 只有在有实际变更时才重新排序和保存
            if (addedCount > 0 || updatedCount > 0) {
                // 按时间戳倒序排序（最新的在前面）
                index.files.sort((a, b) => {
                    const aTime = a.metadata.TimeStamp || 0;
                    const bTime = b.metadata.TimeStamp || 0;
                    return bTime - aTime;
                });

                index.lastUpdated = Date.now();
                index.totalCount = index.files.length;

                indexModified = true;
            }

            const result = {
                addedCount,
                updatedCount,
                skippedCount,
                totalProcessed,
                success: true,
                indexModified: indexModified
            };

            console.log(`Batch add completed: ${addedCount} added, ${updatedCount} updated, ${skippedCount} skipped out of ${totalProcessed} files`);

            return result;

        } catch (error) {
            console.error('Error batch adding files to index:', error);
            return {
                addedCount: 0,
                updatedCount: 0,
                skippedCount: 0,
                totalProcessed: 0,
                success: false,
                error: error.message,
                indexModified: false
            };
        }
    });
}

/**
 * 从索引中删除文件
 * @param {Object} context - 上下文对象
 * @param {string} fileId - 文件 ID
 */
export async function removeFileFromIndex(context, fileId) {
    return await performLockedIndexOperation(context, async (index, lockId) => {
        try {
            const initialLength = index.files.length;
            index.files = index.files.filter(file => file.id !== fileId);
            
            if (index.files.length < initialLength) {
                index.lastUpdated = Date.now();
                index.totalCount = index.files.length;
                console.log(`File ${fileId} removed from index successfully`);
                return { success: true, indexModified: true };
            } else {
                console.log(`File ${fileId} not found in index`);
                return { success: false, indexModified: false };
            }
        } catch (error) {
            console.error('Error removing file from index:', error);
            return { success: false, error: error.message };
        }
    });
}

/**
 * 批量删除文件
 * @param {Object} context - 上下文对象
 * @param {Array} fileIds - 文件 ID 数组
 */
export async function batchRemoveFilesFromIndex(context, fileIds) {
    return await performLockedIndexOperation(context, async (index, lockId) => {
        try {
            const fileIdSet = new Set(fileIds);
            const initialLength = index.files.length;
            index.files = index.files.filter(file => !fileIdSet.has(file.id));
            
            const removedCount = initialLength - index.files.length;
            if (removedCount > 0) {
                index.lastUpdated = Date.now();
                index.totalCount = index.files.length;
                console.log(`${removedCount} files removed from index successfully`);
                return { success: true, indexModified: true, removedCount };
            }
            
            return { success: true, indexModified: false, removedCount: 0 };
        } catch (error) {
            console.error('Error batch removing files from index:', error);
            return { success: false, error: error.message, removedCount: 0 };
        }
    });
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
            countOnly = false
        } = options;

        const index = await getIndex(context);
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
                file.metadata.Channel.toLowerCase() === channel.toLowerCase()
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
        // 获取当前目录下的直接文件
        let resultFiles = filteredFiles.filter(file => {
            const fileDir = file.metadata.Directory ? file.metadata.Directory : extractDirectory(file.id);
            const dirPrefix = directory === '' || directory.endsWith('/') ? directory : directory + '/';
            return fileDir === dirPrefix;
        });

        if (count !== -1) {
            const startIndex = Math.max(0, start);
            const endIndex = startIndex + Math.max(1, count);
            resultFiles = resultFiles.slice(startIndex, endIndex);
        }

        // 提取目录信息
        const directories = new Set();
        if (directory === '') {
            // 如果查询根目录，提取一级子目录
            filteredFiles.forEach(file => {
                const fileDir = file.metadata.Directory ? file.metadata.Directory : extractDirectory(file.id);
                if (fileDir) {
                    const firstSlashIndex = fileDir.indexOf('/');
                    const topLevelDir = firstSlashIndex === -1 ? 
                        fileDir : 
                        fileDir.substring(0, firstSlashIndex);
                    directories.add(topLevelDir);
                }
            });
        } else {
            // 如果查询特定目录，提取其子目录
            const dirPrefix = directory.endsWith('/') ? directory : directory + '/';
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
        }

        return {
            files: resultFiles,
            directories: Array.from(directories),
            totalCount: totalCount,
            indexLastUpdated: index.lastUpdated,
            returnedCount: resultFiles.length
        };

    } catch (error) {
        console.error('Error reading index:', error);
        return {
            files: [],
            directories: [],
            totalCount: 0,
            indexLastUpdated: Date.now(),
            returnedCount: 0
        };
    }
}

/**
 * 重建索引（从 KV 中的所有文件重新构建索引）
 * @param {Object} env - 环境变量
 * @param {Function} progressCallback - 进度回调函数
 */
export async function rebuildIndex(context, progressCallback = null) {
    const { env } = context;

    try {
        console.log('Starting index rebuild...');
        
        let cursor = null;
        let processedCount = 0;
        const newIndex = {
            files: [],
            lastUpdated: Date.now(),
            totalCount: 0
        };

        // 分批读取所有文件
        while (true) {
            const response = await env.img_url.list({
                limit: BATCH_SIZE,
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

        // 保存新索引
        await saveIndex(env, newIndex, null, true);
        
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
            const channel = file.metadata.Channel || 'Unknown';
            channelStats[channel] = (channelStats[channel] || 0) + 1;

            // 目录统计
            const dir = file.metadata.Directory || extractDirectory(file.id) || '/';
            directoryStats[dir] = (directoryStats[dir] || 0) + 1;
            
            // 类型统计
            typeStats[file.metadata.ListType] = (typeStats[file.metadata.ListType] || 0) + 1;
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

/**
 * 获取索引（内部函数）
 * @param {Object} context - 上下文对象
 */
async function getIndex(context) {
    const { env, waitUntil } = context;
    try {
        const indexData = await env.img_url.get(INDEX_KEY);
        if (indexData) {
            return JSON.parse(indexData);
        } else {
            waitUntil(rebuildIndex(context));
        }
    } catch (error) {
        console.warn('Error reading index, creating new one:', error);
    }
    
    // 返回空的索引结构
    return {
        files: [],
        lastUpdated: Date.now(),
        totalCount: 0,
        success: false,
    };
}

/**
 * 保存索引（内部函数）
 * @param {Object} env - 环境变量
 * @param {Object} index - 索引数据
 * @param {string} lockId - 可选的锁ID，如果提供则不会重新获取锁
 * @param {boolean} skipLock - 是否跳过锁获取，默认为 false
 */
async function saveIndex(env, index, lockId = null, skipLock = false) {
    let acquiredLock = false;
    let currentLockId = lockId;
    
    try {
        // 如果没有提供锁ID，且没有跳过锁获取，则获取写锁
        if (!currentLockId && !skipLock) {
            const lockResult = await getWriteLock(env);
            if (!lockResult.success) {
                console.error('Failed to acquire write lock for saving index');
                return false;
            }
            currentLockId = lockResult.lockId;
            acquiredLock = true;
        }

        const indexJson = JSON.stringify(index);
        await env.img_url.put(INDEX_KEY, indexJson);
        
        return true;
    } catch (error) {
        console.error('Error saving index:', error);
        return false;
    } finally {
        // 只在此函数获取锁的情况下释放锁
        if (acquiredLock && currentLockId) {
            await releaseWriteLock(env, currentLockId);
        }
    }
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

/* 读写锁控制 */

const WRITE_LOCK_KEY = 'manage@index@write_lock';
const LOCK_TIMEOUT = 60000; // 锁超时时间 60秒
const LOCK_RETRY_DELAY = 100; // 重试间隔 100ms

/**
 * 获取写锁
 * @param {Object} env - 环境变量对象
 * @param {string} lockId - 锁标识符，用于标识获取锁的操作
 * @param {number} timeout - 锁超时时间，默认60秒
 * @returns {Promise<boolean>} - 是否成功获取锁
 */
export async function getWriteLock(env, lockId = null, timeout = LOCK_TIMEOUT) {
    if (!lockId) {
        lockId = `lock_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }
    
    const lockData = {
        lockId: lockId,
        timestamp: Date.now(),
        expireAt: Date.now() + timeout
    };

    let attempts = 0;
    const maxAttempts = Math.floor(timeout / LOCK_RETRY_DELAY);

    while (attempts < maxAttempts) {
        try {
            // 尝试获取现有锁
            const existingLock = await env.img_url.get(WRITE_LOCK_KEY);
            
            if (existingLock) {
                const lockInfo = JSON.parse(existingLock);
                
                // 检查锁是否已过期
                if (Date.now() > lockInfo.expireAt) {
                    console.log('Found expired lock, attempting to acquire...');
                    // 锁已过期，尝试获取
                } else {
                    // 锁仍然有效，等待后重试
                    attempts++;
                    await new Promise(resolve => setTimeout(resolve, LOCK_RETRY_DELAY));
                    continue;
                }
            }

            // 尝试设置锁
            await env.img_url.put(WRITE_LOCK_KEY, JSON.stringify(lockData), {
                expirationTtl: 60 // 1分钟过期
            });
            
            // 验证锁是否成功设置（防止竞态条件）
            await new Promise(resolve => setTimeout(resolve, 50)); // 短暂延迟
            const verifyLock = await env.img_url.get(WRITE_LOCK_KEY);
            
            if (verifyLock) {
                const verifyLockInfo = JSON.parse(verifyLock);
                if (verifyLockInfo.lockId === lockId) {
                    console.log(`Write lock acquired successfully: ${lockId}`);
                    return { success: true, lockId: lockId };
                }
            }
            
            // 锁获取失败，继续重试
            attempts++;
            await new Promise(resolve => setTimeout(resolve, LOCK_RETRY_DELAY));
            
        } catch (error) {
            console.error('Error trying to acquire write lock:', error);
            attempts++;
            await new Promise(resolve => setTimeout(resolve, LOCK_RETRY_DELAY));
        }
    }

    console.warn(`Failed to acquire write lock after ${attempts} attempts`);
    return { success: false, lockId: null };
}

/**
 * 释放写锁
 * @param {Object} env - 环境变量对象
 * @param {string} lockId - 锁标识符，必须与获取锁时的标识符匹配
 * @returns {Promise<boolean>} - 是否成功释放锁
 */
export async function releaseWriteLock(env, lockId) {
    if (!lockId) {
        console.error('Lock ID is required to release write lock');
        return false;
    }

    try {
        // 获取当前锁信息
        const existingLock = await env.img_url.get(WRITE_LOCK_KEY);
        
        if (!existingLock) {
            console.warn('No write lock found to release');
            return false;
        }

        const lockInfo = JSON.parse(existingLock);
        
        // 验证锁标识符是否匹配
        if (lockInfo.lockId !== lockId) {
            console.error(`Lock ID mismatch. Expected: ${lockId}, Found: ${lockInfo.lockId}`);
            return false;
        }

        // 删除锁
        await env.img_url.delete(WRITE_LOCK_KEY);
        console.log(`Write lock released successfully: ${lockId}`);
        return true;
        
    } catch (error) {
        console.error('Error releasing write lock:', error);
        return false;
    }
}

/**
 * 检查写锁状态
 * @param {Object} env - 环境变量对象
 * @returns {Promise<Object>} - 锁状态信息
 */
export async function checkWriteLockStatus(env) {
    try {
        const existingLock = await env.img_url.get(WRITE_LOCK_KEY);
        
        if (!existingLock) {
            return { locked: false };
        }

        const lockInfo = JSON.parse(existingLock);
        const isExpired = Date.now() > lockInfo.expireAt;
        
        return {
            locked: !isExpired,
            lockInfo: lockInfo,
            expired: isExpired,
            remainingTime: isExpired ? 0 : lockInfo.expireAt - Date.now()
        };
        
    } catch (error) {
        console.error('Error checking write lock status:', error);
        return { locked: false, error: error.message };
    }
}

/**
 * 使用写锁的安全批量操作
 * @param {Object} context - 上下文对象
 * @param {Function} operation - 要执行的操作函数，接收 (index, lockId) 参数
 * @param {Object} options - 选项
 * @param {number} options.timeout - 锁超时时间
 * @returns {Promise<Object>} - 操作结果
 */
export async function performLockedIndexOperation(context, operation, options = {}) {
    const { env } = context;
    const { timeout = LOCK_TIMEOUT } = options;
    
    // 获取写锁
    const lockResult = await getWriteLock(env, null, timeout);
    if (!lockResult.success) {
        return {
            success: false,
            error: 'Failed to acquire write lock'
        };
    }

    const lockId = lockResult.lockId;
    
    try {
        // 获取当前索引
        const index = await getIndex(context);
        
        // 执行操作
        const result = await operation(index, lockId);
        
        // 如果操作成功且索引被修改，保存索引
        if (result.success && result.indexModified) {
            const saveResult = await saveIndex(env, index, lockId);
            if (!saveResult) {
                return {
                    success: false,
                    error: 'Failed to save index after operation'
                };
            }
        }
        
        return result;
        
    } catch (error) {
        console.error('Error in locked index operation:', error);
        return {
            success: false,
            error: error.message
        };
    } finally {
        // 释放写锁
        await releaseWriteLock(env, lockId);
    }
}