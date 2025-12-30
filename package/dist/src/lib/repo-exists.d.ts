import type { RepoDesignation } from "../types/public";
export declare function repoExists(params: {
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
}): Promise<boolean>;
//# sourceMappingURL=repo-exists.d.ts.map