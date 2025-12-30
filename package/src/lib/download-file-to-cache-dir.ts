import { getHFHubCachePath, getRepoFolderName } from "./cache-management";
import { dirname, join } from "node:path";
import { rename, lstat, mkdir, stat } from "node:fs/promises";
import type { CommitInfo, PathInfo } from "./paths-info";
import { pathsInfo } from "./paths-info";
import type { CredentialsParams, RepoDesignation } from "../types/public";
import { toRepoId } from "../utils/toRepoId";
import { downloadFile } from "./download-file";
import { createSymlink } from "../utils/symlink";
import { Readable } from "node:stream";
import type { ReadableStream } from "node:stream/web";
import { pipeline } from "node:stream/promises";
import { createWriteStream } from "node:fs";

export const REGEX_COMMIT_HASH: RegExp = new RegExp("^[0-9a-f]{40}$");

function getFilePointer(storageFolder: string, revision: string, relativeFilename: string): string {
	const snapshotPath = join(storageFolder, "snapshots");
	return join(snapshotPath, revision, relativeFilename);
}

/**
 * handy method to check if a file exists, or the pointer of a symlinks exists
 * @param path
 * @param followSymlinks
 */
async function exists(path: string, followSymlinks?: boolean): Promise<boolean> {
	try {
		if (followSymlinks) {
			await stat(path);
		} else {
			await lstat(path);
		}
		return true;
	} catch (err: unknown) {
		return false;
	}
}

/**
 * Download a given file if it's not already present in the local cache.
 * @param params
 * @return the symlink to the blob object
 */
export async function downloadFileToCacheDir(
	params: {
		repo: RepoDesignation;
		path: string;
		/**
		 * If true, will download the raw git file.
		 *
		 * For example, when calling on a file stored with Git LFS, the pointer file will be downloaded instead.
		 */
		raw?: boolean;
		/**
		 * An optional Git revision id which can be a branch name, a tag, or a commit hash.
		 *
		 * @default "main"
		 */
		revision?: string;
		hubUrl?: string;
		cacheDir?: string;
		/**
		 * Custom fetch function to use instead of the default one, for example to use a proxy or edit headers.
		 */
		fetch?: typeof fetch;
	} & Partial<CredentialsParams>
): Promise<string> {
	// get revision provided or default to main
	const revision = params.revision ?? "main";
	const cacheDir = params.cacheDir ?? getHFHubCachePath();
	// get repo id
	const repoId = toRepoId(params.repo);
	// get storage folder
	const storageFolder = join(cacheDir, getRepoFolderName(repoId));

	let commitHash: string | undefined;

	// if user provides a commitHash as revision, and they already have the file on disk, shortcut everything.
	if (REGEX_COMMIT_HASH.test(revision)) {
		commitHash = revision;
		const pointerPath = getFilePointer(storageFolder, revision, params.path);
		if (await exists(pointerPath, true)) return pointerPath;
	}

	const pathsInformation: (PathInfo & { lastCommit: CommitInfo })[] = await pathsInfo({
		...params,
		paths: [params.path],
		revision: revision,
		expand: true,
	});
	if (!pathsInformation || pathsInformation.length !== 1) throw new Error(`cannot get path info for ${params.path}`);

	let etag: string;
	if (pathsInformation[0].lfs) {
		etag = pathsInformation[0].lfs.oid; // get the LFS pointed file oid
	} else {
		etag = pathsInformation[0].oid; // get the repo file if not a LFS pointer
	}

	const pointerPath = getFilePointer(storageFolder, commitHash ?? pathsInformation[0].lastCommit.id, params.path);
	const blobPath = join(storageFolder, "blobs", etag);

	// if we have the pointer file, we can shortcut the download
	if (await exists(pointerPath, true)) return pointerPath;

	// mkdir blob and pointer path parent directory
	await mkdir(dirname(blobPath), { recursive: true });
	await mkdir(dirname(pointerPath), { recursive: true });

	// We might already have the blob but not the pointer
	// shortcut the download if needed
	if (await exists(blobPath)) {
		// create symlinks in snapshot folder to blob object
		await createSymlink({ sourcePath: blobPath, finalPath: pointerPath });
		return pointerPath;
	}

	const incomplete = `${blobPath}.incomplete`;
	console.debug(`Downloading ${params.path} to ${incomplete}`);

	const blob: Blob | null = await downloadFile({
		...params,
		revision: commitHash,
	});

	if (!blob) {
		throw new Error(`invalid response for file ${params.path}`);
	}

	await pipeline(Readable.fromWeb(blob.stream() as ReadableStream), createWriteStream(incomplete));

	// rename .incomplete file to expect blob
	await rename(incomplete, blobPath);
	// create symlinks in snapshot folder to blob object
	await createSymlink({ sourcePath: blobPath, finalPath: pointerPath });
	return pointerPath;
}
