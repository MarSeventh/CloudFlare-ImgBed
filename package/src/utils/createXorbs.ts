import { bg4_split_bytes, XET_CHUNK_HEADER_BYTES, XetChunkCompressionScheme } from "./XetBlob";
import { compress as lz4_compress } from "../vendor/lz4js";
import { ChunkCache } from "./ChunkCache";
import { xetWriteToken, type XetWriteTokenParams } from "./xetWriteToken";
import type { ShardData } from "./shardParser";
import { parseShardData } from "./shardParser";
import { SplicedBlob } from "./SplicedBlob";

const TARGET_CHUNK_SIZE = 64 * 1024;
/* eslint-disable @typescript-eslint/no-unused-vars */
const MAX_CHUNK_SIZE = 2 * TARGET_CHUNK_SIZE;
const XORB_SIZE = 64 * 1024 * 1024;
const MAX_XORB_CHUNKS = 8 * 1024;
const INTERVAL_BETWEEN_REMOTE_DEDUP = 4_000_000; // 4MB
/**
 * 0 = only show progress when uploading the xorb
 * 1 = only show progress when processing the file
 * 0.5 = show progress when uploading the xorb and when processing the file
 */
const PROCESSING_PROGRESS_RATIO = 0.1;
const UPLOADING_PROGRESS_RATIO = 1 - PROCESSING_PROGRESS_RATIO;

interface XorbEvent {
	event: "xorb";
	xorb: Uint8Array;
	hash: string;
	id: number;
	chunks: Array<{ hash: string; length: number }>;
	files: Array<{
		path: string;
		progress: number;
		lastSentProgress: number;
	}>;
}

export class CurrentXorbInfo {
	id: number;
	offset: number;
	chunks: Array<{ hash: string; length: number; offset: number }>;

	fileProcessedBytes: Record<string, number>;
	fileUploadedBytes: Record<string, number>;
	fileSize: Record<string, number>;
	data: Uint8Array;
	immutableData: {
		chunkIndex: number;
		offset: number;
	} | null;

	constructor() {
		this.id = 0;
		this.offset = 0;
		this.chunks = [];
		this.fileProcessedBytes = {};
		this.fileUploadedBytes = {};
		this.fileSize = {};
		this.data = new Uint8Array(XORB_SIZE);
		this.immutableData = null;
	}

	event(computeXorbHash: (chunks: { hash: string; length: number }[]) => string): XorbEvent {
		const xorbChunksCleaned = this.chunks.map((chunk) => ({
			hash: chunk.hash,
			length: chunk.length,
		}));

		return {
			event: "xorb" as const,
			xorb: this.data.subarray(0, this.offset),
			hash: computeXorbHash(xorbChunksCleaned),
			chunks: xorbChunksCleaned,
			id: this.id,
			files: Object.entries(this.fileProcessedBytes).map(([path, processedBytes]) => ({
				path,
				progress: processedBytes / this.fileSize[path],
				lastSentProgress:
					((this.fileUploadedBytes[path] ?? 0) +
						(processedBytes - (this.fileUploadedBytes[path] ?? 0)) * PROCESSING_PROGRESS_RATIO) /
					this.fileSize[path],
			})),
		};
	}
}

export async function* createXorbs(
	fileSources: AsyncGenerator<{ content: Blob; path: string; sha256: string }>,
	params: XetWriteTokenParams & {
		yieldCallback?: (event: { event: "fileProgress"; path: string; progress: number }) => void;
	}
): AsyncGenerator<
	| XorbEvent
	| {
			event: "file";
			path: string;
			hash: string;
			sha256: string;
			/** Percentage of file bytes that were deduplicated (0-1) */
			dedupRatio: number;
			representation: Array<{
				xorbId: number | string; // either xorb id (for local xorbs) or xorb hash (for remote xorbs)
				indexStart: number;
				indexEnd: number;
				/** Unpacked length */
				length: number;
				rangeHash: string;
			}>;
	  },
	void,
	undefined
> {
	const alreadyDoneFileSha256s: Set<string> = new Set();
	const chunkModule = await import("../vendor/xet-chunk/chunker_wasm");
	let xorbId = 0;

	await chunkModule.init();
	const chunkCache = new ChunkCache();
	let xorb = new CurrentXorbInfo();

	const nextXorb = (currentFile: { path: string; uploadedBytes: number; size: number }): XorbEvent => {
		const event = xorb.event(chunkModule.compute_xorb_hash.bind(chunkModule));

		xorbId++;
		xorb = new CurrentXorbInfo();
		xorb.id = xorbId;
		xorb.fileUploadedBytes = {
			[currentFile.path]: currentFile.uploadedBytes,
		};
		xorb.fileSize[currentFile.path] = currentFile.size;

		return event;
	};

	const pendingFileEvents: Array<{
		event: "file";
		path: string;
		hash: string;
		dedupRatio: number;
		sha256: string;
		representation: Array<{
			xorbId: number | string;
			indexStart: number;
			indexEnd: number;
			length: number;
			rangeHash: string;
		}>;
	}> = [];

	const remoteXorbHashes: string[] = [""]; // starts at index 1 (to simplify implem a bit)

	for await (const fileSource of fileSources) {
		params.yieldCallback?.({
			event: "fileProgress",
			path: fileSource.path,
			progress: 0,
		});
		if (alreadyDoneFileSha256s.has(fileSource.sha256)) {
			params.yieldCallback?.({
				event: "fileProgress",
				path: fileSource.path,
				progress: 1,
			});
			continue;
		}
		alreadyDoneFileSha256s.add(fileSource.sha256);

		const chunker = new chunkModule.Chunker(TARGET_CHUNK_SIZE);
		try {
			xorb.fileSize[fileSource.path] = fileSource.content.size;

			// Load dedup info for the first chunk of the file, if it's potentially modified by the splice
			if (fileSource.content instanceof SplicedBlob && fileSource.content.firstSpliceIndex < MAX_CHUNK_SIZE) {
				await loadDedupInfoToCache(
					fileSource.content.originalBlob.slice(0, MAX_CHUNK_SIZE),
					remoteXorbHashes,
					params,
					chunkCache,
					chunkModule,
					{
						maxChunks: 1,
						isAtBeginning: true,
					}
				);
			}
			let bytesSinceRemoteDedup = Infinity;
			let bytesSinceLastProgressEvent = 0;
			let isFirstFileChunk = true;
			const sourceChunks: Array<Uint8Array> = [];

			const reader = fileSource.content.stream().getReader();
			let processedBytes = 0;
			let dedupedBytes = 0; // Track bytes that were deduplicated
			// Needed to compute the final file hash
			// todo: have the wasm function to compute file hash be able to take data chunk by chunk instead of all at once
			const fileChunks: Array<{ hash: string; length: number }> = [];
			// Collect chunk metadata to build representation at the end
			// todo: build partial representation at the end of each xorb, to avoid having to store all chunks in memory
			const chunkMetadata: Array<{
				xorbId: number | string;
				chunkIndex: number;
				length: number;
			}> = [];

			const addChunks = async function* (chunks: Array<{ hash: string; length: number; dedup: boolean }>) {
				for (const chunk of chunks) {
					if (isFirstFileChunk) {
						chunk.dedup = true;
						isFirstFileChunk = false;
					}
					let chunkIndex = xorb.chunks.length;
					let chunkXorbId = xorbId;

					// Remove chunks from source data
					const chunkToCopy = removeChunkFromSourceData(sourceChunks, chunk.length);

					let cacheData = chunkCache.getChunk(chunk.hash, chunkModule.compute_hmac);
					if (cacheData === undefined && chunk.dedup && bytesSinceRemoteDedup >= INTERVAL_BETWEEN_REMOTE_DEDUP) {
						const token = await xetWriteToken(params);
						bytesSinceRemoteDedup = 0;

						const shardResp = await (params.fetch ?? fetch)(token.casUrl + "/v1/chunks/default/" + chunk.hash, {
							headers: {
								Authorization: `Bearer ${token.accessToken}`,
							},
						});

						// todo: handle non-404 non-429 errors, eg throw error
						if (shardResp.ok) {
							const shard = await shardResp.blob();
							const shardData = await parseShardData(shard);

							for (const xorb of shardData.xorbs) {
								const remoteXorbId = -remoteXorbHashes.length;
								remoteXorbHashes.push(xorb.hash);
								let i = 0;
								for (const chunk of xorb.chunks) {
									chunkCache.addChunkToCache(chunk.hash, remoteXorbId, i++, shardData.hmacKey);
								}
							}
							cacheData = chunkCache.getChunk(chunk.hash, chunkModule.compute_hmac);

							// We backtrack a bit to check if new dedup info contains older chunks
							const oldDedupedBytes = dedupedBytes;
							dedupedBytes = backtrackDedup(
								xorb,
								chunkModule.compute_hmac.bind(chunkModule),
								shardData,
								chunkCache,
								chunkMetadata,
								dedupedBytes
							);

							if (dedupedBytes > oldDedupedBytes) {
								xorb.fileUploadedBytes[fileSource.path] ??= 0;
								xorb.fileUploadedBytes[fileSource.path] += dedupedBytes - oldDedupedBytes;
							}
						}
					}
					if (cacheData === undefined) {
						if (!writeChunk(xorb, chunkToCopy, chunk.hash)) {
							// Failure to write chunk, maybe because it went over xorb size limit
							yield nextXorb({ path: fileSource.path, uploadedBytes: processedBytes, size: fileSource.content.size });

							chunkIndex = 0;
							chunkXorbId = xorbId;

							for (const event of pendingFileEvents) {
								event.representation = event.representation.map((rep) => ({
									...rep,
									xorbId: (rep.xorbId as number) >= 0 ? rep.xorbId : remoteXorbHashes[-rep.xorbId],
								}));
								yield event;
							}
							pendingFileEvents.length = 0;

							if (!writeChunk(xorb, chunkToCopy, chunk.hash)) {
								throw new Error("Failed to write chunk into xorb");
							}
						}

						chunkCache.addChunkToCache(chunk.hash, xorbId, chunkIndex, null);
					} else {
						chunkXorbId = cacheData.xorbIndex;
						chunkIndex = cacheData.chunkIndex;
						dedupedBytes += chunk.length; // Track deduplicated bytes
						xorb.fileUploadedBytes[fileSource.path] ??= 0;
						xorb.fileUploadedBytes[fileSource.path] += chunk.length;
					}

					bytesSinceRemoteDedup += chunk.length;
					bytesSinceLastProgressEvent += chunk.length;

					// Collect metadata for building representation at the end
					fileChunks.push({ hash: chunk.hash, length: chunk.length });
					chunkMetadata.push({
						xorbId: chunkXorbId,
						chunkIndex: chunkIndex,
						length: chunk.length,
					});

					xorb.fileProcessedBytes[fileSource.path] = processedBytes;

					if (bytesSinceLastProgressEvent >= 1_000_000) {
						// Emit half of the progress when processed locally, other half when uploading the xorb
						bytesSinceLastProgressEvent = 0;
						params.yieldCallback?.({
							event: "fileProgress",
							path: fileSource.path,
							progress:
								((xorb.fileUploadedBytes[fileSource.path] ?? 0) +
									(xorb.fileProcessedBytes[fileSource.path] - (xorb.fileUploadedBytes[fileSource.path] ?? 0)) *
										PROCESSING_PROGRESS_RATIO) /
								fileSource.content.size,
						});
					}

					if (xorb.chunks.length >= MAX_XORB_CHUNKS) {
						yield nextXorb({ path: fileSource.path, uploadedBytes: processedBytes, size: fileSource.content.size });

						for (const event of pendingFileEvents) {
							event.representation = event.representation.map((rep) => ({
								...rep,
								xorbId: (rep.xorbId as number) >= 0 ? rep.xorbId : remoteXorbHashes[-rep.xorbId],
							}));
							yield event;
						}
						pendingFileEvents.length = 0;
					}
				}
			};

			while (true) {
				const { done, value } = await reader.read();
				if (done) {
					yield* addChunks(chunker.finish());
					break;
				}
				processedBytes += value.length;
				sourceChunks.push(value);
				yield* addChunks(chunker.add_data(value));
			}

			const fileRepresentation = buildFileRepresentation(
				chunkMetadata,
				fileChunks,
				chunkModule.compute_verification_hash.bind(chunkModule)
			);
			xorb.immutableData = {
				chunkIndex: xorb.chunks.length,
				offset: xorb.offset,
			};
			const dedupRatio = fileSource.content.size > 0 ? dedupedBytes / fileSource.content.size : 0;

			pendingFileEvents.push({
				event: "file" as const,
				path: fileSource.path,
				hash: chunkModule.compute_file_hash(fileChunks),
				sha256: fileSource.sha256,
				dedupRatio,
				representation: fileRepresentation,
			});
		} finally {
			chunker.free();
			// ^ is this really needed ?
		}
	}

	if (xorb.offset > 0) {
		yield xorb.event(chunkModule.compute_xorb_hash.bind(chunkModule));
	}

	for (const event of pendingFileEvents) {
		event.representation = event.representation.map((rep) => ({
			...rep,
			xorbId: (rep.xorbId as number) >= 0 ? rep.xorbId : remoteXorbHashes[-rep.xorbId],
		}));
		yield event;
	}
}

export function backtrackDedup(
	xorb: CurrentXorbInfo,
	computeHmac: (hash: string, key: string) => string,
	shardData: ShardData,
	chunkCache: ChunkCache,
	chunkMetadata: { xorbId: number | string; chunkIndex: number; length: number }[],
	dedupedBytes: number
): number {
	const chunkIndexesToBacktrackFor = new Map<number, { xorbId: number; chunkIndex: number }>();
	for (
		let chunkToRecheckIndex = xorb.immutableData?.chunkIndex ?? 0;
		chunkToRecheckIndex < xorb.chunks.length;
		chunkToRecheckIndex++
	) {
		const chunk = xorb.chunks[chunkToRecheckIndex];
		const hmacHash = computeHmac(chunk.hash, shardData.hmacKey);
		const cacheData = chunkCache.getChunk(hmacHash, null);
		if (cacheData !== undefined) {
			chunkIndexesToBacktrackFor.set(chunkToRecheckIndex, {
				xorbId: cacheData.xorbIndex,
				chunkIndex: cacheData.chunkIndex,
			});
			chunkCache.removeChunkFromCache(chunk.hash);
		}
	}

	// Use remote dedup info to update chunk metadata for file representation
	for (const metadata of chunkMetadata) {
		if (metadata.xorbId === xorb.id && chunkIndexesToBacktrackFor.has(metadata.chunkIndex)) {
			const backtrackData = chunkIndexesToBacktrackFor.get(metadata.chunkIndex);
			if (backtrackData !== undefined) {
				metadata.xorbId = backtrackData.xorbId;
				metadata.chunkIndex = backtrackData.chunkIndex;
				dedupedBytes += metadata.length;
			}
		}
	}

	// Remove chunks that were backtracked from xorbChunks
	const xorbRangesToErase: Array<{ start: number; end: number }> = [];
	for (let i = 0; i < xorb.chunks.length; i++) {
		const chunk = xorb.chunks[i];
		if (chunkIndexesToBacktrackFor.has(i)) {
			xorbRangesToErase.push({
				start: chunk.offset,
				end: i < xorb.chunks.length - 1 ? xorb.chunks[i + 1].offset : xorb.offset,
			});
		}
	}
	const xorbRangesToKeep: Array<{ start: number; end: number }> = [];
	let currentStart = 0;
	for (let i = 0; i < xorbRangesToErase.length; i++) {
		const range = xorbRangesToErase[i];
		if (currentStart !== range.start) {
			xorbRangesToKeep.push({ start: currentStart, end: range.start });
		}
		currentStart = range.end;
	}
	if (currentStart !== xorb.offset) {
		xorbRangesToKeep.push({ start: currentStart, end: xorb.offset });
	}

	let currentOffset = 0;
	for (const range of xorbRangesToKeep) {
		if (range.start !== currentOffset) {
			xorb.data.set(xorb.data.subarray(range.start, range.end), currentOffset);
		}
		currentOffset += range.end - range.start;
	}
	const newXorbChunks: Array<{ hash: string; length: number; offset: number }> = [];
	const oldIndexToNewIndex = new Map<number, number>();
	let erasedOffset = 0;
	for (let i = 0; i < xorb.chunks.length; i++) {
		const chunk = xorb.chunks[i];
		if (chunkIndexesToBacktrackFor.has(i)) {
			if (i < xorb.chunks.length - 1) {
				erasedOffset += xorb.chunks[i + 1].offset - chunk.offset;
			}
		} else {
			newXorbChunks.push({
				hash: chunk.hash,
				length: chunk.length,
				offset: chunk.offset - erasedOffset,
			});
			// Only need a mapping if index changed (at least one previous chunk was erased)
			if (erasedOffset > 0) {
				oldIndexToNewIndex.set(i, newXorbChunks.length - 1);
			}
		}
	}
	xorb.chunks = newXorbChunks;
	xorb.offset = currentOffset;
	// Update chunkMetadata and chunkCache with new chunk indexes for the current xorb chunks
	for (const chunk of chunkMetadata) {
		if (chunk.xorbId === xorb.id) {
			const newIndex = oldIndexToNewIndex.get(chunk.chunkIndex);
			if (newIndex !== undefined) {
				const cached = chunkCache.getChunk(xorb.chunks[newIndex].hash, null);
				if (cached !== undefined && cached.xorbIndex === chunk.xorbId && cached.chunkIndex === chunk.chunkIndex) {
					chunkCache.updateChunkIndex(xorb.chunks[newIndex].hash, newIndex);
				}
				chunk.chunkIndex = newIndex;
			}
		}
	}
	return dedupedBytes;
}

/**
 * Removes and returns a chunk of the specified length from the sourceChunks array.
 */
function removeChunkFromSourceData(sourceChunks: Array<Uint8Array>, chunkLength: number): Uint8Array {
	if (chunkLength === sourceChunks[0].length) {
		const chunkToCopy = sourceChunks[0];
		sourceChunks.shift();
		return chunkToCopy;
	} else if (chunkLength < sourceChunks[0].length) {
		const chunkToCopy = sourceChunks[0].subarray(0, chunkLength);
		sourceChunks[0] = sourceChunks[0].subarray(chunkLength);
		return chunkToCopy;
	} else {
		const chunkToCopy = new Uint8Array(chunkLength);
		let copyOffset = 0;
		let index = 0;
		let toSlice = -1;
		while (copyOffset < chunkLength) {
			const nToCopy = Math.min(sourceChunks[index].length, chunkLength - copyOffset);
			chunkToCopy.set(sourceChunks[index].subarray(0, nToCopy), copyOffset);
			copyOffset += nToCopy;

			if (nToCopy === sourceChunks[index].length) {
				index++;
			} else {
				toSlice = nToCopy;
			}
		}
		sourceChunks.splice(0, index);
		if (toSlice !== -1) {
			sourceChunks[0] = sourceChunks[0].subarray(toSlice);
		}
		return chunkToCopy;
	}
}

/**
 * Write a chunk header to the xorb and return the offset of where to write the next chunk
 *
 * If it returns 0, it means there wasn't enough space in the xorb
 */
function writeChunk(xorb: CurrentXorbInfo, chunk: Uint8Array, hash: string): boolean {
	const regularCompressedChunk = lz4_compress(chunk);
	const bgCompressedChunk = lz4_compress(bg4_split_bytes(chunk));
	const compressedChunk =
		bgCompressedChunk.length < regularCompressedChunk.length ? bgCompressedChunk : regularCompressedChunk;
	const chunkToWrite = compressedChunk.length < chunk.length ? compressedChunk : chunk;

	if (xorb.offset + XET_CHUNK_HEADER_BYTES + chunkToWrite.length > XORB_SIZE) {
		return false;
	}

	xorb.data[xorb.offset] = 0;
	xorb.data[xorb.offset + 1] = chunkToWrite.length & 0xff;
	xorb.data[xorb.offset + 2] = (chunkToWrite.length >> 8) & 0xff;
	xorb.data[xorb.offset + 3] = (chunkToWrite.length >> 16) & 0xff;
	xorb.data[xorb.offset + 4] =
		chunkToWrite.length < chunk.length
			? bgCompressedChunk.length < regularCompressedChunk.length
				? XetChunkCompressionScheme.ByteGroupingLZ4
				: XetChunkCompressionScheme.LZ4
			: XetChunkCompressionScheme.None;
	xorb.data[xorb.offset + 5] = chunk.length & 0xff;
	xorb.data[xorb.offset + 6] = (chunk.length >> 8) & 0xff;
	xorb.data[xorb.offset + 7] = (chunk.length >> 16) & 0xff;

	xorb.data.set(chunkToWrite, xorb.offset + XET_CHUNK_HEADER_BYTES);

	xorb.chunks.push({ hash, length: chunk.length, offset: xorb.offset });
	xorb.offset += XET_CHUNK_HEADER_BYTES + chunkToWrite.length;
	return true;
}

// Build file representation from collected metadata
const buildFileRepresentation = (
	metadata: Array<{ xorbId: number | string; chunkIndex: number; length: number }>,
	chunks: Array<{ hash: string; length: number }>,
	computeVerificationHash: (hashes: string[]) => string
): Array<{
	xorbId: number | string;
	indexStart: number;
	indexEnd: number;
	length: number;
	rangeHash: string;
}> => {
	if (metadata.length === 0) {
		return [];
	}

	const representation: Array<{
		xorbId: number | string;
		indexStart: number;
		indexEnd: number;
		length: number;
		rangeHash: string;
	}> = [];

	let currentRange = {
		xorbId: metadata[0].xorbId,
		indexStart: metadata[0].chunkIndex,
		indexEnd: metadata[0].chunkIndex + 1,
		length: metadata[0].length,
		chunkHashStart: 0,
	};

	for (let i = 1; i < metadata.length; i++) {
		const chunk = metadata[i];

		// Check if this chunk continues the current range
		if (currentRange.xorbId === chunk.xorbId && currentRange.indexEnd === chunk.chunkIndex) {
			// Extend current range
			currentRange.indexEnd = chunk.chunkIndex + 1;
			currentRange.length += chunk.length;
		} else {
			// Finalize current range and start a new one
			const rangeHash = computeVerificationHash(chunks.slice(currentRange.chunkHashStart, i).map((x) => x.hash));
			representation.push({
				xorbId: currentRange.xorbId,
				indexStart: currentRange.indexStart,
				indexEnd: currentRange.indexEnd,
				length: currentRange.length,
				rangeHash,
			});

			currentRange = {
				xorbId: chunk.xorbId,
				indexStart: chunk.chunkIndex,
				indexEnd: chunk.chunkIndex + 1,
				length: chunk.length,
				chunkHashStart: i,
			};
		}
	}

	// Finalize the last range
	const rangeHash = computeVerificationHash(chunks.slice(currentRange.chunkHashStart).map((x) => x.hash));
	representation.push({
		xorbId: currentRange.xorbId,
		indexStart: currentRange.indexStart,
		indexEnd: currentRange.indexEnd,
		length: currentRange.length,
		rangeHash,
	});

	return representation;
};

/**
 * Helper to load dedup info for blob contents into cache.
 * Processes the blob's contents, chunks it, and loads dedup info into cache without writing to xorb.
 *
 * For now this is optimized for when the replacement data is at the very beginning of the file
 *
 * todo: handle when it's not at the beginning of the file by backingtracking xorb contents
 * todo: handle when it's not at the beginning of the file by using previous content to chunk at the same boundaries as it would have in the original file
 */
async function loadDedupInfoToCache(
	content: Blob,
	/** Will be mutated */
	remoteXorbHashes: string[],
	params: XetWriteTokenParams,
	chunkCache: ChunkCache,
	// eslint-disable-next-line @typescript-eslint/consistent-type-imports
	chunkModule: typeof import("../vendor/xet-chunk/chunker_wasm"),

	opts?: {
		isAtBeginning?: boolean;
		/**
		 * The end position of the content to process
		 *
		 * Will process content up to the end of the chunk after this position
		 */
		end?: number;
		/**
		 * The maximum number of chunks to process
		 *
		 * Will process content up to the end of the chunk after this position
		 */
		maxChunks?: number;
	}
): Promise<void> {
	const chunker = new chunkModule.Chunker(TARGET_CHUNK_SIZE);
	const cache = chunkCache;

	let dedupedBytes = 0;
	let chunksProcessed = 0;
	let totalBytes = 0;
	let bytesSinceRemoteDedup = Infinity;
	const sourceChunks: Array<Uint8Array> = [];

	try {
		const reader = content.stream().getReader();

		const processChunks = async (chunkData: Array<{ hash: string; length: number; dedup: boolean }>) => {
			for (const chunk of chunkData) {
				chunksProcessed++;
				if (opts?.isAtBeginning && chunksProcessed === 1) {
					chunk.dedup = true;
				}
				totalBytes += chunk.length;

				// Remove chunks from source data
				removeChunkFromSourceData(sourceChunks, chunk.length);

				// Check if chunk is already in cache
				let cacheData = cache.getChunk(chunk.hash, chunkModule.compute_hmac);

				// Early return if already cached - no need for remote lookup
				if (cacheData !== undefined) {
					dedupedBytes += chunk.length;
					bytesSinceRemoteDedup += chunk.length;
					continue;
				}

				// Try remote dedup lookup if conditions are met
				if (chunk.dedup && bytesSinceRemoteDedup >= INTERVAL_BETWEEN_REMOTE_DEDUP) {
					const token = await xetWriteToken(params);
					bytesSinceRemoteDedup = 0;

					const shardResp = await (params.fetch ?? fetch)(token.casUrl + "/v1/chunks/default/" + chunk.hash, {
						headers: {
							Authorization: `Bearer ${token.accessToken}`,
						},
					});

					if (shardResp.ok) {
						const shard = await shardResp.blob();
						const shardData = await parseShardData(shard);

						// Load remote dedup info into cache
						for (const xorb of shardData.xorbs) {
							const remoteXorbId = -remoteXorbHashes.length;
							remoteXorbHashes.push(xorb.hash);
							let i = 0;
							for (const xorbChunk of xorb.chunks) {
								cache.addChunkToCache(xorbChunk.hash, remoteXorbId, i++, shardData.hmacKey);
							}
						}
						cacheData = cache.getChunk(chunk.hash, chunkModule.compute_hmac);
					}
				}

				if (cacheData !== undefined) {
					// Chunk found in cache after remote lookup - it's deduplicated
					dedupedBytes += chunk.length;
				}

				bytesSinceRemoteDedup += chunk.length;
			}
		};

		// Read and process blob content
		while (true) {
			if (opts?.end !== undefined && totalBytes >= opts.end) {
				break;
			}
			if (opts?.maxChunks !== undefined && chunksProcessed >= opts.maxChunks) {
				break;
			}
			const { done, value } = await reader.read();
			if (done) {
				await processChunks(chunker.finish());
				break;
			}
			sourceChunks.push(value);
			await processChunks(chunker.add_data(value));
		}
	} finally {
		chunker.free();
	}
}
