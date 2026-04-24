/**
 * 根据环境变量生成 wrangler.worker.toml
 * 用于 GitHub Actions 部署，从 Secrets/Variables 读取配置
 * 
 * 环境变量：
 *   WORKER_NAME      - Worker 名称（默认 cloudflare-imgbed）
 *   D1_DATABASE_ID   - D1 数据库 ID
 *   KV_NAMESPACE_ID  - KV 命名空间 ID
 *   R2_BUCKET_NAME   - R2 存储桶名称
 *   WORKER_VARS      - JSON 格式的业务环境变量
 */

import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const outputPath = join(ROOT, 'wrangler.worker.toml');

const env = process.env;
const name = env.WORKER_NAME || 'cloudflare-imgbed';

let toml = `name = "${name}"
main = "worker/index.js"
compatibility_date = "2024-08-21"

[assets]
directory = "./frontend-dist"
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

console.log('Generated wrangler.worker.toml:');
console.log(safeToml);
