import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { createBuildInfo, hashFrontendDist, validateBuildInfo } from '../.github/workflows/scripts/build-info.mjs';

const COMMIT = '0123456789abcdef0123456789abcdef01234567';

describe('build identity', () => {
    let root;

    beforeEach(() => {
        root = mkdtempSync(join(tmpdir(), 'imgbed-build-info-'));
        mkdirSync(join(root, 'frontend-dist', 'js'), { recursive: true });
        writeFileSync(join(root, 'package.json'), JSON.stringify({ name: 'cloudflare-imgbed', version: '2.7.8' }));
        writeFileSync(join(root, 'frontend-dist', 'index.html'), '<!doctype html>');
        writeFileSync(join(root, 'frontend-dist', 'js', 'app.js'), 'console.log("app");');
    });

    afterEach(() => rmSync(root, { recursive: true, force: true }));

    it('combines the business version with a 20-character commit prefix', async () => {
        const buildInfo = await createBuildInfo({ root, commit: COMMIT, dirty: false, env: {} });
        assert.equal(buildInfo.version, '2.7.8');
        assert.equal(buildInfo.commit, COMMIT);
        assert.equal(buildInfo.buildId, COMMIT.slice(0, 20));
        assert.equal(buildInfo.packageVersion, `2.7.8-commit.${COMMIT.slice(0, 20)}`);
        assert.equal(buildInfo.frontendDistSha256.length, 64);
        assert.equal(buildInfo.dirty, false);
        assert.equal(validateBuildInfo(buildInfo), buildInfo);
    });

    it('hashes paths and contents deterministically while excluding its own manifest', async () => {
        const initial = await hashFrontendDist(join(root, 'frontend-dist'));
        writeFileSync(join(root, 'frontend-dist', '.sanyue-build.json'), '{"ignored":true}');
        assert.equal(await hashFrontendDist(join(root, 'frontend-dist')), initial);
        writeFileSync(join(root, 'frontend-dist', 'js', 'app.js'), 'console.log("changed");');
        assert.notEqual(await hashFrontendDist(join(root, 'frontend-dist')), initial);
    });

    it('writes the manifest and GitHub outputs from the CLI', () => {
        const outputPath = join(root, 'github-output');
        const scriptPath = resolve('.github/workflows/scripts/build-info.mjs');
        const result = spawnSync(process.execPath, [
            scriptPath,
            '--root', root,
            '--commit', COMMIT,
            '--dirty', 'false',
            '--write-manifest',
            '--github-output', outputPath,
        ], { encoding: 'utf8' });

        assert.equal(result.status, 0, result.stderr);
        const manifest = JSON.parse(readFileSync(join(root, 'frontend-dist', '.sanyue-build.json'), 'utf8'));
        assert.equal(manifest.commit, COMMIT);
        assert.equal(manifest.packageVersion, `2.7.8-commit.${COMMIT.slice(0, 20)}`);
        const outputs = readFileSync(outputPath, 'utf8');
        assert.match(outputs, /^version=2\.7\.8$/m);
        assert.match(outputs, new RegExp(`^commit=${COMMIT}$`, 'm'));
        assert.match(outputs, /^dirty=false$/m);
    });

    it('rejects abbreviated commits and unstable business versions', async () => {
        await assert.rejects(
            createBuildInfo({ root, commit: COMMIT.slice(0, 12), dirty: false, env: {} }),
            /complete 40-character Git SHA/,
        );
        await assert.rejects(
            createBuildInfo({ root, commit: COMMIT, version: '2.7.8-beta.1', dirty: false, env: {} }),
            /stable x\.y\.z format/,
        );
    });
});
