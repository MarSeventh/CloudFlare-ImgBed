import type { CredentialsParams, RepoDesignation } from "../types/public";
export declare function countCommits(params: {
    repo: RepoDesignation;
    /**
     * Revision to list commits from. Defaults to the default branch.
     */
    revision?: string;
    hubUrl?: string;
    fetch?: typeof fetch;
} & Partial<CredentialsParams>): Promise<number>;
//# sourceMappingURL=count-commits.d.ts.map