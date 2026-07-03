import { describe, expect, it } from 'vitest';
import { mulberry32 } from '@/engine/rng';
import { CUP_ROUND_RANK, simulateUserCupRun, type CupKind } from './cups';
import type { TeamStrength } from '@/types';

function ts(id: string, atk: number, def: number, chem = 0.7, mor = 50): TeamStrength {
  return { clubId: id, attack: atk, defense: def, homeBoost: 5, chemistry01: chem, mor };
}

/** A realistic PL-shaped pool: 5 big clubs + 14 mid/lower-table sides. */
const POOL: TeamStrength[] = [
  ts('peer1', 84, 84, 0.78, 82), ts('peer2', 83, 82, 0.75, 76), ts('peer3', 81, 80, 0.72, 70),
  ts('peer4', 80, 79, 0.70, 66), ts('peer5', 78, 78, 0.68, 60),
  ts('f01', 78, 76, 0.66, 55), ts('f02', 76, 74), ts('f03', 74, 73), ts('f04', 73, 71),
  ts('f05', 72, 70), ts('f06', 71, 70), ts('f07', 70, 69), ts('f08', 70, 69),
  ts('f09', 69, 70), ts('f10', 71, 68), ts('f11', 69, 69), ts('f12', 68, 67),
  ts('f13', 66, 65), ts('f14', 65, 65),
];

const ELITE = [...POOL]
  .sort((a, b) => (b.attack + b.defense) - (a.attack + a.defense))
  .slice(0, 8);

const AVG = { attack: 74, defense: 73 };

const TITLE_SQUAD = ts('me-top', 86, 85, 0.92, 85);
const MID_SQUAD = ts('me-mid', 75, 75, 0.65, 50);
const WEAK_SQUAD = ts('me-weak', 67, 66, 0.55, 30);

function winRate(user: TeamStrength, cup: CupKind, opponents: TeamStrength[], runs: number, seedBase: number): number {
  let wins = 0;
  for (let i = 0; i < runs; i++) {
    const run = simulateUserCupRun({
      rng: mulberry32(seedBase + i),
      cup,
      user,
      opponents,
      leagueAvg: AVG,
    });
    if (run.reached === 'Winners') wins++;
  }
  return wins / runs;
}

describe('simulateUserCupRun — calibration', () => {
  it('a title-class squad wins the FA Cup sometimes, never routinely', () => {
    const pct = winRate(TITLE_SQUAD, 'FA Cup', POOL, 1000, 10_000);
    // Real Big-6 sides win the FA Cup roughly 1-in-4 to 1-in-8 seasons.
    expect(pct).toBeGreaterThan(0.06);
    expect(pct).toBeLessThan(0.38);
  });

  it('a title-class squad wins the EFL Cup at a similar clip', () => {
    const pct = winRate(TITLE_SQUAD, 'EFL', POOL, 1000, 20_000);
    expect(pct).toBeGreaterThan(0.06);
    expect(pct).toBeLessThan(0.42);
  });

  it('the UCL is the hardest trophy — even elite squads win it rarely', () => {
    const pct = winRate(TITLE_SQUAD, 'UCL', ELITE, 1000, 30_000);
    expect(pct).toBeGreaterThan(0.02);
    expect(pct).toBeLessThan(0.30);
    // And harder than the domestic cups
    const fa = winRate(TITLE_SQUAD, 'FA Cup', POOL, 1000, 10_000);
    expect(pct).toBeLessThan(fa + 0.05);
  });

  it('a mid-table squad wins domestic cups only occasionally', () => {
    const pct = winRate(MID_SQUAD, 'FA Cup', POOL, 1000, 40_000);
    expect(pct).toBeLessThan(0.08);
  });

  it('a weak squad essentially never wins a cup', () => {
    const fa = winRate(WEAK_SQUAD, 'FA Cup', POOL, 1000, 50_000);
    const ucl = winRate(WEAK_SQUAD, 'UCL', ELITE, 1000, 60_000);
    expect(fa).toBeLessThan(0.03);
    expect(ucl).toBeLessThan(0.02);
  });

  it('cup success is monotonic in squad strength', () => {
    const top = winRate(TITLE_SQUAD, 'FA Cup', POOL, 800, 70_000);
    const mid = winRate(MID_SQUAD, 'FA Cup', POOL, 800, 70_000);
    const weak = winRate(WEAK_SQUAD, 'FA Cup', POOL, 800, 70_000);
    expect(top).toBeGreaterThan(mid);
    expect(mid).toBeGreaterThanOrEqual(weak);
  });
});

describe('simulateUserCupRun — structure', () => {
  it('exits are spread across the bracket, not clustered in one round', () => {
    const tally: Record<string, number> = {};
    for (let i = 0; i < 800; i++) {
      const run = simulateUserCupRun({
        rng: mulberry32(80_000 + i),
        cup: 'FA Cup',
        user: TITLE_SQUAD,
        opponents: POOL,
        leagueAvg: AVG,
      });
      tally[run.reached] = (tally[run.reached] ?? 0) + 1;
    }
    // At least 4 distinct exit points across 800 runs, none above 60%.
    expect(Object.keys(tally).length).toBeGreaterThanOrEqual(4);
    expect(Math.max(...Object.values(tally)) / 800).toBeLessThan(0.6);
  });

  it('UCL group-stage exits happen (a poor league phase ends the campaign)', () => {
    let groupExits = 0;
    for (let i = 0; i < 600; i++) {
      const run = simulateUserCupRun({
        rng: mulberry32(90_000 + i),
        cup: 'UCL',
        user: MID_SQUAD,
        opponents: ELITE,
        leagueAvg: AVG,
      });
      if (run.reached === 'Group') groupExits++;
    }
    // A mid squad against Europe's best should fall at the league phase often.
    expect(groupExits / 600).toBeGreaterThan(0.3);
  });

  it('determinism: same seed → same run', () => {
    const args = { cup: 'EFL' as const, user: TITLE_SQUAD, opponents: POOL, leagueAvg: AVG };
    const a = simulateUserCupRun({ rng: mulberry32(42), ...args });
    const b = simulateUserCupRun({ rng: mulberry32(42), ...args });
    expect(a).toEqual(b);
  });

  it('empty opponent pool falls back to a neutral side without crashing', () => {
    const run = simulateUserCupRun({
      rng: mulberry32(7),
      cup: 'FA Cup',
      user: TITLE_SQUAD,
      opponents: [],
      leagueAvg: AVG,
    });
    expect(CUP_ROUND_RANK[run.reached]).toBeGreaterThanOrEqual(2);
  });

  it('CUP_ROUND_RANK orders rounds correctly', () => {
    expect(CUP_ROUND_RANK['R3']!).toBeLessThan(CUP_ROUND_RANK['QF']!);
    expect(CUP_ROUND_RANK['QF']!).toBeLessThan(CUP_ROUND_RANK['SF']!);
    expect(CUP_ROUND_RANK['SF']!).toBeLessThan(CUP_ROUND_RANK['Final']!);
    expect(CUP_ROUND_RANK['Final']!).toBeLessThan(CUP_ROUND_RANK['Winners']!);
    expect(CUP_ROUND_RANK['Group']!).toBeLessThan(CUP_ROUND_RANK['Last16']!);
  });
});
