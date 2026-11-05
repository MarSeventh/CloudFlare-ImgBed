<template>
    <el-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" :title="$t('tgSend.title')" width="min(680px, 94vw)" :close-on-click-modal="!sending" :close-on-press-escape="!sending" :show-close="!sending" @open="open">
        <el-alert :title="$t('tgSend.hint')" type="info" :closable="false" show-icon />
        <el-form label-position="top" class="send-form">
            <el-form-item :label="$t('tgSend.bot')">
                <el-select v-model="channel" :disabled="started || loading" style="width: 100%"><el-option v-for="bot in channels" :key="bot.name" :label="bot.name" :value="bot.name" /></el-select>
            </el-form-item>
            <el-form-item :label="$t('tgSend.recipient')">
                <el-select v-model="recipient" filterable allow-create default-first-option :disabled="started || loading" :placeholder="$t('tgSend.recipientPlaceholder')" style="width: 100%" @change="recipient = String(recipient).trim()">
                    <el-option v-for="id in recipients" :key="id" :label="id" :value="id" />
                </el-select>
            </el-form-item>
        </el-form>
        <p class="send-note">{{ $t('tgSend.fileHint', { count: queue.length, skipped: skipped }) }}</p>
        <el-alert v-if="error" :title="error" type="error" :closable="false" />
        <el-progress v-if="started" :percentage="progress" :status="sending ? undefined : (queue.some(item => ['failed','unknown'].includes(item.status)) ? 'warning' : 'success')" />
        <el-table :data="queue" max-height="280" size="small">
            <el-table-column prop="name" :label="$t('dashboard.fileName')" min-width="180" show-overflow-tooltip />
            <el-table-column :label="$t('tgSend.result')" min-width="200"><template #default="{ row }"><span :class="'result-' + row.status">{{ row.error ? $t('tgSend.errors.' + row.error, { seconds: row.retryAfter || 30 }) : $t('tgSend.status.' + row.status) }}</span></template></el-table-column>
        </el-table>
        <p v-if="started" class="send-note">{{ $t('tgSend.summary', { success: queue.filter(item => item.status === 'sent').length, total: queue.length }) }}</p>
        <template #footer>
            <el-button v-if="sending" @click="cancelRequested = true" :disabled="cancelRequested">{{ $t('tgSend.stop') }}</el-button>
            <el-button v-else @click="$emit('update:modelValue', false)">{{ $t('common.close') }}</el-button>
            <el-button v-if="!started" type="primary" :disabled="loading || !channel || !validRecipient || !queue.length" @click="send">{{ $t('tgSend.confirm', { count: queue.length, recipient: recipient || '…' }) }}</el-button>
        </template>
    </el-dialog>
</template>
<script>
import fetchWithAuth from '@/utils/fetchWithAuth';
const stopErrors = ['rate_limited','recipient_unavailable','bot_unavailable','delivery_unknown','unauthorized'];
export default {
    props: { modelValue: Boolean, files: { type: Array, default: () => [] } },
    emits: ['update:modelValue'],
    data: () => ({ channels: [], recipients: [], channel: '', recipient: '', queue: [], skipped: 0,
        loading: false, started: false, sending: false, cancelRequested: false, error: '' }),
    computed: {
        validRecipient() { return /^[1-9]\d{0,15}$/.test(this.recipient) && Number.isSafeInteger(Number(this.recipient)); },
        progress() { return this.queue.length ? Math.round(this.queue.filter(item => !['queued','sending'].includes(item.status)).length / this.queue.length * 100) : 0; }
    },
    methods: {
        async open() {
            this.started = false; this.sending = false; this.cancelRequested = false; this.error = '';
            this.queue = this.files.filter(file => !file.isFolder).map(file => ({ fileId: file.metadata?.FixedId || file.name,
                name: file.metadata?.FileName || file.name.split('/').pop(), status: 'queued', error: '' }));
            this.skipped = this.files.length - this.queue.length;
            this.loading = true;
            try {
                const response = await fetchWithAuth('/api/manage/telegramSend');
                if (!response.ok) throw Error('configuration');
                const data = await response.json(); this.channels = data.channels; this.recipients = data.recipients;
                if (!this.channels.some(bot => bot.name === this.channel)) this.channel = this.channels[0]?.name || '';
                if (!this.recipient && this.recipients.length === 1) this.recipient = this.recipients[0];
                if (!this.channels.length) this.error = this.$t('tgSend.errors.bot_not_configured');
            } catch { this.error = this.$t('tgSend.loadFailed'); }
            finally { this.loading = false; }
        },
        async send() {
            if (this.started || this.sending || !this.validRecipient || !this.channel) return;
            this.started = true; this.sending = true;
            try {
                for (const item of this.queue) {
                    if (this.cancelRequested) { item.status = 'cancelled'; continue; }
                    item.status = 'sending';
                    try {
                        const response = await fetchWithAuth('/api/manage/telegramSend', { method: 'POST',
                            headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileId: item.fileId, channel: this.channel, recipient: this.recipient }) });
                        const result = await response.json();
                        if (response.ok && result.success) item.status = 'sent';
                        else {
                            const code = result.error || 'delivery_unknown';
                            item.error = this.$te('tgSend.errors.' + code) ? code : 'delivery_unknown';
                            item.status = item.error === 'delivery_unknown' ? 'unknown' : 'failed';
                            item.retryAfter = result.retryAfter;
                            if (stopErrors.includes(code)) this.cancelRequested = true;
                        }
                    } catch { item.status = 'unknown'; item.error = 'delivery_unknown'; this.cancelRequested = true; }
                    // Stay below Telegram's per-chat message rate, with no automatic retries.
                    if (!this.cancelRequested && item !== this.queue[this.queue.length - 1]) await new Promise(resolve => setTimeout(resolve, 1100));
                }
            } finally { this.sending = false; }
        }
    }
};
</script>
<style scoped>
.send-form { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 16px; }
.send-note { color: var(--el-text-color-secondary); font-size: 12px; line-height: 1.6; }
.result-sent { color: var(--el-color-success); }
.result-failed, .result-unknown { color: var(--el-color-danger); }
@media (max-width: 600px) { .send-form { grid-template-columns: 1fr; gap: 0; } }
</style>
