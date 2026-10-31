/**
 * 根据环境变量生成 deploy/worker/wrangler.toml
 * 用于 GitHub Actions 部署，从 GitHub Secrets 读取配置
 * 
 * 环境变量：
 *   WORKER_NAME      - Worker 名称（默认 cloudflare-imgbed）
 *   D1_DATABASE_ID   - D1 数据库 ID
 *   KV_NAMESPACE_ID  - KV 命名空间 ID
 *   R2_BUCKET_NAME   - R2 存储桶名称
 *   WORKER_VARS      - JSON 对象，值可直接填写或使用 { value, type: 'text' | 'secret' }
 *                     type 默认 text；secret 单独生成文件供部署后批量上传
 *   WRANGLER_CONFIG - 可选，追加 Wrangler 配置的 JSON 对象
 *   EXPIRY_CLEANUP_CRON - 可选，文件有效期清理的 Cron 表达式（5 段格式，如每 30 分钟一次），不填则不生成定时任务
 */

import { appendFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = join(__dirname, 'wrangler.toml');

const env = process.env;
const name = env.WORKER_NAME || 'cloudflare-imgbed';

// JSON 字符串转义适用于 TOML 基本字符串，另外转义 TOML 禁止的 DEL 字符。
const tomlString = (value) => JSON.stringify(value).replace(/\u007f/g, '\\u007f');

const managedKeys = new Set([
    'name', 'main', 'compatibility_date', 'compatibility_flags', 'assets', 'images',
    'd1_databases', 'kv_namespaces', 'r2_buckets', 'vars', 'triggers'
]);

// 每层先写普通字段，再写子表，避免字段落入前一个子表。
function serializeConfig(config, path = []) {
    let fields = '';
    let tables = '';
    for (const [key, value] of Object.entries(config)) {
        if (path.length === 0 && managedKeys.has(key)) {
            throw new Error(`WRANGLER_CONFIG cannot override script-managed key: ${key}.`);
        }
        if (!key.isWellFormed() || (typeof value === 'string' && !value.isWellFormed())) {
            throw new Error('WRANGLER_CONFIG strings must contain valid Unicode.');
        }
        if (Array.isArray(value)) {
            throw new Error('WRANGLER_CONFIG does not support arrays or arrays of tables.');
        }
        if (value !== null && typeof value === 'object') {
            const tablePath = [...path, key];
            const child = serializeConfig(value, tablePath);
            tables += `\n[${tablePath.map(tomlString).join('.')}]\n` + child.fields + child.tables;
        } else if (typeof value === 'string' || typeof value === 'boolean' ||
                   (typeof value === 'number' && Number.isFinite(value))) {
            fields += `${tomlString(key)} = ${tomlString(value)}\n`;
        } else {
            throw new Error('WRANGLER_CONFIG values must be strings, finite numbers, booleans, or objects; null is not supported.');
        }
    }
    return { fields, tables };
}

let customConfig = { fields: '', tables: '' };
if (env.WRANGLER_CONFIG) {
    let config;
    try {
        config = JSON.parse(env.WRANGLER_CONFIG);
    } catch {
        console.error('Error: WRANGLER_CONFIG must be a valid JSON object.');
        process.exit(1);
    }
    if (config === null || typeof config !== 'object' || Array.isArray(config)) {
        console.error('Error: WRANGLER_CONFIG must be a JSON object.');
        process.exit(1);
    }
    try {
        customConfig = serializeConfig(config);
    } catch (error) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
    }
}

// 先验证全部配置，避免错误的 secret 配置被降级成普通变量或被静默跳过。
const textVars = Object.create(null);
const secretVars = Object.create(null);
if (env.WORKER_VARS) {
    let vars;
    try {
        vars = JSON.parse(env.WORKER_VARS);
    } catch {
        // JSON 解析错误可能包含原始密钥片段，不输出解析器的错误信息。
        console.error('Error: WORKER_VARS must be a valid JSON object.');
        process.exit(1);
    }
    if (vars === null || typeof vars !== 'object' || Array.isArray(vars)) {
        console.error('Error: WORKER_VARS must be a JSON object.');
        process.exit(1);
    }
    for (const [key, entry] of Object.entries(vars)) {
        let type = 'text';
        let value = entry;
        if (entry !== null && typeof entry === 'object') {
            if (Array.isArray(entry) || !Object.hasOwn(entry, 'value')) {
                console.error('Error: Each WORKER_VARS descriptor must contain value and an optional text/secret type.');
                process.exit(1);
            }
            type = Object.hasOwn(entry, 'type') ? entry.type : 'text';
            value = entry.value;
        }
        if (type !== 'text' && type !== 'secret') {
            console.error('Error: WORKER_VARS type must be text or secret.');
            process.exit(1);
        }
        if (value !== null && !['string', 'number', 'boolean'].includes(typeof value)) {
            console.error('Error: WORKER_VARS value must be a string, number, boolean, or null.');
            process.exit(1);
        }
        (type === 'secret' ? secretVars : textVars)[key] = String(value);
    }
}

// 文件有效期清理的定时任务，只接受 5 段 Cron 表达式
const expiryCron = (env.EXPIRY_CLEANUP_CRON || '').trim();
if (expiryCron && !/^[0-9A-Za-z*\/,#?-]+(\s+[0-9A-Za-z*\/,#?-]+){4}$/.test(expiryCron)) {
    console.error('Error: EXPIRY_CLEANUP_CRON must be a 5-field cron expression, for example "*/30 * * * *".');
    process.exit(1);
}

let toml = `name = "${name}"
main = "index.js"
compatibility_date = "2024-08-21"
compatibility_flags = ["global_fetch_strictly_public"]

[assets]
directory = "../../frontend-dist"
binding = "ASSETS"
not_found_handling = "single-page-application"

[images]
binding = "IMAGES"
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

if (expiryCron) {
    toml += `
[triggers]
crons = [${JSON.stringify(expiryCron.replace(/\s+/g, ' '))}]
`;
}

toml += `
[vars]
# Secret 类型的变量在部署后单独上传，不写入此配置。
`;

const configWithoutVars = toml;
for (const [key, value] of Object.entries(textVars)) {
    toml += `${tomlString(key)} = ${tomlString(value)}\n`;
}

// 自定义根字段必须位于第一个表之前；日志仅使用未包含自定义值的配置。
toml = customConfig.fields + toml + customConfig.tables;
writeFileSync(outputPath, toml, 'utf8');

const hasSecrets = Object.keys(secretVars).length > 0;
let secretsPath;
if (hasSecrets) {
    secretsPath = join(env.RUNNER_TEMP || __dirname, 'worker-secrets.json');
    writeFileSync(secretsPath, JSON.stringify(secretVars), { encoding: 'utf8', mode: 0o600 });
}
if (env.GITHUB_OUTPUT) {
    appendFileSync(env.GITHUB_OUTPUT, `has_secrets=${hasSecrets}\n${hasSecrets ? `secrets_path=${secretsPath}\n` : ''}`);
}

// 所有业务变量的值都隐藏，避免依赖变量命名规则判断是否敏感。
const safeToml = configWithoutVars
    .replace(/database_id = ".*"/g, 'database_id = "***"')
    .replace(/(id = )".*"/g, '$1"***"')
    .replace(/(TOKEN.*= )".*"/gi, '$1"***"')
    .replace(/(KEY.*= )".*"/gi, '$1"***"')
    .replace(/(SECRET.*= )".*"/gi, '$1"***"');

console.log('Generated deploy/worker/wrangler.toml:');
console.log(safeToml);
for (const key of Object.keys(textVars)) {
    console.log(`${JSON.stringify(key)} = "***"`);
}
console.log(`Prepared ${Object.keys(secretVars).length} secret(s) for upload after deployment.`);
