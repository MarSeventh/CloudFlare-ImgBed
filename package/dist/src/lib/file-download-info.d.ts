import type { CredentialsParams, RepoDesignation } from "../types/public";
export interface XetFileInfo {
    hash: string;
    refreshUrl: URL;
    /**
     * Can be directly used instead of the hash.
     */
    reconstructionUrl: URL;
}
export interface FileDownloadInfoOutput {
    size: number;
    etag: string;
    xet?: XetFileInfo;
    url: string;
}
/**
 * @returns null when the file doesn't exist
 */
export declare function fileDownloadInfo(params: {
    repo: RepoDesignation;
    path: string;
    revision?: string;
    hubUrl?: string;
    /**
     * Custom fetch function to use instead of the default one, for example to use a proxy or edit headers.
     */
    fetch?: typeof fetch;
    /**
     * To get the raw pointer file behind a LFS file
     */
    raw?: boolean;
    /**
     * To avoid the content-disposition header in the `downloadLink` for LFS files
     *
     * So that on browsers you can use the URL in an iframe for example
     */
    noContentDisposition?: boolean;
} & Partial<CredentialsParams>): Promise<FileDownloadInfoOutput | null>;
//# sourceMappingURL=file-download-info.d.ts.map