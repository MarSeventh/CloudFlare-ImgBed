import { readIndex } from '../../../utils/indexManager.js';
import { getDatabase } from '../../../utils/databaseAdapter.js';

export async function onRequest(context) {
    const { request, env } = context;
    
    try {
        const url = new URL(request.url);
        const action = url.searchParams.get('action');

        switch (action) {
        case 'backup':
            return await handleBackup(context);
        case 'restore':
            return await handleRestore(request, env);
        default:
            return new Response(JSON.stringify({ error: '不支持的操作' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    } catch (error) {
        console.error('备份操作错误:', error);
        return new Response(JSON.stringify({ error: '操作失败: ' + error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// 处理备份操作
async function handleBackup(context) {
    const { env } = context;
    try {
        const backupData = {
            timestamp: Date.now(),
            version: '2.0.2',
            data: {
                fileCount: 0,
                files: {},
                settings: {}
            }
        };

        // 直接从数据库读取所有文件信息，不依赖索引
        const db = getDatabase(env);
        let allFiles = [];
        let cursor = null;

        // 分批获取所有文件
        while (true) {
            const response = await db.listFiles({
                limit: 1000,
                cursor: cursor
            });

            if (!response || !response.keys || !Array.isArray(response.keys)) {
                break;
            }

            for (const item of response.keys) {
                // 跳过管理相关的键和分块数据
                if (item.name.startsWith('manage@') || item.name.startsWith('chunk_')) {
                    continue;
                }

                // 跳过没有元数据的文件
                if (!item.metadata || !item.metadata.TimeStamp) {
                    continue;
                }

                allFiles.push({
                    id: item.name,
                    metadata: item.metadata
                });
            }

            cursor = response.cursor;
            if (!cursor) break;
        }

        backupData.data.fileCount = allFiles.length;

        // 备份文件数据
        for (const file of allFiles) {
            const fileId = file.id;
            const metadata = file.metadata;
            
            // 对于TelegramNew渠道且IsChunked为true的文件，需要从数据库读取其值
            if (metadata.Channel === 'TelegramNew' && metadata.IsChunked === true) {
                try {
                    const fileData = await db.getWithMetadata(fileId);
                    backupData.data.files[fileId] = {
                        metadata: metadata,
                        value: fileData.value
                    };
                } catch (error) {
                    console.error(`读取分块文件 ${fileId} 失败:`, error);
                    // 如果读取失败，仍然保存元数据
                    backupData.data.files[fileId] = {
                        metadata: metadata,
                        value: null
                    };
                }
            } else {
                // 其他文件直接保存索引中的元数据
                backupData.data.files[fileId] = {
                    metadata: metadata,
                    value: null
                };
            }
        }

        // 备份系统设置
        // db 已经在上面定义了

        // 备份所有设置，不仅仅是manage@开头的
        const allSettingsList = await db.listSettings({});
        for (const key of allSettingsList.keys) {
            // 忽略索引文件
            if (key.name.startsWith('manage@index')) continue;

            const setting = key.value;
            if (setting) {
                backupData.data.settings[key.name] = setting;
            }
        }

        // 额外确保备份manage@开头的设置
        const manageSettingsList = await db.listSettings({ prefix: 'manage@' });
        for (const key of manageSettingsList.keys) {
            // 忽略索引文件
            if (key.name.startsWith('manage@index')) continue;

            const setting = key.value;
            if (setting && !backupData.data.settings[key.name]) {
                backupData.data.settings[key.name] = setting;
            }
        }

        const backupJson = JSON.stringify(backupData, null, 2);
        
        return new Response(backupJson, {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Content-Disposition': `attachment; filename="imgbed_backup_${new Date().toISOString().split('T')[0]}.json"`
            }
        });
    } catch (error) {
        throw new Error('备份失败: ' + error.message);
    }
}

// 处理恢复操作
async function handleRestore(request, env) {
    try {
        const contentType = request.headers.get('content-type');
        
        if (!contentType || !contentType.includes('application/json')) {
            return new Response(JSON.stringify({ error: '请上传JSON格式的备份文件' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const backupData = await request.json();
        
        // 验证备份文件格式
        if (!backupData.data || !backupData.data.files || !backupData.data.settings) {
            return new Response(JSON.stringify({ error: '备份文件格式无效' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        let restoredFiles = 0;
        let restoredSettings = 0;

        // 恢复文件数据
        const db = getDatabase(env);
        const fileEntries = Object.entries(backupData.data.files);
        const batchSize = 50; // 批量处理，避免超时

        for (let i = 0; i < fileEntries.length; i += batchSize) {
            const batch = fileEntries.slice(i, i + batchSize);

            for (const [key, fileData] of batch) {
                try {
                    if (fileData.value) {
                        // 对于有value的文件（如telegram分块文件），恢复完整数据
                        await db.put(key, fileData.value, {
                            metadata: fileData.metadata
                        });
                    } else if (fileData.metadata) {
                        // 只恢复元数据
                        await db.put(key, '', {
                            metadata: fileData.metadata
                        });
                    }
                    restoredFiles++;
                } catch (error) {
                    console.error(`恢复文件 ${key} 失败:`, error);
                }
            }

            // 每批处理后短暂暂停，避免过载
            if (i + batchSize < fileEntries.length) {
                await new Promise(resolve => setTimeout(resolve, 10));
            }
        }

        // 恢复系统设置
        const settingEntries = Object.entries(backupData.data.settings);
        console.log(`开始恢复 ${settingEntries.length} 个设置`);

        for (const [key, value] of settingEntries) {
            try {
                console.log(`恢复设置: ${key}, 长度: ${value.length}`);
                await db.put(key, value);

                // 验证是否成功保存
                const retrieved = await db.get(key);
                if (retrieved === value) {
                    restoredSettings++;
                    console.log(`设置 ${key} 恢复成功`);
                } else {
                    console.error(`设置 ${key} 恢复后验证失败`);
                    console.error(`原始长度: ${value.length}, 检索长度: ${retrieved ? retrieved.length : 'null'}`);
                }
            } catch (error) {
                console.error(`恢复设置 ${key} 失败:`, error);
            }
        }

        return new Response(JSON.stringify({ 
            success: true,
            message: '恢复完成',
            stats: {
                restoredFiles,
                restoredSettings,
                backupTimestamp: backupData.timestamp
            }
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (error) {
        throw new Error('恢复失败: ' + error.message);
    }
}
