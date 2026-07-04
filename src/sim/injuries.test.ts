import { describe, expect, it } from 'vitest';
import { mulberry32 } from '@/engine/rng';
import {
  addInjuries,
  INJURY_BASE_P,
  injuryRiskMultiplier,
  rollMatchdayInjuries,
  tickInjuries,
} from './injuries';
import type { Player } from '@/types';

function p(id: string, age: number): Player {
  return {
    id, name: id, age, position: 'CM', group: 'MID', rating: 80, potential: 82,
    marketValueM: 20, wageK: 80, contractYearsLeft: 3, clubId: 'manutd',
    foot: 'R', nationality: 'X', isStar: false,
  };
}

const XI = Array.from({ length: 11 }, (_, i) => p('p' + i, 26));

describe('rollMatchdayInjuries', () => {
  it('injury rate over many matchdays ≈ base probability', () => {
    const rng = mulberry32(1);
    let events = 0;
    const N = 3000;
    for (let i = 0; i < N; i++) {
      events += rollMatchdayInjuries({ rng, players: XI }).length;
    }
    const perPlayerRate = events / (N * XI.length);
    expect(perPlayerRate).toBeGreaterThan(INJURY_BASE_P * 0.8);
    expect(perPlayerRate).toBeLessThan(INJURY_BASE_P * 1.2);
  });

  it('durations are mostly short with a long tail', () => {
    const rng = mulberry32(2);
    const durations: number[] = [];
    for (let i = 0; i < 5000; i++) {
      for (const ev of rollMatchdayInjuries({ rng, players: XI })) {
        durations.push(ev.matchdaysOut);
      }
    }
    const short = durations.filter((d) => d <= 2).length;
    const long = durations.filter((d) => d >= 6).length;
    expect(short / durations.length).toBeGreaterThan(0.5);
    expect(long / durations.length).toBeLessThan(0.15);
    expect(Math.max(...durations)).toBeLessThanOrEqual(10);
  });

  it('older players get injured more', () => {
    expect(injuryRiskMultiplier(35)).toBeGreaterThan(injuryRiskMultiplier(26));
    expect(injuryRiskMultiplier(26)).toBeGreaterThan(injuryRiskMultiplier(20));
    const rngA = mulberry32(3);
    const rngB = mulberry32(3);
    const old = Array.from({ length: 11 }, (_, i) => p('o' + i, 35));
    let oldCount = 0;
    let youngCount = 0;
    for (let i = 0; i < 2000; i++) {
      oldCount += rollMatchdayInjuries({ rng: rngA, players: old }).length;
      youngCount += rollMatchdayInjuries({ rng: rngB, players: XI }).length;
    }
    expect(oldCount).toBeGreaterThan(youngCount);
  });

  it('deterministic: same seed → same events', () => {
    const a = rollMatchdayInjuries({ rng: mulberry32(9), players: XI });
    const b = rollMatchdayInjuries({ rng: mulberry32(9), players: XI });
    expect(a).toEqual(b);
  });
});

describe('injury table', () => {
  it('tickInjuries heals by one and drops the recovered', () => {
    const t = tickInjuries({ a: 3, b: 1, c: 2 });
    expect(t).toEqual({ a: 2, c: 1 });
  });

  it('addInjuries keeps the longer spell on double-hit', () => {
    const t = addInjuries({ a: 5 }, [{ playerId: 'a', matchdaysOut: 2 }, { playerId: 'b', matchdaysOut: 4 }]);
    expect(t).toEqual({ a: 5, b: 4 });
  });
});
