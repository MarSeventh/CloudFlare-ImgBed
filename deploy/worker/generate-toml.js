/**
 * Generates deploy/worker/wrangler.toml from environment variables.
 * Used by GitHub Actions deployments; configuration is read from GitHub Secrets.
 *
 * Environment variables:
 *   WORKER_NAME      - Worker name (default: animelk-storage)
 *   D1_DATABASE_ID   - D1 数据库 ID
 *   KV_NAMESPACE_ID  - KV 命名空间 ID
 *   R2_BUCKET_NAME   - R2 存储桶名称
 *   WORKER_VARS      - JSON 对象，值可直接填写或使用 { value, type: 'text' | 'secret' }
 *                     type defaults to text; secrets are written to a separate file for batch upload after deployment.
 */

import { appendFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = join(__dirname, 'wrangler.toml');

const env = process.env;
const name = env.WORKER_NAME || 'animelk-storage';

// Validate the full configuration first, so a bad secret config is never downgraded to a plain variable or silently skipped.
const textVars = Object.create(null);
const secretVars = Object.create(null);
if (env.WORKER_VARS) {
    let vars;
    try {
        vars = JSON.parse(env.WORKER_VARS);
    } catch {
        // JSON parse errors may contain raw secret fragments; do not print the parser's error message.
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

// D1 database
if (env.D1_DATABASE_ID) {
    toml += `
[[d1_databases]]
binding = "img_d1"
database_name = "img_d1"
database_id = "${env.D1_DATABASE_ID}"
`;
}

// KV namespace
if (env.KV_NAMESPACE_ID) {
    toml += `
[[kv_namespaces]]
binding = "img_url"
id = "${env.KV_NAMESPACE_ID}"
`;
}

// R2 bucket
if (env.R2_BUCKET_NAME) {
    toml += `
[[r2_buckets]]
binding = "img_r2"
bucket_name = "${env.R2_BUCKET_NAME}"
`;
}

toml += `
[vars]
# Secret-type variables are uploaded separately after deployment and are not written to this config.
`;

// JSON string escaping fits TOML basic strings; also escape the DEL character, which TOML forbids.
const tomlString = (value) => JSON.stringify(value).replace(/\u007f/g, '\\u007f');
const configWithoutVars = toml;
for (const [key, value] of Object.entries(textVars)) {
    toml += `${tomlString(key)} = ${tomlString(value)}\n`;
}

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

// Hide all business variable values, so sensitivity never depends on variable naming conventions.
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
