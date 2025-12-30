/**
 * Represents a single splice operation
 */
interface SpliceOperation {
    insert: Blob;
    start: number;
    end: number;
}
/**
 * @internal
 *
 * A SplicedBlob is a Blob that represents the result of splicing one or more insert blobs
 * into an original blob at specified positions, replacing content between start and end.
 *
 * It is a drop-in replacement for the Blob class, so you can use it as a Blob.
 * The splicing is done virtually without copying data until accessed.
 *
 * @example
 * const originalBlob = new Blob(["Hello, World!"]);
 * const insertBlob = new Blob(["Beautiful "]);
 * const splicedBlob = SplicedBlob.create(originalBlob, insertBlob, 7, 7);
 * // Result represents: "Hello, Beautiful World!"
 */
export declare class SplicedBlob extends Blob {
    originalBlob: Blob;
    spliceOperations: SpliceOperation[];
    private constructor();
    static create(originalBlob: Blob, operations: SpliceOperation[]): SplicedBlob;
    /**
     * Returns the size of the spliced blob.
     * Size = original size - total replaced size + total insert size
     */
    get size(): number;
    /**
     * Returns the MIME type of the original blob.
     */
    get type(): string;
    /**
     * Returns a new instance of SplicedBlob that is a slice of the current one.
     *
     * The slice is inclusive of the start and exclusive of the end.
     * The slice method does not support negative start/end.
     *
     * @param start beginning of the slice
     * @param end end of the slice
     */
    slice(start?: number, end?: number): Blob;
    get firstSpliceIndex(): number;
    /**
     * Read the spliced blob content and returns it as an ArrayBuffer.
     */
    arrayBuffer(): Promise<ArrayBuffer>;
    /**
     * Read the spliced blob content and returns it as a string.
     */
    text(): Promise<string>;
    /**
     * Returns a stream around the spliced blob content.
     */
    stream(): ReturnType<Blob["stream"]>;
    /**
     * Get all segments that make up the spliced blob.
     * This includes original blob segments between splice operations and insert blobs.
     */
    private get segments();
}
export {};
//# sourceMappingURL=SplicedBlob.d.ts.map