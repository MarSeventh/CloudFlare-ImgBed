import type { CredentialsParams, RepoDesignation } from "../types/public";
export declare const REGEX_COMMIT_HASH: RegExp;
/**
 * Download a given file if it's not already present in the local cache.
 * @param params
 * @return the symlink to the blob object
 */
export declare function downloadFileToCacheDir(params: {
    repo: RepoDesignation;
    path: string;
    /**
     * If true, will download the raw git file.
     *
     * For example, when calling on a file stored with Git LFS, the pointer file will be downloaded instead.
     */
    raw?: boolean;
    /**
     * An optional Git revision id which can be a branch name, a tag, or a commit hash.
     *
     * @default "main"
     */
    revision?: string;
    hubUrl?: string;
    cacheDir?: string;
    /**
     * Custom fetch function to use instead of the default one, for example to use a proxy or edit headers.
     */
    fetch?: typeof fetch;
} & Partial<CredentialsParams>): Promise<string>;
//# sourceMappingURL=download-file-to-cache-dir.d.ts.map