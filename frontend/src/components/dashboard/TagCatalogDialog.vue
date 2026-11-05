<template>
    <el-dialog :model-value="modelValue" @update:model-value="$emit('update:modelValue', $event)" :title="$t('tagCatalog.title')" width="min(640px, 94vw)" :close-on-click-modal="!busy" :close-on-press-escape="!busy" :show-close="!busy" @open="load">
        <p>{{ $t('tagCatalog.hint') }}</p>
        <el-alert v-if="error" :title="error" type="error" :closable="false" />
        <div class="add-tag"><el-input v-model="newTag" :placeholder="$t('tagManagement.inputPlaceholder')" :disabled="busy" @keyup.enter="add" /><el-button :disabled="busy || !newTag.trim()" @click="add">{{ $t('tagCatalog.add') }}</el-button></div>
        <p v-if="busy">{{ $t('tagCatalog.progress', { count: updated }) }}</p>
        <el-table :data="tags" max-height="440" v-loading="loading">
            <el-table-column prop="name" :label="$t('dashboard.tags')" />
            <el-table-column prop="count" :label="$t('tagCatalog.usage')" width="100" />
            <el-table-column :label="$t('tagCatalog.actions')" width="160"><template #default="{ row }">
                <el-button link type="primary" :disabled="busy" @click="rename(row)">{{ $t('tagCatalog.rename') }}</el-button>
                <el-button link type="danger" :disabled="busy || row.count > 0" @click="remove(row)">{{ $t('tagCatalog.delete') }}</el-button>
            </template></el-table-column>
        </el-table>
    </el-dialog>
</template>
<script>
import fetchWithAuth from '@/utils/fetchWithAuth';
export default {
    props: { modelValue: Boolean }, emits: ['update:modelValue', 'changed'],
    data: () => ({ tags: [], newTag: '', busy: false, loading: false, error: '', updated: 0 }),
    methods: {
        async load() {
            this.loading = true;
            try {
                const response = await fetchWithAuth('/api/manage/tags/catalog');
                if (!response.ok) throw new Error(this.$t('tagCatalog.failed'));
                this.tags = (await response.json()).tags;
            } catch (e) { this.error = e.message; } finally { this.loading = false; }
        },
        async run(body) {
            this.busy = true; this.error = ''; this.updated = 0;
            try {
                let cursor;
                do {
                    const response = await fetchWithAuth('/api/manage/tags/catalog', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, cursor }) });
                    const result = await response.json();
                    if (!response.ok) throw new Error(this.$t('tagCatalog.failed'));
                    this.updated += result.updated || 0;
                    cursor = result.nextCursor;
                } while (cursor);
                this.$emit('changed', body);
                this.$message.success(this.$t('tagCatalog.saved'));
                await this.load();
                return true;
            } catch (e) { this.error = this.$t('tagCatalog.retry'); return false; }
            finally { this.busy = false; }
        },
        async add() { if (this.newTag.trim() && !this.busy && await this.run({ action: 'add', name: this.newTag.trim() })) this.newTag = ''; },
        async remove(row) {
            try { await this.$confirm(this.$t('tagCatalog.confirmDelete', { name: row.name }), this.$t('tagCatalog.title')); }
            catch { return; }
            await this.run({ action: 'delete', name: row.name });
        },
        async rename(row) {
            let value;
            try { ({ value } = await this.$prompt(this.$t('tagCatalog.confirmRename', { name: row.name, count: row.count }), this.$t('tagCatalog.rename'), { inputValue: row.name, inputValidator: value => /^[\w\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af-]{1,100}$/.test(value?.trim()) && value.trim().toLowerCase() !== row.name })); }
            catch { return; }
            await this.run({ action: 'rename', name: row.name, newName: value.trim().toLowerCase() });
        }
    }
};
</script>
<style scoped>.add-tag { display: flex; gap: 12px; margin: 16px 0; }</style>
