import type { CredentialsParams, RepoDesignation } from "../types/public";
import { listFiles } from "./list-files";
import { getHFHubCachePath, getRepoFolderName } from "./cache-management";
import { spaceInfo } from "./space-info";
import { datasetInfo } from "./dataset-info";
import { modelInfo } from "./model-info";
import { toRepoId } from "../utils/toRepoId";
import { join, dirname } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { downloadFileToCacheDir } from "./download-file-to-cache-dir";

export const DEFAULT_REVISION = "main";

/**
 * Downloads an entire repository at a given revision in the cache directory {@link getHFHubCachePath}.
 * You can list all cached repositories using {@link scanCachedRepo}
 * @remarks It uses internally {@link downloadFileToCacheDir}.
 */
export async function snapshotDownload(
	params: {
		repo: RepoDesignation;
		cacheDir?: string;
		/**
		 * An optional Git revision id which can be a branch name, a tag, or a commit hash.
		 *
		 * @default "main"
		 */
		revision?: string;
		hubUrl?: string;
		/**
		 * Custom fetch function to use instead of the default one, for example to use a proxy or edit headers.
		 */
		fetch?: typeof fetch;
	} & Partial<CredentialsParams>
): Promise<string> {
	let cacheDir: string;
	if (params.cacheDir) {
		cacheDir = params.cacheDir;
	} else {
		cacheDir = getHFHubCachePath();
	}

	let revision: string;
	if (params.revision) {
		revision = params.revision;
	} else {
		revision = DEFAULT_REVISION;
	}

	const repoId = toRepoId(params.repo);

	// get repository revision value (sha)
	let repoInfo: { sha: string };
	switch (repoId.type) {
		case "space":
			repoInfo = await spaceInfo({
				...params,
				name: repoId.name,
				additionalFields: ["sha"],
				revision: revision,
			});
			break;
		case "dataset":
			repoInfo = await datasetInfo({
				...params,
				name: repoId.name,
				additionalFields: ["sha"],
				revision: revision,
			});
			break;
		case "model":
			repoInfo = await modelInfo({
				...params,
				name: repoId.name,
				additionalFields: ["sha"],
				revision: revision,
			});
			break;
		default:
			throw new Error(`invalid repository type ${repoId.type}`);
	}

	const commitHash: string = repoInfo.sha;

	// get storage folder
	const storageFolder = join(cacheDir, getRepoFolderName(repoId));
	const snapshotFolder = join(storageFolder, "snapshots", commitHash);

	// if passed revision is not identical to commit_hash
	// then revision has to be a branch name or tag name.
	// In that case store a ref.
	if (revision !== commitHash) {
		const refPath = join(storageFolder, "refs", revision);
		await mkdir(dirname(refPath), { recursive: true });
		await writeFile(refPath, commitHash);
	}

	const cursor = listFiles({
		...params,
		repo: params.repo,
		recursive: true,
		revision: repoInfo.sha,
	});

	for await (const entry of cursor) {
		switch (entry.type) {
			case "file":
				await downloadFileToCacheDir({
					...params,
					path: entry.path,
					revision: commitHash,
					cacheDir: cacheDir,
				});
				break;
			case "directory":
				await mkdir(join(snapshotFolder, entry.path), { recursive: true });
				break;
			default:
				throw new Error(`unknown entry type: ${entry.type}`);
		}
	}

	return snapshotFolder;
}
