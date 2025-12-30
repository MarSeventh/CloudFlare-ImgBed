import type { AccessToken, RepoDesignation } from "../types/public";
export declare function createBranch(params: {
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
}): Promise<void>;
//# sourceMappingURL=create-branch.d.ts.map