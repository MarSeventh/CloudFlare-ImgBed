/**
 * Code generated with this prompt by Cursor:
 *
 * I want to build a class to manage ranges
 *
 * I can add ranges to it with a start& an end (both integer, end > start). It should store those ranges efficiently.
 *
 * When several ranges overlap, eg [1, 100] and [30, 50], I want the class to split the range into non-overlapping ranges, and add a "ref counter" to the ranges. For example,  [1, 30], [30, 50] * 2, [50, 100]
 *
 * I also want to be able to remove ranges, it will decrease the ref counter or remove the range altogether. I can only remove ranges at existing boundaries. For example, with the [1, 30], [30, 50] * 2, [50, 100] configuration
 *
 * - removing [1, 100] => the only range remaning is [30, 50]
 * - removing [2, 50] => error, because "2' is not a boundary
 * - removing [30, 50] => [1, 30], [30, 50], [50, 100] (do not "merge" the ranges back together)
 *
 * I want to be able to associate data to each range. And I want to be able to get the ranges inside boundaries. For example , with [1, 30], [30, 50] * 2, [50, 100] configuration
 *
 * - getting [30, 100] => I receive [30, 50] * 2, [50, 100], and I can get / modify the data associated to each range by accessing their data prop. Note the "*2" is just the ref counter, there is onlly one range object for the interval returned
 * - getting [2, 50] => I get [30, 50] * 2
 *
 * ----
 *
 * Could optimize with binary search, but the ranges we want to handle are not that many.
 */
interface Range<T> {
	start: number;
	end: number;
	refCount: number;
	data: T | null;
}

export class RangeList<T> {
	private ranges: Range<T>[] = [];

	/**
	 * Add a range to the list. If it overlaps with existing ranges,
	 * it will split them and increment reference counts accordingly.
	 */
	add(start: number, end: number): void {
		if (end <= start) {
			throw new TypeError("End must be greater than start");
		}

		// Find all ranges that overlap with the new range
		const overlappingRanges: { index: number; range: Range<T> }[] = [];
		for (let i = 0; i < this.ranges.length; i++) {
			const range = this.ranges[i];
			if (start < range.end && end > range.start) {
				overlappingRanges.push({ index: i, range });
			}
			if (range.data !== null) {
				throw new Error("Overlapping range already has data");
			}
		}

		if (overlappingRanges.length === 0) {
			// No overlaps, just add the new range
			this.ranges.push({ start, end, refCount: 1, data: null });
			this.ranges.sort((a, b) => a.start - b.start);
			return;
		}

		// Handle overlaps by splitting ranges
		const newRanges: Range<T>[] = [];
		let currentPos = start;

		for (let i = 0; i < overlappingRanges.length; i++) {
			const { range } = overlappingRanges[i];

			// Add range before overlap if exists
			if (currentPos < range.start) {
				newRanges.push({
					start: currentPos,
					end: range.start,
					refCount: 1,
					data: null,
				});
			} else if (range.start < currentPos) {
				newRanges.push({
					start: range.start,
					end: currentPos,
					refCount: range.refCount,
					data: null,
				});
			}

			// Add overlapping part with increased ref count
			newRanges.push({
				start: Math.max(currentPos, range.start),
				end: Math.min(end, range.end),
				refCount: range.refCount + 1,
				data: null,
			});

			// Add remaining part of existing range if exists
			if (range.end > end) {
				newRanges.push({
					start: end,
					end: range.end,
					refCount: range.refCount,
					data: null,
				});
			}

			currentPos = Math.max(currentPos, range.end);
		}

		// Add remaining part after last overlap if exists
		if (currentPos < end) {
			newRanges.push({
				start: currentPos,
				end,
				refCount: 1,
				data: null,
			});
		}

		// Remove old overlapping ranges and insert new ones
		const firstIndex = overlappingRanges[0].index;
		const lastIndex = overlappingRanges[overlappingRanges.length - 1].index;
		this.ranges.splice(firstIndex, lastIndex - firstIndex + 1, ...newRanges);
		this.ranges.sort((a, b) => a.start - b.start);
	}

	/**
	 * Remove a range from the list. The range must start and end at existing boundaries.
	 */
	remove(start: number, end: number): void {
		if (end <= start) {
			throw new TypeError("End must be greater than start");
		}

		// Find ranges that need to be modified
		const affectedRanges: { index: number; range: Range<T> }[] = [];
		for (let i = 0; i < this.ranges.length; i++) {
			const range = this.ranges[i];
			if (start < range.end && end > range.start) {
				affectedRanges.push({ index: i, range });
			}
		}

		if (affectedRanges.length === 0) {
			throw new Error("No ranges found to remove");
		}

		// Verify boundaries match
		if (start !== affectedRanges[0].range.start || end !== affectedRanges[affectedRanges.length - 1].range.end) {
			throw new Error("Range boundaries must match existing boundaries");
		}

		// Todo: also check if there's a gap in the middle but it should not happen with our usage

		for (let i = 0; i < affectedRanges.length; i++) {
			const { range } = affectedRanges[i];

			range.refCount--;
		}

		this.ranges = this.ranges.filter((range) => range.refCount > 0);
	}

	/**
	 * Get all ranges within the specified boundaries.
	 */
	getRanges(start: number, end: number): Range<T>[] {
		if (end <= start) {
			throw new TypeError("End must be greater than start");
		}

		return this.ranges.filter((range) => start < range.end && end > range.start);
	}

	/**
	 * Get all ranges in the list
	 */
	getAllRanges(): Range<T>[] {
		return [...this.ranges];
	}
}
