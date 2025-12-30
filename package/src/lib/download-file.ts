import type { CredentialsParams, RepoDesignation } from "../types/public";
import { checkCredentials } from "../utils/checkCredentials";
import { WebBlob } from "../utils/WebBlob";
import { XetBlob } from "../utils/XetBlob";
import type { FileDownloadInfoOutput } from "./file-download-info";
import { fileDownloadInfo } from "./file-download-info";

/**
 * @returns null when the file doesn't exist
 */
export async function downloadFile(
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
		/**
		 * Custom fetch function to use instead of the default one, for example to use a proxy or edit headers.
		 */
		fetch?: typeof fetch;
		/**
		 * Whether to use the xet protocol to download the file (if applicable).
		 *
		 * Currently there's experimental support for it, so it's not enabled by default.
		 *
		 * It will be enabled automatically in a future minor version.
		 *
		 * @default false
		 */
		xet?: boolean;
		/**
		 * Can save an http request if provided
		 */
		downloadInfo?: FileDownloadInfoOutput;
	} & Partial<CredentialsParams>
): Promise<Blob | null> {
	const accessToken = checkCredentials(params);

	const info =
		params.downloadInfo ??
		(await fileDownloadInfo({
			accessToken,
			repo: params.repo,
			path: params.path,
			revision: params.revision,
			hubUrl: params.hubUrl,
			fetch: params.fetch,
			raw: params.raw,
		}));

	if (!info) {
		return null;
	}

	if (info.xet && params.xet) {
		return new XetBlob({
			refreshUrl: info.xet.refreshUrl.href,
			reconstructionUrl: info.xet.reconstructionUrl.href,
			fetch: params.fetch,
			accessToken,
			size: info.size,
		});
	}

	return new WebBlob(new URL(info.url), 0, info.size, "", true, params.fetch ?? fetch, accessToken);
}
