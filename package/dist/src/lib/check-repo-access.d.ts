import type { CredentialsParams, RepoDesignation } from "../types/public";
/**
 * Check if we have read access to a repository.
 *
 * Throw a {@link HubApiError} error if we don't have access. HubApiError.statusCode will be 401, 403 or 404.
 */
export declare function checkRepoAccess(params: {
    repo: RepoDesignation;
    hubUrl?: string;
    fetch?: typeof fetch;
} & Partial<CredentialsParams>): Promise<void>;
//# sourceMappingURL=check-repo-access.d.ts.map