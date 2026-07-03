import { describe, expect, it } from 'vitest';
import {
  bandFor,
  departmentBalance,
  finishVerdict,
  pickAwards,
  projectedPosition,
} from './awards';
import type { Player } from '@/types';

function p(id: string, position: Player['position'], rating: number, group: Player['group']): Player {
  return {
    id, name: id, age: 25, position, group, rating, potential: rating + 2,
    marketValueM: 20, wageK: 80, contractYearsLeft: 3, clubId: 'manutd',
    foot: 'R', nationality: 'X', isStar: false,
  };
}

describe('bandFor', () => {
  it('maps avg rating into the qualitative buckets', () => {
    expect(bandFor(91)).toBe('World Class');
    expect(bandFor(86)).toBe('Strong');
    expect(bandFor(83)).toBe('Very Good');
    expect(bandFor(79)).toBe('Good');
    expect(bandFor(75)).toBe('Average');
    expect(bandFor(60)).toBe('Weak');
  });
});

describe('pickAwards', () => {
  it('picks Golden Boot, Playmaker, Glove, POTY correctly', () => {
    const squadById = {
      gk:  p('gk',  'GK',  84, 'GK'),
      cb:  p('cb',  'CB',  82, 'DEF'),
      cam: p('cam', 'CAM', 86, 'MID'),
      st:  p('st',  'ST',  88, 'FWD'),
    };
    const stats = {
      gk:  { playerId: 'gk',  goals: 0,  assists: 0,  cleanSheets: 14, appearances: 38 },
      cb:  { playerId: 'cb',  goals: 3,  assists: 1,  cleanSheets: 14, appearances: 38 },
      cam: { playerId: 'cam', goals: 12, assists: 18, cleanSheets: 0,  appearances: 38 },
      st:  { playerId: 'st',  goals: 24, assists: 5,  cleanSheets: 0,  appearances: 38 },
    };
    const awards = pickAwards({ stats, squadById });
    expect(awards.goldenBoot?.playerId).toBe('st');
    expect(awards.goldenBoot?.goals).toBe(24);
    expect(awards.playmaker?.playerId).toBe('cam');
    expect(awards.playmaker?.assists).toBe(18);
    expect(awards.goldenGlove?.playerId).toBe('gk');
    expect(awards.goldenGlove?.cleanSheets).toBe(14);
    // POTY: ST (24 + 0.7×5 = 27.5) vs CAM (12 + 0.7×18 = 24.6). ST wins.
    expect(awards.playerOfSeason?.playerId).toBe('st');
  });
});

describe('departmentBalance', () => {
  it('returns the verdict for a balanced top XI', () => {
    const xi = [
      p('gk', 'GK', 84, 'GK'),
      p('lb', 'LB', 82, 'DEF'),
      p('cb1', 'CB', 84, 'DEF'),
      p('cb2', 'CB', 83, 'DEF'),
      p('rb', 'RB', 81, 'DEF'),
      p('cdm', 'CDM', 84, 'MID'),
      p('cm1', 'CM', 83, 'MID'),
      p('cm2', 'CAM', 85, 'MID'),
      p('lw', 'LW', 86, 'FWD'),
      p('rw', 'RW', 84, 'FWD'),
      p('st', 'ST', 88, 'FWD'),
    ];
    const b = departmentBalance(xi);
    expect(b.attack.band).toMatch(/Strong|Very Good|World Class/);
    expect(b.defense.band).toMatch(/Very Good|Strong/);
    expect(b.goalkeeper.band).toMatch(/Very Good|Strong/);
    expect(b.spread).toBeLessThanOrEqual(8);
    expect(b.verdict).toMatch(/balanced|small dip/i);
  });

  it('flags a top-heavy lopsided squad', () => {
    const xi = [
      p('gk', 'GK', 64, 'GK'),
      p('lb', 'LB', 62, 'DEF'),
      p('cb1', 'CB', 65, 'DEF'),
      p('cb2', 'CB', 64, 'DEF'),
      p('rb', 'RB', 63, 'DEF'),
      p('cdm', 'CDM', 70, 'MID'),
      p('cm1', 'CM', 72, 'MID'),
      p('cm2', 'CAM', 75, 'MID'),
      p('lw', 'LW', 90, 'FWD'),
      p('rw', 'RW', 91, 'FWD'),
      p('st', 'ST', 92, 'FWD'),
    ];
    const b = departmentBalance(xi);
    expect(b.spread).toBeGreaterThan(15);
    expect(b.verdict.toLowerCase()).toContain('lopsided');
  });
});

describe('projectedPosition + finishVerdict', () => {
  it('projects the top team into 1st place', () => {
    const strengths = [
      { clubId: 'top',   attack: 86, defense: 85, chemistry01: 0.9, mor: 85 },
      { clubId: 'mid1',  attack: 78, defense: 77, chemistry01: 0.7, mor: 60 },
      { clubId: 'mid2',  attack: 76, defense: 76, chemistry01: 0.7, mor: 55 },
      { clubId: 'mid3',  attack: 75, defense: 75, chemistry01: 0.65, mor: 50 },
      { clubId: 'low',   attack: 66, defense: 66, chemistry01: 0.55, mor: 35 },
    ];
    expect(projectedPosition({ userClubId: 'top', strengths })).toBe(1);
    expect(projectedPosition({ userClubId: 'low', strengths })).toBe(5);
  });

  it('classifies finishes', () => {
    expect(finishVerdict(10, 2).tone).toBe('crashers');
    expect(finishVerdict(8, 5).tone).toBe('overachiever');
    expect(finishVerdict(4, 4).tone).toBe('expected');
    expect(finishVerdict(2, 6).tone).toBe('underperform');
    expect(finishVerdict(1, 15).tone).toBe('disaster');
  });
});
