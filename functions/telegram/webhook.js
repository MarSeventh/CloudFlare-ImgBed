import { createTelegramWebhookHandler } from '../utils/telegramWebhook.js';
import { fetchUploadConfig, fetchSecurityConfig } from '../utils/sysConfig.js';
import { getDatabase } from '../utils/databaseAdapter.js';
import { addFileToIndex } from '../utils/indexManager.js';
import { moderateContent, sanitizeUploadFolder, purgeCDNCache } from '../upload/uploadTools.js';
import { TelegramAPI } from '../utils/storage/telegramAPI.js';

export const onRequest = createTelegramWebhookHandler({
    fetchUploadConfig, fetchSecurityConfig, getDatabase, addFileToIndex, moderateContent, sanitizeUploadFolder, purgeCDNCache,
    createAPI(channel) {
        const api = new TelegramAPI(channel.botToken, channel.proxyUrl || '');
        return {
            fileDomain: api.fileDomain,
            async call(method, body) {
                const response = await fetch(`${api.baseURL}/${method}`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body), signal: AbortSignal.timeout(15000)
                });
                const data = await response.json();
                if (!response.ok || !data.ok) throw new Error(`Telegram ${method} failed`);
                return data.result;
            }
        };
    }
});
