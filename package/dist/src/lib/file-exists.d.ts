import type { CredentialsParams, RepoDesignation } from "../types/public";
export declare function fileExists(params: {
    repo: RepoDesignation;
    path: string;
    revision?: string;
    hubUrl?: string;
    /**
     * Custom fetch function to use instead of the default one, for example to use a proxy or edit headers.
     */
    fetch?: typeof fetch;
} & Partial<CredentialsParams>): Promise<boolean>;
//# sourceMappingURL=file-exists.d.ts.map