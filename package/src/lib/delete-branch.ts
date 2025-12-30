import { HUB_URL } from "../consts";
import { createApiError } from "../error";
import type { AccessToken, RepoDesignation } from "../types/public";
import { toRepoId } from "../utils/toRepoId";

export async function deleteBranch(params: {
	repo: RepoDesignation;
	/**
	 * The name of the branch to delete
	 */
	branch: string;
	hubUrl?: string;
	accessToken?: AccessToken;
	fetch?: typeof fetch;
}): Promise<void> {
	const repoId = toRepoId(params.repo);
	const res = await (params.fetch ?? fetch)(
		`${params.hubUrl ?? HUB_URL}/api/${repoId.type}s/${repoId.name}/branch/${encodeURIComponent(params.branch)}`,
		{
			method: "DELETE",
			headers: {
				...(params.accessToken && {
					Authorization: `Bearer ${params.accessToken}`,
				}),
			},
		}
	);

	if (!res.ok) {
		throw await createApiError(res);
	}
}
