import { describe, it, expect } from "vitest";
import { RangeList } from "./RangeList";

describe("RangeList", () => {
	it("should add a single range", () => {
		const rangeList = new RangeList();
		rangeList.add(1, 100);

		const ranges = rangeList.getAllRanges();
		expect(ranges).toHaveLength(1);
		expect(ranges[0]).toEqual({
			start: 1,
			end: 100,
			refCount: 1,
			data: null,
		});
	});

	it("should handle overlapping ranges", () => {
		const rangeList = new RangeList();
		rangeList.add(1, 100);
		rangeList.add(30, 50);

		const ranges = rangeList.getAllRanges();
		expect(ranges).toHaveLength(3);
		expect(ranges).toEqual([
			{ start: 1, end: 30, refCount: 1, data: null },
			{ start: 30, end: 50, refCount: 2, data: null },
			{ start: 50, end: 100, refCount: 1, data: null },
		]);
	});

	it("should remove a range at existing boundaries", () => {
		const rangeList = new RangeList();
		rangeList.add(1, 100);
		rangeList.add(30, 50);
		rangeList.remove(30, 50);

		const ranges = rangeList.getAllRanges();
		expect(ranges).toHaveLength(3);
		expect(ranges).toEqual([
			{ start: 1, end: 30, refCount: 1, data: null },
			{ start: 30, end: 50, refCount: 1, data: null },
			{ start: 50, end: 100, refCount: 1, data: null },
		]);
	});

	it("should throw error when removing range at non-existing boundaries", () => {
		const rangeList = new RangeList();
		rangeList.add(1, 100);
		rangeList.add(30, 50);

		expect(() => rangeList.remove(2, 50)).toThrow("Range boundaries must match existing boundaries");
	});

	it("should get ranges within boundaries", () => {
		const rangeList = new RangeList();
		rangeList.add(1, 100);
		rangeList.add(30, 50);

		const ranges = rangeList.getRanges(30, 100);
		expect(ranges).toHaveLength(2);
		expect(ranges).toEqual([
			{ start: 30, end: 50, refCount: 2, data: null },
			{ start: 50, end: 100, refCount: 1, data: null },
		]);
	});

	it("should throw error when end is less than or equal to start", () => {
		const rangeList = new RangeList();

		expect(() => rangeList.add(100, 1)).toThrow("End must be greater than start");
		expect(() => rangeList.add(1, 1)).toThrow("End must be greater than start");
		expect(() => rangeList.remove(100, 1)).toThrow("End must be greater than start");
		expect(() => rangeList.remove(1, 1)).toThrow("End must be greater than start");
		expect(() => rangeList.getRanges(100, 1)).toThrow("End must be greater than start");
		expect(() => rangeList.getRanges(1, 1)).toThrow("End must be greater than start");
	});

	it("should handle multiple overlapping ranges", () => {
		const rangeList = new RangeList();
		rangeList.add(1, 100);
		rangeList.add(30, 50);
		rangeList.add(40, 60);

		const ranges = rangeList.getAllRanges();
		expect(ranges).toHaveLength(5);
		expect(ranges).toEqual([
			{ start: 1, end: 30, refCount: 1, data: null },
			{ start: 30, end: 40, refCount: 2, data: null },
			{ start: 40, end: 50, refCount: 3, data: null },
			{ start: 50, end: 60, refCount: 2, data: null },
			{ start: 60, end: 100, refCount: 1, data: null },
		]);
	});
});
