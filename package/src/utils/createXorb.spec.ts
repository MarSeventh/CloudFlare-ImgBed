import { describe, expect, it } from "vitest";
import { backtrackDedup, CurrentXorbInfo } from "./createXorbs";
import type { ShardData } from "./shardParser";
import { ChunkCache } from "./ChunkCache";

describe("createXorb", () => {
	describe("backtrackDedup", () => {
		it("should update cache info for chunks that go back due to previous chunks being erased", () => {
			const xorb = new CurrentXorbInfo();

			const chunkMetadata = [
				{
					xorbId: xorb.id,
					chunkIndex: 0,
					length: 101,
				},
				{
					xorbId: xorb.id,
					chunkIndex: 1,
					length: 101,
				},
			];
			xorb.chunks = [
				{
					hash: "chunk1",
					length: 101,
					offset: 0,
				},
				{
					hash: "chunk2",
					length: 101,
					offset: 101,
				},
			];
			const shardData: ShardData = {
				hmacKey: "shard1",
				xorbs: [
					{
						hash: "remoteXorb1",
						chunks: [
							{
								hash: "chunk0:shard1",
								startOffset: 0,
								unpackedLength: 100,
							},
							{
								hash: "chunk1:shard1",
								startOffset: 100,
								unpackedLength: 101,
							},
						],
					},
				],
			};

			const computeHmac = (hash: string, key: string) => {
				return hash + ":" + key;
			};

			const chunkCache = new ChunkCache();
			let chunkIndex = 0;
			for (const chunk of xorb.chunks) {
				chunkCache.addChunkToCache(chunk.hash, xorb.id, chunkIndex++, shardData.hmacKey);
			}
			let xorbIndex = 0;
			for (const xorb of shardData.xorbs) {
				xorbIndex--;
				for (let i = 0; i < xorb.chunks.length; i++) {
					chunkCache.addChunkToCache(xorb.chunks[i].hash, xorbIndex, i, shardData.hmacKey);
				}
			}
			const dedup = backtrackDedup(xorb, computeHmac, shardData, chunkCache, chunkMetadata, 0);
			expect(dedup).toBe(101);
			expect(xorb.chunks).toEqual([{ hash: "chunk2", length: 101, offset: 0 }]);
			expect(chunkMetadata).toEqual([
				{
					xorbId: -1,
					chunkIndex: 1,
					length: 101,
				},
				{
					xorbId: 0,
					chunkIndex: 0,
					length: 101,
				},
			]);
			// chunk1 should use remote hash now
			expect(chunkCache.getChunk("chunk1", computeHmac)).toEqual({ xorbIndex: -1, chunkIndex: 1 });
			// The xorb index for chunk2 should be 0 now that the previous chunk was erased from the xorb
			expect(chunkCache.getChunk("chunk2", computeHmac)).toEqual({ xorbIndex: 0, chunkIndex: 0 });
		});
	});
});
