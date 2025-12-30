import type { AccessToken, RepoDesignation } from "../types/public";
export declare function deleteBranch(params: {
    repo: RepoDesignation;
    /**
     * The name of the branch to delete
     */
    branch: string;
    hubUrl?: string;
    accessToken?: AccessToken;
    fetch?: typeof fetch;
}): Promise<void>;
//# sourceMappingURL=delete-branch.d.ts.map