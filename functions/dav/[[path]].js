// WebDAV 服务支持
import { fetchOthersConfig } from "../utils/sysConfig";
import { getDatabase } from "../utils/databaseAdapter";
import { createApiToken } from "../api/manage/apiTokens";

export async function onRequest(context) {
    const { request, env } = context;

    // WebDAV 规范：如果请求的是根目录 /dav 但没有斜杠，重定向到 /dav/，以保证客户端的 href 匹配
    const url = new URL(request.url);
    if (url.pathname === '/dav') {
        url.pathname = '/dav/';
        return Response.redirect(url.toString(), 301);
    }

    const authResponse = await checkAuth(request, env);
    if (authResponse) return authResponse;

    // 从请求路径中替换第一个 /dav 部分
    url.pathname = url.pathname.replace(/^\/dav/, '') || '/';
    const modifiedRequest = new Request(url.toString(), request);

    switch (modifiedRequest.method) {
        case 'OPTIONS': return handleOptions(modifiedRequest);
        case 'PROPFIND': return handlePropfind(modifiedRequest, env);
        case 'PUT': return handlePut(modifiedRequest, env);
        case 'DELETE': return handleDelete(modifiedRequest, env);
        case 'GET': return handleGet(modifiedRequest, env);
        case 'MOVE': return handleMove(modifiedRequest, env, context);
        case 'MKCOL': return new Response(null, { status: 201 });
        default: return new Response('Method Not Allowed', { status: 405 });
    }
}

// --- UTILITY FUNCTIONS ---

async function getApiHeaders(env) {
    const othersConfig = await fetchOthersConfig(env);
    let token = othersConfig.webDAV.internalToken;
    let tokenId = othersConfig.webDAV.internalTokenId;

    const db = getDatabase(env);

    // token 不存在时自动创建并更新 WebDAV 设置
    if (!token) {
        const tokenResult = await createApiToken(
            db,
            'WebDAV Internal Token',
            ['list', 'upload', 'delete', 'manage'],
            'system',
            null,
            false,
            'internal'
        );
        token = tokenResult.token;
        tokenId = tokenResult.id;

        // 更新 others config 中的 WebDAV 设置
        const settingsStr = await db.get('manage@sysConfig@others');
        const settings = settingsStr ? JSON.parse(settingsStr) : {};
        if (!settings.webDAV) settings.webDAV = {};
        settings.webDAV.internalToken = token;
        settings.webDAV.internalTokenId = tokenResult.id;
        await db.put('manage@sysConfig@others', JSON.stringify(settings));
    } else if (tokenId) {
        // 自愈：确保已存在的 token 具有 'manage' 权限，以便执行 MOVE 操作
        const settingsStr = await db.get('manage@sysConfig@security');
        const settings = settingsStr ? JSON.parse(settingsStr) : {};
        if (settings.apiTokens?.tokens?.[tokenId]) {
            const tokenData = settings.apiTokens.tokens[tokenId];
            if (!tokenData.permissions.includes('manage')) {
                tokenData.permissions.push('manage');
                tokenData.updatedAt = new Date().toISOString();
                await db.put('manage@sysConfig@security', JSON.stringify(settings));
            }
        }
    }

    return {
        'Authorization': `Bearer ${token}`,
    };
}

async function checkAuth(request, env) {
    const othersConfig = await fetchOthersConfig(env);

    const enabled = othersConfig.webDAV.enabled;
    if (!enabled) return new Response('WebDAV is disabled', { status: 403 }); // WebDAV disabled

    const davUser = othersConfig.webDAV.username;
    const davPass = othersConfig.webDAV.password;
    if (!davUser || !davPass) return null; // No auth required

    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
        return new Response('Authorization required', {
            status: 401,
            headers: { 'WWW-Authenticate': 'Basic realm="WebDAV"' },
        });
    }

    const [scheme, encoded] = authHeader.split(' ');
    if (scheme !== 'Basic' || !encoded) {
        return new Response('Malformed Authorization header', { status: 400 });
    }

    const [user, pass] = atob(encoded).split(':');
    if (user !== davUser || pass !== davPass) {
        return new Response('Invalid credentials', { status: 403 });
    }

    return null;
}

// --- WEBDAV METHOD HANDLERS ---

function handleOptions(request) {
    return new Response(null, {
        status: 200,
        headers: {
            'Allow': 'OPTIONS, GET, PUT, DELETE, PROPFIND, MOVE, MKCOL',
            'DAV': '1',
            'MS-Author-Via': 'DAV',
        },
    });
}

async function handleGet(request, env) {
    const path = decodeURIComponent(new URL(request.url).pathname);

    if (path.endsWith('/')) { // Directory listing
        try {
            const dir = path === '/' ? '' : path.substring(1, path.length - 1);
            const contents = await fetchDirectoryContents(dir, env, request);
            const html = generateDirectoryListingHtml(path, contents);
            return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
        } catch (error) {
            console.error('GET (directory) failed:', error.stack);
            return new Response(`Error listing directory: ${error.message}`, { status: 500 });
        }
    } else { // File download
        try {
            const fileUrl = new URL(`/file${path}`, request.url);

            const fileResponse = await fetch(fileUrl.toString());

            if (!fileResponse.ok) {
                 return new Response('File not found', { status: fileResponse.status, statusText: fileResponse.statusText });
            }

            const response = new Response(fileResponse.body, fileResponse);
            response.headers.set('Access-Control-Allow-Origin', '*');

            return response;
        } catch (error) {
            console.error('GET (file) failed:', error.stack);
            return new Response(`Error getting file: ${error.message}`, { status: 500 });
        }
    }
}

async function handlePut(request, env) {
    const fullPath = decodeURIComponent(new URL(request.url).pathname.substring(1));
    if (!fullPath || fullPath.endsWith('/')) {
        return new Response('Invalid file name', { status: 400 });
    }

    const lastSlashIndex = fullPath.lastIndexOf('/');
    let uploadFolder = lastSlashIndex > -1 ? fullPath.substring(0, lastSlashIndex) : '';
    const fileName = lastSlashIndex > -1 ? fullPath.substring(lastSlashIndex + 1) : fullPath;

    // 路径安全处理：防止路径穿越
    if (uploadFolder) {
        // 防止双重编码绕过：仅在检测到编码字符时解码
        if (/%[0-9a-fA-F]{2}/.test(uploadFolder)) {
            try { uploadFolder = decodeURIComponent(uploadFolder); } catch (e) { /* ignore */ }
        }
        uploadFolder = uploadFolder
            .replace(/\.\./g, '_')
            .replace(/\\/g, '/')
            .replace(/\/{2,}/g, '/')
            .replace(/^\/+/, '')
            .replace(/\/+$/, '');
    }
    
    const fileContent = await request.blob();
    const formData = new FormData();
    formData.append('file', fileContent, fileName);

    const uploadUrl = new URL(`/upload`, request.url);
    uploadUrl.searchParams.set('uploadNameType', 'origin'); // WebDAV 规范：使用原始文件名
    if (uploadFolder) {
        uploadUrl.searchParams.set('uploadFolder', uploadFolder);
    }

    // 获取 WebDAV 配置的上传渠道
    const othersConfig = await fetchOthersConfig(env);
    const webdavConfig = othersConfig.webDAV || {};
    if (webdavConfig.uploadChannel) {
        uploadUrl.searchParams.set('uploadChannel', webdavConfig.uploadChannel);
    }
    if (webdavConfig.channelName) {
        uploadUrl.searchParams.set('channelName', webdavConfig.channelName);
    }

    try {
        const response = await fetch(uploadUrl.toString(), { 
            method: 'POST', 
            body: formData,
            headers: await getApiHeaders(env)
        });
        const result = await response.json(); 
        if (response.ok && Array.isArray(result) && result.length > 0 && result[0].src) {
            return new Response(null, { status: 201 }); // Created
        } else {
            const errorMsg = result.error || JSON.stringify(result);
            console.error('Upload API error:', errorMsg);
            return new Response(`Upload failed: ${errorMsg}`, { status: 500 });
        }
    } catch (error) {
        console.error('Fetch to upload API failed:', error.stack);
        return new Response('Failed to contact upload service', { status: 502 });
    }
}

async function handleDelete(request, env) {
    const path = decodeURIComponent(new URL(request.url).pathname.substring(1));
    if (!path) return new Response('Invalid path for DELETE', { status: 400 });

    const isFolder = path.endsWith('/');
    const cleanPath = isFolder ? path.slice(0, -1) : path;
    
    const deleteUrl = new URL(`/api/manage/delete/${cleanPath}`, request.url);
    if (isFolder) deleteUrl.searchParams.set('folder', 'true');

    try {
        const response = await fetch(deleteUrl.toString(), {
            method: 'DELETE',
            headers: await getApiHeaders(env)
        });
        const result = await response.json();
        if (result.success) {
            return new Response(null, { status: 204 }); // No Content
        } else {
            console.error('Delete API error:', JSON.stringify(result));
            return new Response(`Deletion failed: ${result.error || 'API error'}`, { status: 500 });
        }
    } catch (error) {
        console.error('Delete operation failed:', error.stack);
        return new Response(`Internal server error: ${error.message}`, { status: 500 });
    }
}

async function handlePropfind(request, env) {
    const path = decodeURIComponent(new URL(request.url).pathname);
    const depth = request.headers.get('Depth') || '1';
    
    try {
        const db = getDatabase(env);
        
        // 检查请求路径是否为文件
        let isFile = false;
        let fileInfo = null;
        if (path !== '/') {
            const cleanPath = path.startsWith('/') ? path.substring(1) : path;
            const fileData = await db.getWithMetadata(cleanPath);
            if (fileData && fileData.metadata) {
                isFile = true;
                fileInfo = {
                    name: cleanPath,
                    metadata: fileData.metadata
                };
            }
        }

        // 检查请求路径是否为目录
        let isDir = false;
        if (path === '/') {
            isDir = true;
        } else {
            const dir = path.startsWith('/') ? path.substring(1) : path;
            const cleanDir = dir.endsWith('/') ? dir : dir + '/';
            // 如果数据库中存在以当前路径为前缀的键，说明目录存在
            const listResponse = await db.list({ prefix: cleanDir, limit: 1 });
            if (listResponse.keys && listResponse.keys.length > 0) {
                isDir = true;
            }
        }

        // 如果路径既不是文件也不是目录，直接返回 404
        if (!isFile && !isDir) {
            return new Response('Not Found', { status: 404 });
        }

        let xml;
        if (isFile) {
            xml = `<?xml version="1.0" encoding="utf-8"?><D:multistatus xmlns:D="DAV:">${createFileXml(fileInfo)}</D:multistatus>`;
        } else {
            const dir = path === '/' ? '' : path.substring(1, path.endsWith('/') ? path.length - 1 : path.length);
            let contents = { files: [], directories: [] };
            if (depth !== '0') {
                contents = await fetchDirectoryContents(dir, env, request);
            }
            xml = generateWebDAVXml(path, contents, depth);
        }
        
        return new Response(xml, { status: 207, headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
    } catch (error) {
        console.error('Propfind failed:', error.stack);
        return new Response(`Failed to list files: ${error.message}`, { status: 500 });
    }
}

async function handleMove(request, env, context) {
    const destinationHeader = request.headers.get('Destination');
    if (!destinationHeader) {
        return new Response('Destination header is required', { status: 400 });
    }

    let destinationUrl;
    try {
        destinationUrl = new URL(destinationHeader);
    } catch (e) {
        return new Response('Invalid Destination URL', { status: 400 });
    }

    const requestUrl = new URL(request.url);
    if (destinationUrl.host !== requestUrl.host) {
        return new Response('Cannot move resource to a different server', { status: 502 });
    }

    const sourcePath = decodeURIComponent(requestUrl.pathname);
    const cleanSource = sourcePath.startsWith('/') ? sourcePath.substring(1) : sourcePath;

    let destPath = decodeURIComponent(destinationUrl.pathname);
    destPath = destPath.replace(/^\/dav/, '') || '/';
    const cleanDest = destPath.startsWith('/') ? destPath.substring(1) : destPath;

    if (!cleanSource || !cleanDest) {
        return new Response('Invalid source or destination path', { status: 400 });
    }

    const overwrite = request.headers.get('Overwrite') !== 'F';

    try {
        const db = getDatabase(env);

        // 检查源路径是否为目录
        let isFolder = cleanSource.endsWith('/');
        let lookupSource = isFolder ? cleanSource.slice(0, -1) : cleanSource;

        if (!isFolder) {
            const listResponse = await db.list({ prefix: lookupSource + '/', limit: 1 });
            if (listResponse.keys && listResponse.keys.length > 0) {
                isFolder = true;
            }
        }

        let lookupDest = cleanDest.endsWith('/') ? cleanDest.slice(0, -1) : cleanDest;

        // 处理覆盖逻辑：如果目标存在且允许覆盖，先将其删除
        let destExisted = false;
        const existingFile = await db.getWithMetadata(lookupDest);
        if (existingFile && existingFile.value !== null) {
            destExisted = true;
            if (!overwrite) {
                return new Response('Precondition Failed', { status: 412 });
            }
            const deleteUrl = new URL(`/api/manage/delete/${encodeURIComponent(lookupDest)}`, request.url);
            const deleteResponse = await fetch(deleteUrl.toString(), {
                method: 'DELETE',
                headers: await getApiHeaders(env)
            });
            if (!deleteResponse.ok) {
                return new Response('Failed to delete existing destination file', { status: 500 });
            }
        } else {
            const listResponse = await db.list({ prefix: lookupDest + '/', limit: 1 });
            if (listResponse.keys && listResponse.keys.length > 0) {
                destExisted = true;
                if (!overwrite) {
                    return new Response('Precondition Failed', { status: 412 });
                }
                const deleteUrl = new URL(`/api/manage/delete/${encodeURIComponent(lookupDest)}`, request.url);
                deleteUrl.searchParams.set('folder', 'true');
                const deleteResponse = await fetch(deleteUrl.toString(), {
                    method: 'DELETE',
                    headers: await getApiHeaders(env)
                });
                if (!deleteResponse.ok) {
                    return new Response('Failed to delete existing destination folder', { status: 500 });
                }
            }
        }

        if (isFolder) {
            // 递归列出目录下的所有文件并重命名
            const listUrl = new URL(`/api/manage/list`, request.url);
            listUrl.searchParams.set('dir', lookupSource);
            listUrl.searchParams.set('count', -1);
            listUrl.searchParams.set('recursive', 'true');
            
            const listResponse = await fetch(listUrl.toString(), { headers: await getApiHeaders(env) });
            if (!listResponse.ok) {
                return new Response('Failed to list source folder contents', { status: 500 });
            }
            const listData = await listResponse.json();

            const filesToMove = listData.files || [];
            for (const file of filesToMove) {
                const relativePath = file.name.substring(lookupSource.length);
                const newFileId = lookupDest + relativePath;

                const renameUrl = new URL(`/api/manage/rename/${encodeURIComponent(file.name)}`, request.url);
                const renameResponse = await fetch(renameUrl.toString(), {
                    method: 'POST',
                    headers: {
                        ...(await getApiHeaders(env)),
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ newFileId })
                });

                if (!renameResponse.ok) {
                    const errorMsg = await renameResponse.text();
                    return new Response(`Failed to move file ${file.name}: ${errorMsg}`, { status: 500 });
                }
            }
            
            return new Response(null, { status: destExisted ? 204 : 201 });
        } else {
            // 单个文件重命名/移动
            const renameUrl = new URL(`/api/manage/rename/${encodeURIComponent(lookupSource)}`, request.url);
            const renameResponse = await fetch(renameUrl.toString(), {
                method: 'POST',
                headers: {
                    ...(await getApiHeaders(env)),
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ newFileId: lookupDest })
            });

            if (renameResponse.ok) {
                return new Response(null, { status: destExisted ? 204 : 201 });
            } else {
                const errorMsg = await renameResponse.text();
                return new Response(`Rename failed: ${errorMsg}`, { status: 500 });
            }
        }
    } catch (error) {
        console.error('MOVE operation failed:', error.stack);
        return new Response(`Internal server error: ${error.message}`, { status: 500 });
    }
}

// --- API DATA FETCHING ---

async function fetchDirectoryContents(dir, env, request) {
    let allFiles = [];
    let allDirectories = [];
    const count = -1; // Fetch all items

    const listUrl = new URL(`/api/manage/list`, request.url);
    listUrl.searchParams.set('dir', dir);
    listUrl.searchParams.set('count', count);

    const response = await fetch(listUrl.toString(), { headers: await getApiHeaders(env) });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API fetch error: Status ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    if (result.error) {
        throw new Error(`API error: ${result.error} - ${result.message}`);
    }

    if (result.files && result.files.length > 0) allFiles = allFiles.concat(result.files);
    if (result.directories && result.directories.length > 0) allDirectories = allDirectories.concat(result.directories);


    return { files: allFiles, directories: [...new Set(allDirectories)] };
}

// --- HTML and XML GENERATION ---

function generateDirectoryListingHtml(basePath, contents) {
    let fileLinks = '';
    let dirLinks = '';

    for (const dir of contents.directories) {
        const fullDirPath = `/dav/${dir}/`;
        const dirName = dir.split('/').pop();
        dirLinks += `<li><a href="${fullDirPath}"><strong>${dirName}/</strong></a></li>`;
    }

    for (const file of contents.files) {
        const fullFilePath = `/dav/${file.name}`; 
        const fileName = file.name.split('/').pop();
        const fileSize = file.metadata && file.metadata['FileSize'] 
            ? `${file.metadata['FileSize']} MB` 
            : 'N/A';
        fileLinks += `<li><a href="${fullFilePath}">${fileName}</a> - ${fileSize}</li>`;
    }
    
    let parentDirLink = '';
    if (basePath !== '/') {
        const parentPath = new URL('..', `http://dummy.com${basePath}`).pathname;
        parentDirLink = `<li><a href="/dav${parentPath}"><strong>../ (Parent Directory)</strong></a></li>`;
    }

    return `<!DOCTYPE html><html><head><title>Index of ${basePath}</title><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>body{font-family:sans-serif;padding:20px}li{margin:5px 0}</style></head><body><h1>Index of ${basePath}</h1><ul>${parentDirLink}${dirLinks}${fileLinks}</ul></body></html>`;
}

function generateWebDAVXml(basePath, contents, depth) {
    let responses = '';
    const prefixPath = basePath.startsWith('/dav/') ? basePath : `/dav${basePath.startsWith('/') ? '' : '/'}${basePath}`;
    const currentPath = prefixPath.endsWith('/') ? prefixPath : `${prefixPath}/`;

    responses += createCollectionXml(currentPath);

    if (depth !== '0') {
        for (const dir of contents.directories) {
            const dirPath = dir.startsWith('dav/') ? `/${dir}/` : `/dav/${dir}/`;
            responses += createCollectionXml(dirPath);
        }
        for (const file of contents.files) {
            responses += createFileXml(file);
        }
    }
    return `<?xml version="1.0" encoding="utf-8"?><D:multistatus xmlns:D="DAV:">${responses}</D:multistatus>`;
}

function createCollectionXml(path) {
    const now = new Date();
    const creationDate = now.toISOString();
    const lastModified = now.toUTCString();
    const pathWithSlash = path.endsWith('/') ? path : `${path}/`;
    const cleanPath = path.endsWith('/') ? path.slice(0, -1) : path;
    const name = cleanPath.split('/').pop() || '';
    return `<D:response><D:href>${encodeURI(pathWithSlash)}</D:href><D:propstat><D:prop><D:displayname>${name}</D:displayname><D:resourcetype><D:collection/></D:resourcetype><D:creationdate>${creationDate}</D:creationdate><D:getlastmodified>${lastModified}</D:getlastmodified></D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat></D:response>`;
}

function createFileXml(file) {
    let fileSize = "0";
    if (file.metadata) {
        if (file.metadata['FileSizeBytes']) {
            fileSize = String(file.metadata['FileSizeBytes']);
        } else if (file.metadata['FileSize']) {
            fileSize = String(Math.round(parseFloat(file.metadata['FileSize']) * 1024 * 1024));
        }
    }
    const fileTime = file.metadata && file.metadata['TimeStamp']
        ? new Date(Number(file.metadata['TimeStamp']))
        : new Date();
    const creationDate = fileTime.toISOString();
    const lastModified = fileTime.toUTCString();
    const contentType = file.metadata && file.metadata['FileType'] ? file.metadata['FileType'] : "application/octet-stream";
    return `<D:response><D:href>${encodeURI(`/dav/${file.name}`)}</D:href><D:propstat><D:prop><D:displayname>${file.name.split('/').pop()}</D:displayname><D:resourcetype/><D:creationdate>${creationDate}</D:creationdate><D:getlastmodified>${lastModified}</D:getlastmodified><D:getcontentlength>${fileSize}</D:getcontentlength><D:getcontenttype>${contentType}</D:getcontenttype></D:prop><D:status>HTTP/1.1 200 OK</D:status></D:propstat></D:response>`;
}
