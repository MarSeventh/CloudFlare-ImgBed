import { HUB_URL } from "../consts";
import { createApiError } from "../error";
import type { CredentialsParams, RepoDesignation } from "../types/public";
import { checkCredentials } from "../utils/checkCredentials";
import { toRepoId } from "../utils/toRepoId";

export async function countCommits(
	params: {
		repo: RepoDesignation;
		/**
		 * Revision to list commits from. Defaults to the default branch.
		 */
		revision?: string;
		hubUrl?: string;
		fetch?: typeof fetch;
	} & Partial<CredentialsParams>
): Promise<number> {
	const accessToken = checkCredentials(params);
	const repoId = toRepoId(params.repo);

	// Could upgrade to 1000 commits per page
	const url: string | undefined = `${params.hubUrl ?? HUB_URL}/api/${repoId.type}s/${repoId.name}/commits/${
		params.revision ?? "main"
	}?limit=1`;

	const res: Response = await (params.fetch ?? fetch)(url, {
		headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
	});

	if (!res.ok) {
		throw await createApiError(res);
	}

	return parseInt(res.headers.get("x-total-count") ?? "0", 10);
}
