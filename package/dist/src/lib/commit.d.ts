import type { CredentialsParams, RepoDesignation } from "../types/public";
export interface CommitDeletedEntry {
    operation: "delete";
    path: string;
}
export type ContentSource = Blob | URL;
export interface CommitFile {
    operation: "addOrUpdate";
    path: string;
    content: ContentSource;
}
/**
 * Opitmized when only the beginning or the end of the file is replaced
 *
 * todo: handle other cases
 */
export interface CommitEditFile {
    operation: "edit";
    path: string;
    /** Later, will be ContentSource. For now simpler to just handle blobs */
    originalContent: Blob;
    edits: Array<{
        /**
         * Later, will be ContentSource. For now simpler to just handle blobs
         *
         * originalContent from [start, end) will be replaced by this
         */
        content: Blob;
        /**
         * The start position of the edit in the original content
         */
        start: number;
        /**
         * The end position of the edit in the original content
         *
         * originalContent from [start, end) will be replaced by the edit
         */
        end: number;
    }>;
}
export type CommitOperation = CommitDeletedEntry | CommitFile | CommitEditFile;
export type CommitParams = {
    title: string;
    description?: string;
    repo: RepoDesignation;
    operations: CommitOperation[];
    /** @default "main" */
    branch?: string;
    /**
     * Parent commit. Optional
     *
     * - When opening a PR: will use parentCommit as the parent commit
     * - When committing on a branch: Will make sure that there were no intermediate commits
     */
    parentCommit?: string;
    isPullRequest?: boolean;
    hubUrl?: string;
    /**
     * Whether to use web workers to compute SHA256 hashes.
     *
     * @default false
     */
    useWebWorkers?: boolean | {
        minSize?: number;
        poolSize?: number;
    };
    /**
     * Maximum depth of folders to upload. Files deeper than this will be ignored
     *
     * @default 5
     */
    maxFolderDepth?: number;
    /**
     * Custom fetch function to use instead of the default one, for example to use a proxy or edit headers.
     */
    fetch?: typeof fetch;
    abortSignal?: AbortSignal;
    /**
     * @default true
     *
     * Use xet protocol: https://huggingface.co/blog/xet-on-the-hub to upload, rather than a basic S3 PUT
     */
    useXet?: boolean;
} & Partial<CredentialsParams>;
export interface CommitOutput {
    pullRequestUrl?: string;
    commit: {
        oid: string;
        url: string;
    };
    hookOutput: string;
}
export type CommitProgressEvent = {
    event: "phase";
    phase: "preuploading" | "uploadingLargeFiles" | "committing";
} | {
    event: "fileProgress";
    path: string;
    progress: number;
    state: "hashing" | "uploading";
};
/**
 * Internal function for now, used by commit.
 *
 * Can be exposed later to offer fine-tuned progress info
 */
export declare function commitIter(params: CommitParams): AsyncGenerator<CommitProgressEvent, CommitOutput>;
export declare function commit(params: CommitParams): Promise<CommitOutput>;
//# sourceMappingURL=commit.d.ts.map