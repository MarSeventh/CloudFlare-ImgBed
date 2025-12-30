import { describe, expect, it } from "vitest";
import { mergeAsyncGenerators } from "./mergeAsyncGenerators";
import { splitAsyncGenerator } from "./splitAsyncGenerator";

describe("mergeAsyncGenerators", () => {
	const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
	it("should merge multiple async generators", async () => {
		const generator1 = (async function* () {
			yield 1;
			yield 2;
			await sleep(250);
			yield 3;
		})();
		const generator2 = (async function* () {
			await sleep(100);
			yield 4;
			yield 5;
			yield 6;
		})();
		const generator3 = (async function* () {
			await sleep(200);
			yield 7;
			yield 8;
			yield 9;
		})();

		const results: number[] = [];

		for await (const result of mergeAsyncGenerators([generator1, generator2, generator3])) {
			results.push(result);
		}
		expect(results).toEqual([1, 2, 4, 5, 6, 7, 8, 9, 3]);
	});

	it("should merge multiple async generators from a single source", async () => {
		const source = (async function* () {
			yield 1;
			yield 2;
			yield 3;
			yield 4;
			yield 5;
			yield 6;
			yield 7;
			yield 8;
			yield 9;
		})();
		const sources = splitAsyncGenerator(source, 3);

		const generator1 = (async function* () {
			for await (const result of sources[0]) {
				yield { result, gen: 1 };
				await sleep(100);
			}
		})();

		const generator2 = (async function* () {
			await sleep(50);
			for await (const result of sources[1]) {
				yield { result, gen: 2 };
				await sleep(100);
			}
		})();

		const generator3 = (async function* () {
			await sleep(80);
			let count = 0;
			for await (const result of sources[2]) {
				yield { result, gen: 3 };
				count++;

				if (count >= 2) {
					return;
				}
			}
		})();

		const results: { result: number; gen: number }[] = [];
		for await (const result of mergeAsyncGenerators([generator1, generator2, generator3])) {
			results.push(result);
		}
		expect(results.length).toBe(9);
		expect(results).toEqual([
			{ result: 1, gen: 1 },
			{ result: 2, gen: 2 },
			{ result: 3, gen: 3 },
			{ result: 4, gen: 3 },
			{ result: 5, gen: 1 },
			{ result: 6, gen: 2 },
			{ result: 7, gen: 1 },
			{ result: 8, gen: 2 },
			{ result: 9, gen: 1 },
		]);
	});
});
