import { describe, it, expect } from 'vitest';
import { percentile, RunningStats, ewma } from '../src/aggregate.js';

describe('percentile', () => {
  it('returns null on empty', () => {
    expect(percentile([], 0.5)).toBeNull();
  });
  it('p50 of [1..9] is 5', () => {
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9], 0.5)).toBe(5);
  });
  it('p90 interpolates', () => {
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.9)).toBeCloseTo(9.1);
  });
});

describe('RunningStats', () => {
  it('matches numpy std for small sample', () => {
    const r = new RunningStats();
    [4, 8, 6, 5, 3, 7].forEach((x) => r.push(x));
    expect(r.mean).toBeCloseTo(5.5);
    expect(r.stddev).toBeCloseTo(1.870828693, 6);
  });
});

describe('ewma', () => {
  it('alpha=1 takes new value', () => {
    expect(ewma(10, 5, 1)).toBe(5);
  });
  it('alpha=0 keeps old', () => {
    expect(ewma(10, 5, 0)).toBe(10);
  });
});
