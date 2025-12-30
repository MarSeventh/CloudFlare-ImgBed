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
            const response = await fetch(`${this.baseURL}/api/datasets/${this.repo}`, {
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

            const response = await fetch(`${this.baseURL}/api/repos/create`, {
                method: 'POST',
                headers: {
                    ...this.defaultHeaders,
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
                    return true; // 仓库已存在
                }
                const errorText = await response.text();
                throw new Error(`Failed to create repo: ${response.status} - ${errorText}`);
            }

            return true;
        } catch (error) {
            console.error('Error creating repo:', error.message);
            return false;
        }
    }

    /**
     * 上传文件到仓库（使用 multipart form upload）
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

            // 使用 multipart form 上传 API
            // POST https://huggingface.co/api/datasets/{repo_id}/upload/main/{path_in_repo}
            const uploadUrl = `${this.baseURL}/api/datasets/${this.repo}/upload/main/${filePath}`;
            
            console.log('Upload URL:', uploadUrl);
            console.log('File path:', filePath);
            console.log('File size:', file.size);

            // 创建 FormData，使用 multipart/form-data 上传
            const formData = new FormData();
            formData.append('file', file, filePath.split('/').pop());

            const response = await fetch(uploadUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`
                    // 不设置 Content-Type，让浏览器自动设置 multipart/form-data boundary
                },
                body: formData
            });

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
                commitId: result.commitOid || result.commitId || result.oid,
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
            const commitUrl = `${this.baseURL}/api/datasets/${this.repo}/commit/main`;
            
            const response = await fetch(commitUrl, {
                method: 'POST',
                headers: {
                    ...this.defaultHeaders,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    summary: commitMessage,
                    deletedFiles: [filePath]
                })
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
}
