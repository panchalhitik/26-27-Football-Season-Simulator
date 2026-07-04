import { describe, expect, it } from 'vitest';
import { autoPickXI, chemistryFor, positionAffinity, teamStrengthFromXI } from './squad';
import { FORMATIONS_BY_SHAPE } from '@/data/formations';
import type { Player, Position } from '@/types';

function p(id: string, pos: Position, rating: number, group: Player['group']): Player {
  return {
    id, name: id, age: 25, position: pos, group, rating, potential: rating + 2,
    marketValueM: 20, wageK: 80, contractYearsLeft: 3, clubId: 'manutd',
    foot: 'R', nationality: 'X', isStar: false,
  };
}

describe('positionAffinity', () => {
  it('exact match → 1', () => {
    expect(positionAffinity('CB', 'CB')).toBe(1);
    expect(positionAffinity('ST', 'ST')).toBe(1);
    expect(positionAffinity('GK', 'GK')).toBe(1);
  });

  it('same group → 0.6 (CAM in CM, CB in LB, LW in RW)', () => {
    expect(positionAffinity('CM', 'CAM')).toBe(0.6);
    expect(positionAffinity('LB', 'CB')).toBe(0.6);
    expect(positionAffinity('LW', 'RW')).toBe(0.6);
  });

  it('adjacent groups → 0.15 (DEF ↔ MID, MID ↔ FWD)', () => {
    expect(positionAffinity('CDM', 'CB')).toBe(0.15);
    expect(positionAffinity('CM', 'ST')).toBe(0.15);
  });

  it('far apart → 0 (ST in CB, CB in ST)', () => {
    expect(positionAffinity('CB', 'ST')).toBe(0);
    expect(positionAffinity('ST', 'CB')).toBe(0);
  });

  it('GK against anything else → 0', () => {
    expect(positionAffinity('GK', 'CB')).toBe(0);
    expect(positionAffinity('CB', 'GK')).toBe(0);
    expect(positionAffinity('ST', 'GK')).toBe(0);
  });
});

describe('autoPickXI', () => {
  it('exact-position squad yields chemistry = 100', () => {
    const squad: Player[] = [
      p('gk1', 'GK', 84, 'GK'),
      p('cb1', 'CB', 82, 'DEF'), p('cb2', 'CB', 80, 'DEF'),
      p('lb1', 'LB', 78, 'DEF'), p('rb1', 'RB', 78, 'DEF'),
      p('cdm1', 'CDM', 80, 'MID'),
      p('cm1', 'CM', 82, 'MID'), p('cm2', 'CM', 79, 'MID'),
      p('lw1', 'LW', 81, 'FWD'), p('rw1', 'RW', 80, 'FWD'),
      p('st1', 'ST', 86, 'FWD'),
    ];
    const xi = autoPickXI(squad, FORMATIONS_BY_SHAPE['4-3-3']);
    expect(Object.keys(xi.assignments)).toHaveLength(11);
    expect(xi.exactMatches).toBe(11);
    expect(xi.chemistry).toBe(100);
  });

  it('all-CM squad in 4-3-3 yields partial chemistry, not zero', () => {
    const squad: Player[] = Array.from({ length: 11 }, (_, i) =>
      p(`x${i}`, 'CM', 75, 'MID'),
    );
    const xi = autoPickXI(squad, FORMATIONS_BY_SHAPE['4-3-3']);
    // 1 GK slot (CM in GK → 0), 4 DEF slots (CM in DEF → 0.15), 3 MID slots
    // (CM in CDM/CM/CM → some exact some same-group), 3 FWD slots (CM in
    // LW/ST/RW → 0.15). Chemistry should be > 0 and < 100.
    expect(xi.chemistry).toBeGreaterThan(0);
    expect(xi.chemistry).toBeLessThan(100);
  });

  it('uses each player at most once', () => {
    const squad: Player[] = Array.from({ length: 15 }, (_, i) =>
      p(`x${i}`, 'CM', 70 + i, 'MID'),
    );
    const xi = autoPickXI(squad, FORMATIONS_BY_SHAPE['4-3-3']);
    const ids = Object.values(xi.assignments);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('chemistryFor', () => {
  it('penalises a striker stationed in defence (zeros that slot)', () => {
    // 4-3-3 slot order: GK, LB, CB, CB, RB, CDM, CM, CM, LW, ST, RW
    const formation = FORMATIONS_BY_SHAPE['4-3-3'];
    const squad: Player[] = [
      p('gk1', 'GK', 84, 'GK'),
      p('lb1', 'LB', 78, 'DEF'),
      p('cb1', 'CB', 82, 'DEF'), p('cb2', 'CB', 80, 'DEF'),
      // RB slot will be filled by a striker — that slot loses ALL its chem
      p('rogue', 'ST', 85, 'FWD'),
      p('cdm1', 'CDM', 80, 'MID'),
      p('cm1', 'CM', 82, 'MID'), p('cm2', 'CM', 79, 'MID'),
      p('lw1', 'LW', 81, 'FWD'),
      p('st1', 'ST', 86, 'FWD'),
      p('rw1', 'RW', 80, 'FWD'),
    ];
    const squadById = Object.fromEntries(squad.map((s) => [s.id, s]));
    const xi = {
      shape: formation.shape, chemistry: 0, exactMatches: 0,
      assignments: { 0: 'gk1', 1: 'lb1', 2: 'cb1', 3: 'cb2', 4: 'rogue', 5: 'cdm1', 6: 'cm1', 7: 'cm2', 8: 'lw1', 9: 'st1', 10: 'rw1' },
    } as const;
    const res = chemistryFor({ squadById, xi, formation });
    // 10 of 11 slots exact (10 × 1.0), 1 slot rogue ST in RB (× 0). Chem ≈ 91.
    expect(res.chemistry).toBeGreaterThan(85);
    expect(res.chemistry).toBeLessThan(95);
    expect(res.exactMatches).toBe(10);
    expect(res.perSlot[4]).toBe(0);
  });

  it('CAM in a CM slot is a partial hit, not zero', () => {
    // 4-3-3 slot order: GK, LB, CB, CB, RB, CDM, CM, CM, LW, ST, RW
    const formation = FORMATIONS_BY_SHAPE['4-3-3'];
    const squad: Player[] = [
      p('gk1', 'GK', 84, 'GK'),
      p('lb1', 'LB', 78, 'DEF'),
      p('cb1', 'CB', 82, 'DEF'), p('cb2', 'CB', 80, 'DEF'),
      p('rb1', 'RB', 78, 'DEF'),
      p('cdm1', 'CDM', 80, 'MID'),
      p('cam_in_cm', 'CAM', 82, 'MID'),  // CAM filling a CM slot
      p('cm2', 'CM', 79, 'MID'),
      p('lw1', 'LW', 81, 'FWD'),
      p('st1', 'ST', 86, 'FWD'),
      p('rw1', 'RW', 80, 'FWD'),
    ];
    const squadById = Object.fromEntries(squad.map((s) => [s.id, s]));
    const xi = {
      shape: formation.shape, chemistry: 0, exactMatches: 0,
      assignments: { 0: 'gk1', 1: 'lb1', 2: 'cb1', 3: 'cb2', 4: 'rb1', 5: 'cdm1', 6: 'cam_in_cm', 7: 'cm2', 8: 'lw1', 9: 'st1', 10: 'rw1' },
    } as const;
    const res = chemistryFor({ squadById, xi, formation });
    // 10 exact (×1), 1 same-group (×0.6). Chem ≈ 96.
    expect(res.chemistry).toBeGreaterThan(95);
    expect(res.chemistry).toBeLessThan(98);
    expect(res.exactMatches).toBe(10);
  });

  it('empty XI has chemistry 0', () => {
    const formation = FORMATIONS_BY_SHAPE['4-3-3'];
    const xi = { shape: formation.shape, chemistry: 0, exactMatches: 0, assignments: {} };
    const res = chemistryFor({ squadById: {}, xi, formation });
    expect(res.chemistry).toBe(0);
  });
});

describe('teamStrengthFromXI', () => {
  it('reflects rating averages roughly', () => {
    const squad: Player[] = [
      p('gk1', 'GK', 88, 'GK'),
      p('cb1', 'CB', 85, 'DEF'), p('cb2', 'CB', 85, 'DEF'),
      p('lb1', 'LB', 83, 'DEF'), p('rb1', 'RB', 83, 'DEF'),
      p('cdm1', 'CDM', 85, 'MID'),
      p('cm1', 'CM', 84, 'MID'), p('cm2', 'CM', 84, 'MID'),
      p('lw1', 'LW', 86, 'FWD'), p('rw1', 'RW', 86, 'FWD'),
      p('st1', 'ST', 89, 'FWD'),
    ];
    const xi = autoPickXI(squad, FORMATIONS_BY_SHAPE['4-3-3']);
    const squadById = Object.fromEntries(squad.map((s) => [s.id, s]));
    const s = teamStrengthFromXI({
      squadById, xi, baseAttack: 80, baseDefense: 80,
      managerAttackMod: 2, managerDefenseMod: 1,
    });
    expect(s.attack).toBeGreaterThan(80);
    expect(s.defense).toBeGreaterThan(80);
  });
});

describe('fillVacantSlots', () => {
  it('replaces an injured starter with the best available fit and keeps everyone else', async () => {
    const { fillVacantSlots, autoPickXI } = await import('./squad');
    const { FORMATIONS_BY_SHAPE } = await import('@/data');
    const formation = FORMATIONS_BY_SHAPE['4-3-3'];
    const mk = (id: string, position: import('@/types').Position, group: import('@/types').PositionGroup, rating: number): import('@/types').Player => ({
      id, name: id, age: 25, position, group, rating, potential: rating,
      marketValueM: 10, wageK: 50, contractYearsLeft: 3, clubId: 'c', foot: 'R', nationality: 'X',
    });
    const squad = [
      mk('gk1', 'GK', 'GK', 82), mk('gk2', 'GK', 'GK', 74),
      mk('lb1', 'LB', 'DEF', 80), mk('cb1', 'CB', 'DEF', 82), mk('cb2', 'CB', 'DEF', 81),
      mk('rb1', 'RB', 'DEF', 79), mk('cb3', 'CB', 'DEF', 75),
      mk('dm1', 'CDM', 'MID', 81), mk('cm1', 'CM', 'MID', 83), mk('cm2', 'CM', 'MID', 80),
      mk('cm3', 'CM', 'MID', 74),
      mk('lw1', 'LW', 'FWD', 84), mk('rw1', 'RW', 'FWD', 83), mk('st1', 'ST', 'FWD', 86),
      mk('st2', 'ST', 'FWD', 77),
    ];
    const xi = autoPickXI(squad, formation);
    const stSlot = formation.slots.findIndex((s) => s.position === 'ST');
    expect(xi.assignments[stSlot]).toBe('st1');

    const repaired = fillVacantSlots({
      squad, formation, xi, unavailable: new Set(['st1']),
    });
    expect(repaired.assignments[stSlot]).toBe('st2');   // backup striker steps in
    // everyone else untouched
    for (let i = 0; i < 11; i++) {
      if (i !== stSlot) expect(repaired.assignments[i]).toBe(xi.assignments[i]);
    }
  });
});
