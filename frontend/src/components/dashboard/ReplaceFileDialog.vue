<template>
    <el-dialog :model-value="modelValue" :title="$t('replaceFile.title')" width="min(680px, 94vw)" align-center
        :close-on-click-modal="!saving" :close-on-press-escape="!saving" :show-close="!saving"
        @update:model-value="close" class="replace-file-dialog">
        <p class="replacement-source"><strong>{{ $t('replaceFile.source') }}</strong> {{ source?.name }}</p>
        <p>{{ $t('replaceFile.hint') }}</p>
        <div class="picker-toolbar">
            <el-button :disabled="!folder || loading || saving" @click="goUp">{{ $t('replaceFile.up') }}</el-button>
            <el-input v-model="folderInput" :disabled="saving" :placeholder="$t('replaceFile.folder')" @keyup.enter="navigate(folderInput)">
                <template #prepend>/</template>
            </el-input>
            <el-button :disabled="loading || saving" @click="navigate(folderInput)">{{ $t('replaceFile.open') }}</el-button>
        </div>
        <el-alert v-if="error" :title="error" type="error" :closable="false" show-icon />
        <div class="target-picker" v-loading="loading" role="group" :aria-label="$t('replaceFile.target')">
            <button v-for="dir in directories" :key="'dir:' + dir" type="button" class="picker-row folder-row"
                :disabled="saving || loading" @click="navigate(dir)">
                <font-awesome-icon icon="folder" /> <span>{{ basename(dir) }}/</span>
            </button>
            <button v-for="file in files" :key="file.name" type="button" class="picker-row"
                :class="{ chosen: target?.name === file.name }" :disabled="saving || loading || !eligible(file)"
                :aria-pressed="target?.name === file.name" @click="target = file; error = ''">
                <img v-if="file.metadata?.FileType?.startsWith('image/')" :src="preview(file)" alt="" loading="lazy" class="target-thumbnail" />
                <font-awesome-icon v-else :icon="target?.name === file.name ? 'check' : 'file'" />
                <span>{{ file.metadata?.FileName || basename(file.name) }}</span>
                <small>{{ file.metadata?.FileType }}</small>
            </button>
            <p v-if="!loading && !files.length && !directories.length">{{ $t('replaceFile.empty') }}</p>
        </div>
        <div class="picker-pagination">
            <el-button :disabled="page === 0 || loading || saving" @click="load(page - 1)">{{ $t('replaceFile.previous') }}</el-button>
            <span>{{ page + 1 }}</span>
            <el-button :disabled="files.length < 50 || loading || saving" @click="load(page + 1)">{{ $t('replaceFile.next') }}</el-button>
        </div>
        <div v-if="target" class="replacement-confirmation">
            <p><strong>{{ $t('replaceFile.target') }}</strong> {{ target.name }}</p>
            <p>{{ $t('replaceFile.preserved') }}</p>
            <el-checkbox v-model="deleteSource" :disabled="saving">{{ $t('replaceFile.deleteSource') }}</el-checkbox>
            <p v-if="deleteSource" class="delete-hint">{{ $t('replaceFile.deleteHint') }}</p>
        </div>
        <template #footer>
            <el-button :disabled="saving" @click="close(false)">{{ $t('replaceFile.cancel') }}</el-button>
            <el-button type="primary" :disabled="!target || loading" :loading="saving" @click="submit">
                {{ $t('replaceFile.confirm') }}
            </el-button>
        </template>
    </el-dialog>
</template>

<script>
import fetchWithAuth from '@/utils/fetchWithAuth';
import { replacementCompatible } from '@/utils/replacementHelpers';

export default {
    name: 'ReplaceFileDialog',
    props: { modelValue: Boolean, source: Object, currentDirectory: { type: String, default: '' } },
    emits: ['update:modelValue', 'replaced'],
    data() {
        return { folder: '', folderInput: '', files: [], directories: [], page: 0, target: null,
            deleteSource: false, loading: false, saving: false, error: '', requestNumber: 0 };
    },
    watch: {
        modelValue(open) {
            if (open) {
                this.target = null; this.deleteSource = false; this.error = '';
                this.navigate(this.currentDirectory);
            } else { this.requestNumber++; }
        }
    },
    methods: {
        basename(path) { return path.replace(/\/+$/, '').split('/').pop(); },
        preview(file) {
            const prefix = process.env.NODE_ENV === 'production' ? '/file/' : '/api/file/';
            const path = file.metadata?.FixedId || file.name;
            return prefix + path.split('/').map(encodeURIComponent).join('/') + '?from=admin&v=' + encodeURIComponent(file.metadata?.ContentVersion || '');
        },
        eligible(file) { return replacementCompatible(this.source, file); },
        close(value) { if (!this.saving) this.$emit('update:modelValue', value); },
        navigate(path) {
            this.folder = path.replace(/^\/+|\/+$/g, ''); this.folderInput = this.folder;
            this.target = null; this.error = ''; this.load(0);
        },
        goUp() { this.navigate(this.folder.split('/').slice(0, -1).join('/')); },
        async load(page) {
            const number = ++this.requestNumber;
            this.error = ''; this.loading = true; this.files = []; this.directories = []; this.page = page;
            try {
                const query = new URLSearchParams({ dir: this.folder, count: '50', start: String(page * 50) });
                const response = await fetchWithAuth('/api/manage/list?' + query);
                if (!response.ok) throw new Error(this.$t('replaceFile.loadFailed'));
                const data = await response.json();
                if (number !== this.requestNumber) return;
                this.files = data.files || [];
                this.directories = (data.directories || []).filter(dir => dir.replace(/\/+$/, '') !== this.folder);
            } catch (error) { if (number === this.requestNumber) this.error = error.message; }
            finally { if (number === this.requestNumber) this.loading = false; }
        },
        async submit() {
            if (this.saving || !this.target || !this.eligible(this.target)) return;
            this.saving = true; this.error = '';
            try {
                const response = await fetchWithAuth('/api/manage/replace/' + this.source.name.split('/').map(encodeURIComponent).join('/'), {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ target: this.target.name, deleteSource: this.deleteSource,
                        expectedSourcePath: this.source.name, expectedTargetPath: this.target.name,
                        sourceVersion: this.source.metadata?.ContentVersion || '', targetVersion: this.target.metadata?.ContentVersion || '' })
                });
                const result = await response.json();
                if (!response.ok || !result.success) throw new Error(result.message || this.$t('replaceFile.failed'));
                this.$emit('replaced', result);
                this.$emit('update:modelValue', false);
            } catch (error) { this.error = error.message; }
            finally { this.saving = false; }
        }
    }
};
</script>

<style scoped>
.picker-toolbar { display: flex; gap: 8px; margin: 12px 0; }
.target-picker { min-height: 120px; max-height: clamp(100px, 20dvh, 180px); overflow: auto; margin: 8px 0; border: 1px solid var(--el-border-color); border-radius: 8px; }
.picker-row { width: 100%; display: flex; align-items: center; gap: 10px; padding: 12px; text-align: left; border: 0; border-bottom: 1px solid var(--el-border-color-lighter); background: transparent; color: var(--el-text-color-primary); cursor: pointer; }
.target-thumbnail { width: 36px; height: 36px; object-fit: cover; border-radius: 4px; }
.picker-row span { overflow-wrap: anywhere; flex: 1; }
.picker-row small { color: var(--el-text-color-secondary); }
.picker-row:hover, .picker-row.chosen { background: var(--el-color-primary-light-9); }
.picker-row:disabled { opacity: .4; cursor: default; }
.folder-row { color: var(--el-color-primary); }
.picker-pagination { display: flex; align-items: center; justify-content: center; gap: 16px; }
.replacement-source, .replacement-confirmation p { overflow-wrap: anywhere; }
.replacement-confirmation { margin-top: 12px; padding: 8px; border: 1px solid var(--el-border-color); border-radius: 8px; }
.replacement-source { margin: 8px 0; }
.replacement-confirmation p { margin: 6px 0; }
.delete-hint { color: var(--el-color-danger); }
@media (max-width: 600px) { .picker-row small { display: none; } }
</style>

<style>
.el-dialog.replace-file-dialog { max-height: calc(100dvh - 24px); display: flex; flex-direction: column; }
.replace-file-dialog .el-dialog__body { overflow-y: auto; min-height: 0; text-align: left; }
.replace-file-dialog .el-dialog__header, .replace-file-dialog .el-dialog__footer { flex-shrink: 0; }
</style>
