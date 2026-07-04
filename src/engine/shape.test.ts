import { describe, expect, it } from 'vitest';
import { conventionality, deriveSlotPosition, withDerivedPositions } from './shape';
import { FORMATIONS } from '@/data/formations';
import type { PitchSlot } from '@/types';

describe('deriveSlotPosition', () => {
  it('maps the classic bands', () => {
    expect(deriveSlotPosition(50, 92)).toBe('GK');
    expect(deriveSlotPosition(50, 78)).toBe('CB');
    expect(deriveSlotPosition(14, 75)).toBe('LB');
    expect(deriveSlotPosition(86, 75)).toBe('RB');
    expect(deriveSlotPosition(50, 58)).toBe('CDM');
    expect(deriveSlotPosition(50, 45)).toBe('CM');
    expect(deriveSlotPosition(50, 30)).toBe('CAM');
    expect(deriveSlotPosition(16, 22)).toBe('LW');
    expect(deriveSlotPosition(84, 22)).toBe('RW');
    expect(deriveSlotPosition(50, 16)).toBe('ST');
  });

  it('dragging a striker to the halfway line makes him a midfielder', () => {
    expect(deriveSlotPosition(50, 16)).toBe('ST');
    expect(deriveSlotPosition(50, 50)).toBe('CM');
  });
});

describe('conventionality', () => {
  it('every preset formation scores as balanced', () => {
    for (const f of FORMATIONS) {
      const v = conventionality(f.slots);
      expect(v.score01, f.shape).toBeGreaterThanOrEqual(0.9);
      expect(v.multiplier, f.shape).toBeGreaterThanOrEqual(0.98);
    }
  });

  it('a keeper-less all-out attack is tactical chaos', () => {
    const chaos: PitchSlot[] = Array.from({ length: 11 }, (_, i) => ({
      position: 'ST' as const,
      x: 20 + (i % 4) * 4,   // narrow AND one-flank
      y: 14 + Math.floor(i / 4) * 5,
    }));
    const v = conventionality(chaos);
    expect(v.score01).toBeLessThan(0.4);
    expect(v.multiplier).toBeLessThan(0.92);
    expect(v.verdict).toBe('Tactical chaos');
    expect(v.issues.length).toBeGreaterThan(2);
  });

  it('a mild tweak costs little', () => {
    const base = FORMATIONS[0]!.slots;
    // Nudge one CM forward a bit
    const tweaked = base.map((s, i) => (i === 6 ? { ...s, y: s.y - 10 } : s));
    const v = conventionality(tweaked);
    expect(v.multiplier).toBeGreaterThan(0.95);
  });

  it('no defenders is punished', () => {
    const base = FORMATIONS[0]!.slots;
    // Shove the whole back four up into midfield
    const noDef = base.map((s) =>
      s.position === 'LB' || s.position === 'RB' || s.position === 'CB'
        ? { ...s, y: 45 }
        : s,
    );
    const v = conventionality(noDef);
    expect(v.score01).toBeLessThan(0.8);
    expect(v.issues.join(' ')).toMatch(/defensive line/i);
  });
});

describe('withDerivedPositions', () => {
  it('re-labels slots from coordinates', () => {
    const slots: PitchSlot[] = [
      { position: 'ST', x: 50, y: 92 },  // an "ST" parked in goal is a GK
      { position: 'GK', x: 50, y: 16 },  // and vice versa
    ];
    const out = withDerivedPositions(slots);
    expect(out[0]!.position).toBe('GK');
    expect(out[1]!.position).toBe('ST');
  });
});
