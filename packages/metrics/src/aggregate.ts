/** Percentile of a numeric array (linear interpolation). Returns null if empty. */
export function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo]!;
  const frac = idx - lo;
  return sorted[lo]! * (1 - frac) + sorted[hi]! * frac;
}

export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Exponentially-weighted moving average update. */
export function ewma(prev: number, x: number, alpha: number): number {
  return alpha * x + (1 - alpha) * prev;
}

/** Welford's online stddev — usable in a streaming worker. */
export class RunningStats {
  private n = 0;
  private m = 0;
  private s = 0;
  push(x: number): void {
    this.n++;
    const oldM = this.m;
    this.m += (x - oldM) / this.n;
    this.s += (x - oldM) * (x - this.m);
  }
  get count(): number {
    return this.n;
  }
  get mean(): number {
    return this.m;
  }
  get stddev(): number {
    return this.n > 1 ? Math.sqrt(this.s / (this.n - 1)) : 0;
  }
}
