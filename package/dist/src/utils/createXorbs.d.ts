import { ChunkCache } from "./ChunkCache";
import { type XetWriteTokenParams } from "./xetWriteToken";
import type { ShardData } from "./shardParser";
interface XorbEvent {
    event: "xorb";
    xorb: Uint8Array;
    hash: string;
    id: number;
    chunks: Array<{
        hash: string;
        length: number;
    }>;
    files: Array<{
        path: string;
        progress: number;
        lastSentProgress: number;
    }>;
}
export declare class CurrentXorbInfo {
    id: number;
    offset: number;
    chunks: Array<{
        hash: string;
        length: number;
        offset: number;
    }>;
    fileProcessedBytes: Record<string, number>;
    fileUploadedBytes: Record<string, number>;
    fileSize: Record<string, number>;
    data: Uint8Array;
    immutableData: {
        chunkIndex: number;
        offset: number;
    } | null;
    constructor();
    event(computeXorbHash: (chunks: {
        hash: string;
        length: number;
    }[]) => string): XorbEvent;
}
export declare function createXorbs(fileSources: AsyncGenerator<{
    content: Blob;
    path: string;
    sha256: string;
}>, params: XetWriteTokenParams & {
    yieldCallback?: (event: {
        event: "fileProgress";
        path: string;
        progress: number;
    }) => void;
}): AsyncGenerator<XorbEvent | {
    event: "file";
    path: string;
    hash: string;
    sha256: string;
    /** Percentage of file bytes that were deduplicated (0-1) */
    dedupRatio: number;
    representation: Array<{
        xorbId: number | string;
        indexStart: number;
        indexEnd: number;
        /** Unpacked length */
        length: number;
        rangeHash: string;
    }>;
}, void, undefined>;
export declare function backtrackDedup(xorb: CurrentXorbInfo, computeHmac: (hash: string, key: string) => string, shardData: ShardData, chunkCache: ChunkCache, chunkMetadata: {
    xorbId: number | string;
    chunkIndex: number;
    length: number;
}[], dedupedBytes: number): number;
export {};
//# sourceMappingURL=createXorbs.d.ts.map