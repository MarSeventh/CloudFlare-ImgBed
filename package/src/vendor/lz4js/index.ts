// lz4.js - An implementation of Lz4 in plain JavaScript.
//
// TODO:
// - Unify header parsing/writing.
// - Support options (block size, checksums)
// - Support streams
// - Better error handling (handle bad offset, etc.)
// - HC support (better search algorithm)
// - Tests/benchmarking

import * as xxhash from "./xxh32.js";
import * as util from "./util.js";

// Constants
// --

// Compression format parameters/constants.
const minMatch = 4;
const matchSearchLimit = 12;
const minTrailingLitterals = 5;
const skipTrigger = 6;
const hashSize = 1 << 16;

// Token constants.
const mlBits = 4;
const mlMask = (1 << mlBits) - 1;
const runBits = 4;
const runMask = (1 << runBits) - 1;

// Shared buffers
const blockBuf = makeBuffer(5 << 20);
const hashTable = makeHashTable();

// Frame constants.
const magicNum = 0x184d2204;

// Frame descriptor flags.
const fdContentChksum = 0x4;
const fdContentSize = 0x8;
const fdBlockChksum = 0x10;
// var fdBlockIndep = 0x20;
const fdVersion = 0x40;
const fdVersionMask = 0xc0;

// Block sizes.
const bsUncompressed = 0x80000000;
const bsDefault = 7;
const bsShift = 4;
const bsMask = 7;
const bsMap: Record<number, number> = {
	4: 0x10000,
	5: 0x40000,
	6: 0x100000,
	7: 0x400000,
};

// Utility functions/primitives
// --

// Makes our hashtable. On older browsers, may return a plain array.
function makeHashTable() {
	try {
		return new Uint32Array(hashSize);
	} catch (error) {
		const hashTable = new Array(hashSize);

		for (let i = 0; i < hashSize; i++) {
			hashTable[i] = 0;
		}

		return hashTable;
	}
}

// Clear hashtable.
function clearHashTable(table: Uint32Array | number[]) {
	for (let i = 0; i < hashSize; i++) {
		table[i] = 0;
	}
}

// Makes a byte buffer. On older browsers, may return a plain array.
function makeBuffer(size: number) {
	return new Uint8Array(size);
}

function sliceArray(array: Uint8Array, start: number, end: number) {
	return array.slice(start, end);
}

// Implementation
// --

// Calculates an upper bound for lz4 compression.
export function compressBound(n: number) {
	return (n + n / 255 + 16) | 0;
}

// Calculates an upper bound for lz4 decompression, by reading the data.
export function decompressBound(src: Uint8Array) {
	let sIndex = 0;

	// Read magic number
	if (util.readU32(src, sIndex) !== magicNum) {
		throw new Error("invalid magic number");
	}

	sIndex += 4;

	// Read descriptor
	const descriptor = src[sIndex++];

	// Check version
	if ((descriptor & fdVersionMask) !== fdVersion) {
		throw new Error("incompatible descriptor version " + (descriptor & fdVersionMask));
	}

	// Read flags
	const useBlockSum = (descriptor & fdBlockChksum) !== 0;
	const useContentSize = (descriptor & fdContentSize) !== 0;

	// Read block size
	const bsIdx = (src[sIndex++] >> bsShift) & bsMask;

	if (bsMap[bsIdx] === undefined) {
		throw new Error("invalid block size " + bsIdx);
	}

	const maxBlockSize = bsMap[bsIdx];

	// Get content size
	if (useContentSize) {
		return util.readU64(src, sIndex);
	}

	// Checksum
	sIndex++;

	// Read blocks.
	let maxSize = 0;
	while (true) {
		let blockSize = util.readU32(src, sIndex);
		sIndex += 4;

		if (blockSize & bsUncompressed) {
			blockSize &= ~bsUncompressed;
			maxSize += blockSize;
		} else if (blockSize > 0) {
			maxSize += maxBlockSize;
		}

		if (blockSize === 0) {
			return maxSize;
		}

		if (useBlockSum) {
			sIndex += 4;
		}

		sIndex += blockSize;
	}
}

// Decompresses a block of Lz4.
export function decompressBlock(src: Uint8Array, dst: Uint8Array, sIndex: number, sLength: number, dIndex: number) {
	let mLength, mOffset, sEnd, n, i;
	const hasCopyWithin = dst.copyWithin !== undefined && dst.fill !== undefined;

	// Setup initial state.
	sEnd = sIndex + sLength;

	// Consume entire input block.
	while (sIndex < sEnd) {
		const token = src[sIndex++];

		// Copy literals.
		let literalCount = token >> 4;
		if (literalCount > 0) {
			// Parse length.
			if (literalCount === 0xf) {
				while (true) {
					literalCount += src[sIndex];
					if (src[sIndex++] !== 0xff) {
						break;
					}
				}
			}

			// Copy literals
			for (n = sIndex + literalCount; sIndex < n; ) {
				dst[dIndex++] = src[sIndex++];
			}
		}

		if (sIndex >= sEnd) {
			break;
		}

		// Copy match.
		mLength = token & 0xf;

		// Parse offset.
		mOffset = src[sIndex++] | (src[sIndex++] << 8);

		// Parse length.
		if (mLength === 0xf) {
			while (true) {
				mLength += src[sIndex];
				if (src[sIndex++] !== 0xff) {
					break;
				}
			}
		}

		mLength += minMatch;

		// Copy match
		// prefer to use typedarray.copyWithin for larger matches
		// NOTE: copyWithin doesn't work as required by LZ4 for overlapping sequences
		// e.g. mOffset=1, mLength=30 (repeach char 30 times)
		// we special case the repeat char w/ array.fill
		if (hasCopyWithin && mOffset === 1) {
			dst.fill(dst[dIndex - 1] | 0, dIndex, dIndex + mLength);
			dIndex += mLength;
		} else if (hasCopyWithin && mOffset > mLength && mLength > 31) {
			dst.copyWithin(dIndex, dIndex - mOffset, dIndex - mOffset + mLength);
			dIndex += mLength;
		} else {
			for (i = dIndex - mOffset, n = i + mLength; i < n; ) {
				dst[dIndex++] = dst[i++] | 0;
			}
		}
	}

	return dIndex;
}

// Compresses a block with Lz4.
export function compressBlock(
	src: Uint8Array,
	dst: Uint8Array,
	sIndex: number,
	sLength: number,
	hashTable: Uint32Array | number[]
) {
	let mIndex, mAnchor, mLength, mOffset, mStep;
	let literalCount, dIndex, sEnd, n;

	// Setup initial state.
	dIndex = 0;
	sEnd = sLength + sIndex;
	mAnchor = sIndex;

	let searchMatchCount = (1 << skipTrigger) + 3;

	// Search for matches with a limit of matchSearchLimit bytes
	// before the end of block (Lz4 spec limitation.)
	while (sIndex <= sEnd - matchSearchLimit) {
		const seq = util.readU32(src, sIndex);
		let hash = util.hashU32(seq) >>> 0;

		// Crush hash to 16 bits.
		hash = (((hash >> 16) ^ hash) >>> 0) & 0xffff;

		// Look for a match in the hashtable. NOTE: remove one; see below.
		mIndex = hashTable[hash] - 1;

		// Put pos in hash table. NOTE: add one so that zero = invalid.
		hashTable[hash] = sIndex + 1;

		// Determine if there is a match (within range.)
		if (mIndex < 0 || (sIndex - mIndex) >>> 16 > 0 || util.readU32(src, mIndex) !== seq) {
			mStep = searchMatchCount++ >> skipTrigger;
			sIndex += mStep;
			continue;
		}

		searchMatchCount = (1 << skipTrigger) + 3;

		// Calculate literal count and offset.
		literalCount = sIndex - mAnchor;
		mOffset = sIndex - mIndex;

		// We've already matched one word, so get that out of the way.
		sIndex += minMatch;
		mIndex += minMatch;

		// Determine match length.
		// N.B.: mLength does not include minMatch, Lz4 adds it back
		// in decoding.
		mLength = sIndex;
		while (sIndex < sEnd - minTrailingLitterals && src[sIndex] === src[mIndex]) {
			sIndex++;
			mIndex++;
		}
		mLength = sIndex - mLength;

		// Write token + literal count.
		const token = mLength < mlMask ? mLength : mlMask;
		if (literalCount >= runMask) {
			dst[dIndex++] = (runMask << mlBits) + token;
			for (n = literalCount - runMask; n >= 0xff; n -= 0xff) {
				dst[dIndex++] = 0xff;
			}
			dst[dIndex++] = n;
		} else {
			dst[dIndex++] = (literalCount << mlBits) + token;
		}

		// Write literals.
		for (let i = 0; i < literalCount; i++) {
			dst[dIndex++] = src[mAnchor + i];
		}

		// Write offset.
		dst[dIndex++] = mOffset;
		dst[dIndex++] = mOffset >> 8;

		// Write match length.
		if (mLength >= mlMask) {
			for (n = mLength - mlMask; n >= 0xff; n -= 0xff) {
				dst[dIndex++] = 0xff;
			}
			dst[dIndex++] = n;
		}

		// Move the anchor.
		mAnchor = sIndex;
	}

	// Nothing was encoded.
	if (mAnchor === 0) {
		return 0;
	}

	// Write remaining literals.
	// Write literal token+count.
	literalCount = sEnd - mAnchor;
	if (literalCount >= runMask) {
		dst[dIndex++] = runMask << mlBits;
		for (n = literalCount - runMask; n >= 0xff; n -= 0xff) {
			dst[dIndex++] = 0xff;
		}
		dst[dIndex++] = n;
	} else {
		dst[dIndex++] = literalCount << mlBits;
	}

	// Write literals.
	sIndex = mAnchor;
	while (sIndex < sEnd) {
		dst[dIndex++] = src[sIndex++];
	}

	return dIndex;
}

// Decompresses a frame of Lz4 data.
export function decompressFrame(src: Uint8Array, dst: Uint8Array) {
	let useBlockSum, useContentSum, useContentSize, descriptor;
	let sIndex = 0;
	let dIndex = 0;

	// Read magic number
	if (util.readU32(src, sIndex) !== magicNum) {
		throw new Error("invalid magic number");
	}

	sIndex += 4;

	// Read descriptor
	descriptor = src[sIndex++];

	// Check version
	if ((descriptor & fdVersionMask) !== fdVersion) {
		throw new Error("incompatible descriptor version");
	}

	// Read flags
	useBlockSum = (descriptor & fdBlockChksum) !== 0;
	useContentSum = (descriptor & fdContentChksum) !== 0;
	useContentSize = (descriptor & fdContentSize) !== 0;

	// Read block size
	const bsIdx = (src[sIndex++] >> bsShift) & bsMask;

	if (bsMap[bsIdx] === undefined) {
		throw new Error("invalid block size");
	}

	if (useContentSize) {
		// TODO: read content size
		sIndex += 8;
	}

	sIndex++;

	// Read blocks.
	while (true) {
		var compSize;

		compSize = util.readU32(src, sIndex);
		sIndex += 4;

		if (compSize === 0) {
			break;
		}

		if (useBlockSum) {
			// TODO: read block checksum
			sIndex += 4;
		}

		// Check if block is compressed
		if ((compSize & bsUncompressed) !== 0) {
			// Mask off the 'uncompressed' bit
			compSize &= ~bsUncompressed;

			// Copy uncompressed data into destination buffer.
			for (let j = 0; j < compSize; j++) {
				dst[dIndex++] = src[sIndex++];
			}
		} else {
			// Decompress into blockBuf
			dIndex = decompressBlock(src, dst, sIndex, compSize, dIndex);
			sIndex += compSize;
		}
	}

	if (useContentSum) {
		// TODO: read content checksum
		sIndex += 4;
	}

	return dIndex;
}

// Compresses data to an Lz4 frame.
export function compressFrame(src: Uint8Array, dst: Uint8Array) {
	let dIndex = 0;

	// Write magic number.
	util.writeU32(dst, dIndex, magicNum);
	dIndex += 4;

	// Descriptor flags.
	dst[dIndex++] = fdVersion;
	dst[dIndex++] = bsDefault << bsShift;

	// Descriptor checksum.
	dst[dIndex] = xxhash.hash(0, dst, 4, dIndex - 4) >> 8;
	dIndex++;

	// Write blocks.
	const maxBlockSize = bsMap[bsDefault];
	let remaining = src.length;
	let sIndex = 0;

	// Clear the hashtable.
	clearHashTable(hashTable);

	// Split input into blocks and write.
	while (remaining > 0) {
		let compSize = 0;
		const blockSize = remaining > maxBlockSize ? maxBlockSize : remaining;

		compSize = compressBlock(src, blockBuf, sIndex, blockSize, hashTable);

		if (compSize > blockSize || compSize === 0) {
			// Output uncompressed.
			util.writeU32(dst, dIndex, 0x80000000 | blockSize);
			dIndex += 4;

			for (let z = sIndex + blockSize; sIndex < z; ) {
				dst[dIndex++] = src[sIndex++];
			}

			remaining -= blockSize;
		} else {
			// Output compressed.
			util.writeU32(dst, dIndex, compSize);
			dIndex += 4;

			for (let j = 0; j < compSize; ) {
				dst[dIndex++] = blockBuf[j++];
			}

			sIndex += blockSize;
			remaining -= blockSize;
		}
	}

	// Write blank end block.
	util.writeU32(dst, dIndex, 0);
	dIndex += 4;

	return dIndex;
}

// Decompresses a buffer containing an Lz4 frame. maxSize is optional; if not
// provided, a maximum size will be determined by examining the data. The
// buffer returned will always be perfectly-sized.
export function decompress(src: Uint8Array, maxSize: number) {
	let dst, size;

	if (maxSize === undefined) {
		maxSize = decompressBound(src);
	}
	dst = makeBuffer(maxSize);
	size = decompressFrame(src, dst);

	if (size !== maxSize) {
		dst = sliceArray(dst, 0, size);
	}

	return dst;
}

// Compresses a buffer to an Lz4 frame. maxSize is optional; if not provided,
// a buffer will be created based on the theoretical worst output size for a
// given input size. The buffer returned will always be perfectly-sized.
export function compress(src: Uint8Array, maxSize?: number) {
	let dst, size;

	if (maxSize === undefined) {
		maxSize = compressBound(src.length);
	}

	dst = makeBuffer(maxSize);
	size = compressFrame(src, dst);

	if (size !== maxSize) {
		dst = sliceArray(dst, 0, size);
	}

	return dst;
}
