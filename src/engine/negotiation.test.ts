import { describe, expect, it } from 'vitest';
import { negotiate } from './negotiation';
import { importanceFromRating, negotiationFactors } from './valuation';
import type { Offer, Player } from '@/types';

function fairFeeFor(p: Player): number {
  return negotiationFactors(p, { importanceToClub: importanceFromRating(p.rating) }).fairFeeM;
}

function mkPlayer(over: Partial<Player> = {}): Player {
  return {
    id: 'p-test', name: 'Test', age: 26, position: 'CM', group: 'MID',
    rating: 82, potential: 85, marketValueM: 60, wageK: 150,
    contractYearsLeft: 3, clubId: 'manutd', foot: 'R', nationality: 'X',
    isStar: false, ...over,
  };
}

function mkOffer(over: Partial<Offer> = {}): Offer {
  return {
    kind: 'buy', playerId: 'p-test', fromClubId: 'arsenal',
    toClubId: 'manutd', feeM: 70, wageK: 180, contractYears: 4, ...over,
  };
}

describe('negotiate', () => {
  it('accepts a comfortably generous offer', () => {
    const out = negotiate({
      player: mkPlayer({ marketValueM: 50, wageK: 100, contractYearsLeft: 2 }),
      offer: mkOffer({ feeM: 200, wageK: 400, contractYears: 4 }),
    });
    expect(out.decision.result).toBe('accept');
  });

  it('rejects an insulting lowball (< 50% of fair fee)', () => {
    const out = negotiate({
      player: mkPlayer({ marketValueM: 100, isStar: true, age: 23 }),
      offer: mkOffer({ feeM: 5 }),
    });
    expect(out.decision.result).toBe('reject');
    if (out.decision.result === 'reject') {
      expect(out.decision.minFeeM).toBeGreaterThan(50);
    }
  });

  it('counters offers in the mid-range band', () => {
    const out = negotiate({
      player: mkPlayer({ marketValueM: 50, wageK: 100, contractYearsLeft: 3 }),
      offer: mkOffer({ feeM: 40, wageK: 110, contractYears: 4 }),
    });
    expect(out.decision.result).toBe('counter');
    if (out.decision.result === 'counter') {
      expect(out.decision.counterFeeM).toBeGreaterThan(40);
    }
  });

  it('rejects when contract is too short even if fee is fine', () => {
    const out = negotiate({
      player: mkPlayer(),
      offer: mkOffer({ feeM: 200, contractYears: 1 }),
    });
    expect(out.decision.result).toBe('reject');
    if (out.decision.result === 'reject') {
      expect(out.decision.reason.toLowerCase()).toContain('2 years');
    }
  });

  it('is fully deterministic for the same input (same luck)', () => {
    const player = mkPlayer({ marketValueM: 72, isStar: true });
    const offer = mkOffer({ feeM: 80 });
    const a = negotiate({ player, offer, luckRoll: 0.5 });
    const b = negotiate({ player, offer, luckRoll: 0.5 });
    expect(a).toEqual(b);
  });

  it('returns a visible factor breakdown', () => {
    const out = negotiate({ player: mkPlayer({ isStar: true }), offer: mkOffer() });
    expect(out.factors.fairFeeM).toBeGreaterThan(0);
    expect(out.factors.starPremium).toBeGreaterThan(1);
  });

  it('peer prestige levels: prestigePremium = 1', () => {
    const out = negotiate({
      player: mkPlayer({ rating: 90 }), offer: mkOffer(),
      sellerReputation: 85, buyerReputation: 85,
    });
    expect(out.factors.prestigePremium).toBe(1);
  });

  it('high-rep buyer chasing low-rep seller: still no prestige premium', () => {
    const out = negotiate({
      player: mkPlayer({ rating: 90 }), offer: mkOffer(),
      sellerReputation: 65, buyerReputation: 95,
    });
    expect(out.factors.prestigePremium).toBe(1);
  });

  it('low-rep buyer chasing top star at top club: large prestige premium', () => {
    const sameOffer = { feeM: 200, wageK: 350 } as const;
    const low = negotiate({
      player: mkPlayer({ rating: 91, marketValueM: 150 }),
      offer: mkOffer(sameOffer),
      sellerReputation: 95, buyerReputation: 62,
    });
    const peer = negotiate({
      player: mkPlayer({ rating: 91, marketValueM: 150 }),
      offer: mkOffer(sameOffer),
      sellerReputation: 95, buyerReputation: 95,
    });
    expect(low.factors.prestigePremium).toBeGreaterThan(1.3);
    expect(low.factors.fairFeeM).toBeGreaterThan(peer.factors.fairFeeM);
    expect(low.factors.prestigeWageBoost).toBeGreaterThan(1);
    expect(low.factors.prestigeWageBoost).toBeLessThan(low.factors.prestigePremium);
  });

  it('prestige premium does not affect low-rated players', () => {
    const out = negotiate({
      player: mkPlayer({ rating: 73, marketValueM: 20 }),
      offer: mkOffer({ feeM: 40 }),
      sellerReputation: 95, buyerReputation: 62,
    });
    expect(out.factors.prestigePremium).toBe(1);
  });

  it('Spurs cannot match Real Madrid\'s fee for a 90-rated star', () => {
    const fee = 200;
    const spurs = negotiate({
      player: mkPlayer({ rating: 91, marketValueM: 180, isStar: true, age: 26 }),
      offer: mkOffer({ feeM: fee }),
      sellerReputation: 95, buyerReputation: 62,
    });
    const arsenal = negotiate({
      player: mkPlayer({ rating: 91, marketValueM: 180, isStar: true, age: 26 }),
      offer: mkOffer({ feeM: fee }),
      sellerReputation: 95, buyerReputation: 86,
    });
    expect(spurs.factors.fairFeeM).toBeGreaterThan(arsenal.factors.fairFeeM);
  });

  it('stars are tougher to accept than non-stars at the same offer ratio', () => {
    // Build a non-star and a star with identical raw fair-fee numbers so we
    // can probe the threshold difference cleanly.
    const player = mkPlayer({ rating: 80, marketValueM: 60, isStar: false, contractYearsLeft: 3 });
    const star = mkPlayer({ rating: 80, marketValueM: 60, isStar: true,  contractYearsLeft: 3 });

    // Offer ~92% of each fair fee.
    const baseFair = 60 * 1.05 * 1.0 * (1 + 0.45 * 0.5); // ageMul 1.05 (age 26), contract 1.0 (3yr), importance (rating 80 → 0.45)
    const starFair = baseFair * 1.15;
    const at92 = (fair: number) => Math.round(fair * 0.92);

    const normalRes = negotiate({
      player, offer: mkOffer({ feeM: at92(baseFair), wageK: 200, contractYears: 4 }),
      luckRoll: 0.5,
    });
    const starRes = negotiate({
      player: star, offer: mkOffer({ feeM: at92(starFair), wageK: 200, contractYears: 4 }),
      luckRoll: 0.5,
    });

    // Non-star: 92% > 0.90 threshold → accept. Star: 92% < ~1.00 threshold → counter.
    expect(normalRes.decision.result).toBe('accept');
    expect(starRes.decision.result).toBe('counter');
  });

  it('lucky day (luckRoll≈1) accepts offers that an unlucky day rejects', () => {
    const player = mkPlayer({ marketValueM: 60, wageK: 100, isStar: false, contractYearsLeft: 3, rating: 80 });
    // Calibrate offer to sit in the luck band: about 73% of fair fee.
    const fair = 60 * 1.05 * 1.0 * (1 + 0.45 * 0.5);
    const borderline = Math.round(fair * 0.73);
    const unlucky = negotiate({
      player, offer: mkOffer({ feeM: borderline, wageK: 110, contractYears: 4 }),
      luckRoll: 0,
    });
    const lucky = negotiate({
      player, offer: mkOffer({ feeM: borderline, wageK: 110, contractYears: 4 }),
      luckRoll: 1,
    });
    expect(unlucky.decision.result).toBe('counter');
    expect(lucky.decision.result).toBe('accept');
  });

  it('star accepts a small discount on a high fair fee', () => {
    // Star with rating 90; fair fee comes out around 150M. Offering ~93%
    // (≈10M off) should clear at neutral luck.
    const star = mkPlayer({ rating: 90, marketValueM: 130, isStar: true, age: 26, contractYearsLeft: 4 });
    const fair = fairFeeFor(star);
    const out = negotiate({
      player: star,
      offer: mkOffer({ feeM: Math.round(fair * 0.94), wageK: 400, contractYears: 4 }),
      luckRoll: 0.5,
    });
    expect(out.decision.result).toBe('accept');
  });

  it('regular accepts a meaningful discount on its fair fee', () => {
    // Non-star with rating 82, fair fee around 70M. Offering ~73% (~20M off)
    // should clear at neutral luck.
    const player = mkPlayer({ rating: 82, marketValueM: 70, isStar: false, age: 26, contractYearsLeft: 4 });
    const fair = fairFeeFor(player);
    const out = negotiate({
      player,
      offer: mkOffer({ feeM: Math.round(fair * 0.77), wageK: 220, contractYears: 4 }),
      luckRoll: 0.5,
    });
    expect(out.decision.result).toBe('accept');
  });

  it('exposes thresholds + ratios in meta for the dialog', () => {
    const out = negotiate({
      player: mkPlayer({ isStar: true }),
      offer: mkOffer({ feeM: 100, wageK: 200, contractYears: 4 }),
      luckRoll: 0.5,
    });
    expect(out.meta.isStar).toBe(true);
    // Star band 0.92 .. 0.96
    expect(out.meta.feeAcceptThreshold).toBeGreaterThanOrEqual(0.92);
    expect(out.meta.feeAcceptThreshold).toBeLessThanOrEqual(0.96);
    expect(out.meta.feeRatio).toBeGreaterThan(0);
  });
});
