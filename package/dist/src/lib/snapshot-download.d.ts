import type { CredentialsParams, RepoDesignation } from "../types/public";
export declare const DEFAULT_REVISION = "main";
/**
 * Downloads an entire repository at a given revision in the cache directory {@link getHFHubCachePath}.
 * You can list all cached repositories using {@link scanCachedRepo}
 * @remarks It uses internally {@link downloadFileToCacheDir}.
 */
export declare function snapshotDownload(params: {
    repo: RepoDesignation;
    cacheDir?: string;
    /**
     * An optional Git revision id which can be a branch name, a tag, or a commit hash.
     *
     * @default "main"
     */
    revision?: string;
    hubUrl?: string;
    /**
     * Custom fetch function to use instead of the default one, for example to use a proxy or edit headers.
     */
    fetch?: typeof fetch;
} & Partial<CredentialsParams>): Promise<string>;
//# sourceMappingURL=snapshot-download.d.ts.map