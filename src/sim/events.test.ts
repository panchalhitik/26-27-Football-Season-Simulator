import { describe, expect, it } from 'vitest';
import { mulberry32 } from '@/engine/rng';
import { attributeGoals, computeSeasonStats } from './events';
import type { Player, XI } from '@/types';

function p(id: string, position: Player['position'], rating: number, group: Player['group']): Player {
  return {
    id, name: id, age: 25, position, group, rating, potential: rating + 2,
    marketValueM: 20, wageK: 80, contractYearsLeft: 3, clubId: 'manutd',
    foot: 'R', nationality: 'X', isStar: false,
  };
}

const baseXI = [
  p('gk', 'GK', 84, 'GK'),
  p('lb', 'LB', 80, 'DEF'),
  p('cb1', 'CB', 82, 'DEF'),
  p('cb2', 'CB', 82, 'DEF'),
  p('rb', 'RB', 80, 'DEF'),
  p('cdm', 'CDM', 80, 'MID'),
  p('cm', 'CM', 82, 'MID'),
  p('cam', 'CAM', 86, 'MID'),
  p('lw', 'LW', 84, 'FWD'),
  p('rw', 'RW', 83, 'FWD'),
  p('st', 'ST', 88, 'FWD'),
];

describe('attributeGoals', () => {
  it('strikers and wingers score most over many matches', () => {
    const rng = mulberry32(42);
    const tally: Record<string, number> = {};
    for (let i = 0; i < 1000; i++) {
      const events = attributeGoals({ rng, xiPlayers: baseXI, goals: 2 });
      for (const ev of events) {
        tally[ev.scorerId] = (tally[ev.scorerId] ?? 0) + 1;
      }
    }
    expect(tally['st']!).toBeGreaterThan(tally['cdm']! * 5);
    expect(tally['st']!).toBeGreaterThan(tally['cb1']! * 8);
  });

  it('about ~70% of goals get an assist', () => {
    const rng = mulberry32(2);
    let goals = 0, assists = 0;
    for (let i = 0; i < 500; i++) {
      const events = attributeGoals({ rng, xiPlayers: baseXI, goals: 3 });
      for (const ev of events) {
        goals++;
        if (ev.assisterId) assists++;
      }
    }
    expect(assists / goals).toBeGreaterThan(0.6);
    expect(assists / goals).toBeLessThan(0.8);
  });

  it('CAM and wingers carry most assists', () => {
    const rng = mulberry32(7);
    const assistTally: Record<string, number> = {};
    for (let i = 0; i < 1500; i++) {
      const events = attributeGoals({ rng, xiPlayers: baseXI, goals: 2 });
      for (const ev of events) {
        if (ev.assisterId) assistTally[ev.assisterId] = (assistTally[ev.assisterId] ?? 0) + 1;
      }
    }
    const sumCreative = (assistTally['cam'] ?? 0) + (assistTally['lw'] ?? 0) + (assistTally['rw'] ?? 0);
    const sumDef = (assistTally['cb1'] ?? 0) + (assistTally['cb2'] ?? 0) + (assistTally['lb'] ?? 0) + (assistTally['rb'] ?? 0);
    expect(sumCreative).toBeGreaterThan(sumDef * 2);
  });

  it('GK essentially never scores', () => {
    const rng = mulberry32(99);
    let gkGoals = 0;
    for (let i = 0; i < 4000; i++) {
      const events = attributeGoals({ rng, xiPlayers: baseXI, goals: 1 });
      if (events[0]?.scorerId === 'gk') gkGoals++;
    }
    expect(gkGoals).toBeLessThan(20);
  });
});

describe('computeSeasonStats', () => {
  it('rolls up goals, assists, clean sheets, appearances for the user XI', () => {
    const xi: XI = {
      shape: '4-3-3',
      chemistry: 100,
      exactMatches: 11,
      assignments: Object.fromEntries(baseXI.map((p, i) => [i, p.id])),
    };
    const squadById = Object.fromEntries(baseXI.map((p) => [p.id, p]));
    const fixtures = [
      { homeId: 'me',    awayId: 'opp1', homeGoals: 3, awayGoals: 0 },  // CS, 3 goals
      { homeId: 'opp2',  awayId: 'me',   homeGoals: 2, awayGoals: 2 },  // not CS, 2 goals
      { homeId: 'me',    awayId: 'opp3', homeGoals: 0, awayGoals: 1 },  // not CS, no goals
      { homeId: 'opp4',  awayId: 'me',   homeGoals: 0, awayGoals: 4 },  // CS, 4 goals
    ];
    const rng = mulberry32(1234);
    const stats = computeSeasonStats({
      seed: 1234,
      xi,
      squadById,
      fixtures,
      userClubId: 'me',
      rng,
    });
    // Every XI player appeared in 4 matches
    for (const p of baseXI) {
      expect(stats[p.id]!.appearances).toBe(4);
    }
    // Total goals across players = 3 + 2 + 0 + 4 = 9
    const totalGoals = baseXI.reduce((acc, p) => acc + stats[p.id]!.goals, 0);
    expect(totalGoals).toBe(9);
    // Clean sheets credited to each XI member for matches 1 and 4
    for (const p of baseXI) {
      expect(stats[p.id]!.cleanSheets).toBe(2);
    }
  });
});
