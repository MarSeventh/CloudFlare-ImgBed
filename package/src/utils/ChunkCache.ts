const CHUNK_CACHE_INITIAL_SIZE = 10_000;
const CHUNK_CACHE_GROW_FACTOR = 1.5;
const CHUNK_CACHE_MAX_SIZE = 1_000_000;

export class ChunkCache {
	index = 0;
	// Index >= 0 means local xorb, < 0 means remote xorb
	xorbIndices: Int32Array;
	// Max 8K chunks per xorb, less than 64K uint16_t
	chunkIndices: Uint16Array;
	map = new Map<string, number>(); // hash -> chunkCacheIndex. Less overhead that way, empty object is 60+B and empty array is 40+B
	hmacs = new Set<string>(); // todo : remove old hmacs
	maxSize: number;

	constructor(maxSize: number = CHUNK_CACHE_MAX_SIZE) {
		if (maxSize < 1) {
			throw new Error("maxSize must be at least 1");
		}
		this.maxSize = maxSize;
		this.xorbIndices = new Int32Array(Math.min(CHUNK_CACHE_INITIAL_SIZE, maxSize));
		this.chunkIndices = new Uint16Array(Math.min(CHUNK_CACHE_INITIAL_SIZE, maxSize));
	}

	addChunkToCache(hash: string, xorbIndex: number, chunkIndex: number, hmac: string | null): void {
		if (this.map.has(hash)) {
			// Happens when we receive an existing chunk from remote dedup info (eg duplicate chunk in shard? Or shards with same hmac key
			// sharing chunks/xorbs)

			// processing this chunk again would desync the cache, as `this.map.size` would not increase, as opposed to `this.index`

			// We could readd/remove it to "refresh it"
			return;
		}
		if (this.map.values().next().value === this.index) {
			// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
			this.map.delete(this.map.keys().next().value!);
		}
		this.map.set(hash, this.index);
		if (hmac !== null) {
			this.hmacs.add(hmac);
		}

		if (this.index >= this.xorbIndices.length) {
			// todo: switch to resize() with modern browsers
			const oldXorbIndices = this.xorbIndices;
			const oldChunkIndices = this.chunkIndices;
			this.xorbIndices = new Int32Array(Math.min(this.xorbIndices.length * CHUNK_CACHE_GROW_FACTOR, this.maxSize));
			this.chunkIndices = new Uint16Array(Math.min(this.chunkIndices.length * CHUNK_CACHE_GROW_FACTOR, this.maxSize));
			this.xorbIndices.set(oldXorbIndices);
			this.chunkIndices.set(oldChunkIndices);
		}

		this.xorbIndices[this.index] = xorbIndex;
		this.chunkIndices[this.index] = chunkIndex;
		this.index = (this.index + 1) % this.maxSize;
	}

	getChunk(
		hash: string,
		/**
		 * Set to null if you only want to check against locally created chunks, or the hash is already a hmac
		 */
		hmacFunction: ((hash: string, key: string) => string) | null
	):
		| {
				xorbIndex: number;
				chunkIndex: number;
		  }
		| undefined {
		let index = this.map.get(hash);
		if (index === undefined && hmacFunction !== null) {
			for (const hmac of this.hmacs) {
				index = this.map.get(hmacFunction(hash, hmac));
				if (index !== undefined) {
					break;
				}
			}
		}
		if (index === undefined) {
			return undefined;
		}
		return {
			xorbIndex: this.xorbIndices[index],
			chunkIndex: this.chunkIndices[index],
		};
	}

	updateChunkIndex(hash: string, chunkIndex: number): void {
		const index = this.map.get(hash);
		if (index === undefined) {
			throw new Error(`Chunk not found in cache: ${hash}`);
		}
		this.chunkIndices[index] = chunkIndex;
	}

	removeChunkFromCache(hash: string): void {
		this.map.delete(hash);
	}
}
