import { describe, expect, it } from 'vitest';
import {
  computeManagerRatings,
  managerMu,
  MGR_MU_CLAMP,
  tacticalEffectiveness,
} from './manager';
import type { Manager } from '@/types';

function mk(over: Partial<Manager> & { id: string; name: string; compensationFeeM: number; salaryMPerYr: number; pros: string[] }): Manager {
  return {
    nationality: 'X',
    age: 50,
    style: 'pragmatic',
    cons: [],
    attackMod: 0,
    defenseMod: 0,
    pedigree: 50,
    ...over,
  };
}

describe('computeManagerRatings', () => {
  it('separates money from legacy — bargains and busts exist', () => {
    const pool: Manager[] = [
      mk({ id: 'cheap-legend', name: 'Cheap Legend', compensationFeeM: 0, salaryMPerYr: 4, pedigree: 95, pros: ['Champions League winner'] }),
      mk({ id: 'pricy-rookie', name: 'Pricy Rookie', compensationFeeM: 60, salaryMPerYr: 12, pedigree: 30, pros: ['hyped young coach'] }),
      mk({ id: 'mid', name: 'Mid Manager', compensationFeeM: 12, salaryMPerYr: 6, pedigree: 55, pros: ['solid'] }),
    ];
    const { byId } = computeManagerRatings(pool);
    // Cheap legend has HIGH legacy, LOW money — overall pulled up by legacy
    expect(byId['cheap-legend']!.legacyScore).toBeGreaterThan(byId['mid']!.legacyScore);
    expect(byId['cheap-legend']!.moneyScore).toBeLessThan(byId['pricy-rookie']!.moneyScore);
    // Pricy rookie has HIGH money but LOW legacy — MOR doesn't max out
    expect(byId['pricy-rookie']!.moneyScore).toBeGreaterThan(byId['cheap-legend']!.moneyScore);
    expect(byId['pricy-rookie']!.legacyScore).toBeLessThan(byId['cheap-legend']!.legacyScore);
    // Legacy dominates the blend: the legend outrates the rookie overall
    expect(byId['cheap-legend']!.mor).toBeGreaterThan(byId['pricy-rookie']!.mor);
  });

  it('a free-agent legend is not punished for having no release fee', () => {
    const pool: Manager[] = [
      mk({ id: 'free-legend', name: 'Free Legend', compensationFeeM: 0, salaryMPerYr: 14, pedigree: 92, pros: [] }),
      mk({ id: 'hot-coach', name: 'Hot Coach', compensationFeeM: 30, salaryMPerYr: 11, pedigree: 74, pros: [] }),
      mk({ id: 'nobody', name: 'Nobody', compensationFeeM: 5, salaryMPerYr: 4, pedigree: 40, pros: [] }),
    ];
    const { byId } = computeManagerRatings(pool);
    // The double-weighted salary keeps the free agent's money score respectable,
    // and pedigree carries him past the employed hot coach overall.
    expect(byId['free-legend']!.mor).toBeGreaterThan(byId['hot-coach']!.mor);
    expect(byId['hot-coach']!.mor).toBeGreaterThan(byId['nobody']!.mor);
  });

  it('MOR is in [0, 100]', () => {
    const pool: Manager[] = Array.from({ length: 8 }, (_, i) =>
      mk({ id: `m${i}`, name: `M${i}`, compensationFeeM: i * 8, salaryMPerYr: 4 + i, pedigree: 30 + i * 8, pros: ['ok'] }),
    );
    const { byId } = computeManagerRatings(pool);
    for (const v of Object.values(byId)) {
      expect(v.mor).toBeGreaterThanOrEqual(0);
      expect(v.mor).toBeLessThanOrEqual(100);
    }
  });
});

describe('tacticalEffectiveness', () => {
  it('bounded between 0.92 and 1.08 (spec ±8% ceiling)', () => {
    expect(tacticalEffectiveness(0)).toBeCloseTo(0.92, 5);
    expect(tacticalEffectiveness(50)).toBeCloseTo(1.00, 5);
    expect(tacticalEffectiveness(100)).toBeCloseTo(1.08, 5);
    expect(tacticalEffectiveness(200)).toBeCloseTo(1.08, 5); // clamped
    expect(tacticalEffectiveness(-50)).toBeCloseTo(0.92, 5); // clamped
  });
});

describe('managerMu', () => {
  it('is antisymmetric (μ(a,b) = -μ(b,a))', () => {
    expect(managerMu(80, 50)).toBeCloseTo(-managerMu(50, 80), 6);
  });

  it('is clamped to ±MGR_MU_CLAMP', () => {
    expect(managerMu(100, 0)).toBeLessThanOrEqual(MGR_MU_CLAMP + 1e-9);
    expect(managerMu(100, 0)).toBeGreaterThan(MGR_MU_CLAMP - 1e-9);
    expect(managerMu(0, 100)).toBeGreaterThanOrEqual(-MGR_MU_CLAMP - 1e-9);
  });

  it('zero when MOR equal', () => {
    expect(managerMu(50, 50)).toBe(0);
  });
});
