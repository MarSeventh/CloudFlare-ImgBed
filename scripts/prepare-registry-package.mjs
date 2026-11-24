import { execFile } from 'node:child_process';
import {
  chmod,
  copyFile,
  lstat,
  mkdir,
  readFile,
  readlink,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const scriptPath = fileURLToPath(import.meta.url);
const defaultRoot = resolve(dirname(scriptPath), '..');
const defaultManifestPath = join('frontend-dist', '.sanyue-build.json');
const manifestFields = [
  'schemaVersion',
  'packageName',
  'version',
  'commit',
  'buildId',
  'packageVersion',
  'dirty',
  'frontendDistSha256',
];
const packageNamePattern = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;
const versionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const commitPattern = /^[0-9a-f]{40}$/;
const buildIdPattern = /^[0-9a-f]{20}$/;
const sha256Pattern = /^[0-9a-f]{64}$/;

function isPlainObject(value) {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value);
}

function normalizeGitPath(path) {
  return path.split('\\').join('/');
}

function isPathWithin(parentPath, childPath) {
  const relativePath = relative(parentPath, childPath);
  return relativePath === ''
    || (!relativePath.startsWith(`..${sep}`)
      && relativePath !== '..'
      && !isAbsolute(relativePath));
}

function isExcludedTrackedPath(path) {
  const normalizedPath = normalizeGitPath(path);
  const segments = normalizedPath.split('/');
  if (segments.includes('.git') || segments.includes('node_modules')) {
    return true;
  }
  if (segments[0] === 'data') {
    return true;
  }
  return false;
}

function assertExactManifestFields(manifest) {
  const actualFields = Object.keys(manifest).sort();
  const expectedFields = [...manifestFields].sort();
  if (actualFields.length !== expectedFields.length
    || actualFields.some((field, index) => field !== expectedFields[index])) {
    throw new Error(`Build manifest must contain exactly: ${manifestFields.join(', ')}.`);
  }
}

export function validateBuildManifest(manifest) {
  if (!isPlainObject(manifest)) {
    throw new Error('Build manifest must be a JSON object.');
  }

  assertExactManifestFields(manifest);
  if (manifest.schemaVersion !== 1) {
    throw new Error('Build manifest schemaVersion must be 1.');
  }
  if (typeof manifest.packageName !== 'string'
    || !packageNamePattern.test(manifest.packageName)
    || manifest.packageName.length > 214) {
    throw new Error('Build manifest packageName is invalid.');
  }
  if (typeof manifest.version !== 'string' || !versionPattern.test(manifest.version)) {
    throw new Error('Build manifest version must use the stable x.y.z format.');
  }
  if (typeof manifest.commit !== 'string' || !commitPattern.test(manifest.commit)) {
    throw new Error('Build manifest commit must be 40 lowercase hexadecimal characters.');
  }
  if (typeof manifest.buildId !== 'string' || !buildIdPattern.test(manifest.buildId)) {
    throw new Error('Build manifest buildId must be 20 lowercase hexadecimal characters.');
  }
  if (manifest.buildId !== manifest.commit.slice(0, 20)) {
    throw new Error('Build manifest buildId must match the first 20 commit characters.');
  }

  const expectedPackageVersion = `${manifest.version}-commit.${manifest.buildId}`;
  if (manifest.packageVersion !== expectedPackageVersion) {
    throw new Error(`Build manifest packageVersion must be ${expectedPackageVersion}.`);
  }
  if (typeof manifest.dirty !== 'boolean') {
    throw new Error('Build manifest dirty must be a boolean.');
  }
  if (typeof manifest.frontendDistSha256 !== 'string'
    || !sha256Pattern.test(manifest.frontendDistSha256)) {
    throw new Error(
      'Build manifest frontendDistSha256 must be 64 lowercase hexadecimal characters.',
    );
  }

  return {
    schemaVersion: manifest.schemaVersion,
    packageName: manifest.packageName,
    version: manifest.version,
    commit: manifest.commit,
    buildId: manifest.buildId,
    packageVersion: manifest.packageVersion,
    dirty: manifest.dirty,
    frontendDistSha256: manifest.frontendDistSha256,
  };
}

export async function readBuildManifest(manifestPath) {
  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`Build manifest is not valid JSON: ${manifestPath}`);
    }
    throw error;
  }
  return validateBuildManifest(manifest);
}

async function listTrackedFiles(root) {
  const { stdout } = await execFileAsync(
    'git',
    ['-C', root, 'ls-files', '--cached', '-z', '--'],
    {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      windowsHide: true,
    },
  );
  return stdout.split('\0').filter(Boolean);
}

function resolveTrackedPath(root, trackedPath) {
  const absolutePath = resolve(root, ...normalizeGitPath(trackedPath).split('/'));
  if (!isPathWithin(root, absolutePath)) {
    throw new Error(`Tracked path escapes the repository: ${trackedPath}`);
  }
  return absolutePath;
}

async function copyTrackedFile(sourcePath, destinationPath) {
  let sourceStats;
  try {
    sourceStats = await lstat(sourcePath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return false;
    }
    throw error;
  }

  await mkdir(dirname(destinationPath), { recursive: true });
  if (sourceStats.isSymbolicLink()) {
    await symlink(await readlink(sourcePath), destinationPath);
    return true;
  }
  if (!sourceStats.isFile()) {
    throw new Error(`Tracked path is not a regular file or symbolic link: ${sourcePath}`);
  }

  await copyFile(sourcePath, destinationPath);
  await chmod(destinationPath, sourceStats.mode & 0o777);
  return true;
}

function createStagingPackageJson(packageJson, manifest) {
  const publishConfig = isPlainObject(packageJson.publishConfig)
    ? packageJson.publishConfig
    : {};
  return {
    ...packageJson,
    name: manifest.packageName,
    version: manifest.packageVersion,
    private: false,
    publishConfig: {
      ...publishConfig,
      access: 'public',
    },
    sanyueBuild: manifest,
  };
}

function assertSafeStagingPath(root, stagingPath) {
  if (isPathWithin(stagingPath, root)) {
    throw new Error('Staging directory cannot be the repository or one of its parent directories.');
  }
  if (isPathWithin(root, stagingPath)) {
    throw new Error('Staging directory must be outside the repository.');
  }
}

export async function prepareRegistryPackage(options) {
  const root = resolve(options.root || defaultRoot);
  const manifestPath = resolve(options.manifestPath || join(root, defaultManifestPath));
  const stagingPath = resolve(options.stagingPath);
  assertSafeStagingPath(root, stagingPath);

  const manifest = await readBuildManifest(manifestPath);
  const trackedFiles = await listTrackedFiles(root);

  await rm(stagingPath, { force: true, recursive: true });
  await mkdir(stagingPath, { recursive: true });

  let copiedFileCount = 0;
  for (const trackedPath of trackedFiles) {
    if (isExcludedTrackedPath(trackedPath)) {
      continue;
    }
    const sourcePath = resolveTrackedPath(root, trackedPath);
    const destinationPath = resolveTrackedPath(stagingPath, trackedPath);
    if (await copyTrackedFile(sourcePath, destinationPath)) {
      copiedFileCount += 1;
    }
  }

  const packageJsonPath = join(stagingPath, 'package.json');
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8'));
  const stagingPackageJson = createStagingPackageJson(packageJson, manifest);
  await writeFile(
    packageJsonPath,
    `${JSON.stringify(stagingPackageJson, null, 2)}\n`,
    'utf8',
  );

  const stagingManifestPath = join(stagingPath, defaultManifestPath);
  await mkdir(dirname(stagingManifestPath), { recursive: true });
  await writeFile(
    stagingManifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
  await writeFile(
    join(stagingPath, '.npmignore'),
    '!frontend-dist/.sanyue-build.json\n',
    'utf8',
  );

  return {
    copiedFileCount,
    manifest,
    stagingPath,
  };
}

function parseArguments(args) {
  const options = {
    root: defaultRoot,
    manifestPath: defaultManifestPath,
  };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    const value = args[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${argument}.`);
    }
    index += 1;
    if (argument === '--root') {
      options.root = value;
    } else if (argument === '--manifest') {
      options.manifestPath = value;
    } else if (argument === '--staging') {
      options.stagingPath = value;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  if (!options.stagingPath) {
    throw new Error('--staging is required.');
  }

  const root = resolve(options.root);
  return {
    root,
    manifestPath: isAbsolute(options.manifestPath)
      ? resolve(options.manifestPath)
      : resolve(root, options.manifestPath),
    stagingPath: isAbsolute(options.stagingPath)
      ? resolve(options.stagingPath)
      : resolve(root, options.stagingPath),
  };
}

async function main() {
  const result = await prepareRegistryPackage(parseArguments(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify({
    packageName: result.manifest.packageName,
    packageVersion: result.manifest.packageVersion,
    stagingPath: result.stagingPath,
    copiedFileCount: result.copiedFileCount,
  })}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  main().catch((error) => {
    process.stderr.write(`Error: ${error.message}\n`);
    process.exitCode = 1;
  });
}
