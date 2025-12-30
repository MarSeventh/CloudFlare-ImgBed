/**
 * Hugging Face Hub API 封装类
 * 用于上传文件到 Hugging Face 仓库并获取文件
 */
export class HuggingFaceAPI {
    constructor(token, repo, isPrivate = false) {
        this.token = token;
        this.repo = repo;  // 格式: username/repo-name
        this.isPrivate = isPrivate;
        this.baseURL = 'https://huggingface.co';
        this.apiURL = 'https://huggingface.co/api';
        this.defaultHeaders = {
            'Authorization': `Bearer ${this.token}`,
        };
    }

    /**
     * 检查仓库是否存在
     * @returns {Promise<boolean>}
     */
    async repoExists() {
        try {
            const response = await fetch(`${this.apiURL}/datasets/${this.repo}`, {
                method: 'GET',
                headers: this.defaultHeaders
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
                return true;
            }

            const response = await fetch(`${this.apiURL}/repos/create`, {
                method: 'POST',
                headers: {
                    ...this.defaultHeaders,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: this.repo.split('/')[1],  // 仓库名（不含用户名）
                    type: 'dataset',
                    private: this.isPrivate
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`Failed to create repo: ${response.status} - ${errorData.error || response.statusText}`);
            }

            console.log(`Created HuggingFace repo: ${this.repo}`);
            return true;
        } catch (error) {
            console.error('Error creating repo:', error.message);
            return false;
        }
    }

    /**
     * 上传文件到仓库
     * @param {File|Blob} file - 要上传的文件
     * @param {string} filePath - 存储路径（如 images/xxx.jpg）
     * @param {string} commitMessage - 提交信息
     * @returns {Promise<Object>} 上传结果
     */
    async uploadFile(file, filePath, commitMessage = 'Upload file') {
        try {
            // 确保仓库存在
            await this.createRepoIfNotExists();

            // 将文件转换为 base64
            const arrayBuffer = await file.arrayBuffer();
            const base64Content = this.arrayBufferToBase64(arrayBuffer);

            // 使用 commit API 上传文件
            const response = await fetch(`${this.apiURL}/datasets/${this.repo}/commit/main`, {
                method: 'POST',
                headers: {
                    ...this.defaultHeaders,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    summary: commitMessage,
                    operations: [{
                        op: 'addOrUpdate',
                        path: filePath,
                        content: base64Content,
                        encoding: 'base64'
                    }]
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`HuggingFace upload error: ${response.status} - ${errorData.error || response.statusText}`);
            }

            const result = await response.json();
            
            // 构建文件 URL
            const fileUrl = `${this.baseURL}/datasets/${this.repo}/resolve/main/${filePath}`;

            return {
                success: true,
                commitId: result.commitId || result.oid,
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
     * 删除文件
     * @param {string} filePath - 文件路径
     * @param {string} commitMessage - 提交信息
     * @returns {Promise<boolean>}
     */
    async deleteFile(filePath, commitMessage = 'Delete file') {
        try {
            const response = await fetch(`${this.apiURL}/datasets/${this.repo}/commit/main`, {
                method: 'POST',
                headers: {
                    ...this.defaultHeaders,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    summary: commitMessage,
                    operations: [{
                        op: 'delete',
                        path: filePath
                    }]
                })
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error('HuggingFace delete error:', response.status, errorData);
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
            headers: this.isPrivate ? this.defaultHeaders : {}
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

    /**
     * 检查文件是否存在
     * @param {string} filePath - 文件路径
     * @returns {Promise<boolean>}
     */
    async fileExists(filePath) {
        try {
            const fileUrl = this.getFileURL(filePath);
            const response = await fetch(fileUrl, {
                method: 'HEAD',
                headers: this.isPrivate ? this.defaultHeaders : {}
            });
            return response.ok;
        } catch (error) {
            return false;
        }
    }

    /**
     * ArrayBuffer 转 Base64
     * @param {ArrayBuffer} buffer
     * @returns {string}
     */
    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }
}
