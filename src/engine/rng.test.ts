import { describe, expect, it } from 'vitest';
import { mulberry32, poissonSample, randInt, gaussian } from './rng';

describe('mulberry32', () => {
  it('same seed -> identical sequence (determinism)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('different seeds -> different sequences', () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a()).not.toBe(b());
  });

  it('values stay in [0, 1)', () => {
    const r = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('randInt', () => {
  it('stays within bounds', () => {
    const r = mulberry32(1);
    for (let i = 0; i < 500; i++) {
      const v = randInt(r, 3, 9);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(9);
      expect(Number.isInteger(v)).toBe(true);
    }
  });
});

describe('poissonSample', () => {
  it('mean over 5000 draws approximates lambda', () => {
    const r = mulberry32(123);
    const lambda = 2.1;
    let sum = 0;
    const n = 5000;
    for (let i = 0; i < n; i++) sum += poissonSample(r, lambda);
    const mean = sum / n;
    expect(Math.abs(mean - lambda)).toBeLessThan(0.15);
  });

  it('lambda <= 0 always returns 0', () => {
    const r = mulberry32(9);
    expect(poissonSample(r, 0)).toBe(0);
    expect(poissonSample(r, -1)).toBe(0);
  });
});

describe('gaussian', () => {
  it('approximate mean and stddev over many draws', () => {
    const r = mulberry32(2024);
    const n = 5000;
    let sum = 0;
    const samples: number[] = [];
    for (let i = 0; i < n; i++) {
      const s = gaussian(r, 0, 1);
      samples.push(s);
      sum += s;
    }
    const mean = sum / n;
    const variance = samples.reduce((acc, s) => acc + (s - mean) ** 2, 0) / n;
    expect(Math.abs(mean)).toBeLessThan(0.08);
    expect(Math.abs(Math.sqrt(variance) - 1)).toBeLessThan(0.08);
  });
});
