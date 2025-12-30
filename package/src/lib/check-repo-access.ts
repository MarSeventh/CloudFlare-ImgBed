import { HUB_URL } from "../consts";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { createApiError, type HubApiError } from "../error";
import type { CredentialsParams, RepoDesignation } from "../types/public";
import { checkCredentials } from "../utils/checkCredentials";
import { toRepoId } from "../utils/toRepoId";

/**
 * Check if we have read access to a repository.
 *
 * Throw a {@link HubApiError} error if we don't have access. HubApiError.statusCode will be 401, 403 or 404.
 */
export async function checkRepoAccess(
	params: {
		repo: RepoDesignation;
		hubUrl?: string;
		fetch?: typeof fetch;
	} & Partial<CredentialsParams>
): Promise<void> {
	const accessToken = params && checkCredentials(params);
	const repoId = toRepoId(params.repo);

	const response = await (params.fetch || fetch)(`${params?.hubUrl || HUB_URL}/api/${repoId.type}s/${repoId.name}`, {
		headers: {
			...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
		},
	});

	if (!response.ok) {
		throw await createApiError(response);
	}
}
