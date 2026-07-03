import { describe, expect, it } from 'vitest';
import { mulberry32 } from '@/engine/rng';
import { CUP_ROUND_RANK, simulateUserCupRun } from './cups';

describe('simulateUserCupRun', () => {
  it('strong sides occasionally win, but not every season', () => {
    let wins = 0;
    const RUNS = 2000;
    for (let i = 0; i < RUNS; i++) {
      const rng = mulberry32(1000 + i);
      const run = simulateUserCupRun({
        rng,
        cup: 'FA Cup',
        userStrength: 170, // top tier (Man Utd / City class)
        opponentStrengths: [130, 135, 140, 145, 150, 155, 160, 165],
      });
      if (run.reached === 'Winners') wins++;
    }
    const pct = wins / RUNS;
    // A top side should be FAR from auto-winning. Real EPL Big-6 win FA Cup
    // ~1-in-6 to 1-in-3 seasons each — we target 8-35%.
    expect(pct).toBeGreaterThan(0.05);
    expect(pct).toBeLessThan(0.4);
  });

  it('average sides win cups very rarely', () => {
    let wins = 0;
    const RUNS = 2000;
    for (let i = 0; i < RUNS; i++) {
      const rng = mulberry32(2000 + i);
      const run = simulateUserCupRun({
        rng,
        cup: 'FA Cup',
        userStrength: 150,
        opponentStrengths: [140, 145, 150, 155, 160],
      });
      if (run.reached === 'Winners') wins++;
    }
    expect(wins / RUNS).toBeLessThan(0.1);
  });

  it('weak sides almost never win cups', () => {
    let wins = 0;
    const RUNS = 2000;
    for (let i = 0; i < RUNS; i++) {
      const rng = mulberry32(3000 + i);
      const run = simulateUserCupRun({
        rng,
        cup: 'UCL',
        userStrength: 130,
        opponentStrengths: [155, 160, 165, 170, 175],
      });
      if (run.reached === 'Winners') wins++;
    }
    expect(wins / RUNS).toBeLessThan(0.02);
  });

  it('reached rounds span the bracket (not all final or all R3)', () => {
    const tally: Record<string, number> = {};
    for (let i = 0; i < 1000; i++) {
      const rng = mulberry32(5000 + i);
      const run = simulateUserCupRun({
        rng,
        cup: 'FA Cup',
        userStrength: 160,
        opponentStrengths: [130, 140, 150, 160, 170],
      });
      tally[run.reached] = (tally[run.reached] ?? 0) + 1;
    }
    // Should see at least 3 distinct outcomes in 1000 sims
    expect(Object.keys(tally).length).toBeGreaterThanOrEqual(3);
    // No single outcome dominates >90%
    const max = Math.max(...Object.values(tally));
    expect(max / 1000).toBeLessThan(0.9);
  });

  it('determinism: same seed → same result', () => {
    const args = {
      cup: 'EFL' as const,
      userStrength: 160,
      opponentStrengths: [140, 150, 160],
    };
    const a = simulateUserCupRun({ rng: mulberry32(42), ...args });
    const b = simulateUserCupRun({ rng: mulberry32(42), ...args });
    expect(a).toEqual(b);
  });

  it('CUP_ROUND_RANK orders rounds correctly', () => {
    expect(CUP_ROUND_RANK['R3']).toBeLessThan(CUP_ROUND_RANK['QF']!);
    expect(CUP_ROUND_RANK['QF']).toBeLessThan(CUP_ROUND_RANK['SF']!);
    expect(CUP_ROUND_RANK['SF']).toBeLessThan(CUP_ROUND_RANK['Final']!);
    expect(CUP_ROUND_RANK['Final']).toBeLessThan(CUP_ROUND_RANK['Winners']!);
  });
});
