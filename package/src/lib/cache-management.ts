import { homedir } from "node:os";
import { join, basename } from "node:path";
import { stat, readdir, readFile, realpath, lstat } from "node:fs/promises";
import type { Stats } from "node:fs";
import type { RepoType, RepoId } from "../types/public";

function getDefaultHome(): string {
	return join(homedir(), ".cache");
}

function getDefaultCachePath(): string {
	return join(process.env["HF_HOME"] ?? join(process.env["XDG_CACHE_HOME"] ?? getDefaultHome(), "huggingface"), "hub");
}

function getHuggingFaceHubCache(): string {
	return process.env["HUGGINGFACE_HUB_CACHE"] ?? getDefaultCachePath();
}

export function getHFHubCachePath(): string {
	return process.env["HF_HUB_CACHE"] ?? getHuggingFaceHubCache();
}

const FILES_TO_IGNORE: string[] = [".DS_Store"];

export const REPO_ID_SEPARATOR: string = "--";

export function getRepoFolderName({ name, type }: RepoId): string {
	const parts = [`${type}s`, ...name.split("/")];
	return parts.join(REPO_ID_SEPARATOR);
}

export interface CachedFileInfo {
	path: string;
	/**
	 * Underlying file - which `path` is symlinked to
	 */
	blob: {
		size: number;
		path: string;
		lastModifiedAt: Date;
		lastAccessedAt: Date;
	};
}

export interface CachedRevisionInfo {
	commitOid: string;
	path: string;
	size: number;
	files: CachedFileInfo[];
	refs: string[];

	lastModifiedAt: Date;
}

export interface CachedRepoInfo {
	id: RepoId;
	path: string;
	size: number;
	filesCount: number;
	revisions: CachedRevisionInfo[];

	lastAccessedAt: Date;
	lastModifiedAt: Date;
}

export interface HFCacheInfo {
	size: number;
	repos: CachedRepoInfo[];
	warnings: Error[];
}

export async function scanCacheDir(cacheDir: string | undefined = undefined): Promise<HFCacheInfo> {
	if (!cacheDir) cacheDir = getHFHubCachePath();

	const s = await stat(cacheDir);
	if (!s.isDirectory()) {
		throw new Error(
			`Scan cache expects a directory but found a file: ${cacheDir}. Please use \`cacheDir\` argument or set \`HF_HUB_CACHE\` environment variable.`
		);
	}

	const repos: CachedRepoInfo[] = [];
	const warnings: Error[] = [];

	const directories = await readdir(cacheDir);
	for (const repo of directories) {
		// skip .locks folder
		if (repo === ".locks") continue;

		// get the absolute path of the repo
		const absolute = join(cacheDir, repo);

		// ignore non-directory element
		const s = await stat(absolute);
		if (!s.isDirectory()) {
			continue;
		}

		try {
			const cached = await scanCachedRepo(absolute);
			repos.push(cached);
		} catch (err: unknown) {
			warnings.push(err as Error);
		}
	}

	return {
		repos: repos,
		size: [...repos.values()].reduce((sum, repo) => sum + repo.size, 0),
		warnings: warnings,
	};
}

export async function scanCachedRepo(repoPath: string): Promise<CachedRepoInfo> {
	// get the directory name
	const name = basename(repoPath);
	if (!name.includes(REPO_ID_SEPARATOR)) {
		throw new Error(`Repo path is not a valid HuggingFace cache directory: ${name}`);
	}

	// parse the repoId from directory name
	const [type, ...remaining] = name.split(REPO_ID_SEPARATOR);
	const repoType = parseRepoType(type);
	const repoId = remaining.join("/");

	const snapshotsPath = join(repoPath, "snapshots");
	const refsPath = join(repoPath, "refs");

	const snapshotStat = await stat(snapshotsPath);
	if (!snapshotStat.isDirectory()) {
		throw new Error(`Snapshots dir doesn't exist in cached repo ${snapshotsPath}`);
	}

	// Check if the refs directory exists and scan it
	const refsByHash: Map<string, string[]> = new Map();
	const refsStat = await stat(refsPath);
	if (refsStat.isDirectory()) {
		await scanRefsDir(refsPath, refsByHash);
	}

	// Scan snapshots directory and collect cached revision information
	const cachedRevisions: CachedRevisionInfo[] = [];
	const blobStats: Map<string, Stats> = new Map(); // Store blob stats

	const snapshotDirs = await readdir(snapshotsPath);
	for (const dir of snapshotDirs) {
		if (FILES_TO_IGNORE.includes(dir)) continue; // Ignore unwanted files

		const revisionPath = join(snapshotsPath, dir);
		const revisionStat = await stat(revisionPath);
		if (!revisionStat.isDirectory()) {
			throw new Error(`Snapshots folder corrupted. Found a file: ${revisionPath}`);
		}

		const cachedFiles: CachedFileInfo[] = [];
		await scanSnapshotDir(revisionPath, cachedFiles, blobStats);

		const revisionLastModified =
			cachedFiles.length > 0
				? Math.max(...[...cachedFiles].map((file) => file.blob.lastModifiedAt.getTime()))
				: revisionStat.mtimeMs;

		cachedRevisions.push({
			commitOid: dir,
			files: cachedFiles,
			refs: refsByHash.get(dir) || [],
			size: [...cachedFiles].reduce((sum, file) => sum + file.blob.size, 0),
			path: revisionPath,
			lastModifiedAt: new Date(revisionLastModified),
		});

		refsByHash.delete(dir);
	}

	// Verify that all refs refer to a valid revision
	if (refsByHash.size > 0) {
		throw new Error(
			`Reference(s) refer to missing commit hashes: ${JSON.stringify(Object.fromEntries(refsByHash))} (${repoPath})`
		);
	}

	const repoStats = await stat(repoPath);
	const repoLastAccessed =
		blobStats.size > 0 ? Math.max(...[...blobStats.values()].map((stat) => stat.atimeMs)) : repoStats.atimeMs;

	const repoLastModified =
		blobStats.size > 0 ? Math.max(...[...blobStats.values()].map((stat) => stat.mtimeMs)) : repoStats.mtimeMs;

	// Return the constructed CachedRepoInfo object
	return {
		id: {
			name: repoId,
			type: repoType,
		},
		path: repoPath,
		filesCount: blobStats.size,
		revisions: cachedRevisions,
		size: [...blobStats.values()].reduce((sum, stat) => sum + stat.size, 0),
		lastAccessedAt: new Date(repoLastAccessed),
		lastModifiedAt: new Date(repoLastModified),
	};
}

export async function scanRefsDir(refsPath: string, refsByHash: Map<string, string[]>): Promise<void> {
	const refFiles = await readdir(refsPath, { withFileTypes: true });
	for (const refFile of refFiles) {
		const refFilePath = join(refsPath, refFile.name);
		if (refFile.isDirectory()) continue; // Skip directories

		const commitHash = await readFile(refFilePath, "utf-8");
		const refName = refFile.name;
		if (!refsByHash.has(commitHash)) {
			refsByHash.set(commitHash, []);
		}
		refsByHash.get(commitHash)?.push(refName);
	}
}

export async function scanSnapshotDir(
	revisionPath: string,
	cachedFiles: CachedFileInfo[],
	blobStats: Map<string, Stats>
): Promise<void> {
	const files = await readdir(revisionPath, { withFileTypes: true });
	for (const file of files) {
		if (file.isDirectory()) continue; // Skip directories

		const filePath = join(revisionPath, file.name);
		const blobPath = await realpath(filePath);
		const blobStat = await getBlobStat(blobPath, blobStats);

		cachedFiles.push({
			path: filePath,
			blob: {
				path: blobPath,
				size: blobStat.size,
				lastAccessedAt: new Date(blobStat.atimeMs),
				lastModifiedAt: new Date(blobStat.mtimeMs),
			},
		});
	}
}

export async function getBlobStat(blobPath: string, blobStats: Map<string, Stats>): Promise<Stats> {
	const blob = blobStats.get(blobPath);
	if (!blob) {
		const statResult = await lstat(blobPath);
		blobStats.set(blobPath, statResult);
		return statResult;
	}
	return blob;
}

export function parseRepoType(type: string): RepoType {
	switch (type) {
		case "models":
			return "model";
		case "datasets":
			return "dataset";
		case "spaces":
			return "space";
		default:
			throw new TypeError(`Invalid repo type: ${type}`);
	}
}
