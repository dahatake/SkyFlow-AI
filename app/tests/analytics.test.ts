import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { buildSeed, deepFreeze } from '../src/domain/seed';
import { dataQuality, delayPoints, exceptionHeatmap, fiveNumber, histogramBins, pearson, quantile, staffUtilisation } from '../src/domain/analytics';

describe('analytics statistics', () => {
  it('computes quantiles and Tukey fences', () => {
    expect(quantile([1, 2, 3, 4, 5], 0.5)).toBe(3);
    const f = fiveNumber([1, 2, 3, 4, 5, 100]);
    expect(f.n).toBe(6);
    expect(f.outliers).toEqual([100]);
    expect(f.highFence).toBe(5);
  });
  it('handles empty input', () => {
    expect(fiveNumber([]).n).toBe(0);
    expect(histogramBins([], 5)).toEqual([]);
  });
  it('histogram counts every value exactly once', () => {
    fc.assert(fc.property(fc.array(fc.integer({ min: -200, max: 200 }), { minLength: 1, maxLength: 60 }), (xs) => {
      expect(histogramBins(xs, 10).reduce((a, b) => a + b.count, 0)).toBe(xs.length);
    }));
  });
  it('pearson is 1 for a linear relation and null for constants', () => {
    expect(pearson([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1);
    expect(pearson([1, 1, 1], [1, 2, 3])).toBeNull();
  });
});

describe('analytics over the seed', () => {
  const b = deepFreeze(buildSeed());
  it('covers every task, exception and business unit', () => {
    expect(delayPoints(b)).toHaveLength(b.tasks.length);
    expect(exceptionHeatmap(b).reduce((a, c) => a + c.count, 0)).toBe(b.exceptions.length);
    expect(staffUtilisation(b)).toHaveLength(b.bus.length);
  });
  it('reports completeness within 0..1 and is deterministic', () => {
    const q = dataQuality(b);
    q.forEach((r) => { expect(r.completeness).toBeGreaterThanOrEqual(0); expect(r.completeness).toBeLessThanOrEqual(1); });
    expect(dataQuality(b)).toEqual(q);
  });
});
