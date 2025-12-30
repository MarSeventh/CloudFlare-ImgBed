import { HUB_URL } from "../consts";
import { createApiError } from "../error";
import type { AccessToken, RepoDesignation } from "../types/public";
import { toRepoId } from "../utils/toRepoId";

export async function createBranch(params: {
	repo: RepoDesignation;
	/**
	 * Revision to create the branch from. Defaults to the default branch.
	 *
	 * Use empty: true to create an empty branch.
	 */
	revision?: string;
	hubUrl?: string;
	accessToken?: AccessToken;
	fetch?: typeof fetch;
	/**
	 * The name of the branch to create
	 */
	branch: string;
	/**
	 * Use this to create an empty branch, with no commits.
	 */
	empty?: boolean;
	/**
	 * Use this to overwrite the branch if it already exists.
	 *
	 * If you only specify `overwrite` and no `revision`/`empty`, and the branch already exists, it will be a no-op.
	 */
	overwrite?: boolean;
}): Promise<void> {
	const repoId = toRepoId(params.repo);
	const res = await (params.fetch ?? fetch)(
		`${params.hubUrl ?? HUB_URL}/api/${repoId.type}s/${repoId.name}/branch/${encodeURIComponent(params.branch)}`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				...(params.accessToken && {
					Authorization: `Bearer ${params.accessToken}`,
				}),
			},
			body: JSON.stringify({
				startingPoint: params.revision,
				...(params.empty && { emptyBranch: true }),
				overwrite: params.overwrite,
			}),
		}
	);

	if (!res.ok) {
		throw await createApiError(res);
	}
}
