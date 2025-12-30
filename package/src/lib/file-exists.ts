import { HUB_URL } from "../consts";
import { createApiError } from "../error";
import type { CredentialsParams, RepoDesignation } from "../types/public";
import { checkCredentials } from "../utils/checkCredentials";
import { toRepoId } from "../utils/toRepoId";

export async function fileExists(
	params: {
		repo: RepoDesignation;
		path: string;
		revision?: string;
		hubUrl?: string;
		/**
		 * Custom fetch function to use instead of the default one, for example to use a proxy or edit headers.
		 */
		fetch?: typeof fetch;
	} & Partial<CredentialsParams>
): Promise<boolean> {
	const accessToken = checkCredentials(params);
	const repoId = toRepoId(params.repo);

	const hubUrl = params.hubUrl ?? HUB_URL;
	const url = `${hubUrl}/${repoId.type === "model" ? "" : `${repoId.type}s/`}${repoId.name}/raw/${encodeURIComponent(
		params.revision ?? "main"
	)}/${params.path}`;

	const resp = await (params.fetch ?? fetch)(url, {
		method: "HEAD",
		headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
	});

	if (resp.status === 404) {
		return false;
	}

	if (!resp.ok) {
		throw await createApiError(resp);
	}

	return true;
}
