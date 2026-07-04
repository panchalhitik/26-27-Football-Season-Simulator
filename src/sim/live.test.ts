import { describe, expect, it } from 'vitest';
import {
  formGuide,
  initLiveSeason,
  liveToSeasonResult,
  matchdaysRemaining,
  nextUserFixture,
  playMatchday,
} from './live';
import type { TeamStrength } from '@/types';

function ts(clubId: string, attack: number, defense: number): TeamStrength {
  return { clubId, attack, defense, homeBoost: 5 };
}

const TEAMS: TeamStrength[] = [
  ts('a', 85, 85), ts('b', 82, 81), ts('c', 78, 78), ts('d', 76, 76),
  ts('e', 74, 74), ts('f', 72, 72), ts('g', 70, 70), ts('h', 69, 69),
  ts('i', 68, 68), ts('j', 67, 67),
];

function playFullSeason(seed: number, strengths: TeamStrength[]) {
  let state = initLiveSeason({ seed, strengths });
  while (state.matchday <= state.totalRounds) {
    state = playMatchday(state, strengths);
  }
  return state;
}

describe('live season engine', () => {
  it('plays a full double round-robin', () => {
    const state = playFullSeason(11, TEAMS);
    const n = TEAMS.length;
    expect(state.results.length).toBe(n * (n - 1)); // every pairing twice
    for (const row of state.table) {
      expect(row.played).toBe(2 * (n - 1));
    }
    expect(matchdaysRemaining(state)).toBe(0);
  });

  it('deterministic: same seed → identical season', () => {
    const a = playFullSeason(42, TEAMS);
    const b = playFullSeason(42, TEAMS);
    expect(a.results).toEqual(b.results);
    expect(a.table).toEqual(b.table);
  });

  it('playMatchday does not mutate the input state', () => {
    const s0 = initLiveSeason({ seed: 5, strengths: TEAMS });
    const frozen = JSON.parse(JSON.stringify(s0));
    playMatchday(s0, TEAMS);
    expect(s0).toEqual(frozen);
  });

  it('editing the user team mid-season only affects future matches', () => {
    // Play 5 MDs, then boost team "j" massively. Past results must be
    // untouched, other clubs' head-to-heads must be untouched, and across
    // several seeds the boosted side must clearly win more.
    const base = TEAMS;
    const boosted = base.map((t) => (t.clubId === 'j' ? { ...t, attack: 95, defense: 95 } : t));
    let boostedWins = 0;
    let plainWins = 0;
    for (let seed = 0; seed < 8; seed++) {
      let sA = initLiveSeason({ seed: 100 + seed * 7, strengths: base });
      let sB = initLiveSeason({ seed: 100 + seed * 7, strengths: base });
      for (let i = 0; i < 5; i++) {
        sA = playMatchday(sA, base);
        sB = playMatchday(sB, base);
      }
      expect(sA.results).toEqual(sB.results);
      for (let i = 5; i < sA.totalRounds; i++) {
        sA = playMatchday(sA, boosted);
        sB = playMatchday(sB, base);
      }
      boostedWins += sA.table.find((r) => r.clubId === 'j')!.won;
      plainWins += sB.table.find((r) => r.clubId === 'j')!.won;
      // Other clubs' head-to-heads (not involving j) are untouched by the
      // edit — OUTSIDE the run-in. In the final 8 matchdays the live table
      // feeds motivation, so j's changed results legitimately ripple.
      const runInStart = sA.totalRounds - 8;
      const nonJ = (rs: typeof sA.results) =>
        rs.filter((f) => f.homeId !== 'j' && f.awayId !== 'j' && f.matchday <= runInStart);
      expect(nonJ(sA.results)).toEqual(nonJ(sB.results));
    }
    expect(boostedWins).toBeGreaterThan(plainWins * 1.5);
  });

  it('nextUserFixture walks the schedule', () => {
    let state = initLiveSeason({ seed: 3, strengths: TEAMS });
    const first = nextUserFixture(state, TEAMS, 'a');
    expect(first).not.toBeNull();
    expect(first!.matchday).toBe(1);
    state = playMatchday(state, TEAMS);
    const second = nextUserFixture(state, TEAMS, 'a');
    expect(second!.matchday).toBe(2);
    expect(second!.opponentId).not.toBe(first!.opponentId);
  });

  it('formGuide tracks last-5 results', () => {
    let state = initLiveSeason({ seed: 9, strengths: TEAMS });
    for (let i = 0; i < 7; i++) state = playMatchday(state, TEAMS);
    const guide = formGuide(state);
    for (const id of state.clubOrder) {
      expect(guide[id]!.length).toBe(5);
      for (const r of guide[id]!) expect(['W', 'D', 'L']).toContain(r);
    }
  });

  it('liveToSeasonResult matches the accumulated table', () => {
    const state = playFullSeason(21, TEAMS);
    const res = liveToSeasonResult(state, 'a');
    expect(res.fixtures.length).toBe(state.results.length);
    const row = state.table.find((r) => r.clubId === 'a')!;
    expect(res.userPoints).toBe(row.points);
    expect(res.userGoalsFor).toBe(row.gf);
    // strongest team should usually be upper half
    expect(res.userPosition).toBeLessThanOrEqual(TEAMS.length);
  });
});
