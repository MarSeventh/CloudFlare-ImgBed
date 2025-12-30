import { HUB_URL } from "../consts";
import { createApiError } from "../error";
import type { RepoDesignation } from "../types/public";
import { toRepoId } from "../utils/toRepoId";

export async function repoExists(params: {
	repo: RepoDesignation;

	hubUrl?: string;
	/**
	 * An optional Git revision id which can be a branch name, a tag, or a commit hash.
	 */
	revision?: string;
	/**
	 * Custom fetch function to use instead of the default one, for example to use a proxy or edit headers.
	 */
	fetch?: typeof fetch;
	accessToken?: string;
}): Promise<boolean> {
	const repoId = toRepoId(params.repo);

	const res = await (params.fetch ?? fetch)(
		`${params.hubUrl ?? HUB_URL}/api/${repoId.type}s/${repoId.name}?expand[]=likes`,
		{
			method: "GET",
			headers: {
				...(params.accessToken && {
					Authorization: `Bearer ${params.accessToken}`,
				}),
			},
		}
	);

	if (res.status === 404 || res.status === 401) {
		return false;
	}

	if (!res.ok) {
		throw await createApiError(res);
	}

	return true;
}
