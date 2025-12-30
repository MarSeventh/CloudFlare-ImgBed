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
export declare class RangeList<T> {
    private ranges;
    /**
     * Add a range to the list. If it overlaps with existing ranges,
     * it will split them and increment reference counts accordingly.
     */
    add(start: number, end: number): void;
    /**
     * Remove a range from the list. The range must start and end at existing boundaries.
     */
    remove(start: number, end: number): void;
    /**
     * Get all ranges within the specified boundaries.
     */
    getRanges(start: number, end: number): Range<T>[];
    /**
     * Get all ranges in the list
     */
    getAllRanges(): Range<T>[];
}
export {};
//# sourceMappingURL=RangeList.d.ts.map