import { describe, it, expect } from "vitest";
import { combineUint8Arrays } from "./combineUint8Arrays";

describe("combineUint8Arrays", () => {
	it.each([
		{ a: [], b: [], expected: [] },
		{ a: [], b: [1, 2, 3], expected: [1, 2, 3] },
		{ a: [4, 5, 6], b: [], expected: [4, 5, 6] },
		{ a: [7, 8], b: [9, 10], expected: [7, 8, 9, 10] },
		{ a: [1], b: [2, 3, 4], expected: [1, 2, 3, 4] },
	])("combines $a and $b to $expected", ({ a, b, expected }) => {
		const result = combineUint8Arrays(new Uint8Array(a), new Uint8Array(b));
		expect(result).toEqual(new Uint8Array(expected));
	});
});
