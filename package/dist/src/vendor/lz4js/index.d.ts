export declare function compressBound(n: number): number;
export declare function decompressBound(src: Uint8Array): number;
export declare function decompressBlock(src: Uint8Array, dst: Uint8Array, sIndex: number, sLength: number, dIndex: number): number;
export declare function compressBlock(src: Uint8Array, dst: Uint8Array, sIndex: number, sLength: number, hashTable: Uint32Array | number[]): number;
export declare function decompressFrame(src: Uint8Array, dst: Uint8Array): number;
export declare function compressFrame(src: Uint8Array, dst: Uint8Array): number;
export declare function decompress(src: Uint8Array, maxSize: number): Uint8Array<ArrayBuffer>;
export declare function compress(src: Uint8Array, maxSize?: number): Uint8Array<ArrayBuffer>;
//# sourceMappingURL=index.d.ts.map