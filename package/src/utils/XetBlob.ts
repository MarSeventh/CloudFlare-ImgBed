import { createApiError } from "../error";
import type { CredentialsParams } from "../types/public";
import { checkCredentials } from "./checkCredentials";
import { combineUint8Arrays } from "./combineUint8Arrays";
import { decompress as lz4_decompress } from "../vendor/lz4js";
import { RangeList } from "./RangeList";

const JWT_SAFETY_PERIOD = 60_000;
const JWT_CACHE_SIZE = 1_000;

type XetBlobCreateOptions = {
	/**
	 * Custom fetch function to use instead of the default one, for example to use a proxy or edit headers.
	 */
	fetch?: typeof fetch;
	// URL to get the access token from
	refreshUrl: string;
	size: number;
	listener?: (arg: { event: "read" } | { event: "progress"; progress: { read: number; total: number } }) => void;
	internalLogging?: boolean;
} & ({ hash: string; reconstructionUrl?: string } | { hash?: string; reconstructionUrl: string }) &
	Partial<CredentialsParams>;

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
		range: { start: number; end: number };
	}>;

	/**
	 * Dictionnary of CAS block hash => list of ranges in the block + url to fetch it
	 */
	fetch_info: Record<
		string,
		Array<{
			url: string;
			/** Chunk range */
			range: { start: number; end: number };
			/**
			 * Byte range, when making the call to the URL.
			 *
			 * We assume that we're given non-overlapping ranges for each hash
			 */
			url_range: { start: number; end: number };
		}>
	>;
	/**
	 * When doing a range request, the offset into the term's uncompressed data. Can be multiple chunks' worth of data.
	 */
	offset_into_first_range: number;
}

export enum XetChunkCompressionScheme {
	None = 0,
	LZ4 = 1,
	ByteGroupingLZ4 = 2,
}

const compressionSchemeLabels: Record<XetChunkCompressionScheme, string> = {
	[XetChunkCompressionScheme.None]: "None",
	[XetChunkCompressionScheme.LZ4]: "LZ4",
	[XetChunkCompressionScheme.ByteGroupingLZ4]: "ByteGroupingLZ4",
};

interface ChunkHeader {
	version: number; // u8, 1 byte
	compressed_length: number; // 3 * u8, 3 bytes
	compression_scheme: XetChunkCompressionScheme; // u8, 1 byte
	uncompressed_length: number; // 3 * u8, 3 bytes
}

export const XET_CHUNK_HEADER_BYTES = 8;

/**
 * XetBlob is a blob implementation that fetches data directly from the Xet storage
 */
export class XetBlob extends Blob {
	fetch: typeof fetch;
	accessToken?: string;
	refreshUrl: string;
	reconstructionUrl?: string;
	hash?: string;
	start = 0;
	end = 0;
	internalLogging = false;
	reconstructionInfo: ReconstructionInfo | undefined;
	listener: XetBlobCreateOptions["listener"];

	constructor(params: XetBlobCreateOptions) {
		super([]);

		this.fetch = params.fetch ?? fetch.bind(globalThis);
		this.accessToken = checkCredentials(params);
		this.refreshUrl = params.refreshUrl;
		this.end = params.size;
		this.reconstructionUrl = params.reconstructionUrl;
		this.hash = params.hash;
		this.listener = params.listener;
		this.internalLogging = params.internalLogging ?? false;
		this.refreshUrl;
	}

	override get size(): number {
		return this.end - this.start;
	}

	#clone() {
		const blob = new XetBlob({
			fetch: this.fetch,
			hash: this.hash,
			refreshUrl: this.refreshUrl,
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			reconstructionUrl: this.reconstructionUrl!,
			size: this.size,
		});

		blob.accessToken = this.accessToken;
		blob.start = this.start;
		blob.end = this.end;
		blob.reconstructionInfo = this.reconstructionInfo;
		blob.listener = this.listener;
		blob.internalLogging = this.internalLogging;

		return blob;
	}

	override slice(start = 0, end = this.size): XetBlob {
		if (start < 0 || end < 0) {
			new TypeError("Unsupported negative start/end on XetBlob.slice");
		}

		const slice = this.#clone();

		slice.start = this.start + start;
		slice.end = Math.min(this.start + end, this.end);

		if (slice.start !== this.start || slice.end !== this.end) {
			slice.reconstructionInfo = undefined;
		}

		return slice;
	}

	#reconstructionInfoPromise?: Promise<ReconstructionInfo>;

	#loadReconstructionInfo() {
		if (this.#reconstructionInfoPromise) {
			return this.#reconstructionInfoPromise;
		}

		this.#reconstructionInfoPromise = (async () => {
			const connParams = await getAccessToken(this.accessToken, this.fetch, this.refreshUrl);

			// debug(
			// 	`curl '${connParams.casUrl}/v1/reconstructions/${this.hash}' -H 'Authorization: Bearer ${connParams.accessToken}'`
			// );

			const resp = await this.fetch(this.reconstructionUrl ?? `${connParams.casUrl}/v1/reconstructions/${this.hash}`, {
				headers: {
					Authorization: `Bearer ${connParams.accessToken}`,
					Range: `bytes=${this.start}-${this.end - 1}`,
				},
			});

			if (!resp.ok) {
				throw await createApiError(resp);
			}

			this.reconstructionInfo = (await resp.json()) as ReconstructionInfo;

			return this.reconstructionInfo;
		})().finally(() => (this.#reconstructionInfoPromise = undefined));

		return this.#reconstructionInfoPromise;
	}

	async #fetch(): Promise<ReadableStream<Uint8Array>> {
		if (!this.reconstructionInfo) {
			await this.#loadReconstructionInfo();
		}

		const rangeLists = new Map<string, RangeList<Uint8Array[]>>();

		if (!this.reconstructionInfo) {
			throw new Error("Failed to load reconstruction info");
		}

		for (const term of this.reconstructionInfo.terms) {
			let rangeList = rangeLists.get(term.hash);
			if (!rangeList) {
				rangeList = new RangeList<Uint8Array[]>();
				rangeLists.set(term.hash, rangeList);
			}

			rangeList.add(term.range.start, term.range.end);
		}
		const listener = this.listener;
		const log = this.internalLogging ? (...args: unknown[]) => console.log(...args) : () => {};

		async function* readData(
			reconstructionInfo: ReconstructionInfo,
			customFetch: typeof fetch,
			maxBytes: number,
			reloadReconstructionInfo: () => Promise<ReconstructionInfo>
		) {
			let totalBytesRead = 0;
			let readBytesToSkip = reconstructionInfo.offset_into_first_range;

			for (const term of reconstructionInfo.terms) {
				if (totalBytesRead >= maxBytes) {
					break;
				}

				const rangeList = rangeLists.get(term.hash);
				if (!rangeList) {
					throw new Error(`Failed to find range list for term ${term.hash}`);
				}

				{
					const termRanges = rangeList.getRanges(term.range.start, term.range.end);

					if (termRanges.every((range) => range.data)) {
						log("all data available for term", term.hash, readBytesToSkip);
						rangeLoop: for (const range of termRanges) {
							// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
							for (let chunk of range.data!) {
								if (readBytesToSkip) {
									const skipped = Math.min(readBytesToSkip, chunk.byteLength);
									chunk = chunk.slice(skipped);
									readBytesToSkip -= skipped;
									if (!chunk.byteLength) {
										continue;
									}
								}
								if (chunk.byteLength > maxBytes - totalBytesRead) {
									chunk = chunk.slice(0, maxBytes - totalBytesRead);
								}
								totalBytesRead += chunk.byteLength;
								// The stream consumer can decide to transfer ownership of the chunk, so we need to return a clone
								// if there's more than one range for the same term
								yield range.refCount > 1 ? chunk.slice() : chunk;
								listener?.({ event: "progress", progress: { read: totalBytesRead, total: maxBytes } });

								if (totalBytesRead >= maxBytes) {
									break rangeLoop;
								}
							}
						}
						rangeList.remove(term.range.start, term.range.end);
						continue;
					}
				}

				const fetchInfo = reconstructionInfo.fetch_info[term.hash].find(
					(info) => info.range.start <= term.range.start && info.range.end >= term.range.end
				);

				if (!fetchInfo) {
					throw new Error(
						`Failed to find fetch info for term ${term.hash} and range ${term.range.start}-${term.range.end}`
					);
				}

				log("term", term);
				log("fetchinfo", fetchInfo);
				log("readBytesToSkip", readBytesToSkip);

				let resp = await customFetch(fetchInfo.url, {
					headers: {
						Range: `bytes=${fetchInfo.url_range.start}-${fetchInfo.url_range.end}`,
					},
				});

				if (resp.status === 403) {
					// In case it's expired
					reconstructionInfo = await reloadReconstructionInfo();
					resp = await customFetch(fetchInfo.url, {
						headers: {
							Range: `bytes=${fetchInfo.url_range.start}-${fetchInfo.url_range.end}`,
						},
					});
				}

				if (!resp.ok) {
					throw await createApiError(resp);
				}

				log(
					"expected content length",
					resp.headers.get("content-length"),
					"range",
					fetchInfo.url_range,
					resp.headers.get("content-range")
				);

				const reader = resp.body?.getReader();
				if (!reader) {
					throw new Error("Failed to get reader from response body");
				}

				let done = false;
				let chunkIndex = fetchInfo.range.start;
				const ranges = rangeList.getRanges(fetchInfo.range.start, fetchInfo.range.end);

				let leftoverBytes: Uint8Array | undefined = undefined;
				let totalFetchBytes = 0;

				fetchData: while (!done && totalBytesRead < maxBytes) {
					const result = await reader.read();
					listener?.({ event: "read" });

					done = result.done;

					log("read", result.value?.byteLength, "bytes", "total read", totalBytesRead, "toSkip", readBytesToSkip);

					if (!result.value) {
						log("no data in result, cancelled", result);
						continue;
					}

					totalFetchBytes += result.value.byteLength;

					if (leftoverBytes) {
						result.value = combineUint8Arrays(leftoverBytes, result.value);
						leftoverBytes = undefined;
					}

					while (totalBytesRead < maxBytes && result.value?.byteLength) {
						if (result.value.byteLength < 8) {
							// We need 8 bytes to parse the chunk header
							leftoverBytes = result.value;
							continue fetchData;
						}

						const header = new DataView(result.value.buffer, result.value.byteOffset, XET_CHUNK_HEADER_BYTES);
						const chunkHeader: ChunkHeader = {
							version: header.getUint8(0),
							compressed_length: header.getUint8(1) | (header.getUint8(2) << 8) | (header.getUint8(3) << 16),
							compression_scheme: header.getUint8(4),
							uncompressed_length: header.getUint8(5) | (header.getUint8(6) << 8) | (header.getUint8(7) << 16),
						};

						log("chunk header", chunkHeader, "to skip", readBytesToSkip);

						if (chunkHeader.version !== 0) {
							throw new Error(`Unsupported chunk version ${chunkHeader.version}`);
						}

						if (
							chunkHeader.compression_scheme !== XetChunkCompressionScheme.None &&
							chunkHeader.compression_scheme !== XetChunkCompressionScheme.LZ4 &&
							chunkHeader.compression_scheme !== XetChunkCompressionScheme.ByteGroupingLZ4
						) {
							throw new Error(
								`Unsupported compression scheme ${
									compressionSchemeLabels[chunkHeader.compression_scheme] ?? chunkHeader.compression_scheme
								}`
							);
						}

						if (result.value.byteLength < chunkHeader.compressed_length + XET_CHUNK_HEADER_BYTES) {
							// We need more data to read the full chunk
							leftoverBytes = result.value;
							continue fetchData;
						}

						result.value = result.value.slice(XET_CHUNK_HEADER_BYTES);

						let uncompressed =
							chunkHeader.compression_scheme === XetChunkCompressionScheme.LZ4
								? lz4_decompress(result.value.slice(0, chunkHeader.compressed_length), chunkHeader.uncompressed_length)
								: chunkHeader.compression_scheme === XetChunkCompressionScheme.ByteGroupingLZ4
								  ? bg4_regroup_bytes(
											lz4_decompress(
												result.value.slice(0, chunkHeader.compressed_length),
												chunkHeader.uncompressed_length
											)
								    )
								  : result.value.slice(0, chunkHeader.compressed_length);

						const range = ranges.find((range) => chunkIndex >= range.start && chunkIndex < range.end);
						const shouldYield = chunkIndex >= term.range.start && chunkIndex < term.range.end;
						const minRefCountToStore = shouldYield ? 2 : 1;
						let stored = false;

						// Assuming non-overlapping fetch_info ranges for the same hash
						if (range && range.refCount >= minRefCountToStore) {
							range.data ??= [];
							range.data.push(uncompressed);
							stored = true;
						}

						if (shouldYield) {
							if (readBytesToSkip) {
								const skipped = Math.min(readBytesToSkip, uncompressed.byteLength);
								uncompressed = uncompressed.slice(readBytesToSkip);
								readBytesToSkip -= skipped;
							}

							if (uncompressed.byteLength > maxBytes - totalBytesRead) {
								uncompressed = uncompressed.slice(0, maxBytes - totalBytesRead);
							}

							if (uncompressed.byteLength) {
								log(
									"yield",
									uncompressed.byteLength,
									"bytes",
									result.value.byteLength,
									"total read",
									totalBytesRead,
									stored
								);
								totalBytesRead += uncompressed.byteLength;
								yield stored ? uncompressed.slice() : uncompressed;
								listener?.({ event: "progress", progress: { read: totalBytesRead, total: maxBytes } });
							}
						}

						chunkIndex++;
						result.value = result.value.slice(chunkHeader.compressed_length);
					}
				}

				if (
					done &&
					totalBytesRead < maxBytes &&
					totalFetchBytes < fetchInfo.url_range.end - fetchInfo.url_range.start + 1
				) {
					log("done", done, "total read", totalBytesRead, maxBytes, totalFetchBytes);
					log("failed to fetch all data for term", term.hash);
					throw new Error(
						`Failed to fetch all data for term ${term.hash}, fetched ${totalFetchBytes} bytes out of ${
							fetchInfo.url_range.end - fetchInfo.url_range.start + 1
						}`
					);
				}

				log("done", done, "total read", totalBytesRead, maxBytes, totalFetchBytes);

				// Release the reader
				log("cancel reader");
				await reader.cancel();
			}
		}

		const iterator = readData(
			this.reconstructionInfo,
			this.fetch,
			this.end - this.start,
			this.#loadReconstructionInfo.bind(this)
		);

		// todo: when Chrome/Safari support it, use ReadableStream.from(readData)
		return new ReadableStream<Uint8Array>(
			{
				// todo: when Safari supports it, type controller as ReadableByteStreamController
				async pull(controller) {
					const result = await iterator.next();

					if (result.value) {
						controller.enqueue(result.value);
					}

					if (result.done) {
						controller.close();
					}
				},
				type: "bytes",
				// todo: when Safari supports it, add autoAllocateChunkSize param
			},
			// todo : use ByteLengthQueuingStrategy when there's good support for it, currently in Node.js it fails due to size being a function
			{
				highWaterMark: 1_000, // 1_000 chunks for ~1MB of RAM
			}
		);
	}

	override async arrayBuffer(): Promise<ArrayBuffer> {
		const result = await this.#fetch();

		return new Response(result).arrayBuffer();
	}

	override async text(): Promise<string> {
		const result = await this.#fetch();

		return new Response(result).text();
	}

	async response(): Promise<Response> {
		const result = await this.#fetch();

		return new Response(result);
	}

	override stream(): ReturnType<Blob["stream"]> {
		const stream = new TransformStream();

		this.#fetch()
			.then((response) => response.pipeThrough(stream))
			.catch((error) => stream.writable.abort(error.message));

		return stream.readable;
	}
}

const jwtPromises: Map<string, Promise<{ accessToken: string; casUrl: string }>> = new Map();
/**
 * Cache to store JWTs, to avoid making many auth requests when downloading multiple files from the same repo
 */
const jwts: Map<
	string,
	{
		accessToken: string;
		expiresAt: Date;
		casUrl: string;
	}
> = new Map();

function cacheKey(params: { refreshUrl: string; initialAccessToken: string | undefined }): string {
	return JSON.stringify([params.refreshUrl, params.initialAccessToken]);
}

// exported for testing purposes
export function bg4_regroup_bytes(bytes: Uint8Array): Uint8Array {
	// python code

	// split = len(x) // 4
	// rem = len(x) % 4
	// g1_pos = split + (1 if rem >= 1 else 0)
	// g2_pos = g1_pos + split + (1 if rem >= 2 else 0)
	// g3_pos = g2_pos + split + (1 if rem == 3 else 0)
	// ret = bytearray(len(x))
	// ret[0::4] = x[:g1_pos]
	// ret[1::4] = x[g1_pos:g2_pos]
	// ret[2::4] = x[g2_pos:g3_pos]
	// ret[3::4] = x[g3_pos:]

	// todo: optimize to do it in-place

	const split = Math.floor(bytes.byteLength / 4);
	const rem = bytes.byteLength % 4;
	const g1_pos = split + (rem >= 1 ? 1 : 0);
	const g2_pos = g1_pos + split + (rem >= 2 ? 1 : 0);
	const g3_pos = g2_pos + split + (rem == 3 ? 1 : 0);

	const ret = new Uint8Array(bytes.byteLength);
	for (let i = 0, j = 0; i < bytes.byteLength; i += 4, j++) {
		ret[i] = bytes[j];
	}

	for (let i = 1, j = g1_pos; i < bytes.byteLength; i += 4, j++) {
		ret[i] = bytes[j];
	}

	for (let i = 2, j = g2_pos; i < bytes.byteLength; i += 4, j++) {
		ret[i] = bytes[j];
	}

	for (let i = 3, j = g3_pos; i < bytes.byteLength; i += 4, j++) {
		ret[i] = bytes[j];
	}

	return ret;

	// alternative implementation (to benchmark which one is faster)
	// for (let i = 0; i < bytes.byteLength - 3; i += 4) {
	// 	ret[i] = bytes[i / 4];
	// 	ret[i + 1] = bytes[g1_pos + i / 4];
	// 	ret[i + 2] = bytes[g2_pos + i / 4];
	// 	ret[i + 3] = bytes[g3_pos + i / 4];
	// }

	// if (rem === 1) {
	// 	ret[bytes.byteLength - 1] = bytes[g1_pos - 1];
	// } else if (rem === 2) {
	// 	ret[bytes.byteLength - 2] = bytes[g1_pos - 1];
	// 	ret[bytes.byteLength - 1] = bytes[g2_pos - 1];
	// } else if (rem === 3) {
	// 	ret[bytes.byteLength - 3] = bytes[g1_pos - 1];
	// 	ret[bytes.byteLength - 2] = bytes[g2_pos - 1];
	// 	ret[bytes.byteLength - 1] = bytes[g3_pos - 1];
	// }
}

export function bg4_split_bytes(bytes: Uint8Array): Uint8Array {
	// This function does the opposite of bg4_regroup_bytes
	// It takes interleaved bytes and groups them by 4

	const ret = new Uint8Array(bytes.byteLength);
	const split = Math.floor(bytes.byteLength / 4);
	const rem = bytes.byteLength % 4;

	// Calculate group positions in the output array
	const g1_pos = split + (rem >= 1 ? 1 : 0);
	const g2_pos = g1_pos + split + (rem >= 2 ? 1 : 0);
	const g3_pos = g2_pos + split + (rem == 3 ? 1 : 0);

	// Extract every 4th byte starting from position 0, 1, 2, 3
	// and place them in their respective groups
	for (let i = 0, j = 0; i < bytes.byteLength; i += 4, j++) {
		ret[j] = bytes[i];
	}

	for (let i = 1, j = g1_pos; i < bytes.byteLength; i += 4, j++) {
		ret[j] = bytes[i];
	}

	for (let i = 2, j = g2_pos; i < bytes.byteLength; i += 4, j++) {
		ret[j] = bytes[i];
	}

	for (let i = 3, j = g3_pos; i < bytes.byteLength; i += 4, j++) {
		ret[j] = bytes[i];
	}

	return ret;
}

async function getAccessToken(
	initialAccessToken: string | undefined,
	customFetch: typeof fetch,
	refreshUrl: string
): Promise<{ accessToken: string; casUrl: string }> {
	const key = cacheKey({ refreshUrl, initialAccessToken });

	const jwt = jwts.get(key);

	if (jwt && jwt.expiresAt > new Date(Date.now() + JWT_SAFETY_PERIOD)) {
		return { accessToken: jwt.accessToken, casUrl: jwt.casUrl };
	}

	// If we already have a promise for this repo, return it
	const existingPromise = jwtPromises.get(key);
	if (existingPromise) {
		return existingPromise;
	}

	const promise = (async () => {
		const resp = await customFetch(refreshUrl, {
			headers: {
				...(initialAccessToken
					? {
							Authorization: `Bearer ${initialAccessToken}`,
					  }
					: {}),
			},
		});

		if (!resp.ok) {
			throw new Error(`Failed to get JWT token: ${resp.status} ${await resp.text()}`);
		}

		const json: { accessToken: string; casUrl: string; exp: number } = await resp.json();
		const jwt = {
			accessToken: json.accessToken,
			expiresAt: new Date(json.exp * 1000),
			casUrl: json.casUrl,
		};

		jwtPromises.delete(key);

		for (const [key, value] of jwts.entries()) {
			if (value.expiresAt < new Date(Date.now() + JWT_SAFETY_PERIOD)) {
				jwts.delete(key);
			} else {
				break;
			}
		}
		if (jwts.size >= JWT_CACHE_SIZE) {
			const keyToDelete = jwts.keys().next().value;
			if (keyToDelete) {
				jwts.delete(keyToDelete);
			}
		}
		jwts.set(key, jwt);

		return {
			accessToken: json.accessToken,
			casUrl: json.casUrl,
		};
	})();

	jwtPromises.set(key, promise);

	return promise;
}
