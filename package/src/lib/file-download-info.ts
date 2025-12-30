import { HUB_URL } from "../consts";
import { createApiError, InvalidApiResponseFormatError } from "../error";
import type { CredentialsParams, RepoDesignation } from "../types/public";
import { checkCredentials } from "../utils/checkCredentials";
import { parseLinkHeader } from "../utils/parseLinkHeader";
import { toRepoId } from "../utils/toRepoId";

export interface XetFileInfo {
	hash: string;
	refreshUrl: URL;
	/**
	 * Can be directly used instead of the hash.
	 */
	reconstructionUrl: URL;
}

export interface FileDownloadInfoOutput {
	size: number;
	etag: string;
	xet?: XetFileInfo;
	// URL to fetch (with the access token if private file)
	url: string;
}
/**
 * @returns null when the file doesn't exist
 */
export async function fileDownloadInfo(
	params: {
		repo: RepoDesignation;
		path: string;
		revision?: string;
		hubUrl?: string;
		/**
		 * Custom fetch function to use instead of the default one, for example to use a proxy or edit headers.
		 */
		fetch?: typeof fetch;
		/**
		 * To get the raw pointer file behind a LFS file
		 */
		raw?: boolean;
		/**
		 * To avoid the content-disposition header in the `downloadLink` for LFS files
		 *
		 * So that on browsers you can use the URL in an iframe for example
		 */
		noContentDisposition?: boolean;
	} & Partial<CredentialsParams>
): Promise<FileDownloadInfoOutput | null> {
	const accessToken = checkCredentials(params);
	const repoId = toRepoId(params.repo);

	const hubUrl = params.hubUrl ?? HUB_URL;
	const url =
		`${hubUrl}/${repoId.type === "model" ? "" : `${repoId.type}s/`}${repoId.name}/${
			params.raw ? "raw" : "resolve"
		}/${encodeURIComponent(params.revision ?? "main")}/${params.path}` +
		(params.noContentDisposition ? "?noContentDisposition=1" : "");

	const resp = await (params.fetch ?? fetch)(url, {
		method: "GET",
		headers: {
			...(accessToken && {
				Authorization: `Bearer ${accessToken}`,
			}),
			Range: "bytes=0-0",
			Accept: "application/vnd.xet-fileinfo+json, */*",
		},
	});

	if (resp.status === 404 && resp.headers.get("X-Error-Code") === "EntryNotFound") {
		return null;
	}

	if (!resp.ok) {
		throw await createApiError(resp);
	}

	let size: number | undefined;
	let xetInfo: XetFileInfo | undefined;

	if (resp.headers.get("Content-Type")?.includes("application/vnd.xet-fileinfo+json")) {
		size = parseInt(resp.headers.get("X-Linked-Size") ?? "invalid");
		if (isNaN(size)) {
			throw new InvalidApiResponseFormatError("Invalid file size received in X-Linked-Size header");
		}

		const hash = resp.headers.get("X-Xet-Hash");
		const links = parseLinkHeader(resp.headers.get("Link") ?? "");

		const reconstructionUrl = (() => {
			try {
				return new URL(links["xet-reconstruction-info"]);
			} catch {
				return null;
			}
		})();
		const refreshUrl = (() => {
			try {
				return new URL(links["xet-auth"]);
			} catch {
				return null;
			}
		})();

		if (!hash) {
			throw new InvalidApiResponseFormatError("No hash received in X-Xet-Hash header");
		}

		if (!reconstructionUrl || !refreshUrl) {
			throw new InvalidApiResponseFormatError("No xet-reconstruction-info or xet-auth link header");
		}
		xetInfo = {
			hash,
			refreshUrl,
			reconstructionUrl,
		};
	}

	if (size === undefined || isNaN(size)) {
		const contentRangeHeader = resp.headers.get("content-range");

		if (!contentRangeHeader) {
			throw new InvalidApiResponseFormatError("Expected size information");
		}

		const [, parsedSize] = contentRangeHeader.split("/");
		size = parseInt(parsedSize);

		if (isNaN(size)) {
			throw new InvalidApiResponseFormatError("Invalid file size received");
		}
	}

	const etag = resp.headers.get("X-Linked-ETag") ?? resp.headers.get("ETag") ?? undefined;

	if (!etag) {
		throw new InvalidApiResponseFormatError("Expected ETag");
	}

	return {
		etag,
		size,
		xet: xetInfo,
		// Cannot use resp.url in case it's a S3 url and the user adds an Authorization header to it.
		url:
			resp.url &&
			(new URL(resp.url).origin === new URL(hubUrl).origin || resp.headers.get("X-Cache")?.endsWith(" cloudfront"))
				? resp.url
				: url,
	};
}
