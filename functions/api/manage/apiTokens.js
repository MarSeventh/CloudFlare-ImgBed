import { getDatabase } from '../../utils/databaseAdapter.js';
import { filterAutoDeleteTokens } from '../../utils/tokenExpiration.js';

export async function onRequest(context) {
    // API Token管理，支持创建、删除、列出Token
    const {
      request,
      env
    } = context;

    const db = getDatabase(env);
    const url = new URL(request.url)
    const method = request.method

    // GET - 获取所有Token列表
    if (method === 'GET') {
        const tokens = await getApiTokens(db)
        return new Response(JSON.stringify(tokens), {
            headers: {
                'content-type': 'application/json',
            },
        })
    }

    // POST - 创建新Token
    if (method === 'POST') {
        const body = await request.json()
        const { name, permissions, owner, expiresAt = null, autoDelete = false } = body

        if (!name || !permissions || !owner) {
            return new Response(JSON.stringify({ error: '缺少必要参数' }), {
                status: 400,
                headers: {
                    'content-type': 'application/json',
                },
            })
        }

        const token = await createApiToken(db, name, permissions, owner, expiresAt, autoDelete)
        return new Response(JSON.stringify(token), {
            headers: {
                'content-type': 'application/json',
            },
        })
    }

    // DELETE - 删除Token
    if (method === 'DELETE') {
        const tokenId = url.searchParams.get('id')
        
        if (!tokenId) {
            return new Response(JSON.stringify({ error: '缺少Token ID' }), {
                status: 400,
                headers: {
                    'content-type': 'application/json',
                },
            })
        }

        const result = await deleteApiToken(db, tokenId)
        return new Response(JSON.stringify(result), {
            headers: {
                'content-type': 'application/json',
            },
        })
    }

    // PUT - 更新Token权限
    if (method === 'PUT') {
        const body = await request.json()
        const { tokenId, permissions, expiresAt = null, autoDelete = false } = body

        if (!tokenId || !permissions) {
            return new Response(JSON.stringify({ error: '缺少必要参数' }), {
                status: 400,
                headers: {
                    'content-type': 'application/json',
                },
            })
        }

        const result = await updateApiToken(db, tokenId, permissions, expiresAt, autoDelete)
        return new Response(JSON.stringify(result), {
            headers: {
                'content-type': 'application/json',
            },
        })
    }

    return new Response('Method not allowed', { status: 405 })
}

// 获取所有API Token
async function getApiTokens(db) {
    const settingsStr = await db.get('manage@sysConfig@security')
    const settings = settingsStr ? JSON.parse(settingsStr) : {}
    const tokens = settings.apiTokens?.tokens || {}
    
    // 将 tokens 对象转为数组，并应用向后兼容默认值
    const tokenArray = Object.keys(tokens).map(id => {
        const token = tokens[id]
        return {
            id,
            name: token.name,
            owner: token.owner,
            permissions: token.permissions,
            createdAt: token.createdAt,
            updatedAt: token.updatedAt,
            token: token.token,
            expiresAt: token.expiresAt ?? null,
            autoDelete: token.autoDelete ?? false
        }
    })
    
    // 使用 filterAutoDeleteTokens 识别需要自动删除的 Token
    const { toDelete, toKeep } = filterAutoDeleteTokens(tokenArray)
    
    // 从数据库中删除符合自动删除条件的 Token
    if (toDelete.length > 0) {
        for (const t of toDelete) {
            delete settings.apiTokens.tokens[t.id]
        }
        await db.put('manage@sysConfig@security', JSON.stringify(settings))
    }
    
    // 返回时不包含实际token值，只返回基本信息
    const tokenList = toKeep.map(t => ({
        id: t.id,
        name: t.name,
        owner: t.owner,
        permissions: t.permissions,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        token: t.token.substr(0, 15) + '...', // 只显示前15位
        expiresAt: t.expiresAt,
        autoDelete: t.autoDelete
    }))
    
    return { tokens: tokenList }
}

// 创建新的API Token
async function createApiToken(db, name, permissions, owner, expiresAt = null, autoDelete = false) {
    const settingsStr = await db.get('manage@sysConfig@security')
    const settings = settingsStr ? JSON.parse(settingsStr) : {}
    
    if (!settings.apiTokens) {
        settings.apiTokens = { tokens: {} }
    }
    
    const tokenId = generateTokenId()
    const token = generateApiToken()
    const now = new Date().toISOString()
    
    const tokenData = {
        id: tokenId,
        name,
        token,
        owner,
        permissions,
        createdAt: now,
        updatedAt: now,
        expiresAt: expiresAt ?? null,
        autoDelete: autoDelete === true
    }
    
    settings.apiTokens.tokens[tokenId] = tokenData
    
    // 保存到数据库
    await db.put('manage@sysConfig@security', JSON.stringify(settings))
    
    return {
        id: tokenId,
        name,
        token,
        owner,
        permissions,
        createdAt: now,
        updatedAt: now,
        expiresAt: tokenData.expiresAt,
        autoDelete: tokenData.autoDelete
    }
}

// 删除API Token
async function deleteApiToken(db, tokenId) {
    const settingsStr = await db.get('manage@sysConfig@security')
    const settings = settingsStr ? JSON.parse(settingsStr) : {}
    
    if (!settings.apiTokens?.tokens?.[tokenId]) {
        return { error: 'Token 不存在' }
    }
    
    delete settings.apiTokens.tokens[tokenId]
    
    // 保存到数据库
    await db.put('manage@sysConfig@security', JSON.stringify(settings))
    
    return { success: true, message: 'Token 已删除' }
}

// 更新API Token
async function updateApiToken(db, tokenId, permissions, expiresAt = null, autoDelete = false) {
    const settingsStr = await db.get('manage@sysConfig@security')
    const settings = settingsStr ? JSON.parse(settingsStr) : {}
    
    if (!settings.apiTokens?.tokens?.[tokenId]) {
        return { error: 'Token 不存在' }
    }
    
    settings.apiTokens.tokens[tokenId].permissions = permissions
    settings.apiTokens.tokens[tokenId].updatedAt = new Date().toISOString()
    settings.apiTokens.tokens[tokenId].expiresAt = expiresAt ?? null
    settings.apiTokens.tokens[tokenId].autoDelete = autoDelete === true
    
    // 保存到数据库
    await db.put('manage@sysConfig@security', JSON.stringify(settings))
    
    return { 
        success: true, 
        message: 'Token 已更新',
        token: settings.apiTokens.tokens[tokenId]
    }
}

// 生成随机Token（使用密码学安全随机数）
function generateApiToken() {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    const hex = Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
    return 'imgbed_' + hex;
}

// 生成Token ID（使用密码学安全随机数）
function generateTokenId() {
    const array = new Uint8Array(12);
    crypto.getRandomValues(array);
    return Array.from(array).map(b => b.toString(16).padStart(2, '0')).join('');
}

// 根据Token获取权限（供其他API使用）
export async function getTokenPermissions(db, token) {
    const settingsStr = await db.get('manage@sysConfig@security')
    const settings = settingsStr ? JSON.parse(settingsStr) : {}
    const tokens = settings.apiTokens?.tokens || {}
    
    // 查找匹配的token
    for (const tokenId in tokens) {
        if (tokens[tokenId].token === token) {
            return tokens[tokenId].permissions
        }
    }
    
    return null
}

// 根据Token获取完整数据对象（供tokenValidator使用）
export async function getTokenData(db, token) {
    const settingsStr = await db.get('manage@sysConfig@security')
    const settings = settingsStr ? JSON.parse(settingsStr) : {}
    const tokens = settings.apiTokens?.tokens || {}
    
    // 查找匹配的token
    for (const tokenId in tokens) {
        if (tokens[tokenId].token === token) {
            const t = tokens[tokenId]
            return {
                id: t.id,
                name: t.name,
                token: t.token,
                owner: t.owner,
                permissions: t.permissions,
                createdAt: t.createdAt,
                updatedAt: t.updatedAt,
                expiresAt: t.expiresAt ?? null,
                autoDelete: t.autoDelete ?? false
            }
        }
    }
    
    return null
}
