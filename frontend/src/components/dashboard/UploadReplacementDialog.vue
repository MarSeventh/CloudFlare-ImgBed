<template>
    <el-dialog :model-value="modelValue" :title="$t('replaceFile.localTitle')" width="min(540px, 94vw)" align-center
        :close-on-click-modal="!saving" :close-on-press-escape="!saving" :show-close="!saving" @update:model-value="close">
        <p class="target-path">{{ snapshot?.path || target?.name }}</p>
        <p>{{ $t('replaceFile.localHint') }}</p>
        <input ref="fileInput" type="file" :accept="(snapshot?.type || target?.metadata?.FileType)?.split(';')[0]" :disabled="saving"
            :aria-label="$t('replaceFile.chooseLocal')" @change="selectFile" />
        <p v-if="file" class="target-path">{{ file.name }} ({{ file.size }} bytes)</p>
        <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
        <template #footer>
            <el-button :disabled="saving" @click="close(false)">{{ $t('replaceFile.cancel') }}</el-button>
            <el-button v-if="!snapshot" :loading="preparing" :disabled="saving || preparing" @click="initialize">{{ $t('replaceFile.refreshTarget') }}</el-button>
            <el-button type="primary" :loading="saving || preparing" :disabled="!file || !snapshot || saving || preparing" @click="submit">{{ $t('replaceFile.confirm') }}</el-button>
        </template>
    </el-dialog>
</template>

<script>
import fetchWithAuth from '@/utils/fetchWithAuth';

export default {
    name: 'UploadReplacementDialog',
    props: { modelValue: Boolean, target: Object },
    emits: ['update:modelValue', 'replaced'],
    data() { return { file: null, saving: false, preparing: false, error: '', snapshot: null, identityId: '', generation: 0 }; },
    watch: {
        modelValue(open) {
            this.generation++;
            if (!open) return;
            this.file = null; this.error = ''; this.snapshot = null; this.identityId = this.target?.metadata?.FixedId || '';
            const pending = this.initialize();
            this.$nextTick(() => {
                if (this.$refs.fileInput) { this.$refs.fileInput.value = ''; this.$refs.fileInput.click(); }
            });
            return pending;
        }
    },
    methods: {
        async initialize() {
            const generation = ++this.generation;
            this.preparing = true; this.snapshot = null; this.error = '';
            try {
                let id = this.identityId || this.target?.metadata?.FixedId;
                if (!id) {
                    const response = await fetchWithAuth('/api/manage/identity/' + encodeURIComponent(this.target.name), { method: 'POST' });
                    const result = await response.json().catch(() => ({}));
                    if (!response.ok) throw new Error(result.message || this.$t('replaceFile.failed'));
                    id = result.fixedId;
                }
                if (generation !== this.generation) return;
                this.identityId = id;
                const snapshot = await this.readSnapshot(id);
                if (generation !== this.generation) return;
                this.snapshot = snapshot;
                if (snapshot.path !== this.target.name || snapshot.contentVersion !== (this.target.metadata?.ContentVersion || '') ||
                    snapshot.type !== this.target.metadata?.FileType) this.error = this.$t('replaceFile.targetRefreshed');
            } catch (error) {
                if (generation === this.generation) this.error = error.message || this.$t('replaceFile.failed');
            } finally { if (generation === this.generation) this.preparing = false; }
        },
        async readSnapshot(id) {
            if (!/^f_[a-f0-9]{32}$/.test(id || '')) throw new Error(this.$t('replaceFile.failed'));
            const response = await fetchWithAuth('/api/manage/replace-file/' + encodeURIComponent(id));
            const result = await response.json().catch(() => ({}));
            if (!response.ok || result.id !== id || typeof result.path !== 'string' ||
                typeof result.contentVersion !== 'string' || typeof result.type !== 'string') {
                throw new Error(result.message || this.$t('replaceFile.failed'));
            }
            return result;
        },
        close(value) { if (!this.saving) this.$emit('update:modelValue', value); },
        selectFile(event) {
            if (this.saving) return;
            this.file = event.target.files?.[0] || null;
        },
        async submit() {
            if (this.saving || this.preparing || !this.file || !this.snapshot?.id) return;
            this.error = '';
            const mime = value => value?.split(';')[0].trim().toLowerCase();
            if (!mime(this.file.type) || mime(this.file.type) !== mime(this.snapshot.type)) {
                this.error = this.$t('replaceFile.localTypeError'); return;
            }
            if (this.file.size > 20 * 1024 * 1024) { this.error = this.$t('replaceFile.localSizeError'); return; }
            this.saving = true;
            try {
                const body = new FormData();
                body.append('file', this.file);
                body.append('expectedPath', this.snapshot.path);
                body.append('expectedVersion', this.snapshot.contentVersion);
                const response = await fetchWithAuth('/api/manage/replace-file/' + encodeURIComponent(this.snapshot.id), { method: 'POST', body });
                const result = await response.json();
                if (!response.ok || !result.success) {
                    if (response.status === 409) {
                        const id = this.snapshot.id;
                        this.snapshot = null;
                        // Refresh only; a second explicit confirmation is required.
                        const current = await this.readSnapshot(id);
                        this.snapshot = current;
                        throw new Error((result.message || this.$t('replaceFile.failed')) + '；' + this.$t('replaceFile.targetRefreshed'));
                    }
                    if (result.outcome === 'unknown') { this.file = null; this.snapshot = null; }
                    throw new Error([result.message || this.$t('replaceFile.failed'), ...(result.warnings || [])].join('；'));
                }
                this.$emit('replaced', result);
                this.$emit('update:modelValue', false);
            } catch (error) { this.error = error.message || this.$t('replaceFile.failed'); }
            finally { this.saving = false; }
        }
    }
};
</script>

<style scoped>
.target-path { overflow-wrap: anywhere; }
input { max-width: 100%; margin: 8px 0 16px; }
</style>
