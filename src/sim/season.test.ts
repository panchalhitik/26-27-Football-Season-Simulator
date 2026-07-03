import { describe, expect, it } from 'vitest';
import { monteCarloSeason, runSeasonOnce } from './season';
import type { TeamStrength, SeasonRunInput } from '@/types';

function ts(clubId: string, attack: number, defense: number): TeamStrength {
  return { clubId, attack, defense, homeBoost: 5 };
}

function mkInput(over: Partial<SeasonRunInput> = {}): SeasonRunInput {
  return {
    seed: 7,
    userClubId: 'arsenal',
    monteCarloRuns: 1,
    strengths: [
      ts('arsenal', 85, 85),
      ts('mancity', 84, 83),
      ts('manutd', 76, 75),
      ts('liverpool', 83, 82),
      ts('chelsea', 78, 78),
      ts('spurs', 78, 76),
      ts('newcastle', 75, 75),
      ts('villa', 74, 74),
      ts('brighton', 73, 72),
      ts('west-ham', 71, 70),
    ],
    ...over,
  };
}

describe('runSeasonOnce', () => {
  it('produces a full table summing to a consistent number of points', () => {
    const out = runSeasonOnce(mkInput());
    const totalPlayed = out.finalTable.reduce((sum, r) => sum + r.played, 0);
    // Every fixture is counted twice in `played` (once per side)
    expect(totalPlayed).toBe(out.fixtures.length * 2);

    const totalPoints = out.finalTable.reduce((sum, r) => sum + r.points, 0);
    const drawCount = out.fixtures.filter((f) => f.homeGoals === f.awayGoals).length;
    const decisiveCount = out.fixtures.length - drawCount;
    expect(totalPoints).toBe(decisiveCount * 3 + drawCount * 2);
  });

  it('deterministic: same input -> identical output', () => {
    const a = runSeasonOnce(mkInput());
    const b = runSeasonOnce(mkInput());
    expect(a).toEqual(b);
  });

  it('every team plays N-1 home and N-1 away (double RR)', () => {
    const out = runSeasonOnce(mkInput());
    const n = out.finalTable.length;
    expect(out.finalTable.every((r) => r.played === 2 * (n - 1))).toBe(true);
  });

  it('user has a defined league position', () => {
    const out = runSeasonOnce(mkInput());
    expect(out.userPosition).toBeGreaterThanOrEqual(1);
    expect(out.userPosition).toBeLessThanOrEqual(out.finalTable.length);
  });
});

describe('monteCarloSeason', () => {
  it('strong team finishes top-4 most of the time', () => {
    const out = monteCarloSeason(mkInput({ monteCarloRuns: 200 }));
    expect(out.pctTop4).toBeGreaterThan(70);
  });

  it('weak team has high relegation probability', () => {
    const out = monteCarloSeason(mkInput({
      userClubId: 'west-ham',
      monteCarloRuns: 200,
    }));
    expect(out.pctRelegation).toBeGreaterThan(40);
  });
});
