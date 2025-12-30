/**
 * Hugging Face Hub API 封装类
 * 使用官方 @huggingface/hub SDK 上传文件
 * 
 * 注意：HuggingFace 现在强制要求二进制文件通过 LFS/Xet 协议上传
 * SDK 会自动处理这个复杂流程
 */

export class HuggingFaceAPI {
    constructor(token, repo, isPrivate = false) {
        this.token = token;
        this.repo = repo;  // 格式: username/repo-name
        this.isPrivate = isPrivate;
        this.baseURL = 'https://huggingface.co';
        this.hub = null;
    }

    /**
     * 动态加载 HuggingFace Hub SDK
     */
    async loadSDK() {
        if (!this.hub) {
            try {
                // 使用 esm.sh 导入官方 SDK
                this.hub = await import('https://esm.sh/@huggingface/hub@0.23.0');
                console.log('HuggingFace Hub SDK loaded successfully');
            } catch (error) {
                console.error('Failed to load HuggingFace Hub SDK:', error.message);
                throw new Error('Failed to load HuggingFace Hub SDK: ' + error.message);
            }
        }
        return this.hub;
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
     * 使用官方 @huggingface/hub SDK
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

            // 加载 SDK
            const hub = await this.loadSDK();

            // 使用官方 SDK 上传文件
            // SDK 会自动处理 LFS 协议
            console.log('Calling uploadFiles...');
            const result = await hub.uploadFiles({
                repo: { type: 'dataset', name: this.repo },
                accessToken: this.token,
                files: [{
                    path: filePath,
                    content: file
                }],
                commitTitle: commitMessage,
                // 禁用 Xet 协议，使用标准 LFS（Cloudflare Workers 兼容性更好）
                useXet: false,
                // 禁用 Web Workers（Cloudflare Workers 不支持）
                useWebWorkers: false
            });

            console.log('Upload result:', JSON.stringify(result));

            // 构建文件 URL
            const fileUrl = `${this.baseURL}/datasets/${this.repo}/resolve/main/${filePath}`;

            return {
                success: true,
                commitId: result?.commit?.oid || 'uploaded',
                filePath: filePath,
                fileUrl: fileUrl,
                fileSize: file.size
            };
        } catch (error) {
            console.error('HuggingFace upload error:', error.message);
            console.error('Error stack:', error.stack);
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
            const hub = await this.loadSDK();
            
            await hub.deleteFile({
                repo: { type: 'dataset', name: this.repo },
                accessToken: this.token,
                path: filePath,
                commitTitle: commitMessage
            });

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
