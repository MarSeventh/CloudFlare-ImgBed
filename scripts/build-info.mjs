import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { appendFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const SCRIPT_PATH = fileURLToPath(import.meta.url);
const DEFAULT_ROOT = resolve(dirname(SCRIPT_PATH), '..');
const MANIFEST_NAME = '.sanyue-build.json';
const SHA_PATTERN = /^[0-9a-f]{40}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const VERSION_PATTERN = /^\d+\.\d+\.\d+$/;

function comparePaths(left, right) {
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
}

function normalizeBoolean(value, name) {
    if (typeof value === 'boolean') return value;
    if (value === 'true') return true;
    if (value === 'false') return false;
    throw new Error(`${name} must be true or false.`);
}

function normalizeCommit(value) {
    const commit = String(value || '').trim().toLowerCase();
    if (!SHA_PATTERN.test(commit)) {
        throw new Error('Build commit must be a complete 40-character Git SHA.');
    }
    return commit;
}

function normalizeVersion(value) {
    const version = String(value || '').trim();
    if (!VERSION_PATTERN.test(version)) {
        throw new Error('Business version must use the stable x.y.z format.');
    }
    return version;
}

async function runGit(root, args) {
    const { stdout } = await execFileAsync('git', ['-C', root, ...args], {
        encoding: 'utf8',
        windowsHide: true,
    });
    return stdout.trim();
}

export async function resolveCommit(root, options = {}) {
    const candidates = [
        options.commit,
        options.env?.APP_COMMIT_SHA,
        options.env?.GITHUB_SHA,
        options.env?.CF_PAGES_COMMIT_SHA,
        options.env?.WORKERS_CI_COMMIT_SHA,
    ];
    const supplied = candidates.find(value => String(value || '').trim());
    if (supplied) return normalizeCommit(supplied);

    try {
        return normalizeCommit(await runGit(root, ['rev-parse', 'HEAD']));
    } catch {
        throw new Error('Unable to determine the build commit. Provide APP_COMMIT_SHA or --commit.');
    }
}

export async function resolveDirty(root, options = {}) {
    const supplied = options.dirty ?? options.env?.APP_BUILD_DIRTY;
    if (supplied !== undefined && supplied !== '') {
        return normalizeBoolean(supplied, 'Build dirty flag');
    }

    try {
        return Boolean(await runGit(root, ['status', '--porcelain=v1', '--untracked-files=all']));
    } catch {
        return true;
    }
}

async function collectFiles(directory, baseDirectory = directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        if (entry.name === MANIFEST_NAME && directory === baseDirectory) continue;
        const absolutePath = join(directory, entry.name);
        if (entry.isDirectory()) {
            files.push(...await collectFiles(absolutePath, baseDirectory));
        } else if (entry.isFile()) {
            files.push({
                absolutePath,
                relativePath: relative(baseDirectory, absolutePath).split(sep).join('/'),
            });
        } else {
            throw new Error(`Unsupported entry in frontend-dist: ${absolutePath}`);
        }
    }

    return files.sort((left, right) => comparePaths(left.relativePath, right.relativePath));
}

export async function hashFrontendDist(frontendDirectory) {
    const files = await collectFiles(frontendDirectory);
    if (files.length === 0) {
        throw new Error('frontend-dist must contain at least one file.');
    }

    const hash = createHash('sha256');
    for (const file of files) {
        hash.update(file.relativePath, 'utf8');
        hash.update('\0');
        for await (const chunk of createReadStream(file.absolutePath)) {
            hash.update(chunk);
        }
        hash.update('\0');
    }
    return hash.digest('hex');
}

export function validateBuildInfo(buildInfo) {
    if (buildInfo.schemaVersion !== 1) throw new Error('Unsupported build manifest schema.');
    if (!buildInfo.packageName || typeof buildInfo.packageName !== 'string') {
        throw new Error('Build package name is required.');
    }
    normalizeVersion(buildInfo.version);
    const commit = normalizeCommit(buildInfo.commit);
    if (buildInfo.buildId !== commit.slice(0, 20)) throw new Error('Build ID does not match the full commit.');
    if (buildInfo.packageVersion !== `${buildInfo.version}-commit.${buildInfo.buildId}`) {
        throw new Error('Package version does not match the build identity.');
    }
    if (typeof buildInfo.dirty !== 'boolean') throw new Error('Build dirty flag must be a boolean.');
    if (!SHA256_PATTERN.test(buildInfo.frontendDistSha256)) {
        throw new Error('frontend-dist digest must be a lowercase SHA-256 value.');
    }
    return buildInfo;
}

export async function createBuildInfo(options = {}) {
    const root = resolve(options.root || DEFAULT_ROOT);
    const packageJson = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
    const version = normalizeVersion(options.version || packageJson.version);
    const commit = await resolveCommit(root, options);
    const buildId = commit.slice(0, 20);
    const buildInfo = {
        schemaVersion: 1,
        packageName: packageJson.name,
        version,
        commit,
        buildId,
        packageVersion: `${version}-commit.${buildId}`,
        dirty: await resolveDirty(root, options),
        frontendDistSha256: await hashFrontendDist(join(root, 'frontend-dist')),
    };
    return validateBuildInfo(buildInfo);
}

export async function writeBuildManifest(path, buildInfo) {
    validateBuildInfo(buildInfo);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(buildInfo, null, 2)}\n`, 'utf8');
}

export async function writeGitHubOutputs(path, buildInfo) {
    const outputs = {
        version: buildInfo.version,
        commit: buildInfo.commit,
        build_id: buildInfo.buildId,
        package_version: buildInfo.packageVersion,
        frontend_dist_sha256: buildInfo.frontendDistSha256,
        dirty: String(buildInfo.dirty),
    };
    await appendFile(path, Object.entries(outputs).map(([key, value]) => `${key}=${value}\n`).join(''), 'utf8');
}

function parseArguments(args) {
    const options = { env: process.env, root: DEFAULT_ROOT };
    for (let index = 0; index < args.length; index += 1) {
        const argument = args[index];
        if (argument === '--write-manifest') {
            options.writeManifest = true;
            continue;
        }
        const value = args[index + 1];
        if (value === undefined) throw new Error(`Missing value for ${argument}.`);
        index += 1;
        if (argument === '--root') options.root = value;
        else if (argument === '--commit') options.commit = value;
        else if (argument === '--version') options.version = value;
        else if (argument === '--dirty') options.dirty = value;
        else if (argument === '--manifest') options.manifest = value;
        else if (argument === '--github-output') options.githubOutput = value;
        else throw new Error(`Unknown argument: ${argument}`);
    }
    return options;
}

async function main() {
    const options = parseArguments(process.argv.slice(2));
    const root = resolve(options.root);
    const buildInfo = await createBuildInfo({ ...options, root });
    if (options.writeManifest || options.manifest) {
        const manifestPath = resolve(root, options.manifest || join('frontend-dist', MANIFEST_NAME));
        await writeBuildManifest(manifestPath, buildInfo);
    }
    if (options.githubOutput) {
        await writeGitHubOutputs(resolve(options.githubOutput), buildInfo);
    }
    process.stdout.write(`${JSON.stringify(buildInfo)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === SCRIPT_PATH) {
    main().catch(error => {
        console.error(`Error: ${error.message}`);
        process.exitCode = 1;
    });
}
