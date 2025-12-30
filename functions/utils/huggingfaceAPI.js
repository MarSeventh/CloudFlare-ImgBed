/**
 * Hugging Face Hub API 封装类
 * 用于上传文件到 Hugging Face Dataset 仓库并获取文件
 * 
 * 参考文档：
 * - https://huggingface.co/docs/huggingface_hub/guides/upload
 * - https://huggingface.co/docs/huggingface.js/hub/README
 * 
 * 注意：为了避免 Cloudflare Workers 的 CPU 限制，
 * 本实现直接上传原始文件，不做任何编码转换。
 */
export class HuggingFaceAPI {
    constructor(token, repo, isPrivate = false) {
        this.token = token;
        this.repo = repo;  // 格式: username/repo-name
        this.isPrivate = isPrivate;
        this.baseURL = 'https://huggingface.co';
    }

    /**
     * 检查仓库是否存在
     * @returns {Promise<boolean>}
     */
    async repoExists() {
        try {
            const response = await fetch(`${this.baseURL}/api/datasets/${this.repo}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });
            return response.ok;
        } catch (error) {
            console.error('Error checking repo existence:', error.message);
            return false;
        }
    }

    /**
     * 创建仓库（如果不存在）
     * @returns {Promise<boolean>}
     */
    async createRepoIfNotExists() {
        try {
            const exists = await this.repoExists();
            if (exists) {
                console.log('Repository already exists:', this.repo);
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

            if (!response.ok) {
                if (response.status === 409) {
                    console.log('Repository already exists (409)');
                    return true;
                }
                const errorText = await response.text();
                console.error('Failed to create repo:', response.status, errorText);
                throw new Error(`Failed to create repo: ${response.status} - ${errorText}`);
            }

            console.log('Repository created successfully');
            return true;
        } catch (error) {
            console.error('Error creating repo:', error.message);
            return false;
        }
    }

    /**
     * 上传文件到仓库
     * 使用 HuggingFace 的 commit API (NDJSON 格式)
     * 
     * @param {File|Blob} file - 要上传的文件
     * @param {string} filePath - 存储路径（如 images/xxx.jpg）
     * @param {string} commitMessage - 提交信息
     * @returns {Promise<Object>} 上传结果
     */
    async uploadFile(file, filePath, commitMessage = 'Upload file') {
        try {
            // 确保仓库存在
            const repoCreated = await this.createRepoIfNotExists();
            if (!repoCreated) {
                throw new Error('Failed to create or access repository');
            }

            console.log('=== HuggingFace Upload ===');
            console.log('Repo:', this.repo);
            console.log('File path:', filePath);
            console.log('File size:', file.size);
            console.log('File type:', file.type);

            // HuggingFace commit API 使用 NDJSON 格式
            // POST /api/datasets/{repo_id}/commit/{revision}
            // Content-Type: application/x-ndjson
            const commitUrl = `${this.baseURL}/api/datasets/${this.repo}/commit/main`;
            console.log('Commit URL:', commitUrl);

            // 读取文件内容并转为 base64
            const arrayBuffer = await file.arrayBuffer();
            const base64Content = this.arrayBufferToBase64(arrayBuffer);

            // 构建 NDJSON body
            // 第一行: header (包含 summary)
            // 第二行: file (包含文件内容)
            const header = JSON.stringify({
                key: 'header',
                value: {
                    summary: commitMessage,
                    description: ''
                }
            });

            const fileData = JSON.stringify({
                key: 'file',
                value: {
                    path: filePath,
                    content: base64Content,
                    encoding: 'base64'
                }
            });

            // NDJSON: 每行一个 JSON 对象，用换行符分隔
            const body = header + '\n' + fileData;

            const response = await fetch(commitUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/x-ndjson'
                },
                body: body
            });

            console.log('Upload response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('Upload failed:', response.status, errorText);
                throw new Error(`Upload failed: ${response.status} - ${errorText}`);
            }

            const result = await response.json().catch(() => ({}));
            console.log('Upload result:', JSON.stringify(result));

            // 构建文件 URL
            const fileUrl = `${this.baseURL}/datasets/${this.repo}/resolve/main/${filePath}`;

            return {
                success: true,
                commitId: result.commitOid || result.oid || 'uploaded',
                filePath: filePath,
                fileUrl: fileUrl,
                fileSize: file.size
            };
        } catch (error) {
            console.error('HuggingFace upload error:', error.message);
            throw error;
        }
    }

    /**
     * ArrayBuffer 转 Base64
     * 使用分块处理避免栈溢出
     */
    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        const chunkSize = 32768; // 32KB chunks
        for (let i = 0; i < bytes.length; i += chunkSize) {
            const chunk = bytes.slice(i, Math.min(i + chunkSize, bytes.length));
            binary += String.fromCharCode.apply(null, chunk);
        }
        return btoa(binary);
    }

    /**
     * 删除文件
     * @param {string} filePath - 文件路径
     * @param {string} commitMessage - 提交信息
     * @returns {Promise<boolean>}
     */
    async deleteFile(filePath, commitMessage = 'Delete file') {
        try {
            // 使用 DELETE 请求删除文件
            const deleteUrl = `${this.baseURL}/api/datasets/${this.repo}/delete/main/${filePath}`;
            
            const response = await fetch(deleteUrl, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('HuggingFace delete error:', response.status, errorText);
                return false;
            }

            return true;
        } catch (error) {
            console.error('Error deleting file from HuggingFace:', error.message);
            return false;
        }
    }

    /**
     * 获取文件内容（用于私有仓库）
     * @param {string} filePath - 文件路径
     * @returns {Promise<Response>}
     */
    async getFileContent(filePath) {
        const fileUrl = `${this.baseURL}/datasets/${this.repo}/resolve/main/${filePath}`;
        
        const response = await fetch(fileUrl, {
            headers: this.isPrivate ? { 'Authorization': `Bearer ${this.token}` } : {}
        });

        return response;
    }

    /**
     * 获取文件的公开访问 URL
     * @param {string} filePath - 文件路径
     * @returns {string}
     */
    getFileURL(filePath) {
        return `${this.baseURL}/datasets/${this.repo}/resolve/main/${filePath}`;
    }
}
