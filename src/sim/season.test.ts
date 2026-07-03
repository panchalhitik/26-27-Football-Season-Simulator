import { describe, expect, it } from 'vitest';
import { buildFormTrajectories, monteCarloSeason, runSeasonOnce } from './season';
import { FORM_MOMENTUM_CAP, FORM_SEASON_CAP } from './balance';
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

describe('buildFormTrajectories', () => {
  it('deterministic: same seed → same trajectories', () => {
    const teams = mkInput().strengths;
    const a = buildFormTrajectories(99, teams, 18);
    const b = buildFormTrajectories(99, teams, 18);
    expect(a).toEqual(b);
  });

  it('form stays within the season + momentum caps', () => {
    const teams = mkInput().strengths;
    for (let seed = 0; seed < 50; seed++) {
      const forms = buildFormTrajectories(seed, teams, 38);
      for (const traj of forms.values()) {
        for (const f of traj) {
          expect(Math.abs(f)).toBeLessThanOrEqual(FORM_SEASON_CAP + FORM_MOMENTUM_CAP + 1e-9);
        }
      }
    }
  });

  it('momentum is streaky: consecutive matchdays are positively correlated', () => {
    const teams = mkInput().strengths;
    let num = 0, den = 0;
    for (let seed = 0; seed < 40; seed++) {
      const forms = buildFormTrajectories(seed, teams, 38);
      for (const traj of forms.values()) {
        const mean = traj.reduce((a, b) => a + b, 0) / traj.length;
        for (let i = 1; i < traj.length; i++) {
          num += (traj[i]! - mean) * (traj[i - 1]! - mean);
          den += (traj[i - 1]! - mean) ** 2;
        }
      }
    }
    // AR(1) with rho 0.7 → lag-1 autocorrelation well above zero
    expect(num / den).toBeGreaterThan(0.3);
  });

  it('teams differ: form is per-team, not shared', () => {
    const teams = mkInput().strengths;
    const forms = buildFormTrajectories(7, teams, 38);
    const first = forms.get('arsenal')!;
    const second = forms.get('mancity')!;
    expect(first).not.toEqual(second);
  });
});

describe('season variance (form layers)', () => {
  it('identical strengths still produce different champions across seeds', () => {
    // Two near-equal rivals: neither should sweep every season.
    const strengths = [
      ts('a', 85, 85), ts('b', 85, 84), ts('c', 78, 78), ts('d', 76, 76),
      ts('e', 74, 74), ts('f', 72, 72), ts('g', 70, 70), ts('h', 69, 69),
      ts('i', 68, 68), ts('j', 67, 67),
    ];
    let aTitles = 0;
    const N = 60;
    for (let s = 0; s < N; s++) {
      const run = runSeasonOnce({ seed: 3000 + s * 17, userClubId: 'a', strengths, monteCarloRuns: 1 });
      if (run.userPosition === 1) aTitles++;
    }
    // 'a' is marginally stronger — should win more than a third but far from all.
    expect(aTitles / N).toBeGreaterThan(0.3);
    expect(aTitles / N).toBeLessThan(0.85);
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
