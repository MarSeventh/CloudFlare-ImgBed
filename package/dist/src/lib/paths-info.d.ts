import type { CredentialsParams, RepoDesignation } from "../types/public";
export interface LfsPathInfo {
    oid: string;
    size: number;
    pointerSize: number;
}
export interface CommitInfo {
    id: string;
    title: string;
    date: Date;
}
export interface SecurityFileStatus {
    status: string;
}
export interface PathInfo {
    path: string;
    type: string;
    oid: string;
    size: number;
    /**
     * Only defined when path is LFS pointer
     */
    lfs?: LfsPathInfo;
    lastCommit?: CommitInfo;
    securityFileStatus?: SecurityFileStatus;
}
export declare function pathsInfo(params: {
    repo: RepoDesignation;
    paths: string[];
    expand: true;
    revision?: string;
    hubUrl?: string;
    /**
     * Custom fetch function to use instead of the default one, for example to use a proxy or edit headers.
     */
    fetch?: typeof fetch;
} & Partial<CredentialsParams>): Promise<(PathInfo & {
    lastCommit: CommitInfo;
    securityFileStatus: SecurityFileStatus;
})[]>;
export declare function pathsInfo(params: {
    repo: RepoDesignation;
    paths: string[];
    expand?: boolean;
    revision?: string;
    hubUrl?: string;
    /**
     * Custom fetch function to use instead of the default one, for example to use a proxy or edit headers.
     */
    fetch?: typeof fetch;
} & Partial<CredentialsParams>): Promise<PathInfo[]>;
//# sourceMappingURL=paths-info.d.ts.map