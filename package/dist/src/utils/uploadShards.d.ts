import type { RepoId } from "../types/public";
export declare const SHARD_HEADER_VERSION = 2n;
export declare const SHARD_FOOTER_VERSION = 1n;
export declare const SHARD_MAGIC_TAG: Uint8Array<ArrayBuffer>;
export interface XetTokenParams {
    sessionId?: string;
    casUrl?: string;
    accessToken?: string;
    expiresAt?: Date;
    refreshWriteTokenUrl: string;
}
interface UploadShardsParams {
    accessToken: string | undefined;
    hubUrl: string;
    xetParams: XetTokenParams;
    fetch?: typeof fetch;
    repo: RepoId;
    rev: string;
    isPullRequest?: boolean;
    yieldCallback?: (event: {
        event: "fileProgress";
        path: string;
        progress: number;
    }) => void;
}
/**
 * Outputs the file sha256 after their xorbs/shards have been uploaded.
 */
export declare function uploadShards(source: AsyncGenerator<{
    content: Blob;
    path: string;
    sha256: string;
}>, params: UploadShardsParams): AsyncGenerator<{
    event: "file";
    path: string;
    sha256: string;
    dedupRatio: number;
} | {
    event: "fileProgress";
    path: string;
    progress: number;
}>;
export {};
//# sourceMappingURL=uploadShards.d.ts.map