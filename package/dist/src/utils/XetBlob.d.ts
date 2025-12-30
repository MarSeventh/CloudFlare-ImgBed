import type { CredentialsParams } from "../types/public";
type XetBlobCreateOptions = {
    /**
     * Custom fetch function to use instead of the default one, for example to use a proxy or edit headers.
     */
    fetch?: typeof fetch;
    refreshUrl: string;
    size: number;
    listener?: (arg: {
        event: "read";
    } | {
        event: "progress";
        progress: {
            read: number;
            total: number;
        };
    }) => void;
    internalLogging?: boolean;
} & ({
    hash: string;
    reconstructionUrl?: string;
} | {
    hash?: string;
    reconstructionUrl: string;
}) & Partial<CredentialsParams>;
export interface ReconstructionInfo {
    /**
     * List of CAS blocks
     */
    terms: Array<{
        /** Hash of the CAS block */
        hash: string;
        /** Total uncompressed length of data of the chunks from range.start to range.end - 1 */
        unpacked_length: number;
        /** Chunks. Eg start: 10, end: 100 = chunks 10-99 */
        range: {
            start: number;
            end: number;
        };
    }>;
    /**
     * Dictionnary of CAS block hash => list of ranges in the block + url to fetch it
     */
    fetch_info: Record<string, Array<{
        url: string;
        /** Chunk range */
        range: {
            start: number;
            end: number;
        };
        /**
         * Byte range, when making the call to the URL.
         *
         * We assume that we're given non-overlapping ranges for each hash
         */
        url_range: {
            start: number;
            end: number;
        };
    }>>;
    /**
     * When doing a range request, the offset into the term's uncompressed data. Can be multiple chunks' worth of data.
     */
    offset_into_first_range: number;
}
export declare enum XetChunkCompressionScheme {
    None = 0,
    LZ4 = 1,
    ByteGroupingLZ4 = 2
}
export declare const XET_CHUNK_HEADER_BYTES = 8;
/**
 * XetBlob is a blob implementation that fetches data directly from the Xet storage
 */
export declare class XetBlob extends Blob {
    #private;
    fetch: typeof fetch;
    accessToken?: string;
    refreshUrl: string;
    reconstructionUrl?: string;
    hash?: string;
    start: number;
    end: number;
    internalLogging: boolean;
    reconstructionInfo: ReconstructionInfo | undefined;
    listener: XetBlobCreateOptions["listener"];
    constructor(params: XetBlobCreateOptions);
    get size(): number;
    slice(start?: number, end?: number): XetBlob;
    arrayBuffer(): Promise<ArrayBuffer>;
    text(): Promise<string>;
    response(): Promise<Response>;
    stream(): ReturnType<Blob["stream"]>;
}
export declare function bg4_regroup_bytes(bytes: Uint8Array): Uint8Array;
export declare function bg4_split_bytes(bytes: Uint8Array): Uint8Array;
export {};
//# sourceMappingURL=XetBlob.d.ts.map