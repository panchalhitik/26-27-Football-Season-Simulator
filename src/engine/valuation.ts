import type { NegotiationFactors, Player } from '@/types';

/**
 * Compute the selling club's view of what a player is actually worth, plus the
 * player's own wage demand. All factors are exposed so the UI can show
 * "why your bid failed".
 *
 * Inputs map cleanly to the design brief: market value, age,
 * contract years left, importance to the selling club, star premium.
 */
export function negotiationFactors(
  player: Player,
  opts: {
    importanceToClub: number; // 0..1 (1 = key player, 0 = surplus)
    /**
     * Selling club's reputation (0–100). Defaults to a neutral 75 so the
     * factor breakdown is well-defined even if a caller skips it.
     */
    sellerReputation?: number;
    /** Buying club's reputation (0–100). */
    buyerReputation?: number;
  },
): NegotiationFactors {
  const baseValueM = player.marketValueM;

  // Age: a 19yo with high potential is more expensive; a 32yo is cheap
  const ageMultiplier =
    player.age <= 21 ? 1.35 :
    player.age <= 24 ? 1.15 :
    player.age <= 27 ? 1.05 :
    player.age <= 29 ? 0.95 :
    player.age <= 31 ? 0.78 :
    0.55;

  // Contract: 1 yr left -> ~50%, 5 yr left -> +20%
  const contractMultiplier =
    player.contractYearsLeft <= 1 ? 0.5 :
    player.contractYearsLeft === 2 ? 0.85 :
    player.contractYearsLeft === 3 ? 1.0 :
    player.contractYearsLeft === 4 ? 1.12 :
    1.2;

  // Importance: 0 .. +50% premium
  const importanceMultiplier = 1 + Math.max(0, Math.min(1, opts.importanceToClub)) * 0.5;

  // Star: visible ★ badge -> hard premium
  const starPremium = player.isStar ? 1.15 : 1.0;

  // Prestige: when buyer is a step down in stature and the player is high-rated,
  // the selling club + player both expect a meaningful premium.
  //   playerStarFactor: 0 below rating 75, 1 at rating 95
  //   repGap = max(0, sellerRep - buyerRep), capped at 40
  //   prestigePremium = 1 + (repGap / 30) * playerStarFactor   -- so a gap-30
  //   chase for a 90-rated player ≈ 1.5×, a 78-rated one ≈ 1.15×, an 88+ with
  //   gap 0 is unchanged.
  const sellerRep = opts.sellerReputation ?? 75;
  const buyerRep = opts.buyerReputation ?? 75;
  const repGap = Math.max(0, Math.min(40, sellerRep - buyerRep));
  const playerStarFactor = Math.max(0, Math.min(1, (player.rating - 75) / 20));
  const prestigePremium = 1 + (repGap / 30) * playerStarFactor;
  // Wages scale half as steeply — players negotiate harder than clubs.
  const prestigeWageBoost = 1 + (repGap / 30) * playerStarFactor * 0.5;

  const fairFeeM = round1(
    baseValueM *
      ageMultiplier *
      contractMultiplier *
      importanceMultiplier *
      starPremium *
      prestigePremium,
  );

  // Wage demand: player asks above his current wage, more so if he's a star
  // or has long contract left, and even more if the move is a prestige step down.
  const wageBoost =
    (player.isStar ? 1.18 : 1.08) *
    (player.contractYearsLeft >= 3 ? 1.05 : 1.0) *
    prestigeWageBoost;
  const fairWageK = Math.round(player.wageK * wageBoost);

  return {
    baseValueM,
    ageMultiplier,
    contractMultiplier,
    importanceMultiplier,
    starPremium,
    prestigePremium,
    prestigeWageBoost,
    fairFeeM,
    fairWageK,
  };
}

/** Default importance heuristic from rating + group size on the squad. */
export function importanceFromRating(rating: number): number {
  if (rating >= 88) return 1;
  if (rating >= 85) return 0.85;
  if (rating >= 82) return 0.65;
  if (rating >= 78) return 0.45;
  if (rating >= 74) return 0.25;
  return 0.1;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
