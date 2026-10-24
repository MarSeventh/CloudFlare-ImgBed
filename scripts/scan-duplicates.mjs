/**
 * 存量文件去重扫描（只读，不做任何删除）
 *
 * 用法（在图床容器内运行）:
 *   docker exec cloudflare-imgbed node scripts/scan-duplicates.mjs [baseUrl]
 *
 * baseUrl 默认 http://127.0.0.1:8080。脚本通过自身 /file/<id> 路由读取每个
 * 文件计算 SHA-256，按内容分组并列出重复组。清理重复时，建议每组保留
 * timestamp 最早的一条，其余在管理面板删除后，把引用改写为保留条目的链接。
 */
import Database from 'better-sqlite3';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = resolve(fileURLToPath(new URL('../', import.meta.url)));
const DATA_DIR = process.env.DATA_DIR || join(ROOT_DIR, 'data');
const BASE_URL = process.argv[2] || process.env.BASE_URL || 'http://127.0.0.1:8080';

const db = new Database(join(DATA_DIR, 'database.sqlite'), { readonly: true });
const files = db.prepare(
    "SELECT id, file_name, channel, channel_name, timestamp, file_size FROM files ORDER BY timestamp ASC"
).all();

console.log(`Total indexed files: ${files.length}`);

const groups = new Map(); // sha256 -> [{ id, file_name, timestamp }]
let errors = 0;

for (const file of files) {
    try {
        const resp = await fetch(`${BASE_URL}/file/${file.id}`);
        if (!resp.ok) {
            console.error(`[skip] ${file.id}: HTTP ${resp.status}`);
            errors++;
            continue;
        }
        const digest = createHash('sha256').update(Buffer.from(await resp.arrayBuffer())).digest('hex');
        if (!groups.has(digest)) groups.set(digest, []);
        groups.get(digest).push({
            id: file.id,
            name: file.file_name,
            channel: file.channel_name || file.channel,
            timestamp: file.timestamp,
        });
    } catch (err) {
        console.error(`[skip] ${file.id}: ${err.message}`);
        errors++;
    }
}

let duplicateGroups = 0;
let redundantCopies = 0;
for (const [hash, entries] of groups) {
    if (entries.length < 2) continue;
    duplicateGroups++;
    redundantCopies += entries.length - 1;
    console.log(`\n=== duplicate group (${entries.length} copies), sha256=${hash}`);
    for (const entry of entries) {
        const keep = entry === entries[0];
        console.log(`  ${keep ? '[KEEP] ' : '[DUP]  '} ${entry.id}  ${entry.name}  (${entry.channel}, ts=${entry.timestamp})`);
    }
}

console.log(`\nSummary: ${files.length} files scanned, ${errors} errors, ${duplicateGroups} duplicate group(s), ${redundantCopies} redundant copy(ies).`);
if (duplicateGroups > 0) {
    console.log('Cleanup hint: for each group keep the [KEEP] entry and delete the [DUP] entries in the management panel, then rewrite references to the kept link.');
}
process.exit(0);
