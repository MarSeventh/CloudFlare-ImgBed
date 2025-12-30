import type { Stats } from "node:fs";
import type { RepoType, RepoId } from "../types/public";
export declare function getHFHubCachePath(): string;
export declare const REPO_ID_SEPARATOR: string;
export declare function getRepoFolderName({ name, type }: RepoId): string;
export interface CachedFileInfo {
    path: string;
    /**
     * Underlying file - which `path` is symlinked to
     */
    blob: {
        size: number;
        path: string;
        lastModifiedAt: Date;
        lastAccessedAt: Date;
    };
}
export interface CachedRevisionInfo {
    commitOid: string;
    path: string;
    size: number;
    files: CachedFileInfo[];
    refs: string[];
    lastModifiedAt: Date;
}
export interface CachedRepoInfo {
    id: RepoId;
    path: string;
    size: number;
    filesCount: number;
    revisions: CachedRevisionInfo[];
    lastAccessedAt: Date;
    lastModifiedAt: Date;
}
export interface HFCacheInfo {
    size: number;
    repos: CachedRepoInfo[];
    warnings: Error[];
}
export declare function scanCacheDir(cacheDir?: string | undefined): Promise<HFCacheInfo>;
export declare function scanCachedRepo(repoPath: string): Promise<CachedRepoInfo>;
export declare function scanRefsDir(refsPath: string, refsByHash: Map<string, string[]>): Promise<void>;
export declare function scanSnapshotDir(revisionPath: string, cachedFiles: CachedFileInfo[], blobStats: Map<string, Stats>): Promise<void>;
export declare function getBlobStat(blobPath: string, blobStats: Map<string, Stats>): Promise<Stats>;
export declare function parseRepoType(type: string): RepoType;
//# sourceMappingURL=cache-management.d.ts.map