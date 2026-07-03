import type { SeededRNG } from '@/types';

/**
 * mulberry32 — small, fast, deterministic PRNG.
 * Same seed always produces the same sequence. Pass the returned function
 * into any engine/sim code that needs randomness instead of using Math.random.
 */
export function mulberry32(seed: number): SeededRNG {
  let a = seed >>> 0;
  return function next(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Uniform integer in [min, max] inclusive. */
export function randInt(rng: SeededRNG, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/** Random pick from a non-empty array. */
export function pick<T>(rng: SeededRNG, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick() called on empty array');
  const idx = Math.floor(rng() * items.length);
  return items[idx] as T;
}

/** Standard normal via Box–Muller, using the supplied RNG. */
export function gaussian(rng: SeededRNG, mean = 0, stddev = 1): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  const mag = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + mag * stddev;
}

/**
 * Knuth's Poisson sampler — adequate for the small lambdas (~0.5..3) we use.
 * Returns a non-negative integer.
 */
export function poissonSample(rng: SeededRNG, lambda: number): number {
  if (lambda <= 0) return 0;
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  while (true) {
    k += 1;
    p *= rng();
    if (p <= L) return k - 1;
    if (k > 50) return k - 1; // safety
  }
}
