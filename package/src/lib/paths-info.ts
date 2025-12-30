import type { CredentialsParams, RepoDesignation } from "../types/public";
import { checkCredentials } from "../utils/checkCredentials";
import { toRepoId } from "../utils/toRepoId";
import { HUB_URL } from "../consts";
import { createApiError } from "../error";

export interface LfsPathInfo {
	oid: string;
	size: number;
	pointerSize: number;
}

export interface CommitInfo {
	id: string;
	title: string;
	date: Date;
}

export interface SecurityFileStatus {
	status: string;
}

export interface PathInfo {
	path: string;
	type: string;
	oid: string;
	size: number;
	/**
	 * Only defined when path is LFS pointer
	 */
	lfs?: LfsPathInfo;
	lastCommit?: CommitInfo;
	securityFileStatus?: SecurityFileStatus;
}

// Define the overloaded signatures
export function pathsInfo(
	params: {
		repo: RepoDesignation;
		paths: string[];
		expand: true; // if expand true
		revision?: string;
		hubUrl?: string;
		/**
		 * Custom fetch function to use instead of the default one, for example to use a proxy or edit headers.
		 */
		fetch?: typeof fetch;
	} & Partial<CredentialsParams>
): Promise<(PathInfo & { lastCommit: CommitInfo; securityFileStatus: SecurityFileStatus })[]>;
export function pathsInfo(
	params: {
		repo: RepoDesignation;
		paths: string[];
		expand?: boolean;
		revision?: string;
		hubUrl?: string;
		/**
		 * Custom fetch function to use instead of the default one, for example to use a proxy or edit headers.
		 */
		fetch?: typeof fetch;
	} & Partial<CredentialsParams>
): Promise<PathInfo[]>;

export async function pathsInfo(
	params: {
		repo: RepoDesignation;
		paths: string[];
		expand?: boolean;
		revision?: string;
		hubUrl?: string;
		/**
		 * Custom fetch function to use instead of the default one, for example to use a proxy or edit headers.
		 */
		fetch?: typeof fetch;
	} & Partial<CredentialsParams>
): Promise<PathInfo[]> {
	const accessToken = checkCredentials(params);
	const repoId = toRepoId(params.repo);

	const hubUrl = params.hubUrl ?? HUB_URL;

	const url = `${hubUrl}/api/${repoId.type}s/${repoId.name}/paths-info/${encodeURIComponent(
		params.revision ?? "main"
	)}`;

	const resp = await (params.fetch ?? fetch)(url, {
		method: "POST",
		headers: {
			...(accessToken && {
				Authorization: `Bearer ${accessToken}`,
			}),
			Accept: "application/json",
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			paths: params.paths,
			expand: params.expand,
		}),
	});

	if (!resp.ok) {
		throw await createApiError(resp);
	}

	const json: unknown = await resp.json();
	if (!Array.isArray(json)) throw new Error("malformed response: expected array");

	return json.map((item: PathInfo) => ({
		path: item.path,
		lfs: item.lfs,
		type: item.type,
		oid: item.oid,
		size: item.size,
		// expand fields
		securityFileStatus: item.securityFileStatus,
		lastCommit: item.lastCommit
			? {
					date: new Date(item.lastCommit.date),
					title: item.lastCommit.title,
					id: item.lastCommit.id,
			  }
			: undefined,
	}));
}
