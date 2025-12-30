export interface ShardData {
    hmacKey: string;
    xorbs: Array<{
        hash: string;
        chunks: Array<{
            hash: string;
            startOffset: number;
            unpackedLength: number;
        }>;
    }>;
}
export declare function parseShardData(shardBlob: Blob): Promise<ShardData>;
//# sourceMappingURL=shardParser.d.ts.map