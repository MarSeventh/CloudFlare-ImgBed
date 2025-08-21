/**
 * 数据迁移工具
 * 用于将KV数据迁移到D1数据库
 */

import { getDatabase, checkDatabaseConfig } from '../../utils/databaseAdapter.js';

export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    try {
        switch (action) {
            case 'check':
                return await handleCheck(env);
            case 'migrate':
                return await handleMigrate(env);
            case 'status':
                return await handleStatus(env);
            default:
                return new Response(JSON.stringify({ error: '不支持的操作' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' }
                });
        }
    } catch (error) {
        console.error('迁移操作错误:', error);
        return new Response(JSON.stringify({ error: '操作失败: ' + error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// 检查迁移环境
async function handleCheck(env) {
    const dbConfig = checkDatabaseConfig(env);
    
    const result = {
        hasKV: dbConfig.hasKV,
        hasD1: dbConfig.hasD1,
        canMigrate: dbConfig.hasKV && dbConfig.hasD1,
        currentDatabase: dbConfig.usingD1 ? 'D1' : (dbConfig.usingKV ? 'KV' : 'None'),
        message: ''
    };

    if (!result.canMigrate) {
        if (!result.hasKV) {
            result.message = '未找到KV存储，无法进行迁移';
        } else if (!result.hasD1) {
            result.message = '未找到D1数据库，请先配置D1数据库';
        }
    } else {
        result.message = '环境检查通过，可以开始迁移';
    }

    return new Response(JSON.stringify(result), {
        headers: { 'Content-Type': 'application/json' }
    });
}

// 执行迁移
async function handleMigrate(env) {
    const dbConfig = checkDatabaseConfig(env);
    
    if (!dbConfig.hasKV || !dbConfig.hasD1) {
        return new Response(JSON.stringify({ 
            error: '迁移环境不满足要求',
            hasKV: dbConfig.hasKV,
            hasD1: dbConfig.hasD1
        }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
        });
    }

    const migrationResult = {
        startTime: new Date().toISOString(),
        files: { migrated: 0, failed: 0, errors: [] },
        settings: { migrated: 0, failed: 0, errors: [] },
        operations: { migrated: 0, failed: 0, errors: [] },
        status: 'running'
    };

    try {
        // 1. 迁移文件数据
        console.log('开始迁移文件数据...');
        await migrateFiles(env, migrationResult);

        // 2. 迁移系统设置
        console.log('开始迁移系统设置...');
        await migrateSettings(env, migrationResult);

        // 3. 迁移索引操作
        console.log('开始迁移索引操作...');
        await migrateIndexOperations(env, migrationResult);

        migrationResult.status = 'completed';
        migrationResult.endTime = new Date().toISOString();

    } catch (error) {
        migrationResult.status = 'failed';
        migrationResult.error = error.message;
        migrationResult.endTime = new Date().toISOString();
    }

    return new Response(JSON.stringify(migrationResult), {
        headers: { 'Content-Type': 'application/json' }
    });
}

// 迁移文件数据
async function migrateFiles(env, result) {
    const db = getDatabase(env);
    let cursor = null;
    const batchSize = 100;

    while (true) {
        const response = await getDatabase(env).list({
            limit: batchSize,
            cursor: cursor
        });

        for (const item of response.keys) {
            // 跳过管理相关的键
            if (item.name.startsWith('manage@') || item.name.startsWith('chunk_')) {
                continue;
            }

            try {
                const fileData = await getDatabase(env).getWithMetadata(item.name);
                
                if (fileData && fileData.metadata) {
                    await db.putFile(item.name, fileData.value || '', {
                        metadata: fileData.metadata
                    });
                    result.files.migrated++;
                }
            } catch (error) {
                result.files.failed++;
                result.files.errors.push({
                    file: item.name,
                    error: error.message
                });
                console.error(`迁移文件 ${item.name} 失败:`, error);
            }
        }

        cursor = response.cursor;
        if (!cursor) break;

        // 添加延迟避免过载
        await new Promise(resolve => setTimeout(resolve, 10));
    }
}

// 迁移系统设置
async function migrateSettings(env, result) {
    const db = getDatabase(env);
    
    const settingsList = await getDatabase(env).list({ prefix: 'manage@' });
    
    for (const item of settingsList.keys) {
        // 跳过索引相关的键
        if (item.name.startsWith('manage@index')) {
            continue;
        }

        try {
            const value = await getDatabase(env).get(item.name);
            if (value) {
                await db.putSetting(item.name, value);
                result.settings.migrated++;
            }
        } catch (error) {
            result.settings.failed++;
            result.settings.errors.push({
                setting: item.name,
                error: error.message
            });
            console.error(`迁移设置 ${item.name} 失败:`, error);
        }
    }
}

// 迁移索引操作
async function migrateIndexOperations(env, result) {
    const db = getDatabase(env);
    const operationPrefix = 'manage@index@operation_';
    
    const operationsList = await getDatabase(env).list({ prefix: operationPrefix });
    
    for (const item of operationsList.keys) {
        try {
            const operationData = await getDatabase(env).get(item.name);
            if (operationData) {
                const operation = JSON.parse(operationData);
                const operationId = item.name.replace(operationPrefix, '');
                
                await db.putIndexOperation(operationId, operation);
                result.operations.migrated++;
            }
        } catch (error) {
            result.operations.failed++;
            result.operations.errors.push({
                operation: item.name,
                error: error.message
            });
            console.error(`迁移操作 ${item.name} 失败:`, error);
        }
    }
}

// 获取迁移状态
async function handleStatus(env) {
    const dbConfig = checkDatabaseConfig(env);
    
    let fileCount = { kv: 0, d1: 0 };
    let settingCount = { kv: 0, d1: 0 };

    try {
        // 统计KV中的数据
        if (dbConfig.hasKV) {
            const kvFiles = await getDatabase(env).list({ limit: 1000 });
            fileCount.kv = kvFiles.keys.filter(k => 
                !k.name.startsWith('manage@') && !k.name.startsWith('chunk_')
            ).length;

            const kvSettings = await getDatabase(env).list({ prefix: 'manage@', limit: 1000 });
            settingCount.kv = kvSettings.keys.filter(k => 
                !k.name.startsWith('manage@index')
            ).length;
        }

        // 统计D1中的数据
        if (dbConfig.hasD1) {
            const db = getDatabase(env);
            
            const fileCountStmt = db.db.prepare('SELECT COUNT(*) as count FROM files');
            const fileResult = await fileCountStmt.first();
            fileCount.d1 = fileResult.count;

            const settingCountStmt = db.db.prepare('SELECT COUNT(*) as count FROM settings');
            const settingResult = await settingCountStmt.first();
            settingCount.d1 = settingResult.count;
        }
    } catch (error) {
        console.error('获取状态失败:', error);
    }

    return new Response(JSON.stringify({
        database: dbConfig,
        counts: {
            files: fileCount,
            settings: settingCount
        },
        migrationNeeded: fileCount.kv > 0 && fileCount.d1 === 0
    }), {
        headers: { 'Content-Type': 'application/json' }
    });
}
