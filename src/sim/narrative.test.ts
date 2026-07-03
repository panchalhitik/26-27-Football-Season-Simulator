import { describe, expect, it } from 'vitest';
import { computePositionProgression, pickPlayerOfSeason, pickTopScorer } from './narrative';
import type { FixtureResult, Player, XI } from '@/types';

function f(matchday: number, homeId: string, awayId: string, hg: number, ag: number): FixtureResult {
  return { matchday, month: 'AUG', homeId, awayId, homeGoals: hg, awayGoals: ag };
}

function p(over: Partial<Player> & { id: string; rating: number; position: Player['position']; group: Player['group'] }): Player {
  return {
    name: over.id, age: 25, potential: over.rating + 2,
    marketValueM: 20, wageK: 80, contractYearsLeft: 3, clubId: 'manutd',
    foot: 'R', nationality: 'X', isStar: false,
    ...over,
  };
}

describe('computePositionProgression', () => {
  it('tracks the user climb across matchdays', () => {
    const fixtures: FixtureResult[] = [
      f(1, 'us', 'a', 3, 0),  // us wins big
      f(1, 'b', 'c', 1, 1),
      f(2, 'us', 'b', 2, 1),
      f(2, 'a', 'c', 0, 2),
      f(3, 'c', 'us', 1, 4),
      f(3, 'b', 'a', 2, 0),
    ];
    const trace = computePositionProgression({
      fixtures,
      userClubId: 'us',
      allClubIds: ['us', 'a', 'b', 'c'],
    });
    expect(trace).toHaveLength(3);
    expect(trace[0]?.position).toBe(1);   // 3 pts, +3 gd
    expect(trace[2]?.position).toBe(1);   // 9 pts, +9 gd
    expect(trace[2]?.points).toBe(9);
  });

  it('records position as the bottom rank when user has played nothing yet', () => {
    const trace = computePositionProgression({
      fixtures: [f(1, 'a', 'b', 1, 1)],
      userClubId: 'us',
      allClubIds: ['us', 'a', 'b'],
    });
    // user has 0 pts, drawn fixture has 1 pt each → user sits 3rd
    expect(trace[0]?.position).toBe(3);
  });
});

describe('pickTopScorer', () => {
  it('picks the highest-rated attacker and assigns realistic goals', () => {
    const st = p({ id: 'striker', rating: 88, position: 'ST', group: 'FWD' });
    const lw = p({ id: 'lwing',   rating: 82, position: 'LW', group: 'FWD' });
    const rw = p({ id: 'rwing',   rating: 80, position: 'RW', group: 'FWD' });
    const cb = p({ id: 'defender', rating: 80, position: 'CB', group: 'DEF' });
    const xi: XI = {
      shape: '4-3-3', chemistry: 100, exactMatches: 11,
      assignments: { 0: 'striker', 1: 'lwing', 2: 'rwing', 3: 'defender' },
    };
    const squadById = Object.fromEntries([st, lw, rw, cb].map((x) => [x.id, x]));
    const out = pickTopScorer({ xi, squadById, totalGoalsFor: 80 });
    expect(out?.player.id).toBe('striker');
    expect(out?.goals).toBeGreaterThan(14);
    expect(out?.goals).toBeLessThan(36);
  });

  it('returns null with no attackers', () => {
    const gk = p({ id: 'gk', rating: 85, position: 'GK', group: 'GK' });
    const cb = p({ id: 'cb', rating: 80, position: 'CB', group: 'DEF' });
    const xi: XI = { shape: '4-3-3', chemistry: 0, exactMatches: 0, assignments: { 0: 'gk', 1: 'cb' } };
    const squadById = { gk, cb };
    expect(pickTopScorer({ xi, squadById, totalGoalsFor: 40 })).toBeNull();
  });
});

describe('pickPlayerOfSeason', () => {
  it('prefers outfielders over goalkeepers at similar ratings', () => {
    const gk = p({ id: 'gk', rating: 88, position: 'GK', group: 'GK' });
    const cb = p({ id: 'cb', rating: 87, position: 'CB', group: 'DEF' });
    const xi: XI = { shape: '4-3-3', chemistry: 0, exactMatches: 0, assignments: { 0: 'gk', 1: 'cb' } };
    const squadById = { gk, cb };
    expect(pickPlayerOfSeason({ xi, squadById })?.id).toBe('cb');
  });

  it('boosts stars', () => {
    const a = p({ id: 'a', rating: 85, position: 'CM', group: 'MID' });
    const b = p({ id: 'b', rating: 84, position: 'CM', group: 'MID', isStar: true });
    const xi: XI = { shape: '4-3-3', chemistry: 0, exactMatches: 0, assignments: { 0: 'a', 1: 'b' } };
    const squadById = { a, b };
    expect(pickPlayerOfSeason({ xi, squadById })?.id).toBe('b');
  });
});
