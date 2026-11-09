import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { mergeIntervals, type Interval } from '../src/intervals';

// Read the spec in src/intervals/mergeIntervals.ts, then check your progress
// with `npm run mutants:intervals`.
//
// Label every property with its pattern, on the line above its `it(`:
//   // Pattern: invariant. The output is sorted.
// (invariant, algebraic, metamorphic, differential, or conditional)

// Build valid intervals (start <= end) directly: pick a start and a length.
// Small numbers so intervals often overlap or share an endpoint.
const interval: fc.Arbitrary<Interval> = fc
  .tuple(fc.integer({ min: -20, max: 20 }), fc.nat(10))
  .map(([start, length]): Interval => [start, start + length]);
const intervalList = fc.array(interval, { maxLength: 8 });

describe('mergeIntervals', () => {
  // Pattern: invariant. Every input interval lies inside some output interval.
  it('every input interval lies inside some output interval', () => {
    fc.assert(
      fc.property(intervalList, xs => {
        const out = mergeIntervals(xs);
        const uncovered = xs.filter(([s, e]) => !out.some(([a, b]) => a <= s && e <= b));
        expect(uncovered).toEqual([]);
      }),
    );
  });

  // Pattern: invariant. The output is sorted, and consecutive intervals neither overlap nor touch.
  it('output is sorted with gaps between consecutive intervals', () => {
    fc.assert(
      fc.property(intervalList, xs => {
        const out = mergeIntervals(xs);
        for (const [start, end] of out) expect(start).toBeLessThanOrEqual(end);
        for (let i = 0; i + 1 < out.length; i++) expect(out[i][1]).toBeLessThan(out[i + 1][0]);
      }),
    );
  });

  // Pattern: invariant. The input array and its intervals are not modified.
  it('does not modify the input', () => {
    fc.assert(
      fc.property(intervalList, xs => {
        const copy = xs.map(([start, end]): Interval => [start, end]);
        mergeIntervals(xs);
        expect(xs).toEqual(copy);
      }),
    );
  });

  // Pattern: differential. Input and output cover exactly the same points, including non-integers.
  it('covers exactly the same points as the input', () => {
    const covered = (list: readonly Interval[], p: number) => list.some(([a, b]) => a <= p && p <= b);
    fc.assert(
      fc.property(intervalList, xs => {
        const out = mergeIntervals(xs);
        for (let p = -21; p <= 31; p += 0.5) expect(covered(out, p)).toBe(covered(xs, p));
      }),
    );
  });

  // Pattern: metamorphic. Shuffling the input does not change the output.
  it('gives the same output for any order of the input', () => {
    const listAndShuffle = intervalList.chain(xs =>
      fc.tuple(fc.constant(xs), fc.shuffledSubarray(xs, { minLength: xs.length, maxLength: xs.length })),
    );
    fc.assert(
      fc.property(listAndShuffle, ([xs, shuffled]) => {
        expect(mergeIntervals(shuffled)).toEqual(mergeIntervals(xs));
      }),
    );
  });

  // Pattern: algebraic. Merging an already merged list changes nothing.
  it('is idempotent', () => {
    fc.assert(
      fc.property(intervalList, xs => {
        const once = mergeIntervals(xs);
        expect(mergeIntervals(once)).toEqual(once);
      }),
    );
  });

  // Pattern: conditional. If no intervals overlap or touch, the output is the input sorted by start.
  it('returns disjoint, non-touching input sorted by start', () => {
    // Build sorted, separated intervals: each one starts at least 1 after the previous end.
    const separated = fc
      .array(fc.tuple(fc.integer({ min: 1, max: 5 }), fc.nat(5)), { maxLength: 8 })
      .map(steps => {
        const result: Interval[] = [];
        let prevEnd = -30;
        for (const [gap, length] of steps) {
          const start = prevEnd + gap;
          result.push([start, start + length]);
          prevEnd = start + length;
        }
        return result;
      });
    const separatedAndShuffle = separated.chain(xs =>
      fc.tuple(fc.constant(xs), fc.shuffledSubarray(xs, { minLength: xs.length, maxLength: xs.length })),
    );
    fc.assert(
      fc.property(separatedAndShuffle, ([sorted, shuffled]) => {
        expect(mergeIntervals(shuffled)).toEqual(sorted);
      }),
    );
  });
});
