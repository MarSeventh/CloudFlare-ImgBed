import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

describe('Worker deployment config', function () {
    this.timeout(10000);
    let directory;

    beforeEach(() => {
        directory = mkdtempSync(join(tmpdir(), 'imgbed-worker-config-'));
        copyFileSync('deploy/worker/generate-toml.js', join(directory, 'generate.mjs'));
    });
    afterEach(() => rmSync(directory, { recursive: true, force: true }));

    function generate(config, extra = {}) {
        const env = { ...process.env };
        for (const key of ['WRANGLER_CONFIG', 'WORKER_NAME', 'WORKER_VARS', 'D1_DATABASE_ID', 'KV_NAMESPACE_ID', 'R2_BUCKET_NAME', 'EXPIRY_CLEANUP_CRON']) {
            delete env[key];
        }
        Object.assign(env, { RUNNER_TEMP: directory, GITHUB_OUTPUT: join(directory, 'outputs'), ...extra });
        if (config !== undefined) env.WRANGLER_CONFIG = config;
        const result = spawnSync(process.execPath, [join(directory, 'generate.mjs')], { env, encoding: 'utf8' });
        const output = join(directory, 'wrangler.toml');
        return { ...result, toml: existsSync(output) ? readFileSync(output, 'utf8').replace(/\r\n/g, '\n') : null };
    }

    it('preserves the default config when the extra config is absent or empty', () => {
        const baseline = generate();
        assert.equal(baseline.status, 0, baseline.stderr);
        assert.equal(baseline.toml, `name = "cloudflare-imgbed"
main = "index.js"
compatibility_date = "2024-08-21"
compatibility_flags = ["global_fetch_strictly_public"]

[assets]
directory = "../../frontend-dist"
binding = "ASSETS"
not_found_handling = "single-page-application"

[images]
binding = "IMAGES"

[vars]
# Secret 类型的变量在部署后单独上传，不写入此配置。
`);
        assert.equal(generate('{}').toml, baseline.toml);
        assert.equal(generate('').toml, baseline.toml);
    });

    it('places scalars at the root, nested fields in their tables, and keeps bindings, vars and Cron', () => {
        const result = generate(JSON.stringify({
            workers_dev: false,
            observability: { logs: { enabled: true }, enabled: true, head_sampling_rate: 0.5 },
            limits: { cpu_ms: 10000 },
            placement: { mode: 'smart' },
        }), {
            D1_DATABASE_ID: 'database-test', KV_NAMESPACE_ID: 'kv-test', R2_BUCKET_NAME: 'bucket-test',
            EXPIRY_CLEANUP_CRON: '*/30 * * * *',
            WORKER_VARS: JSON.stringify({ TEXT: 'text-value', SECRET: { value: 'secret-value', type: 'secret' } }),
        });
        assert.equal(result.status, 0, result.stderr);
        assert.ok(result.toml.startsWith('"workers_dev" = false\nname = '));
        assert.ok(result.toml.endsWith('\n["observability"]\n"enabled" = true\n"head_sampling_rate" = 0.5\n\n["observability"."logs"]\n"enabled" = true\n\n["limits"]\n"cpu_ms" = 10000\n\n["placement"]\n"mode" = "smart"\n'));
        for (const section of ['[[d1_databases]]', '[[kv_namespaces]]', '[[r2_buckets]]', '[triggers]\ncrons = ["*/30 * * * *"]', '[vars]\n# Secret 类型的变量在部署后单独上传，不写入此配置。\n"TEXT" = "text-value"']) {
            assert.ok(result.toml.includes(section), section);
        }
        assert.equal(result.toml.includes('secret-value'), false);
        assert.deepEqual(JSON.parse(readFileSync(join(directory, 'worker-secrets.json'), 'utf8')), { SECRET: 'secret-value' });
        for (const value of ['text-value', 'secret-value', 'smart', 'workers_dev', 'head_sampling_rate']) {
            assert.equal((result.stdout + result.stderr).includes(value), false, value);
        }
    });

    it('quotes keys and escapes strings without interpreting dotted keys as table paths', () => {
        const result = generate('{"observability.logs":{"a.b":"line\\n\\\"quote\\\"\\t\\\\end\\u007f"},"__proto__":{"enabled":true},"empty":{}}');
        assert.equal(result.status, 0, result.stderr);
        assert.ok(result.toml.endsWith('\n["observability.logs"]\n"a.b" = "line\\n\\\"quote\\\"\\t\\\\end\\u007f"\n\n["__proto__"]\n"enabled" = true\n\n["empty"]\n'));
        assert.equal(result.stdout.includes('quote'), false);
    });

    for (const key of ['name', 'main', 'compatibility_date', 'compatibility_flags', 'assets', 'images', 'd1_databases', 'kv_namespaces', 'r2_buckets', 'vars', 'triggers']) {
        it(`rejects managed key ${key} before writing any output`, () => {
            const result = generate(JSON.stringify({ [key]: 'sensitive-value' }));
            assert.notEqual(result.status, 0);
            assert.match(result.stderr, /cannot override script-managed key/);
            assert.equal(result.stderr.includes('sensitive-value'), false);
            assert.equal(result.toml, null);
            assert.equal(existsSync(join(directory, 'outputs')), false);
        });
    }

    for (const config of ['{"secret":"sensitive-value",', 'null', 'true', '[]', '"text"', '{"x":null}', '{"x":[]}', '{"x":{"y":[{}]}}', '{"x":1e999}', '{"x":"\\ud800"}']) {
        it(`rejects invalid configuration ${config} without exposing values or writing files`, () => {
            const result = generate(config, { WORKER_VARS: '{"secret":{"value":"private-value","type":"secret"}}' });
            assert.notEqual(result.status, 0);
            assert.match(result.stderr, /WRANGLER_CONFIG/);
            assert.equal(result.stderr.includes('sensitive-value'), false);
            assert.equal(result.toml, null);
            assert.equal(existsSync(join(directory, 'worker-secrets.json')), false);
            assert.equal(existsSync(join(directory, 'outputs')), false);
        });
    }
});
