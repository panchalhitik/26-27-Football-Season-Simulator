import { describe, expect, it } from 'vitest';
import { expectedGoals, simulateFixture } from './poisson';
import { mulberry32 } from '@/engine/rng';
import type { TeamStrength } from '@/types';

function ts(attack: number, defense: number): TeamStrength {
  return { clubId: 't', attack, defense, homeBoost: 5 };
}

describe('expectedGoals', () => {
  it('stronger team scores more in expectation', () => {
    const a = expectedGoals(ts(90, 85), ts(70, 70));
    const b = expectedGoals(ts(70, 70), ts(90, 85));
    expect(a.homeLambda).toBeGreaterThan(b.homeLambda);
  });

  it('home team gets a small boost', () => {
    const home = ts(80, 80);
    const away = ts(80, 80);
    const { homeLambda, awayLambda } = expectedGoals(home, away);
    expect(homeLambda).toBeGreaterThan(awayLambda);
  });

  it('lambdas clamp into sane range', () => {
    const monster = expectedGoals(ts(99, 99), ts(30, 30));
    expect(monster.homeLambda).toBeLessThanOrEqual(7);
    expect(monster.awayLambda).toBeGreaterThanOrEqual(0.05);
  });

  it('stronger team scores more even against league average', () => {
    // 90 attack team vs 60 defense team should clearly outperform a
    // 60 attack team vs 90 defense.
    const strong = expectedGoals(ts(90, 80), ts(60, 60));
    const weak   = expectedGoals(ts(60, 80), ts(60, 90));
    expect(strong.homeLambda).toBeGreaterThan(weak.homeLambda * 1.5);
  });

  it('high chemistry team beats low chemistry team in expected goals', () => {
    const hi = expectedGoals(
      { clubId: 'h', attack: 80, defense: 80, homeBoost: 5, chemistry01: 1.0 },
      { clubId: 'a', attack: 80, defense: 80, homeBoost: 5, chemistry01: 0.0 },
    );
    expect(hi.homeLambda).toBeGreaterThan(hi.awayLambda * 1.15);
  });
});

describe('simulateFixture', () => {
  it('deterministic given the same seed', () => {
    const a = simulateFixture(mulberry32(1), ts(82, 80), ts(78, 76));
    const b = simulateFixture(mulberry32(1), ts(82, 80), ts(78, 76));
    expect(a).toEqual(b);
  });

  it('stronger team wins more often over many sims', () => {
    const rng = mulberry32(99);
    let strongerWins = 0;
    const N = 2000;
    for (let i = 0; i < N; i++) {
      const { homeGoals, awayGoals } = simulateFixture(rng, ts(88, 85), ts(70, 70));
      if (homeGoals > awayGoals) strongerWins += 1;
    }
    expect(strongerWins / N).toBeGreaterThan(0.55);
  });
});
