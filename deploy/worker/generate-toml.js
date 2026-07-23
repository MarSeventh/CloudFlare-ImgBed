/**
 * 根据环境变量生成 deploy/worker/wrangler.toml
 * 用于 GitHub Actions 部署，从 Secrets/Variables 读取配置
 * 
 * 环境变量：
 *   WORKER_NAME      - Worker 名称（默认 cloudflare-imgbed）
 *   D1_DATABASE_ID   - D1 数据库 ID
 *   KV_NAMESPACE_ID  - KV 命名空间 ID
 *   R2_BUCKET_NAME   - R2 存储桶名称
 *   AI_QUEUE_NAME    - 通用 AI Queue 资源名（推荐 imgqueue）
 *   WORKER_VARS      - JSON 格式的业务环境变量
 */

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = join(__dirname, 'wrangler.toml');

const env = process.env;
const name = env.WORKER_NAME || 'cloudflare-imgbed';

let toml = `name = "${name}"
main = "index.js"
compatibility_date = "2026-07-21"
compatibility_flags = ["global_fetch_strictly_public"]

[assets]
directory = "../../frontend-dist"
binding = "ASSETS"
not_found_handling = "single-page-application"
`;

// D1 数据库
if (env.D1_DATABASE_ID) {
    toml += `
[[d1_databases]]
binding = "img_d1"
database_name = "img_d1"
database_id = "${env.D1_DATABASE_ID}"
`;
}

// KV 命名空间
if (env.KV_NAMESPACE_ID) {
    toml += `
[[kv_namespaces]]
binding = "img_url"
id = "${env.KV_NAMESPACE_ID}"
`;
}

// R2 存储桶
if (env.R2_BUCKET_NAME) {
    toml += `
[[r2_buckets]]
binding = "img_r2"
bucket_name = "${env.R2_BUCKET_NAME}"
`;
}

// 通用 AI 任务队列（同一 Worker 同时作为 producer 和 consumer）
if (env.AI_QUEUE_NAME) {
    toml += `
[[queues.producers]]
binding = "img_queue"
queue = "${env.AI_QUEUE_NAME}"

[[queues.consumers]]
queue = "${env.AI_QUEUE_NAME}"
max_batch_size = 5
max_batch_timeout = 5
max_retries = 10
retry_delay = 30
max_concurrency = 1
`;
}

// 业务环境变量（从 JSON 解析）
if (env.WORKER_VARS) {
    try {
        const vars = JSON.parse(env.WORKER_VARS);
        const entries = Object.entries(vars);
        if (entries.length > 0) {
            toml += '\n[vars]\n';
            for (const [key, value] of entries) {
                toml += `${key} = "${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"\n`;
            }
        }
    } catch (e) {
        console.error('Warning: WORKER_VARS is not valid JSON, skipping:', e.message);
    }
}

writeFileSync(outputPath, toml, 'utf8');

// 打印配置（隐藏敏感值）
const safeToml = toml
    .replace(/database_id = ".*"/g, 'database_id = "***"')
    .replace(/(id = )".*"/g, '$1"***"')
    .replace(/(TOKEN.*= )".*"/gi, '$1"***"')
    .replace(/(KEY.*= )".*"/gi, '$1"***"')
    .replace(/(SECRET.*= )".*"/gi, '$1"***"');

console.log('Generated deploy/worker/wrangler.toml:');
console.log(safeToml);
