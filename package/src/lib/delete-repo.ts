import { HUB_URL } from "../consts";
import { createApiError } from "../error";
import type { CredentialsParams, RepoDesignation } from "../types/public";
import { checkCredentials } from "../utils/checkCredentials";
import { toRepoId } from "../utils/toRepoId";

export async function deleteRepo(
	params: {
		repo: RepoDesignation;
		hubUrl?: string;
		/**
		 * Custom fetch function to use instead of the default one, for example to use a proxy or edit headers.
		 */
		fetch?: typeof fetch;
	} & CredentialsParams
): Promise<void> {
	const accessToken = checkCredentials(params);
	const repoId = toRepoId(params.repo);
	const [namespace, repoName] = repoId.name.split("/");

	const res = await (params.fetch ?? fetch)(`${params.hubUrl ?? HUB_URL}/api/repos/delete`, {
		method: "DELETE",
		body: JSON.stringify({
			name: repoName,
			organization: namespace,
			type: repoId.type,
		}),
		headers: {
			Authorization: `Bearer ${accessToken}`,
			"Content-Type": "application/json",
		},
	});

	if (!res.ok) {
		throw await createApiError(res);
	}
}
