import { sum } from "./sum";

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
export class SplicedBlob extends Blob {
	public originalBlob: Blob;
	public spliceOperations: SpliceOperation[];

	private constructor(originalBlob: Blob, spliceOperations: SpliceOperation[]) {
		super();

		this.originalBlob = originalBlob;
		this.spliceOperations = spliceOperations; // Create a copy to prevent external mutation
	}

	static create(originalBlob: Blob, operations: SpliceOperation[]): SplicedBlob {
		// Validate all operations
		for (const op of operations) {
			if (op.start < 0 || op.end < 0) {
				throw new Error("Invalid start/end positions for SplicedBlob");
			}
			if (op.start > originalBlob.size || op.end > originalBlob.size) {
				throw new Error("Invalid start/end positions for SplicedBlob");
			}
			if (op.start > op.end) {
				throw new Error("Invalid start/end positions for SplicedBlob");
			}
		}

		// Sort operations by start position and validate no overlaps
		const sortedOps = [...operations].sort((a, b) => a.start - b.start);
		for (let i = 0; i < sortedOps.length - 1; i++) {
			if (sortedOps[i].end > sortedOps[i + 1].start) {
				throw new Error("Overlapping splice operations are not supported");
			}
		}

		return new SplicedBlob(originalBlob, sortedOps);
	}

	/**
	 * Returns the size of the spliced blob.
	 * Size = original size - total replaced size + total insert size
	 */
	override get size(): number {
		let totalReplacedSize = 0;
		let totalInsertSize = 0;

		for (const op of this.spliceOperations) {
			totalReplacedSize += op.end - op.start;
			totalInsertSize += op.insert.size;
		}

		return this.originalBlob.size - totalReplacedSize + totalInsertSize;
	}

	/**
	 * Returns the MIME type of the original blob.
	 */
	override get type(): string {
		return this.originalBlob.type;
	}

	/**
	 * Returns a new instance of SplicedBlob that is a slice of the current one.
	 *
	 * The slice is inclusive of the start and exclusive of the end.
	 * The slice method does not support negative start/end.
	 *
	 * @param start beginning of the slice
	 * @param end end of the slice
	 */
	override slice(start = 0, end = this.size): Blob {
		if (start < 0 || end < 0) {
			throw new TypeError("Unsupported negative start/end on SplicedBlob.slice");
		}

		start = Math.min(start, this.size);
		end = Math.min(end, this.size);

		if (start >= end) {
			return new Blob([]);
		}

		// Get all segments and calculate their cumulative positions
		const segments = this.segments;
		const segmentBoundaries: number[] = [0];
		let cumulativeSize = 0;

		for (const segment of segments) {
			cumulativeSize += segment.size;
			segmentBoundaries.push(cumulativeSize);
		}

		// Find which segments the slice spans
		const resultSegments: Blob[] = [];

		for (let i = 0; i < segments.length; i++) {
			const segmentStart = segmentBoundaries[i];
			const segmentEnd = segmentBoundaries[i + 1];

			// Skip segments that are entirely before the slice
			if (segmentEnd <= start) {
				continue;
			}

			// Skip segments that are entirely after the slice
			if (segmentStart >= end) {
				break;
			}

			// Calculate slice bounds within this segment
			const sliceStart = Math.max(0, start - segmentStart);
			const sliceEnd = Math.min(segments[i].size, end - segmentStart);

			if (sliceStart < sliceEnd) {
				resultSegments.push(segments[i].slice(sliceStart, sliceEnd));
			}
		}

		return new Blob(resultSegments);
	}

	get firstSpliceIndex(): number {
		return this.spliceOperations[0]?.start ?? Infinity;
	}

	/**
	 * Read the spliced blob content and returns it as an ArrayBuffer.
	 */
	override async arrayBuffer(): Promise<ArrayBuffer> {
		const segments = this.segments;
		const buffers = await Promise.all(segments.map((segment) => segment.arrayBuffer()));

		// Concatenate all buffers
		const totalSize = sum(buffers.map((buffer) => buffer.byteLength));
		const result = new Uint8Array(totalSize);

		let offset = 0;
		for (const buffer of buffers) {
			result.set(new Uint8Array(buffer), offset);
			offset += buffer.byteLength;
		}

		return result.buffer;
	}

	/**
	 * Read the spliced blob content and returns it as a string.
	 */
	override async text(): Promise<string> {
		const buffer = await this.arrayBuffer();
		return new TextDecoder().decode(buffer);
	}

	/**
	 * Returns a stream around the spliced blob content.
	 */
	override stream(): ReturnType<Blob["stream"]> {
		const readable = new ReadableStream({
			start: async (controller) => {
				try {
					const segments = this.segments;

					for (const segment of segments) {
						const reader = segment.stream().getReader();

						try {
							while (true) {
								const { done, value } = await reader.read();
								if (done) {
									break;
								}
								controller.enqueue(value);
							}
						} finally {
							reader.releaseLock();
						}
					}

					controller.close();
				} catch (error) {
					controller.error(error);
				}
			},
		});

		return readable;
	}

	/**
	 * Get all segments that make up the spliced blob.
	 * This includes original blob segments between splice operations and insert blobs.
	 */
	private get segments(): Blob[] {
		const segments: Blob[] = [];
		let currentPosition = 0;

		// Sort operations by start position to ensure correct order
		const sortedOps = [...this.spliceOperations].sort((a, b) => a.start - b.start);

		for (const op of sortedOps) {
			// Add segment from current position to start of this operation
			if (currentPosition < op.start) {
				segments.push(this.originalBlob.slice(currentPosition, op.start));
			}

			// Add the insert blob (if it has content)
			if (op.insert.size > 0) {
				segments.push(op.insert);
			}

			// Move current position to end of this operation
			currentPosition = op.end;
		}

		// Add remaining segment after last operation
		if (currentPosition < this.originalBlob.size) {
			segments.push(this.originalBlob.slice(currentPosition));
		}

		return segments;
	}
}
