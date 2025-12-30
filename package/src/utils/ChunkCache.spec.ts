import { describe, it, expect } from "vitest";
import { ChunkCache } from "./ChunkCache";

describe("ChunkCache", () => {
	describe("basic operations", () => {
		it("should create a cache with specified max size", () => {
			const cache = new ChunkCache(5);
			expect(cache.maxSize).toBe(5);
			expect(cache.index).toBe(0);
		});

		it("should add and retrieve chunks", () => {
			const cache = new ChunkCache(5);

			cache.addChunkToCache("hash1", 100, 10, null);
			cache.addChunkToCache("hash2", 200, 20, null);

			const chunk1 = cache.getChunk("hash1", null);
			const chunk2 = cache.getChunk("hash2", null);

			expect(chunk1).toEqual({ xorbIndex: 100, chunkIndex: 10 });
			expect(chunk2).toEqual({ xorbIndex: 200, chunkIndex: 20 });
		});

		it("should return undefined for non-existent chunks", () => {
			const cache = new ChunkCache(5);

			const chunk = cache.getChunk("nonexistent", null);
			expect(chunk).toBeUndefined();
		});

		it("should remove chunks from cache", () => {
			const cache = new ChunkCache(5);

			cache.addChunkToCache("hash1", 100, 10, null);
			expect(cache.getChunk("hash1", null)).toBeDefined();

			cache.removeChunkFromCache("hash1");
			expect(cache.getChunk("hash1", null)).toBeUndefined();
		});
	});

	describe("duplicate handling", () => {
		it("should ignore duplicate hashes", () => {
			const cache = new ChunkCache(5);

			// Add initial chunk
			cache.addChunkToCache("hash1", 100, 10, null);
			expect(cache.index).toBe(1);
			expect(cache.map.size).toBe(1);

			// Try to add same hash again - should be ignored
			cache.addChunkToCache("hash1", 999, 99, null);
			expect(cache.index).toBe(1); // index should not increment
			expect(cache.map.size).toBe(1); // map size should not increase

			// Original data should be preserved
			const chunk = cache.getChunk("hash1", null);
			expect(chunk).toEqual({ xorbIndex: 100, chunkIndex: 10 });
		});

		it("should maintain consistency when adding duplicates mixed with new hashes", () => {
			const cache = new ChunkCache(5);

			// Add some chunks
			cache.addChunkToCache("hash1", 100, 10, null);
			cache.addChunkToCache("hash2", 200, 20, null);
			cache.addChunkToCache("hash3", 300, 30, null);

			expect(cache.index).toBe(3);
			expect(cache.map.size).toBe(3);

			// Try to add duplicates
			cache.addChunkToCache("hash1", 999, 99, null); // duplicate
			cache.addChunkToCache("hash4", 400, 40, null); // new
			cache.addChunkToCache("hash2", 888, 88, null); // duplicate

			expect(cache.index).toBe(4); // only incremented for hash4
			expect(cache.map.size).toBe(4);

			// Verify all chunks are accessible and have correct data
			expect(cache.getChunk("hash1", null)).toEqual({ xorbIndex: 100, chunkIndex: 10 });
			expect(cache.getChunk("hash2", null)).toEqual({ xorbIndex: 200, chunkIndex: 20 });
			expect(cache.getChunk("hash3", null)).toEqual({ xorbIndex: 300, chunkIndex: 30 });
			expect(cache.getChunk("hash4", null)).toEqual({ xorbIndex: 400, chunkIndex: 40 });
		});
	});

	describe("cache overflow and circular buffer behavior", () => {
		it("should handle cache overflow correctly", () => {
			const cache = new ChunkCache(3); // Small cache size

			// Fill the cache to capacity
			cache.addChunkToCache("hash1", 100, 10, null);
			cache.addChunkToCache("hash2", 200, 20, null);
			cache.addChunkToCache("hash3", 300, 30, null);

			expect(cache.index).toBe(0); // wrapped around (3 % 3 = 0)
			expect(cache.map.size).toBe(3);

			// All chunks should be accessible
			expect(cache.getChunk("hash1", null)).toBeDefined();
			expect(cache.getChunk("hash2", null)).toBeDefined();
			expect(cache.getChunk("hash3", null)).toBeDefined();

			// Add one more chunk - should evict the oldest (hash1)
			cache.addChunkToCache("hash4", 400, 40, null);

			expect(cache.index).toBe(1); // wrapped around (4 % 3 = 1)
			expect(cache.map.size).toBe(3); // size should remain the same

			// hash1 should be evicted, others should remain
			expect(cache.getChunk("hash1", null)).toBeUndefined();
			expect(cache.getChunk("hash2", null)).toEqual({ xorbIndex: 200, chunkIndex: 20 });
			expect(cache.getChunk("hash3", null)).toEqual({ xorbIndex: 300, chunkIndex: 30 });
			expect(cache.getChunk("hash4", null)).toEqual({ xorbIndex: 400, chunkIndex: 40 });
		});

		it("should continue evicting oldest entries as new ones are added", () => {
			const cache = new ChunkCache(3);

			// Fill cache
			cache.addChunkToCache("hash1", 100, 10, null);
			cache.addChunkToCache("hash2", 200, 20, null);
			cache.addChunkToCache("hash3", 300, 30, null);

			// Add more chunks to test multiple evictions
			cache.addChunkToCache("hash4", 400, 40, null); // evicts hash1
			cache.addChunkToCache("hash5", 500, 50, null); // evicts hash2
			cache.addChunkToCache("hash6", 600, 60, null); // evicts hash3

			expect(cache.map.size).toBe(3);

			// Only the last 3 should remain
			expect(cache.getChunk("hash1", null)).toBeUndefined();
			expect(cache.getChunk("hash2", null)).toBeUndefined();
			expect(cache.getChunk("hash3", null)).toBeUndefined();
			expect(cache.getChunk("hash4", null)).toEqual({ xorbIndex: 400, chunkIndex: 40 });
			expect(cache.getChunk("hash5", null)).toEqual({ xorbIndex: 500, chunkIndex: 50 });
			expect(cache.getChunk("hash6", null)).toEqual({ xorbIndex: 600, chunkIndex: 60 });
		});

		it("should handle removals during overflow correctly", () => {
			const cache = new ChunkCache(3);

			// Fill cache
			cache.addChunkToCache("hash1", 100, 10, null);
			cache.addChunkToCache("hash2", 200, 20, null);
			cache.addChunkToCache("hash3", 300, 30, null);

			// Remove middle element
			cache.removeChunkFromCache("hash2");
			expect(cache.map.size).toBe(2);

			// Add new elements
			cache.addChunkToCache("hash4", 400, 40, null);
			cache.addChunkToCache("hash5", 500, 50, null);

			// The removal should not affect the eviction logic
			expect(cache.getChunk("hash1", null)).toBeUndefined(); // evicted
			expect(cache.getChunk("hash2", null)).toBeUndefined(); // removed
			expect(cache.getChunk("hash3", null)).toEqual({ xorbIndex: 300, chunkIndex: 30 });
			expect(cache.getChunk("hash4", null)).toEqual({ xorbIndex: 400, chunkIndex: 40 });
			expect(cache.getChunk("hash5", null)).toEqual({ xorbIndex: 500, chunkIndex: 50 });
		});
	});

	describe("consistency after operations", () => {
		it("should maintain consistent state after mixed operations", () => {
			const cache = new ChunkCache(4);

			// Add initial chunks
			cache.addChunkToCache("a", 1, 10, null);
			cache.addChunkToCache("b", 2, 20, null);
			cache.addChunkToCache("c", 3, 30, null);

			// Mix of operations
			cache.addChunkToCache("a", 999, 999, null); // duplicate (ignored)
			cache.removeChunkFromCache("b"); // removal
			cache.addChunkToCache("d", 4, 40, null); // new addition
			cache.addChunkToCache("e", 5, 50, null); // new addition - this triggers overflow
			cache.addChunkToCache("c", 888, 888, null); // duplicate (ignored)

			// Verify final state
			// With cache size 4: a(0), b(1, removed), c(2), d(3), e(4 -> 0, wraps and evicts a)
			expect(cache.getChunk("a", null)).toBeUndefined(); // evicted by e
			expect(cache.getChunk("b", null)).toBeUndefined(); // removed
			expect(cache.getChunk("c", null)).toEqual({ xorbIndex: 3, chunkIndex: 30 });
			expect(cache.getChunk("d", null)).toEqual({ xorbIndex: 4, chunkIndex: 40 });
			expect(cache.getChunk("e", null)).toEqual({ xorbIndex: 5, chunkIndex: 50 });

			// Map size should be 3 (a evicted, b removed)
			expect(cache.map.size).toBe(3);
		});

		it("should maintain consistency after cache overflow with mixed operations", () => {
			const cache = new ChunkCache(3);

			// Fill cache
			cache.addChunkToCache("first", 1, 1, null);
			cache.addChunkToCache("second", 2, 2, null);
			cache.addChunkToCache("third", 3, 3, null);

			// Cause overflow with duplicates and removals mixed in
			cache.addChunkToCache("fourth", 4, 4, null); // evicts "first"
			cache.addChunkToCache("second", 999, 999, null); // duplicate (ignored)
			cache.removeChunkFromCache("third"); // removal
			cache.addChunkToCache("fifth", 5, 5, null); // evicts "second"

			// Final state verification
			expect(cache.getChunk("first", null)).toBeUndefined(); // evicted
			expect(cache.getChunk("second", null)).toBeUndefined(); // evicted
			expect(cache.getChunk("third", null)).toBeUndefined(); // removed
			expect(cache.getChunk("fourth", null)).toEqual({ xorbIndex: 4, chunkIndex: 4 });
			expect(cache.getChunk("fifth", null)).toEqual({ xorbIndex: 5, chunkIndex: 5 });

			cache.addChunkToCache("sixth", 6, 6, null); // new, takes "third" place
			expect(cache.getChunk("sixth", null)).toEqual({ xorbIndex: 6, chunkIndex: 6 });
			expect(cache.getChunk("fourth", null)).toEqual({ xorbIndex: 4, chunkIndex: 4 });
			expect(cache.getChunk("fifth", null)).toEqual({ xorbIndex: 5, chunkIndex: 5 });

			cache.addChunkToCache("seventh", 7, 7, null); // new, takes "fourth" place
			expect(cache.getChunk("seventh", null)).toEqual({ xorbIndex: 7, chunkIndex: 7 });
			expect(cache.getChunk("fourth", null)).toBeUndefined(); // evicted
			expect(cache.getChunk("fifth", null)).toEqual({ xorbIndex: 5, chunkIndex: 5 });

			expect(cache.map.size).toBe(3);
		});
	});

	describe("negative xorbIndex handling", () => {
		it("should handle negative xorbIndex values (remote xorbs)", () => {
			const cache = new ChunkCache(5);

			cache.addChunkToCache("remote1", -1, 10, null);
			cache.addChunkToCache("local1", 1, 20, null);
			cache.addChunkToCache("remote2", -100, 30, null);

			expect(cache.getChunk("remote1", null)).toEqual({ xorbIndex: -1, chunkIndex: 10 });
			expect(cache.getChunk("local1", null)).toEqual({ xorbIndex: 1, chunkIndex: 20 });
			expect(cache.getChunk("remote2", null)).toEqual({ xorbIndex: -100, chunkIndex: 30 });
		});
	});

	describe("edge cases", () => {
		it("should handle cache with max size of 1", () => {
			const cache = new ChunkCache(1);

			cache.addChunkToCache("hash1", 1, 1, null);
			expect(cache.getChunk("hash1", null)).toBeDefined();

			cache.addChunkToCache("hash2", 2, 2, null);
			expect(cache.getChunk("hash1", null)).toBeUndefined(); // evicted
			expect(cache.getChunk("hash2", null)).toEqual({ xorbIndex: 2, chunkIndex: 2 });
		});

		it("should handle empty cache operations", () => {
			const cache = new ChunkCache(5);

			expect(cache.getChunk("nonexistent", null)).toBeUndefined();
			cache.removeChunkFromCache("nonexistent"); // should not throw
			expect(cache.map.size).toBe(0);
		});
	});
});
