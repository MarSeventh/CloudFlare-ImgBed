/**
 * Hugging Face Hub API 封装类
 * 手动实现 LFS 上传协议（Cloudflare Workers 兼容）
 * 
 * HuggingFace 要求二进制文件通过 LFS 协议上传
 * 流程：preupload -> LFS batch -> upload to LFS storage -> commit
 * 
 * 优化方案：
 * 1. 小文件（<20MB）：前端 → CF Workers → HuggingFace S3
 * 2. 大文件（>=20MB）：前端直接上传到 HuggingFace S3，CF Workers 只负责获取签名 URL 和提交
 * 
 * SHA256 由前端预计算传入，避免后端 CPU 超时
 */

const HF_PROXY_RANGE_CHUNK_SIZE = 4 * 1024 * 1024;
const HF_UPSTREAM_RANGE_CHUNK_SIZE = 4 * 1024 * 1024;

export class HuggingFaceAPI {
    constructor(token, repo, isPrivate = false) {
        this.token = token;
        this.repo = repo;  // 格式: username/repo-name
        this.isPrivate = isPrivate;
        this.baseURL = 'https://huggingface.co';
    }

    /**
     * 计算文件的 SHA256 哈希（仅在未提供预计算哈希时使用）
     * @param {Blob} blob 
     * @returns {Promise<string>} hex string
     */
    async sha256(blob) {
        const buffer = await blob.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    /**
     * 检查仓库是否存在
     */
    async repoExists() {
        try {
            const response = await fetch(`${this.baseURL}/api/datasets/${this.repo}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            return response.ok;
        } catch (error) {
            console.error('Error checking repo:', error.message);
            return false;
        }
    }

    /**
     * 创建仓库（如果不存在）
     */
    async createRepoIfNotExists() {
        try {
            if (await this.repoExists()) {
                console.log('Repository exists:', this.repo);
                return true;
            }

            console.log('Creating repository:', this.repo);
            const response = await fetch(`${this.baseURL}/api/repos/create`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: this.repo.split('/')[1],
                    type: 'dataset',
                    private: this.isPrivate
                })
            });

            if (response.ok || response.status === 409) {
                console.log('Repository ready');
                return true;
            }
            
            const errorText = await response.text();
            throw new Error(`Failed to create repo: ${response.status} - ${errorText}`);
        } catch (error) {
            console.error('Error creating repo:', error.message);
            return false;
        }
    }

    /**
     * 步骤1: Preupload - 检查文件是否需要 LFS
     */
    async preupload(filePath, fileSize, fileSample) {
        const url = `${this.baseURL}/api/datasets/${this.repo}/preupload/main`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                files: [{
                    path: filePath,
                    size: fileSize,
                    sample: fileSample
                }]
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Preupload failed: ${response.status} - ${error}`);
        }

        return await response.json();
    }

    /**
     * 步骤2: LFS Batch - 获取上传 URL
     */
    async lfsBatch(oid, fileSize) {
        const url = `${this.baseURL}/datasets/${this.repo}.git/info/lfs/objects/batch`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Accept': 'application/vnd.git-lfs+json',
                'Content-Type': 'application/vnd.git-lfs+json'
            },
            body: JSON.stringify({
                operation: 'upload',
                transfers: ['basic', 'multipart'],
                hash_algo: 'sha_256',
                ref: { name: 'main' },
                objects: [{ oid, size: fileSize }]
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`LFS batch failed: ${response.status} - ${error}`);
        }

        return await response.json();
    }

    /**
     * 步骤3: 上传文件到 LFS 存储
     * @param {object} uploadAction - 上传动作信息
     * @param {File|Blob} file - 文件
     * @param {string} oid - 文件的 SHA256 哈希
     */
    async uploadToLFS(uploadAction, file, oid) {
        const { href, header } = uploadAction;

        // 检查是否是分片上传
        if (header?.chunk_size) {
            return await this.uploadMultipart(uploadAction, file, oid);
        }

        // 基本上传
        console.log('Uploading to LFS (basic):', href);
        const response = await fetch(href, {
            method: 'PUT',
            headers: header || {},
            body: file
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`LFS upload failed: ${response.status} - ${error}`);
        }

        return true;
    }

    /**
     * 分片上传（大文件）
     * @param {object} uploadAction - 上传动作信息
     * @param {File|Blob} file - 文件
     * @param {string} oid - 文件的 SHA256 哈希
     */
    async uploadMultipart(uploadAction, file, oid) {
        const { href: completionUrl, header } = uploadAction;
        const chunkSize = parseInt(header.chunk_size);
        
        // 获取所有分片的上传 URL
        const parts = Object.keys(header).filter(key => /^[0-9]+$/.test(key));
        console.log(`Multipart upload: ${parts.length} parts, chunk size: ${chunkSize}`);

        const completeParts = [];

        for (const part of parts) {
            const index = parseInt(part) - 1;
            const start = index * chunkSize;
            const end = Math.min(start + chunkSize, file.size);
            const chunk = file.slice(start, end);
            
            console.log(`Uploading part ${part}/${parts.length}`);
            const response = await fetch(header[part], {
                method: 'PUT',
                body: chunk
            });

            if (!response.ok) {
                throw new Error(`Failed to upload part ${part}: ${response.status}`);
            }

            const etag = response.headers.get('ETag');
            if (!etag) {
                throw new Error(`No ETag for part ${part}`);
            }

            completeParts.push({ partNumber: parseInt(part), etag });
        }

        // 完成分片上传
        console.log('Completing multipart upload...');
        const completeResponse = await fetch(completionUrl, {
            method: 'POST',
            headers: {
                'Accept': 'application/vnd.git-lfs+json',
                'Content-Type': 'application/vnd.git-lfs+json'
            },
            body: JSON.stringify({
                oid: oid,
                parts: completeParts
            })
        });

        if (!completeResponse.ok) {
            const error = await completeResponse.text();
            throw new Error(`Multipart complete failed: ${completeResponse.status} - ${error}`);
        }

        return true;
    }

    /**
     * 步骤4: 提交 LFS 文件引用
     */
    async commitLfsFile(filePath, oid, fileSize, commitMessage) {
        const url = `${this.baseURL}/api/datasets/${this.repo}/commit/main`;
        
        // NDJSON 格式
        const body = [
            JSON.stringify({
                key: 'header',
                value: { summary: commitMessage }
            }),
            JSON.stringify({
                key: 'lfsFile',
                value: {
                    path: filePath,
                    algo: 'sha256',
                    size: fileSize,
                    oid: oid
                }
            })
        ].join('\n');

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/x-ndjson'
            },
            body
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Commit failed: ${response.status} - ${error}`);
        }

        return await response.json();
    }

    /**
     * 获取 LFS 上传信息（用于前端直传大文件）
     * 返回上传 URL 和必要的信息，让前端直接上传到 S3
     * @param {number} fileSize - 文件大小
     * @param {string} filePath - 存储路径
     * @param {string} sha256 - 文件的 SHA256 哈希
     * @param {string} fileSample - 文件前512字节的 base64
     */
    async getLfsUploadInfo(fileSize, filePath, sha256, fileSample) {
        // 确保仓库存在
        if (!await this.createRepoIfNotExists()) {
            throw new Error('Failed to create or access repository');
        }

        // 1. Preupload 检查
        console.log('Preupload check for direct upload...');
        const preuploadResult = await this.preupload(filePath, fileSize, fileSample);
        console.log('Preupload result:', JSON.stringify(preuploadResult));

        const fileInfo = preuploadResult.files?.[0];
        const needsLfs = fileInfo?.uploadMode === 'lfs';

        if (!needsLfs) {
            // 小文件不需要 LFS，返回 null 让后端处理
            return { needsLfs: false };
        }

        // 2. LFS Batch - 获取上传 URL
        console.log('LFS batch request for direct upload...');
        const batchResult = await this.lfsBatch(sha256, fileSize);
        console.log('LFS batch result:', JSON.stringify(batchResult));

        const obj = batchResult.objects?.[0];
        if (obj?.error) {
            throw new Error(`LFS error: ${obj.error.message}`);
        }

        // 检查文件是否已存在
        if (!obj?.actions?.upload) {
            return {
                needsLfs: true,
                alreadyExists: true,
                oid: sha256,
                filePath
            };
        }

        // 返回上传信息
        return {
            needsLfs: true,
            alreadyExists: false,
            oid: sha256,
            filePath,
            uploadAction: obj.actions.upload
        };
    }

    /**
     * 上传文件（完整流程）- 用于小文件或后端代理上传
     * @param {File|Blob} file - 要上传的文件
     * @param {string} filePath - 存储路径
     * @param {string} commitMessage - 提交信息
     * @param {string} precomputedSha256 - 前端预计算的 SHA256（可选，传入可避免后端计算）
     */
    async uploadFile(file, filePath, commitMessage = 'Upload file', precomputedSha256 = null) {
        try {
            // 确保仓库存在
            if (!await this.createRepoIfNotExists()) {
                throw new Error('Failed to create or access repository');
            }

            console.log('=== HuggingFace LFS Upload ===');
            console.log('Repo:', this.repo);
            console.log('Path:', filePath);
            console.log('Size:', file.size);

            // 1. 使用预计算的 SHA256 或在后端计算
            let oid;
            if (precomputedSha256) {
                console.log('Using precomputed SHA256:', precomputedSha256);
                oid = precomputedSha256;
            } else {
                console.log('Computing SHA256 on server (may timeout for large files)...');
                oid = await this.sha256(file);
                console.log('SHA256:', oid);
            }

            // 2. 获取文件样本（前512字节的base64）
            const sampleBytes = new Uint8Array(await file.slice(0, 512).arrayBuffer());
            const sample = btoa(String.fromCharCode(...sampleBytes));

            // 3. Preupload 检查
            console.log('Preupload check...');
            const preuploadResult = await this.preupload(filePath, file.size, sample);
            console.log('Preupload result:', JSON.stringify(preuploadResult));

            const fileInfo = preuploadResult.files?.[0];
            const needsLfs = fileInfo?.uploadMode === 'lfs';
            console.log('Needs LFS:', needsLfs);

            if (needsLfs) {
                // 4. LFS Batch - 获取上传 URL
                console.log('LFS batch request...');
                const batchResult = await this.lfsBatch(oid, file.size);
                console.log('LFS batch result:', JSON.stringify(batchResult));

                const obj = batchResult.objects?.[0];
                if (obj?.error) {
                    throw new Error(`LFS error: ${obj.error.message}`);
                }

                // 5. 上传到 LFS 存储（如果需要）
                if (obj?.actions?.upload) {
                    console.log('Uploading to LFS storage...');
                    await this.uploadToLFS(obj.actions.upload, file, oid);
                    console.log('LFS upload complete');
                } else {
                    console.log('File already exists in LFS');
                }

                // 6. 提交 LFS 文件引用
                console.log('Committing LFS file...');
                const commitResult = await this.commitLfsFile(filePath, oid, file.size, commitMessage);
                console.log('Commit result:', JSON.stringify(commitResult));
            } else {
                // 非 LFS 文件：直接 base64 提交（小文本文件）
                console.log('Direct commit (non-LFS)...');
                await this.commitDirectFile(filePath, file, commitMessage);
            }

            const fileUrl = `${this.baseURL}/datasets/${this.repo}/resolve/main/${filePath}`;
            return {
                success: true,
                filePath,
                fileUrl,
                fileSize: file.size,
                oid
            };

        } catch (error) {
            console.error('HuggingFace upload error:', error.message);
            throw error;
        }
    }

    /**
     * 直接提交文件（非 LFS，用于小文本文件）
     */
    async commitDirectFile(filePath, file, commitMessage) {
        const url = `${this.baseURL}/api/datasets/${this.repo}/commit/main`;
        
        const bytes = new Uint8Array(await file.arrayBuffer());
        // 分块转换，避免大文件导致 Maximum call stack size exceeded
        const chunkSize = 4096;
        const parts = [];
        for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
            let s = '';
            for (let j = 0; j < chunk.length; j++) {
                s += String.fromCharCode(chunk[j]);
            }
            parts.push(s);
        }
        const content = btoa(parts.join(''));
        
        const body = [
            JSON.stringify({
                key: 'header',
                value: { summary: commitMessage }
            }),
            JSON.stringify({
                key: 'file',
                value: {
                    path: filePath,
                    content: content,
                    encoding: 'base64'
                }
            })
        ].join('\n');

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/x-ndjson'
            },
            body
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Direct commit failed: ${response.status} - ${error}`);
        }

        return await response.json();
    }

    /**
     * 删除文件
     */
    async deleteFile(filePath, commitMessage = 'Delete file') {
        const url = `${this.baseURL}/api/datasets/${this.repo}/commit/main`;
        
        const body = [
            JSON.stringify({
                key: 'header',
                value: { summary: commitMessage }
            }),
            JSON.stringify({
                key: 'deletedFile',
                value: { path: filePath }
            })
        ].join('\n');

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/x-ndjson'
            },
            body
        });

        return response.ok;
    }

    /**
     * 获取文件内容（用于私有仓库代理）
     */
    async getFileContent(filePath) {
        return await this.fetchFile(filePath);
    }

    /**
     * 获取文件 URL
     */
    getFileURL(filePath) {
        return `${this.baseURL}/datasets/${this.repo}/resolve/main/${filePath}`;
    }

    getRequestHeaders(extraHeaders = {}) {
        const headers = new Headers(extraHeaders);

        if (this.isPrivate && this.token && !headers.has('Authorization')) {
            headers.set('Authorization', `Bearer ${this.token}`);
        }

        return headers;
    }

    async fetchFile(filePath, options = {}) {
        const fileUrl = options.fileUrl || this.getFileURL(filePath);
        return await fetch(fileUrl, {
            method: options.method || 'GET',
            headers: this.getRequestHeaders(options.headers || {}),
        });
    }

    async getRemoteFileSize(filePath, options = {}) {
        const metadataSize = getExactMetadataFileSize(options.metadata);
        if (metadataSize) {
            return metadataSize;
        }

        try {
            const headResponse = await this.fetchFile(filePath, {
                fileUrl: options.fileUrl,
                method: 'HEAD',
            });

            if (headResponse.ok) {
                const contentLength = Number(headResponse.headers.get('Content-Length'));
                if (Number.isFinite(contentLength) && contentLength > 0) {
                    return Math.floor(contentLength);
                }
            }
        } catch (error) {
            console.warn('HuggingFace HEAD size probe failed:', error.message);
        }

        try {
            const rangeResponse = await this.fetchFile(filePath, {
                fileUrl: options.fileUrl,
                headers: { Range: 'bytes=0-0' },
            });

            try {
                const contentRange = parseContentRange(rangeResponse.headers.get('Content-Range'));
                if (contentRange?.total) {
                    return contentRange.total;
                }

                if (rangeResponse.status === 200) {
                    const contentLength = Number(rangeResponse.headers.get('Content-Length'));
                    if (Number.isFinite(contentLength) && contentLength > 0) {
                        return Math.floor(contentLength);
                    }
                }
            } finally {
                if (rangeResponse.body) {
                    await rangeResponse.body.cancel().catch(() => {});
                }
            }
        } catch (error) {
            console.warn('HuggingFace range size probe failed:', error.message);
        }

        return getApproximateMetadataFileSize(options.metadata);
    }

    getProxyRange(rangeHeader, totalSize) {
        const range = parseRangeHeader(rangeHeader, totalSize);
        if (!range) {
            return null;
        }

        const rangeEnd = range.openEnded
            ? Math.min(range.start + HF_PROXY_RANGE_CHUNK_SIZE - 1, range.end)
            : range.end;

        return {
            start: range.start,
            end: rangeEnd,
            openEnded: range.openEnded,
        };
    }

    createRangeStream(filePath, rangeStart, rangeEnd, options = {}) {
        const fileUrl = options.fileUrl || this.getFileURL(filePath);
        let cancelled = false;
        let activeAbortController = null;

        return new ReadableStream({
            start: async (controller) => {
                let nextStart = rangeStart;

                try {
                    while (!cancelled && nextStart <= rangeEnd) {
                        const upstreamEnd = Math.min(nextStart + HF_UPSTREAM_RANGE_CHUNK_SIZE - 1, rangeEnd);
                        const abortController = new AbortController();
                        activeAbortController = abortController;

                        const response = await fetch(fileUrl, {
                            method: 'GET',
                            headers: this.getRequestHeaders({
                                Range: `bytes=${nextStart}-${upstreamEnd}`,
                            }),
                            signal: abortController.signal,
                        });

                        if (cancelled) {
                            abortController.abort();
                            break;
                        }

                        if (!response.ok && response.status !== 206) {
                            throw new Error(`HuggingFace range fetch failed: ${response.status}`);
                        }

                        const contentRange = parseContentRange(response.headers.get('Content-Range'));
                        let readableBytes = upstreamEnd - nextStart + 1;

                        if (contentRange) {
                            if (contentRange.start !== nextStart || contentRange.end < nextStart) {
                                throw new Error(`Unexpected HuggingFace Content-Range: ${response.headers.get('Content-Range')}`);
                            }
                            readableBytes = Math.min(contentRange.end - contentRange.start + 1, rangeEnd - nextStart + 1);
                        } else if (response.status === 200 && nextStart !== 0) {
                            throw new Error('HuggingFace did not honor range request');
                        } else {
                            const contentLength = Number(response.headers.get('Content-Length'));
                            if (Number.isFinite(contentLength) && contentLength > 0) {
                                readableBytes = Math.min(contentLength, rangeEnd - nextStart + 1);
                            }
                        }

                        const sent = await enqueueResponseBody(controller, response.body, readableBytes);
                        activeAbortController = null;

                        if (sent <= 0) {
                            throw new Error('Empty HuggingFace range response');
                        }

                        nextStart += sent;
                    }

                    if (!cancelled) {
                        controller.close();
                    }
                } catch (error) {
                    if (!cancelled) {
                        controller.error(error);
                    }
                }
            },
            cancel: () => {
                cancelled = true;
                if (activeAbortController) {
                    activeAbortController.abort();
                }
            },
        });
    }
}

function parseContentRange(contentRange) {
    if (!contentRange) {
        return null;
    }

    const match = contentRange.match(/^bytes\s+(\d+)-(\d+)\/(\d+|\*)$/i);
    if (!match) {
        return null;
    }

    return {
        start: parseInt(match[1], 10),
        end: parseInt(match[2], 10),
        total: match[3] === '*' ? null : parseInt(match[3], 10),
    };
}

function parseRangeHeader(rangeHeader, totalSize) {
    if (!rangeHeader || !totalSize) {
        return null;
    }

    const match = String(rangeHeader).trim().match(/^bytes=(\d*)-(\d*)$/i);
    if (!match || (match[1] === '' && match[2] === '')) {
        return null;
    }

    let start;
    let end;
    let openEnded = false;

    if (match[1] === '') {
        const suffixLength = parseInt(match[2], 10);
        if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
            return null;
        }
        start = Math.max(totalSize - suffixLength, 0);
        end = totalSize - 1;
    } else {
        start = parseInt(match[1], 10);
        openEnded = match[2] === '';
        end = openEnded ? totalSize - 1 : parseInt(match[2], 10);
    }

    if (!Number.isFinite(start) || !Number.isFinite(end) || start >= totalSize || start > end) {
        return null;
    }

    return {
        start,
        end: Math.min(end, totalSize - 1),
        openEnded,
    };
}

function getExactMetadataFileSize(metadata = {}) {
    const fileSizeBytes = Number(metadata?.FileSizeBytes);
    if (Number.isFinite(fileSizeBytes) && fileSizeBytes > 0) {
        return Math.floor(fileSizeBytes);
    }

    return null;
}

function getApproximateMetadataFileSize(metadata = {}) {
    const fileSizeMB = Number(metadata?.FileSize);
    if (Number.isFinite(fileSizeMB) && fileSizeMB > 0) {
        return Math.floor(fileSizeMB * 1024 * 1024);
    }

    return null;
}

async function enqueueResponseBody(controller, body, maxBytes) {
    if (!body || maxBytes <= 0) {
        return 0;
    }

    const reader = body.getReader();
    let remaining = maxBytes;
    let sent = 0;

    try {
        while (remaining > 0) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }

            const chunk = value.byteLength > remaining ? value.slice(0, remaining) : value;
            controller.enqueue(chunk);

            sent += chunk.byteLength;
            remaining -= chunk.byteLength;

            if (chunk.byteLength < value.byteLength) {
                await reader.cancel();
                break;
            }
        }
    } finally {
        reader.releaseLock();
    }

    return sent;
}
