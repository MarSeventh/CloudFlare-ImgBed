import { appendFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { readBuildManifest } from './prepare-registry-package.mjs';

const scriptPath = fileURLToPath(import.meta.url);
const defaultRoot = resolve(dirname(scriptPath), '..');
const defaultManifestPath = join('frontend-dist', '.sanyue-build.json');
const defaultRegistryUrl = 'https://registry.npmjs.org/';

function createResult(manifest, status) {
  return {
    status,
    packageName: manifest.packageName,
    packageVersion: manifest.packageVersion,
    shouldPublish: status === 'unpublished',
    shouldSkip: status === 'matched',
  };
}

export function buildRegistryVersionUrl(registryUrl, manifest) {
  const baseUrl = new URL(registryUrl.endsWith('/') ? registryUrl : `${registryUrl}/`);
  const packagePath = encodeURIComponent(manifest.packageName);
  const versionPath = encodeURIComponent(manifest.packageVersion);
  return new URL(`${packagePath}/${versionPath}`, baseUrl);
}

export async function inspectRegistryVersion(manifest, options = {}) {
  const fetchImplementation = options.fetchImplementation || globalThis.fetch;
  if (typeof fetchImplementation !== 'function') {
    throw new Error('A Fetch API implementation is required.');
  }

  const registryUrl = options.registryUrl || defaultRegistryUrl;
  const requestUrl = buildRegistryVersionUrl(registryUrl, manifest);
  const response = await fetchImplementation(requestUrl, {
    headers: {
      accept: 'application/json',
      'cache-control': 'no-cache',
    },
    signal: options.signal || AbortSignal.timeout(10_000),
  });

  if (response.status === 404) {
    return createResult(manifest, 'unpublished');
  }
  if (!response.ok) {
    throw new Error(
      `Registry request failed for ${manifest.packageName}@${manifest.packageVersion}: `
      + `${response.status} ${response.statusText}.`,
    );
  }

  let metadata;
  try {
    metadata = await response.json();
  } catch {
    throw new Error(
      `Registry returned invalid JSON for ${manifest.packageName}@${manifest.packageVersion}.`,
    );
  }

  const publishedBuild = metadata?.sanyueBuild;
  if (publishedBuild?.commit === manifest.commit
    && publishedBuild?.frontendDistSha256 === manifest.frontendDistSha256) {
    return createResult(manifest, 'matched');
  }
  return createResult(manifest, 'conflict');
}

export async function writeGitHubOutputs(outputPath, result) {
  const outputs = {
    package_name: result.packageName,
    package_version: result.packageVersion,
    registry_status: result.status,
    should_publish: String(result.shouldPublish),
    should_skip: String(result.shouldSkip),
  };
  const content = Object.entries(outputs)
    .map(([name, value]) => `${name}=${value}\n`)
    .join('');
  await appendFile(outputPath, content, 'utf8');
}

function parseArguments(args) {
  const options = {
    root: defaultRoot,
    manifestPath: defaultManifestPath,
    registryUrl: process.env.NPM_CONFIG_REGISTRY || defaultRegistryUrl,
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
    } else if (argument === '--registry-url') {
      options.registryUrl = value;
    } else if (argument === '--github-output') {
      options.githubOutput = value;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }

  const root = resolve(options.root);
  return {
    root,
    manifestPath: isAbsolute(options.manifestPath)
      ? resolve(options.manifestPath)
      : resolve(root, options.manifestPath),
    registryUrl: options.registryUrl,
    githubOutput: options.githubOutput
      ? resolve(options.githubOutput)
      : null,
  };
}

function printResult(result) {
  const identity = `${result.packageName}@${result.packageVersion}`;
  if (result.status === 'unpublished') {
    process.stdout.write(`Registry version ${identity} is unpublished.\n`);
    return;
  }
  if (result.status === 'matched') {
    process.stdout.write(`Registry version ${identity} matches and can be skipped.\n`);
    return;
  }
  process.stdout.write(`Registry version ${identity} conflicts with the build manifest.\n`);
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const manifest = await readBuildManifest(options.manifestPath);
  const result = await inspectRegistryVersion(manifest, {
    registryUrl: options.registryUrl,
  });
  if (options.githubOutput) {
    await writeGitHubOutputs(options.githubOutput, result);
  }
  printResult(result);
  if (result.status === 'conflict') {
    throw new Error(
      `Published ${result.packageName}@${result.packageVersion} has a different commit or `
      + 'frontend-dist digest.',
    );
  }
}

if (process.argv[1] && resolve(process.argv[1]) === scriptPath) {
  main().catch((error) => {
    process.stderr.write(`Error: ${error.message}\n`);
    process.exitCode = 1;
  });
}
