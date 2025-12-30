import { createApiError } from "../error";
import type { RepoId } from "../types/public";
import { createXorbs } from "./createXorbs";
import { sum } from "./sum";
import { xetWriteToken } from "./xetWriteToken";

const SHARD_MAX_SIZE = 64 * 1024 * 1024;
const SHARD_HEADER_SIZE = 48;
const SHARD_FOOTER_SIZE = 200;
const HASH_LENGTH = 32;
const XORB_FOOTER_LENGTH = 48;
const FILE_FOOTER_LENGTH = 48;
export const SHARD_HEADER_VERSION = 2n;
export const SHARD_FOOTER_VERSION = 1n;

const MDB_FILE_FLAG_WITH_VERIFICATION = 0x80000000; // Cannot define as 1 << 31 because it becomes a negative number
const MDB_FILE_FLAG_WITH_METADATA_EXT = 0x40000000;

export const SHARD_MAGIC_TAG = new Uint8Array([
	"H".charCodeAt(0),
	"F".charCodeAt(0),
	"R".charCodeAt(0),
	"e".charCodeAt(0),
	"p".charCodeAt(0),
	"o".charCodeAt(0),
	"M".charCodeAt(0),
	"e".charCodeAt(0),
	"t".charCodeAt(0),
	"a".charCodeAt(0),
	"D".charCodeAt(0),
	"a".charCodeAt(0),
	"t".charCodeAt(0),
	"a".charCodeAt(0),
	0,
	85,
	105,
	103,
	69,
	106,
	123,
	129,
	87,
	131,
	165,
	189,
	217,
	92,
	205,
	209,
	74,
	169,
]);

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
	yieldCallback?: (event: { event: "fileProgress"; path: string; progress: number }) => void;
}

/**
 * Outputs the file sha256 after their xorbs/shards have been uploaded.
 */
export async function* uploadShards(
	source: AsyncGenerator<{ content: Blob; path: string; sha256: string }>,
	params: UploadShardsParams
): AsyncGenerator<
	| { event: "file"; path: string; sha256: string; dedupRatio: number }
	| { event: "fileProgress"; path: string; progress: number }
> {
	const xorbHashes: Array<string> = [];

	const fileInfoSection = new Uint8Array(Math.floor(SHARD_MAX_SIZE - SHARD_HEADER_SIZE - SHARD_FOOTER_SIZE) * 0.25);
	const xorbInfoSection = new Uint8Array(Math.floor(SHARD_MAX_SIZE - SHARD_HEADER_SIZE - SHARD_FOOTER_SIZE) * 0.75);

	const xorbView = new DataView(xorbInfoSection.buffer);
	let xorbViewOffset = 0;
	const fileInfoView = new DataView(fileInfoSection.buffer);
	let fileViewOffset = 0;
	let xorbTotalSize = 0n;
	let fileTotalSize = 0n;
	let xorbTotalUnpackedSize = 0n;

	for await (const output of createXorbs(source, params)) {
		switch (output.event) {
			case "xorb": {
				xorbHashes.push(output.hash);

				// Calculate space needed for this xorb entry
				const xorbEntrySize = HASH_LENGTH + 4 + 4 + 4 + 4; // hash + flags + count + unpacked + packed
				const chunksSize = output.chunks.length * (HASH_LENGTH + 4 + 4 + 8); // per chunk: hash + length + offset + reserved
				const totalXorbSize = xorbEntrySize + chunksSize;

				// Check if adding this xorb would exceed buffer capacity
				if (xorbViewOffset + totalXorbSize > xorbInfoSection.length) {
					// Upload current shard and reset buffers
					if (xorbViewOffset > 0 || fileViewOffset > 0) {
						await uploadShard(createShard(), params);
					}
				}

				// todo: handle when going out of bounds
				writeHashToArray(output.hash, xorbInfoSection, xorbViewOffset);
				xorbViewOffset += HASH_LENGTH;
				xorbView.setUint32(xorbViewOffset, 0, true); // flags
				xorbViewOffset += 4;
				xorbView.setUint32(xorbViewOffset, output.chunks.length, true);
				xorbViewOffset += 4;
				const xorbUnpackedSize = sum(output.chunks.map((x) => x.length));
				xorbView.setUint32(xorbViewOffset, xorbUnpackedSize, true);
				xorbTotalUnpackedSize += BigInt(xorbUnpackedSize);
				xorbTotalSize += BigInt(output.xorb.byteLength);
				xorbViewOffset += 4;
				xorbView.setUint32(xorbViewOffset, output.xorb.byteLength, true);
				xorbViewOffset += 4;

				let chunkBytes = 0;
				for (const chunk of output.chunks) {
					writeHashToArray(chunk.hash, xorbInfoSection, xorbViewOffset);
					xorbViewOffset += HASH_LENGTH;
					// start offset
					xorbView.setUint32(xorbViewOffset, chunkBytes, true);
					xorbViewOffset += 4;
					// chunk length
					xorbView.setUint32(xorbViewOffset, chunk.length, true);
					xorbViewOffset += 4;
					xorbView.setBigUint64(xorbViewOffset, 0n, true); // reserved
					xorbViewOffset += 8;
					chunkBytes += chunk.length;
				}

				for (const file of output.files) {
					yield {
						event: "fileProgress",
						path: file.path,
						progress: file.lastSentProgress,
					};
				}

				await uploadXorb(output, params);
				//^ Todo: queue it and do not await it

				for (const file of output.files) {
					yield { event: "fileProgress", path: file.path, progress: file.progress };
				}
				break;
			}
			case "file": {
				yield { event: "file", path: output.path, sha256: output.sha256, dedupRatio: output.dedupRatio }; // Maybe wait until shard is uploaded before yielding.

				// Calculate space needed for this file entry
				const fileHeaderSize = HASH_LENGTH + 4 + 4 + 8; // hash + flags + rep length + reserved
				const representationSize = output.representation.length * (HASH_LENGTH + 4 + 4 + 4 + 4); // per rep: xorb hash + flags + length + offset + endOffset
				const verificationSize = output.representation.length * (HASH_LENGTH + 16); // per rep: range hash + reserved
				const metadataSize = HASH_LENGTH + 16; // sha256 + reserved
				const totalFileSize = fileHeaderSize + representationSize + verificationSize + metadataSize;

				// Check if adding this file would exceed buffer capacity
				if (fileViewOffset + totalFileSize > fileInfoSection.length) {
					// Upload current shard and reset buffers
					if (xorbViewOffset > 0 || fileViewOffset > 0) {
						await uploadShard(createShard(), params);
					}
				}

				writeHashToArray(output.hash, fileInfoSection, fileViewOffset);
				fileViewOffset += HASH_LENGTH;
				// Cannot use | binary operator since it works with int32 not uint32 and one of the flags is 1 << 31
				fileInfoView.setUint32(fileViewOffset, MDB_FILE_FLAG_WITH_METADATA_EXT + MDB_FILE_FLAG_WITH_VERIFICATION, true);
				fileViewOffset += 4;
				fileInfoView.setUint32(fileViewOffset, output.representation.length, true);
				fileViewOffset += 4;
				fileInfoView.setBigUint64(fileViewOffset, 0n, true); // reserved
				fileViewOffset += 8;

				for (const repItem of output.representation) {
					writeHashToArray(
						typeof repItem.xorbId === "number" ? xorbHashes[repItem.xorbId] : repItem.xorbId,
						fileInfoSection,
						fileViewOffset
					);
					fileViewOffset += HASH_LENGTH;
					fileInfoView.setUint32(fileViewOffset, 0, true); // Xorb flags
					fileViewOffset += 4;
					fileInfoView.setUint32(fileViewOffset, repItem.length, true);
					fileViewOffset += 4;
					fileInfoView.setUint32(fileViewOffset, repItem.indexStart, true);
					fileViewOffset += 4;
					fileInfoView.setUint32(fileViewOffset, repItem.indexEnd, true);
					fileViewOffset += 4;
				}

				// File verification data
				for (const repItem of output.representation) {
					writeHashToArray(repItem.rangeHash, fileInfoSection, fileViewOffset);
					fileViewOffset += HASH_LENGTH;
					// reserved in file verification data
					for (let i = 0; i < 16; i++) {
						fileInfoSection[fileViewOffset + i] = 0;
					}
					fileViewOffset += 16;
				}

				// File metadata ext
				writeHashToArray(output.sha256, fileInfoSection, fileViewOffset);
				fileViewOffset += HASH_LENGTH;

				// reserved in file metadata ext
				for (let i = 0; i < 16; i++) {
					fileInfoSection[fileViewOffset + i] = 0;
				}
				fileViewOffset += 16;

				break;
			}
		}
	}

	function createShard(): Uint8Array {
		const shard = new Uint8Array(
			SHARD_HEADER_SIZE + SHARD_FOOTER_SIZE + xorbViewOffset + XORB_FOOTER_LENGTH + fileViewOffset + FILE_FOOTER_LENGTH
		);

		const shardView = new DataView(shard.buffer);
		let shardOffset = 0;

		// Header
		shard.set(SHARD_MAGIC_TAG, shardOffset);
		shardOffset += SHARD_MAGIC_TAG.length;

		shardView.setBigUint64(shardOffset, SHARD_HEADER_VERSION, true);
		shardOffset += 8;

		shardView.setBigUint64(shardOffset, BigInt(SHARD_FOOTER_SIZE), true);
		shardOffset += 8;

		// File Info Section
		shard.set(fileInfoSection.slice(0, fileViewOffset), shardOffset);
		shardOffset += fileViewOffset;

		// File info bookend
		for (let i = 0; i < 32; i++) {
			shard[shardOffset + i] = 0xff;
		}
		shardOffset += 32;
		for (let i = 0; i < 16; i++) {
			shard[shardOffset + i] = 0;
		}
		shardOffset += 16;

		// XORB Info Section
		const xorbInfoOffset = shardOffset;
		shard.set(xorbInfoSection.slice(0, xorbViewOffset), shardOffset);
		shardOffset += xorbViewOffset;

		// Xorb info bookend
		for (let i = 0; i < 32; i++) {
			shard[shardOffset + i] = 0xff;
		}
		shardOffset += 32;
		for (let i = 0; i < 16; i++) {
			shard[shardOffset + i] = 0;
		}
		shardOffset += 16;

		// Footer
		const footerOffset = shardOffset;

		// version: u64,                    // Footer version (must be 1)
		// file_info_offset: u64,           // Offset to file info section
		// cas_info_offset: u64,            // Offset to CAS info section
		// reserved 48 bytes
		// chunk_hash_hmac_key: [u64; 4],   // HMAC key for chunk hashes (32 bytes)
		// shard_creation_timestamp: u64,   // Creation time (seconds since epoch)
		// shard_key_expiry: u64,           // Expiry time (seconds since epoch)
		// _buffer: [u64; 6],               // Reserved space (48 bytes)
		// stored_bytes_on_disk: u64,       // Total bytes stored on disk
		// materialized_bytes: u64,         // Total materialized bytes
		// stored_bytes: u64,               // Total stored bytes
		// footer_offset: u64,

		shardView.setBigUint64(shardOffset, SHARD_FOOTER_VERSION, true);
		shardOffset += 8;
		shardView.setBigUint64(shardOffset, BigInt(SHARD_HEADER_SIZE), true); // beginning of fileinfo section
		shardOffset += 8;
		shardView.setBigUint64(shardOffset, BigInt(xorbInfoOffset), true); // beginning of xorbinfo section
		shardOffset += 8;

		for (let i = 0; i < 48; i++) {
			shardView.setUint8(shardOffset + i, 0);
		}
		shardOffset += 48;

		// Chunk HMAC
		for (let i = 0; i < 32; i++) {
			shardView.setUint8(shardOffset + i, 0);
		}
		shardOffset += 32;

		shardView.setBigUint64(shardOffset, BigInt(Math.floor(Date.now() / 1000)), true);
		shardOffset += 8;

		// Shard key expiration
		shardView.setBigUint64(shardOffset, 0n, true);
		shardOffset += 8;

		// Reserved space (48 bytes)
		for (let i = 0; i < 48; i++) {
			shardView.setUint8(shardOffset + i, 0);
		}
		shardOffset += 48;

		shardView.setBigUint64(shardOffset, xorbTotalSize, true);
		shardOffset += 8;

		shardView.setBigUint64(shardOffset, fileTotalSize, true);
		shardOffset += 8;

		shardView.setBigUint64(shardOffset, xorbTotalUnpackedSize, true);
		shardOffset += 8;

		shardView.setBigUint64(shardOffset, BigInt(footerOffset), true);

		xorbViewOffset = 0;
		fileViewOffset = 0;
		xorbTotalSize = 0n;
		xorbTotalUnpackedSize = 0n;
		fileTotalSize = 0n;

		return shard;
	}

	// If un-uploaded data remains, upload it
	if (xorbViewOffset || fileViewOffset) {
		await uploadShard(createShard(), params);
	}
}

// Todo: switch from hex to non-hex when WASM switches. For now consider hash is hex
function writeHashToArray(hash: string, array: Uint8Array, offset: number) {
	for (let i = 0; i < hash.length; i += 16) {
		// Write a uint64 in little endian
		array[offset + i / 2] = parseInt(hash.substring(i + 2 * 7, i + 2 * 8), 16);
		array[offset + i / 2 + 1] = parseInt(hash.substring(i + 2 * 6, i + 2 * 7), 16);
		array[offset + i / 2 + 2] = parseInt(hash.substring(i + 2 * 5, i + 2 * 6), 16);
		array[offset + i / 2 + 3] = parseInt(hash.substring(i + 2 * 4, i + 2 * 5), 16);
		array[offset + i / 2 + 4] = parseInt(hash.substring(i + 2 * 3, i + 2 * 4), 16);
		array[offset + i / 2 + 5] = parseInt(hash.substring(i + 2 * 2, i + 2 * 3), 16);
		array[offset + i / 2 + 6] = parseInt(hash.substring(i + 2 * 1, i + 2 * 2), 16);
		array[offset + i / 2 + 7] = parseInt(hash.substring(i + 2 * 0, i + 2 * 1), 16);
	}
}

async function uploadXorb(
	xorb: { hash: string; xorb: Uint8Array; files: Array<{ path: string; progress: number; lastSentProgress: number }> },
	params: UploadShardsParams
) {
	const token = await xetWriteToken(params);

	const resp = await (params.fetch ?? fetch)(`${token.casUrl}/v1/xorbs/default/${xorb.hash}`, {
		method: "POST",
		body: xorb.xorb,
		headers: {
			Authorization: `Bearer ${token.accessToken}`,
			...(params.xetParams.sessionId ? { "X-Xet-Session-Id": params.xetParams.sessionId } : {}),
		},
		...{
			progressHint: {
				progressCallback: (progress: number) => {
					for (const file of xorb.files) {
						params.yieldCallback?.({
							event: "fileProgress",
							path: file.path,
							progress: file.lastSentProgress + (file.progress - file.lastSentProgress) * progress,
						});
					}
				},
			},
		},
	});

	if (!resp.ok) {
		throw await createApiError(resp);
	}
}

async function uploadShard(shard: Uint8Array, params: UploadShardsParams) {
	const token = await xetWriteToken(params);

	const resp = await (params.fetch ?? fetch)(`${token.casUrl}/v1/shards`, {
		method: "POST",
		body: shard,
		headers: {
			Authorization: `Bearer ${token.accessToken}`,
			...(params.xetParams.sessionId ? { "X-Xet-Session-Id": params.xetParams.sessionId } : {}),
		},
	});

	if (!resp.ok) {
		throw await createApiError(resp);
	}
}
