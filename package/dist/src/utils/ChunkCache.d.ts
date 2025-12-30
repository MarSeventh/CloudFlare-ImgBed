export declare class ChunkCache {
    index: number;
    xorbIndices: Int32Array;
    chunkIndices: Uint16Array;
    map: Map<string, number>;
    hmacs: Set<string>;
    maxSize: number;
    constructor(maxSize?: number);
    addChunkToCache(hash: string, xorbIndex: number, chunkIndex: number, hmac: string | null): void;
    getChunk(hash: string, 
    /**
     * Set to null if you only want to check against locally created chunks, or the hash is already a hmac
     */
    hmacFunction: ((hash: string, key: string) => string) | null): {
        xorbIndex: number;
        chunkIndex: number;
    } | undefined;
    updateChunkIndex(hash: string, chunkIndex: number): void;
    removeChunkFromCache(hash: string): void;
}
//# sourceMappingURL=ChunkCache.d.ts.map