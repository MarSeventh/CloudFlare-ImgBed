import { parseShardData } from "./shardParser";
import { readFile } from "fs/promises";
import { expect, describe, it } from "vitest";
import { init, compute_hmac } from "../vendor/xet-chunk/chunker_wasm";

describe("shardParser", () => {
	it("should parse a shard", async () => {
		const buffer = await readFile("tests/gpt2-64-8bits.tflite.shard");
		const shard = await parseShardData(new Blob([buffer]));
		const expectedJson = JSON.parse(await readFile("tests/gpt2-64-8bits.tflite.shard.json", "utf-8"));

		expect(shard.hmacKey).toBe(expectedJson.hmac_key);
		expect(shard.xorbs.length).toEqual(expectedJson.xorbs.length);
		for (let i = 0; i < shard.xorbs.length; i++) {
			expect(shard.xorbs[i].hash).toEqual(expectedJson.xorbs[i].hash);
			expect(shard.xorbs[i].chunks.length).toEqual(expectedJson.xorbs[i].chunk_hashes.length);
			for (let j = 0; j < shard.xorbs[i].chunks.length; j++) {
				expect(shard.xorbs[i].chunks[j].hash).toEqual(expectedJson.xorbs[i].chunk_hashes[j]);
			}
		}

		await init();

		const chunkHash = "9502eec19d4b0c9f7b389228fa801f68ecdf15d69ccd1da2f9ddbd0219898335";
		expect(compute_hmac(chunkHash, shard.hmacKey)).toEqual(shard.xorbs[1].chunks[0].hash);
	});
});
