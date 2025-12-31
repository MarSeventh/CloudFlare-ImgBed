/**
 * Discord API 封装类
 * 用于上传文件到 Discord 频道并获取文件
 */
export class DiscordAPI {
    constructor(botToken) {
        this.botToken = botToken;
        this.baseURL = 'https://discord.com/api/v10';
        this.defaultHeaders = {
            'Authorization': `Bot ${this.botToken}`,
            'User-Agent': 'DiscordBot (CloudFlare-ImgBed, 1.0)'
        };
    }

    /**
     * 发送文件到 Discord 频道
     * @param {File|Blob} file - 要发送的文件
     * @param {string} channelId - 频道 ID
     * @param {string} fileName - 文件名
     * @returns {Promise<Object>} API 响应结果
     */
    async sendFile(file, channelId, fileName = '') {
        const formData = new FormData();
        
        // Discord 使用 files[0] 作为文件字段名
        if (fileName) {
            formData.append('files[0]', file, fileName);
        } else {
            formData.append('files[0]', file);
        }

        const response = await fetch(`${this.baseURL}/channels/${channelId}/messages`, {
            method: 'POST',
            headers: this.defaultHeaders,
            body: formData
        });

        console.log('Discord API response:', response.status, response.statusText);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Discord API error: ${response.status} - ${errorData.message || response.statusText}`);
        }

        const responseData = await response.json();
        return responseData;
    }

    /**
     * 从响应中提取文件信息
     * @param {Object} responseData - Discord API 响应数据
     * @returns {Object|null} 文件信息对象或 null
     */
    getFileInfo(responseData) {
        try {
            if (!responseData || !responseData.id) {
                console.error('Invalid Discord response:', responseData);
                return null;
            }

            // Discord 消息中的附件在 attachments 数组中
            if (responseData.attachments && responseData.attachments.length > 0) {
                const attachment = responseData.attachments[0];
                return {
                    message_id: responseData.id,
                    attachment_id: attachment.id,
                    file_name: attachment.filename,
                    file_size: attachment.size,
                    content_type: attachment.content_type,
                    url: attachment.url,
                    proxy_url: attachment.proxy_url
                };
            }

            return null;
        } catch (error) {
            console.error('Error parsing Discord response:', error.message);
            return null;
        }
    }

    /**
     * 获取消息信息（用于获取文件 URL）
     * @param {string} channelId - 频道 ID
     * @param {string} messageId - 消息 ID
     * @returns {Promise<Object|null>} 消息数据或 null
     */
    async getMessage(channelId, messageId) {
        try {
            const response = await fetch(`${this.baseURL}/channels/${channelId}/messages/${messageId}`, {
                method: 'GET',
                headers: this.defaultHeaders
            });

            if (!response.ok) {
                console.error('Discord getMessage error:', response.status, response.statusText);
                return null;
            }

            const messageData = await response.json();
            return messageData;
        } catch (error) {
            console.error('Error getting Discord message:', error.message);
            return null;
        }
    }

    /**
     * 获取文件 URL
     * @param {string} channelId - 频道 ID
     * @param {string} messageId - 消息 ID
     * @returns {Promise<string|null>} 文件 URL 或 null
     */
    async getFileURL(channelId, messageId) {
        const message = await this.getMessage(channelId, messageId);
        
        if (message && message.attachments && message.attachments.length > 0) {
            return message.attachments[0].url;
        }

        return null;
    }

    /**
     * 获取文件内容
     * @param {string} channelId - 频道 ID
     * @param {string} messageId - 消息 ID
     * @returns {Promise<Response>} 文件响应
     */
    async getFileContent(channelId, messageId) {
        const fileURL = await this.getFileURL(channelId, messageId);
        
        if (!fileURL) {
            throw new Error(`File URL not found for messageId: ${messageId}`);
        }

        const response = await fetch(fileURL);
        return response;
    }

    /**
     * 删除消息（用于删除文件）
     * @param {string} channelId - 频道 ID
     * @param {string} messageId - 消息 ID
     * @returns {Promise<boolean>} 是否删除成功
     */
    async deleteMessage(channelId, messageId) {
        try {
            const response = await fetch(`${this.baseURL}/channels/${channelId}/messages/${messageId}`, {
                method: 'DELETE',
                headers: this.defaultHeaders
            });

            // Discord 删除成功返回 204 No Content
            if (response.status === 204 || response.ok) {
                return true;
            }

            console.error('Discord deleteMessage error:', response.status, response.statusText);
            return false;
        } catch (error) {
            console.error('Error deleting Discord message:', error.message);
            return false;
        }
    }
}
