import { SHARD_FOOTER_VERSION, SHARD_HEADER_VERSION, SHARD_MAGIC_TAG } from "./uploadShards";

const HASH_LENGTH = 32;
const XORB_HASH_BOOKEND = "ff".repeat(HASH_LENGTH);

// Read 4 uint64 in little endian and convert to hex
function readHashFromArray(array: Uint8Array, offset: number): string {
	let hash = "";
	for (let i = 0; i < HASH_LENGTH; i += 8) {
		hash += `${array[offset + i + 7].toString(16).padStart(2, "0")}${array[offset + i + 6]
			.toString(16)
			.padStart(2, "0")}${array[offset + i + 5].toString(16).padStart(2, "0")}${array[offset + i + 4]
			.toString(16)
			.padStart(2, "0")}${array[offset + i + 3].toString(16).padStart(2, "0")}${array[offset + i + 2]
			.toString(16)
			.padStart(2, "0")}${array[offset + i + 1].toString(16).padStart(2, "0")}${array[offset + i]
			.toString(16)
			.padStart(2, "0")}`;
	}
	return hash;
}

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

export async function parseShardData(shardBlob: Blob): Promise<ShardData> {
	const shard = new Uint8Array(await shardBlob.arrayBuffer());
	const shardView = new DataView(shard.buffer);

	const magicTag = shard.slice(0, SHARD_MAGIC_TAG.length);
	if (!magicTag.every((byte, i) => byte === SHARD_MAGIC_TAG[i])) {
		throw new Error("Invalid shard magic tag");
	}

	const version = shardView.getBigUint64(SHARD_MAGIC_TAG.length, true);
	if (version !== SHARD_HEADER_VERSION) {
		throw new Error(`Invalid shard version: ${version}`);
	}

	const footerSize = Number(shardView.getBigUint64(SHARD_MAGIC_TAG.length + 8, true));

	// Read footer to get section offsets
	const footerStart = shard.length - footerSize;
	const footerVersion = shardView.getBigUint64(footerStart, true);
	if (footerVersion !== SHARD_FOOTER_VERSION) {
		throw new Error(`Invalid shard footer version: ${footerVersion}`);
	}

	// version: u64,                    // Footer version (must be 1)
	// file_info_offset: u64,           // Offset to file info section
	// cas_info_offset: u64,            // Offset to CAS info section
	// file_lookup_offset: u64,         // Offset to file lookup table
	// file_lookup_num_entry: u64,      // Number of file lookup entries
	// cas_lookup_offset: u64,          // Offset to CAS lookup table
	// cas_lookup_num_entry: u64,       // Number of CAS lookup entries
	// chunk_lookup_offset: u64,        // Offset to chunk lookup table
	// chunk_lookup_num_entry: u64,     // Number of chunk lookup entries
	// chunk_hash_hmac_key: [u64; 4],   // HMAC key for chunk hashes (32 bytes)
	// shard_creation_timestamp: u64,   // Creation time (seconds since epoch)
	// shard_key_expiry: u64,           // Expiry time (seconds since epoch)
	// _buffer: [u64; 6],               // Reserved space (48 bytes)
	// stored_bytes_on_disk: u64,       // Total bytes stored on disk
	// materialized_bytes: u64,         // Total materialized bytes
	// stored_bytes: u64,               // Total stored bytes
	// footer_offset: u64,

	//	const fileInfoStart = Number(shardView.getBigUint64(footerStart + 8, true));
	const xorbInfoStart = Number(shardView.getBigUint64(footerStart + 16, true));
	const fileLookupStart = Number(shardView.getBigUint64(footerStart + 24, true));
	// const numFileLookups = Number(shardView.getBigUint64(footerStart + 32, true));
	// const xorbLookupStart = Number(shardView.getBigUint64(footerStart + 40, true));
	// const numXorbLookups = Number(shardView.getBigUint64(footerStart + 48, true));
	// const chunkLookupStart = Number(shardView.getBigUint64(footerStart + 56, true));
	// const numChunkLookups = Number(shardView.getBigUint64(footerStart + 64, true));
	const hmacKey = readHashFromArray(shard, footerStart + 72);
	// const shardCreationTimestamp = Number(shardView.getBigUint64(footerStart + 104, true));
	// const shardKeyExpiry = Number(shardView.getBigUint64(footerStart + 112, true));
	// const storedBytesOnDisk = Number(shardView.getBigUint64(footerStart + 168, true));
	// const materializedBytes = Number(shardView.getBigUint64(footerStart + 176, true));
	// const storedBytes = Number(shardView.getBigUint64(footerStart + 184, true));
	// const footerOffset = Number(shardView.getBigUint64(footerStart + 192, true));

	// Parse XORB Info Section
	const xorbs: ShardData["xorbs"] = [];
	let offset = xorbInfoStart;

	while (offset < fileLookupStart) {
		// Read xorb entry
		const xorbHash = readHashFromArray(shard, offset);
		offset += HASH_LENGTH;

		if (xorbHash === XORB_HASH_BOOKEND) {
			break;
		}

		// const flags = shardView.getUint32(offset, true);
		offset += 4;

		const chunkCount = shardView.getUint32(offset, true);
		offset += 4;

		// const numBytesInXorb = shardView.getUint32(offset, true);
		offset += 4;

		// const numBytesUnpacked = shardView.getUint32(offset, true);
		offset += 4;

		// Read chunks for this xorb
		const chunks: ShardData["xorbs"][number]["chunks"] = [];
		for (let i = 0; i < chunkCount; i++) {
			const chunkHash = readHashFromArray(shard, offset);
			offset += HASH_LENGTH;

			const startOffset = shardView.getUint32(offset, true);
			offset += 4;

			const length = shardView.getUint32(offset, true);
			offset += 4;

			// Skip reserved 8 bytes
			offset += 8;

			chunks.push({
				hash: chunkHash,
				startOffset,
				unpackedLength: length,
			});
		}

		xorbs.push({
			hash: xorbHash,
			chunks,
		});
	}

	return {
		hmacKey,
		xorbs,
	};
}
