import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import {
  access,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

import {
  prepareRegistryPackage,
  validateBuildManifest,
} from '../../.github/workflows/scripts/prepare-registry-package.mjs';

const execFileAsync = promisify(execFile);
const commit = '0123456789abcdef0123456789abcdef01234567';
const manifest = {
  schemaVersion: 1,
  packageName: 'cloudflare-imgbed',
  version: '2.7.8',
  commit,
  buildId: commit.slice(0, 20),
  packageVersion: `2.7.8-commit.${commit.slice(0, 20)}`,
  dirty: false,
  frontendDistSha256: 'a'.repeat(64),
};

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function initializeFixture() {
  const fixtureRoot = await mkdtemp(join(tmpdir(), 'imgbed-registry-package-'));
  const repositoryPath = join(fixtureRoot, 'repository');
  const stagingPath = join(fixtureRoot, 'staging');
  const manifestPath = join(fixtureRoot, 'build-manifest.json');
  await mkdir(join(repositoryPath, 'frontend-dist'), { recursive: true });
  await mkdir(join(repositoryPath, 'node_modules'), { recursive: true });
  await mkdir(join(repositoryPath, 'data'), { recursive: true });
  await mkdir(join(repositoryPath, 'data-source'), { recursive: true });

  const packageJson = {
    name: 'source-name',
    version: '0.0.0',
    private: true,
    publishConfig: {
      registry: 'https://registry.npmjs.org/',
      access: 'restricted',
    },
  };
  await writeFile(
    join(repositoryPath, 'package.json'),
    `${JSON.stringify(packageJson, null, 2)}\n`,
  );
  await writeFile(join(repositoryPath, 'tracked.txt'), 'indexed content\n');
  await writeFile(join(repositoryPath, 'untracked.txt'), 'untracked\n');
  await writeFile(join(repositoryPath, 'frontend-dist', 'app.js'), 'app\n');
  await writeFile(
    join(repositoryPath, 'frontend-dist', '.sanyue-build.json'),
    '{"stale":true}\n',
  );
  await writeFile(join(repositoryPath, 'node_modules', 'tracked.txt'), 'excluded\n');
  await writeFile(join(repositoryPath, 'data', 'tracked.txt'), 'excluded\n');
  await writeFile(join(repositoryPath, 'data-source', 'tracked.txt'), 'included\n');
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  await execFileAsync('git', ['init', '--quiet', repositoryPath]);
  await execFileAsync(
    'git',
    ['-C', repositoryPath, 'add', '-f', '--', '.'],
    { windowsHide: true },
  );
  await execFileAsync(
    'git',
    ['-C', repositoryPath, 'reset', '--', 'untracked.txt'],
    { windowsHide: true },
  );
  await writeFile(join(repositoryPath, 'tracked.txt'), 'working tree content\n');

  return {
    fixtureRoot,
    manifestPath,
    repositoryPath,
    stagingPath,
  };
}

test('prepares only current tracked files and generated Registry metadata', async (context) => {
  const fixture = await initializeFixture();
  context.after(async () => rm(fixture.fixtureRoot, { force: true, recursive: true }));

  const result = await prepareRegistryPackage({
    root: fixture.repositoryPath,
    manifestPath: fixture.manifestPath,
    stagingPath: fixture.stagingPath,
  });

  assert.ok(result.copiedFileCount > 0);
  assert.equal(
    await readFile(join(fixture.stagingPath, 'tracked.txt'), 'utf8'),
    'working tree content\n',
  );
  assert.equal(
    await readFile(join(fixture.stagingPath, 'data-source', 'tracked.txt'), 'utf8'),
    'included\n',
  );
  assert.equal(await pathExists(join(fixture.stagingPath, '.git')), false);
  assert.equal(await pathExists(join(fixture.stagingPath, 'node_modules')), false);
  assert.equal(await pathExists(join(fixture.stagingPath, 'data')), false);
  assert.equal(await pathExists(join(fixture.stagingPath, 'untracked.txt')), false);

  const stagingManifest = JSON.parse(await readFile(
    join(fixture.stagingPath, 'frontend-dist', '.sanyue-build.json'),
    'utf8',
  ));
  assert.deepEqual(stagingManifest, manifest);

  const stagingPackageJson = JSON.parse(await readFile(
    join(fixture.stagingPath, 'package.json'),
    'utf8',
  ));
  assert.equal(stagingPackageJson.name, manifest.packageName);
  assert.equal(stagingPackageJson.version, manifest.packageVersion);
  assert.equal(stagingPackageJson.private, false);
  assert.equal(stagingPackageJson.publishConfig.access, 'public');
  assert.equal(
    stagingPackageJson.publishConfig.registry,
    'https://registry.npmjs.org/',
  );
  assert.deepEqual(stagingPackageJson.sanyueBuild, manifest);
  assert.equal(
    await readFile(join(fixture.stagingPath, '.npmignore'), 'utf8'),
    '!frontend-dist/.sanyue-build.json\n',
  );
});

test('rejects manifests outside the fixed schema', () => {
  assert.throws(
    () => validateBuildManifest({ ...manifest, commit: commit.toUpperCase() }),
    /40 lowercase hexadecimal/,
  );
  assert.throws(
    () => validateBuildManifest({ ...manifest, buildId: 'f'.repeat(20) }),
    /first 20 commit characters/,
  );
  assert.throws(
    () => validateBuildManifest({ ...manifest, unexpected: true }),
    /must contain exactly/,
  );
});

test('rejects a staging directory inside the repository', async (context) => {
  const fixture = await initializeFixture();
  context.after(async () => rm(fixture.fixtureRoot, { force: true, recursive: true }));

  await assert.rejects(
    prepareRegistryPackage({
      root: fixture.repositoryPath,
      manifestPath: fixture.manifestPath,
      stagingPath: join(fixture.repositoryPath, 'frontend-dist'),
    }),
    /must be outside the repository/,
  );
  assert.equal(
    await readFile(join(fixture.repositoryPath, 'frontend-dist', 'app.js'), 'utf8'),
    'app\n',
  );
});


test('rejects an existing staging directory without deleting its contents', async (context) => {
  const fixture = await initializeFixture();
  context.after(async () => rm(fixture.fixtureRoot, { force: true, recursive: true }));
  await mkdir(fixture.stagingPath);
  const sentinelPath = join(fixture.stagingPath, 'keep.txt');
  await writeFile(sentinelPath, 'keep user data');

  await assert.rejects(
    prepareRegistryPackage({
      root: fixture.repositoryPath,
      manifestPath: fixture.manifestPath,
      stagingPath: fixture.stagingPath,
    }),
    { code: 'EEXIST' },
  );
  assert.equal(await readFile(sentinelPath, 'utf8'), 'keep user data');
});
