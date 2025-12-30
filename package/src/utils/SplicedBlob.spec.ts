import { describe, expect, it, beforeEach } from "vitest";
import { SplicedBlob } from "./SplicedBlob";

describe("SplicedBlob", () => {
	let originalBlob: Blob;
	let insertBlob: Blob;
	let replaceBlob: Blob;

	beforeEach(() => {
		// originalBlob: "0123456789" (10 chars)
		originalBlob = new Blob(["0123456789"]);
		// insertBlob: "ABC" (3 chars) - used in tests where we insert something into the blob
		insertBlob = new Blob(["ABC"]);
		// replaceBlob: "XY" (2 chars) - used in tests where part of the blob is replaced
		replaceBlob = new Blob(["XY"]);
	});

	describe("create", () => {
		it("should create a SplicedBlob with valid parameters", () => {
			const splicedBlob = SplicedBlob.create(originalBlob, [{ insert: insertBlob, start: 5, end: 5 }]);
			expect(splicedBlob).toBeInstanceOf(SplicedBlob);
		});

		it("should throw error for negative start", () => {
			expect(() => SplicedBlob.create(originalBlob, [{ insert: insertBlob, start: -1, end: 5 }])).toThrow(
				"Invalid start/end positions for SplicedBlob"
			);
		});

		it("should throw error for negative end", () => {
			expect(() => SplicedBlob.create(originalBlob, [{ insert: insertBlob, start: 5, end: -1 }])).toThrow(
				"Invalid start/end positions for SplicedBlob"
			);
		});

		it("should throw error for start > original.size", () => {
			expect(() => SplicedBlob.create(originalBlob, [{ insert: insertBlob, start: 15, end: 5 }])).toThrow(
				"Invalid start/end positions for SplicedBlob"
			);
		});

		it("should throw error for end > original.size", () => {
			expect(() => SplicedBlob.create(originalBlob, [{ insert: insertBlob, start: 5, end: 15 }])).toThrow(
				"Invalid start/end positions for SplicedBlob"
			);
		});

		it("should throw error for start > end", () => {
			expect(() => SplicedBlob.create(originalBlob, [{ insert: insertBlob, start: 7, end: 5 }])).toThrow(
				"Invalid start/end positions for SplicedBlob"
			);
		});
	});

	describe("size and type", () => {
		it("should calculate size correctly for insertion", () => {
			// Insert "ABC" at position 5: "01234ABC56789" = 13 chars
			const splicedBlob = SplicedBlob.create(originalBlob, [{ insert: insertBlob, start: 5, end: 5 }]);
			expect(splicedBlob.size).toBe(13);
		});

		it("should calculate size correctly for replacement", () => {
			// Replace "345" with "XY": "012XY6789" = 9 chars
			const splicedBlob = SplicedBlob.create(originalBlob, [{ insert: replaceBlob, start: 3, end: 6 }]);
			expect(splicedBlob.size).toBe(9);
		});

		it("should return original blob type", () => {
			const typedBlob = new Blob(["test"], { type: "text/plain" });
			const splicedBlob = SplicedBlob.create(typedBlob, [{ insert: insertBlob, start: 2, end: 2 }]);
			expect(splicedBlob.type).toBe("text/plain");
		});
	});

	describe("text method", () => {
		it("should insert at beginning", async () => {
			// Insert "ABC" at start: "ABC0123456789"
			const splicedBlob = SplicedBlob.create(originalBlob, [{ insert: insertBlob, start: 0, end: 0 }]);
			const text = await splicedBlob.text();
			expect(text).toBe("ABC0123456789");
		});

		it("should insert at end", async () => {
			// Insert "ABC" at end: "0123456789ABC"
			const splicedBlob = SplicedBlob.create(originalBlob, [{ insert: insertBlob, start: 10, end: 10 }]);
			const text = await splicedBlob.text();
			expect(text).toBe("0123456789ABC");
		});

		it("should insert in middle", async () => {
			// Insert "ABC" at position 5: "01234ABC56789"
			const splicedBlob = SplicedBlob.create(originalBlob, [{ insert: insertBlob, start: 5, end: 5 }]);
			const text = await splicedBlob.text();
			expect(text).toBe("01234ABC56789");
		});

		it("should replace content", async () => {
			// Replace "345" with "XY": "012XY6789"
			const splicedBlob = SplicedBlob.create(originalBlob, [{ insert: replaceBlob, start: 3, end: 6 }]);
			const text = await splicedBlob.text();
			expect(text).toBe("012XY6789");
		});

		it("should replace everything", async () => {
			// Replace entire content with "ABC": "ABC"
			const splicedBlob = SplicedBlob.create(originalBlob, [{ insert: insertBlob, start: 0, end: 10 }]);
			const text = await splicedBlob.text();
			expect(text).toBe("ABC");
		});
	});

	describe("slice method - basic cases", () => {
		it("should return empty blob for start >= end", async () => {
			const splicedBlob = SplicedBlob.create(originalBlob, [{ insert: insertBlob, start: 5, end: 5 }]);
			const slice = splicedBlob.slice(5, 5);
			expect(slice.size).toBe(0);
			expect(await slice.text()).toBe("");
		});

		it("should handle slice beyond size", async () => {
			const splicedBlob = SplicedBlob.create(originalBlob, [{ insert: insertBlob, start: 5, end: 5 }]);
			const slice = splicedBlob.slice(10, 20);
			const text = await slice.text();
			expect(text).toBe("789"); // Only gets what's available
		});

		it("should throw error for negative start/end", () => {
			const splicedBlob = SplicedBlob.create(originalBlob, [{ insert: insertBlob, start: 5, end: 5 }]);
			expect(() => splicedBlob.slice(-1, 5)).toThrow("Unsupported negative start/end on SplicedBlob.slice");
			expect(() => splicedBlob.slice(0, -1)).toThrow("Unsupported negative start/end on SplicedBlob.slice");
		});
	});

	describe("slice method - before segment only", () => {
		it("should slice entirely in before segment", async () => {
			// SplicedBlob: "01234ABC56789", slice(1, 4) = "123"
			const splicedBlob = SplicedBlob.create(originalBlob, [{ insert: insertBlob, start: 5, end: 5 }]);
			const slice = splicedBlob.slice(1, 4);
			const text = await slice.text();
			expect(text).toBe("123");
		});

		it("should slice from start of before segment", async () => {
			// SplicedBlob: "01234ABC56789", slice(0, 3) = "012"
			const splicedBlob = SplicedBlob.create(originalBlob, [{ insert: insertBlob, start: 5, end: 5 }]);
			const slice = splicedBlob.slice(0, 3);
			const text = await slice.text();
			expect(text).toBe("012");
		});

		it("should slice to end of before segment", async () => {
			// SplicedBlob: "01234ABC56789", slice(2, 5) = "234"
			const splicedBlob = SplicedBlob.create(originalBlob, [{ insert: insertBlob, start: 5, end: 5 }]);
			const slice = splicedBlob.slice(2, 5);
			const text = await slice.text();
			expect(text).toBe("234");
		});
	});

	describe("slice method - insert segment only", () => {
		it("should slice entirely in insert segment", async () => {
			// SplicedBlob: "01234ABC56789", slice(6, 7) = "B"
			const splicedBlob = SplicedBlob.create(originalBlob, [{ insert: insertBlob, start: 5, end: 5 }]);
			const slice = splicedBlob.slice(6, 7);
			const text = await slice.text();
			expect(text).toBe("B");
		});

		it("should slice entire insert segment", async () => {
			// SplicedBlob: "01234ABC56789", slice(5, 8) = "ABC"
			const splicedBlob = SplicedBlob.create(originalBlob, [{ insert: insertBlob, start: 5, end: 5 }]);
			const slice = splicedBlob.slice(5, 8);
			const text = await slice.text();
			expect(text).toBe("ABC");
		});

		it("should slice from start of insert segment", async () => {
			// SplicedBlob: "01234ABC56789", slice(5, 7) = "AB"
			const splicedBlob = SplicedBlob.create(originalBlob, [{ insert: insertBlob, start: 5, end: 5 }]);
			const slice = splicedBlob.slice(5, 7);
			const text = await slice.text();
			expect(text).toBe("AB");
		});

		it("should slice to end of insert segment", async () => {
			// SplicedBlob: "01234ABC56789", slice(6, 8) = "BC"
			const splicedBlob = SplicedBlob.create(originalBlob, [{ insert: insertBlob, start: 5, end: 5 }]);
			const slice = splicedBlob.slice(6, 8);
			const text = await slice.text();
			expect(text).toBe("BC");
		});
	});

	describe("slice method - after segment only", () => {
		it("should slice entirely in after segment", async () => {
			// SplicedBlob: "01234ABC56789", slice(9, 12) = "678"
			const splicedBlob = SplicedBlob.create(originalBlob, [{ insert: insertBlob, start: 5, end: 5 }]);
			const slice = splicedBlob.slice(9, 12);
			const text = await slice.text();
			expect(text).toBe("678");
		});

		it("should slice from start of after segment", async () => {
			// SplicedBlob: "01234ABC56789", slice(8, 11) = "567"
			const splicedBlob = SplicedBlob.create(originalBlob, [{ insert: insertBlob, start: 5, end: 5 }]);
			const slice = splicedBlob.slice(8, 11);
			const text = await slice.text();
			expect(text).toBe("567");
		});

		it("should slice to end of after segment", async () => {
			// SplicedBlob: "01234ABC56789", slice(10, 13) = "789"
			const splicedBlob = SplicedBlob.create(originalBlob, [{ insert: insertBlob, start: 5, end: 5 }]);
			const slice = splicedBlob.slice(10, 13);
			const text = await slice.text();
			expect(text).toBe("789");
		});
	});

	describe("slice method - spanning before and insert", () => {
		it("should slice spanning before and insert segments", async () => {
			// SplicedBlob: "01234ABC56789", slice(3, 7) = "34AB"
			const splicedBlob = SplicedBlob.create(originalBlob, [{ insert: insertBlob, start: 5, end: 5 }]);
			const slice = splicedBlob.slice(3, 7);
			const text = await slice.text();
			expect(text).toBe("34AB");
		});

		it("should slice from start spanning before and insert", async () => {
			// SplicedBlob: "01234ABC56789", slice(0, 6) = "01234A"
			const splicedBlob = SplicedBlob.create(originalBlob, [{ insert: insertBlob, start: 5, end: 5 }]);
			const slice = splicedBlob.slice(0, 6);
			const text = await slice.text();
			expect(text).toBe("01234A");
		});

		it("should slice to end of insert spanning before and insert", async () => {
			// SplicedBlob: "01234ABC56789", slice(4, 8) = "4ABC"
			const splicedBlob = SplicedBlob.create(originalBlob, [{ insert: insertBlob, start: 5, end: 5 }]);
			const slice = splicedBlob.slice(4, 8);
			const text = await slice.text();
			expect(text).toBe("4ABC");
		});
	});

	describe("slice method - spanning insert and after", () => {
		it("should slice spanning insert and after segments", async () => {
			// SplicedBlob: "01234ABC56789", slice(6, 10) = "BC56"
			const splicedBlob = SplicedBlob.create(originalBlob, [{ insert: insertBlob, start: 5, end: 5 }]);
			const slice = splicedBlob.slice(6, 10);
			const text = await slice.text();
			expect(text).toBe("BC56");
		});

		it("should slice from start of insert to end", async () => {
			// SplicedBlob: "01234ABC56789", slice(5, 13) = "ABC56789"
			const splicedBlob = SplicedBlob.create(originalBlob, [{ insert: insertBlob, start: 5, end: 5 }]);
			const slice = splicedBlob.slice(5, 13);
			const text = await slice.text();
			expect(text).toBe("ABC56789");
		});

		it("should slice from middle of insert spanning to after", async () => {
			// SplicedBlob: "01234ABC56789", slice(7, 11) = "C567"
			const splicedBlob = SplicedBlob.create(originalBlob, [{ insert: insertBlob, start: 5, end: 5 }]);
			const slice = splicedBlob.slice(7, 11);
			const text = await slice.text();
			expect(text).toBe("C567");
		});
	});

	describe("slice method - spanning all three segments", () => {
		it("should slice spanning all three segments", async () => {
			// SplicedBlob: "01234ABC56789", slice(3, 10) = "34ABC56"
			const splicedBlob = SplicedBlob.create(originalBlob, [{ insert: insertBlob, start: 5, end: 5 }]);
			const slice = splicedBlob.slice(3, 10);
			const text = await slice.text();
			expect(text).toBe("34ABC56");
		});

		it("should slice entire spliced blob", async () => {
			// SplicedBlob: "01234ABC56789", slice(0, 13) = "01234ABC56789"
			const splicedBlob = SplicedBlob.create(originalBlob, [{ insert: insertBlob, start: 5, end: 5 }]);
			const slice = splicedBlob.slice(0, 13);
			const text = await slice.text();
			expect(text).toBe("01234ABC56789");
		});

		it("should slice most of spliced blob", async () => {
			// SplicedBlob: "01234ABC56789", slice(1, 12) = "1234ABC5678"
			const splicedBlob = SplicedBlob.create(originalBlob, [{ insert: insertBlob, start: 5, end: 5 }]);
			const slice = splicedBlob.slice(1, 12);
			const text = await slice.text();
			expect(text).toBe("1234ABC5678");
		});
	});

	describe("slice method - with replacement", () => {
		it("should slice before replacement", async () => {
			// Replace "345" with "XY": "012XY6789", slice(0, 3) = "012"
			const splicedBlob = SplicedBlob.create(originalBlob, [{ insert: replaceBlob, start: 3, end: 6 }]);
			const slice = splicedBlob.slice(0, 3);
			const text = await slice.text();
			expect(text).toBe("012");
		});

		it("should slice replacement only", async () => {
			// Replace "345" with "XY": "012XY6789", slice(3, 5) = "XY"
			const splicedBlob = SplicedBlob.create(originalBlob, [{ insert: replaceBlob, start: 3, end: 6 }]);
			const slice = splicedBlob.slice(3, 5);
			const text = await slice.text();
			expect(text).toBe("XY");
		});

		it("should slice after replacement", async () => {
			// Replace "345" with "XY": "012XY6789", slice(5, 9) = "6789"
			const splicedBlob = SplicedBlob.create(originalBlob, [{ insert: replaceBlob, start: 3, end: 6 }]);
			const slice = splicedBlob.slice(5, 9);
			const text = await slice.text();
			expect(text).toBe("6789");
		});

		it("should slice spanning before and replacement", async () => {
			// Replace "345" with "XY": "012XY6789", slice(1, 4) = "12X"
			const splicedBlob = SplicedBlob.create(originalBlob, [{ insert: replaceBlob, start: 3, end: 6 }]);
			const slice = splicedBlob.slice(1, 4);
			const text = await slice.text();
			expect(text).toBe("12X");
		});

		it("should slice spanning replacement and after", async () => {
			// Replace "345" with "XY": "012XY6789", slice(4, 7) = "Y67"
			const splicedBlob = SplicedBlob.create(originalBlob, [{ insert: replaceBlob, start: 3, end: 6 }]);
			const slice = splicedBlob.slice(4, 7);
			const text = await slice.text();
			expect(text).toBe("Y67");
		});

		it("should slice spanning all segments with replacement", async () => {
			// Replace "345" with "XY": "012XY6789", slice(1, 8) = "12XY678"
			const splicedBlob = SplicedBlob.create(originalBlob, [{ insert: replaceBlob, start: 3, end: 6 }]);
			const slice = splicedBlob.slice(1, 8);
			const text = await slice.text();
			expect(text).toBe("12XY678");
		});
	});

	describe("slice method - edge cases", () => {
		it("should handle empty insert blob", async () => {
			const emptyBlob = new Blob([""]);
			// Replace "345" with "": "0126789"
			const splicedBlob = SplicedBlob.create(originalBlob, [{ insert: emptyBlob, start: 3, end: 6 }]);
			const text = await splicedBlob.text();
			expect(text).toBe("0126789");

			const slice = splicedBlob.slice(2, 5);
			expect(await slice.text()).toBe("267");
		});

		it("should handle slice at segment boundaries", async () => {
			// SplicedBlob: "01234ABC56789", exact boundary slices
			const splicedBlob = SplicedBlob.create(originalBlob, [{ insert: insertBlob, start: 5, end: 5 }]);

			// End of before segment
			expect(await splicedBlob.slice(4, 5).text()).toBe("4");
			// Start of insert segment
			expect(await splicedBlob.slice(5, 6).text()).toBe("A");
			// End of insert segment
			expect(await splicedBlob.slice(7, 8).text()).toBe("C");
			// Start of after segment
			expect(await splicedBlob.slice(8, 9).text()).toBe("5");
		});

		it("should handle insert at beginning with slice", async () => {
			// Insert "ABC" at start: "ABC0123456789"
			const splicedBlob = SplicedBlob.create(originalBlob, [{ insert: insertBlob, start: 0, end: 0 }]);
			const slice = splicedBlob.slice(1, 5);
			expect(await slice.text()).toBe("BC01");
		});

		it("should handle insert at end with slice", async () => {
			// Insert "ABC" at end: "0123456789ABC"
			const splicedBlob = SplicedBlob.create(originalBlob, [{ insert: insertBlob, start: 10, end: 10 }]);
			const slice = splicedBlob.slice(8, 12);
			expect(await slice.text()).toBe("89AB");
		});
	});

	describe("arrayBuffer method", () => {
		it("should return correct ArrayBuffer for insertion", async () => {
			const splicedBlob = SplicedBlob.create(originalBlob, [{ insert: insertBlob, start: 5, end: 5 }]);
			const buffer = await splicedBlob.arrayBuffer();
			const text = new TextDecoder().decode(buffer);
			expect(text).toBe("01234ABC56789");
			expect(buffer.byteLength).toBe(13);
		});

		it("should return correct ArrayBuffer for replacement", async () => {
			const splicedBlob = SplicedBlob.create(originalBlob, [{ insert: replaceBlob, start: 3, end: 6 }]);
			const buffer = await splicedBlob.arrayBuffer();
			const text = new TextDecoder().decode(buffer);
			expect(text).toBe("012XY6789");
			expect(buffer.byteLength).toBe(9);
		});
	});

	describe("stream method", () => {
		it("should return correct stream for insertion", async () => {
			const splicedBlob = SplicedBlob.create(originalBlob, [{ insert: insertBlob, start: 5, end: 5 }]);
			const stream = splicedBlob.stream();
			const response = new Response(stream);
			const text = await response.text();
			expect(text).toBe("01234ABC56789");
		});

		it("should return correct stream for replacement", async () => {
			const splicedBlob = SplicedBlob.create(originalBlob, [{ insert: replaceBlob, start: 3, end: 6 }]);
			const stream = splicedBlob.stream();
			const response = new Response(stream);
			const text = await response.text();
			expect(text).toBe("012XY6789");
		});

		it("should handle empty segments in stream", async () => {
			const emptyBlob = new Blob([""]);
			const splicedBlob = SplicedBlob.create(originalBlob, [{ insert: emptyBlob, start: 5, end: 5 }]);
			const stream = splicedBlob.stream();
			const response = new Response(stream);
			const text = await response.text();
			expect(text).toBe("0123456789");
		});
	});

	describe("nested slicing", () => {
		it("should allow slicing of sliced blob", async () => {
			// SplicedBlob: "01234ABC56789", slice(3, 10) = "34ABC56", then slice(2, 5) = "ABC"
			const splicedBlob = SplicedBlob.create(originalBlob, [{ insert: insertBlob, start: 5, end: 5 }]);
			const firstSlice = splicedBlob.slice(3, 10);
			const secondSlice = firstSlice.slice(2, 5);
			const text = await secondSlice.text();
			expect(text).toBe("ABC");
		});

		it("should handle multiple levels of slicing", async () => {
			// Complex slicing chain
			const splicedBlob = SplicedBlob.create(originalBlob, [{ insert: insertBlob, start: 5, end: 5 }]);
			const slice1 = splicedBlob.slice(2, 11); // "234ABC567"
			const slice2 = slice1.slice(1, 7); // "34ABC5"
			const slice3 = slice2.slice(2, 5); // "ABC"
			const text = await slice3.text();
			expect(text).toBe("ABC");
		});
	});
});
