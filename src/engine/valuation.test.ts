import { describe, expect, it } from 'vitest';
import { importanceFromRating, negotiationFactors } from './valuation';
import type { Player } from '@/types';

function p(over: Partial<Player>): Player {
  return {
    id: 'x', name: 'Test', age: 26, position: 'CM', group: 'MID',
    rating: 80, potential: 84, marketValueM: 50, wageK: 120,
    contractYearsLeft: 3, clubId: 'manutd', foot: 'R', nationality: 'X',
    isStar: false,
    ...over,
  };
}

describe('negotiationFactors', () => {
  it('1-year contract halves the contract multiplier', () => {
    const longC = negotiationFactors(p({ contractYearsLeft: 4 }), { importanceToClub: 0.5 });
    const shortC = negotiationFactors(p({ contractYearsLeft: 1 }), { importanceToClub: 0.5 });
    expect(shortC.contractMultiplier).toBeLessThan(longC.contractMultiplier);
    expect(shortC.fairFeeM).toBeLessThan(longC.fairFeeM);
  });

  it('youth + long contract is more expensive than late-career', () => {
    const young = negotiationFactors(p({ age: 21, contractYearsLeft: 4 }), { importanceToClub: 0.6 });
    const old = negotiationFactors(p({ age: 33, contractYearsLeft: 2 }), { importanceToClub: 0.6 });
    expect(young.fairFeeM).toBeGreaterThan(old.fairFeeM);
  });

  it('star players carry a premium', () => {
    const star = negotiationFactors(p({ isStar: true }), { importanceToClub: 0.5 });
    const normal = negotiationFactors(p({ isStar: false }), { importanceToClub: 0.5 });
    expect(star.starPremium).toBeGreaterThan(normal.starPremium);
    expect(star.fairFeeM).toBeGreaterThan(normal.fairFeeM);
    expect(star.fairWageK).toBeGreaterThan(normal.fairWageK);
  });

  it('importance scales linearly within bounds', () => {
    const low = negotiationFactors(p({}), { importanceToClub: 0 });
    const mid = negotiationFactors(p({}), { importanceToClub: 0.5 });
    const high = negotiationFactors(p({}), { importanceToClub: 1 });
    expect(low.importanceMultiplier).toBeLessThan(mid.importanceMultiplier);
    expect(mid.importanceMultiplier).toBeLessThan(high.importanceMultiplier);
    expect(high.importanceMultiplier).toBeCloseTo(1.5, 5);
  });

  it('out-of-range importance is clamped', () => {
    const over = negotiationFactors(p({}), { importanceToClub: 5 });
    const under = negotiationFactors(p({}), { importanceToClub: -1 });
    expect(over.importanceMultiplier).toBeCloseTo(1.5, 5);
    expect(under.importanceMultiplier).toBeCloseTo(1.0, 5);
  });
});

describe('importanceFromRating', () => {
  it('monotonic in rating', () => {
    const vals = [60, 75, 78, 82, 85, 88, 92].map(importanceFromRating);
    for (let i = 1; i < vals.length; i++) {
      expect(vals[i]).toBeGreaterThanOrEqual(vals[i - 1] as number);
    }
  });
});
