import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const testDirectory = dirname(fileURLToPath(import.meta.url));
const scriptPath = resolve(testDirectory, '../../.github/workflows/scripts/check-registry-version.mjs');
const commit = '0123456789abcdef0123456789abcdef01234567';
const manifest = {
  schemaVersion: 1,
  packageName: 'cloudflare-imgbed',
  version: '2.7.8',
  commit,
  buildId: commit.slice(0, 20),
  packageVersion: `2.7.8-commit.${commit.slice(0, 20)}`,
  dirty: false,
  frontendDistSha256: 'b'.repeat(64),
};

async function createRegistryServer(handler) {
  const server = createServer(handler);
  await new Promise((resolveListening, rejectListening) => {
    server.once('error', rejectListening);
    server.listen(0, '127.0.0.1', resolveListening);
  });
  const address = server.address();
  return {
    registryUrl: `http://127.0.0.1:${address.port}/`,
    close: () => new Promise((resolveClose, rejectClose) => {
      server.close((error) => {
        if (error) {
          rejectClose(error);
          return;
        }
        resolveClose();
      });
    }),
  };
}

async function createFixture(context) {
  const root = await mkdtemp(join(tmpdir(), 'imgbed-registry-check-'));
  const manifestPath = join(root, 'build-manifest.json');
  const githubOutputPath = join(root, 'github-output');
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  context.after(async () => rm(root, { force: true, recursive: true }));
  return { githubOutputPath, manifestPath };
}

function runCheckScript(fixture, registryUrl) {
  return execFileAsync(
    process.execPath,
    [
      scriptPath,
      '--manifest', fixture.manifestPath,
      '--registry-url', registryUrl,
      '--github-output', fixture.githubOutputPath,
    ],
    {
      encoding: 'utf8',
      windowsHide: true,
    },
  );
}

test('reports an exact 404 version as unpublished with GitHub outputs', async (context) => {
  const fixture = await createFixture(context);
  let requestedPath;
  const registry = await createRegistryServer((request, response) => {
    requestedPath = request.url;
    response.writeHead(404).end();
  });
  context.after(registry.close);

  const result = await runCheckScript(fixture, registry.registryUrl);
  assert.match(result.stdout, /is unpublished/);
  assert.equal(
    decodeURIComponent(requestedPath),
    `/${manifest.packageName}/${manifest.packageVersion}`,
  );

  const githubOutput = await readFile(fixture.githubOutputPath, 'utf8');
  assert.match(githubOutput, /^registry_status=unpublished$/m);
  assert.match(githubOutput, /^should_publish=true$/m);
  assert.match(githubOutput, /^should_skip=false$/m);
});

test('skips a published version with the same full commit and digest', async (context) => {
  const fixture = await createFixture(context);
  const registry = await createRegistryServer((request, response) => {
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({ sanyueBuild: manifest }));
  });
  context.after(registry.close);

  const result = await runCheckScript(fixture, registry.registryUrl);
  assert.match(result.stdout, /matches and can be skipped/);

  const githubOutput = await readFile(fixture.githubOutputPath, 'utf8');
  assert.match(githubOutput, /^registry_status=matched$/m);
  assert.match(githubOutput, /^should_publish=false$/m);
  assert.match(githubOutput, /^should_skip=true$/m);
});

test('fails when an exact published version has a different identity', async (context) => {
  const fixture = await createFixture(context);
  const registry = await createRegistryServer((request, response) => {
    response.setHeader('content-type', 'application/json');
    response.end(JSON.stringify({
      sanyueBuild: {
        ...manifest,
        frontendDistSha256: 'c'.repeat(64),
      },
    }));
  });
  context.after(registry.close);

  await assert.rejects(
    runCheckScript(fixture, registry.registryUrl),
    (error) => {
      assert.match(error.stdout, /conflicts with the build manifest/);
      assert.match(error.stderr, /different commit or frontend-dist digest/);
      return true;
    },
  );

  const githubOutput = await readFile(fixture.githubOutputPath, 'utf8');
  assert.match(githubOutput, /^registry_status=conflict$/m);
  assert.match(githubOutput, /^should_publish=false$/m);
  assert.match(githubOutput, /^should_skip=false$/m);
});
