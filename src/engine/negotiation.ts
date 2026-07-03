import type { NegotiationDecision, NegotiationFactors, Offer, Player } from '@/types';
import { importanceFromRating, negotiationFactors } from './valuation';

export interface NegotiateInput {
  player: Player;
  offer: Offer;
  /** Optional override; defaults to importanceFromRating(player.rating). */
  importanceToClub?: number;
  /** Selling club's reputation (0–100). */
  sellerReputation?: number;
  /** Buying club's reputation (0–100). */
  buyerReputation?: number;
  /**
   * Optional luck roll in [0, 1] for stochastic willingness on borderline
   * offers. The selling club is rarely a hard price wall: with high luck it
   * tolerates a slightly-below-valuation bid; with low luck it digs in.
   *
   * - Stars carry a narrow band (≈ ±2%) — they rarely budge.
   * - Non-stars carry a wider band (≈ ±10%) and accept bigger discounts.
   *
   * Defaults to 0.5 — neutral and fully deterministic. The dialog passes a
   * fresh roll on each "Suggest Terms" click for the FM-style feel.
   */
  luckRoll?: number;
}

export interface NegotiateOutput {
  decision: NegotiationDecision;
  factors: NegotiationFactors;
  /** Useful for showing the "Assistant Recommendation" panel. */
  meta: {
    isStar: boolean;
    feeAcceptThreshold: number; // ratio of fair fee needed
    wageAcceptThreshold: number;
    feeRatio: number;
    wageRatio: number;
  };
}

/** Soft "star" classification — explicit ★ badge OR rating ≥ 88. */
function isStarish(p: Player): boolean {
  return p.isStar || p.rating >= 88;
}

/**
 * Pure negotiation function: given an offer + player, return accept /
 * reject / counter plus the factor breakdown the UI can render to explain
 * *why*. Optionally accepts a `luckRoll` in [0,1] for the soft acceptance
 * band — same input + same luck → same output.
 */
export function negotiate({
  player,
  offer,
  importanceToClub,
  sellerReputation,
  buyerReputation,
  luckRoll,
}: NegotiateInput): NegotiateOutput {
  const factors = negotiationFactors(player, {
    importanceToClub: importanceToClub ?? importanceFromRating(player.rating),
    ...(sellerReputation !== undefined ? { sellerReputation } : {}),
    ...(buyerReputation !== undefined ? { buyerReputation } : {}),
  });

  const feeRatio = offer.feeM / Math.max(0.1, factors.fairFeeM);
  const wageRatio = offer.wageK / Math.max(1, factors.fairWageK);
  const contractOK = offer.contractYears >= 2;

  const isStar = isStarish(player);
  const luck = clamp01(luckRoll ?? 0.5);

  // Acceptance band.
  //   Star fee: 0.92 .. 0.96 (accept ~5–10% below valuation — they hold a hard
  //     line, but they're not delusional)
  //   Non-star fee: 0.70 .. 0.80 (accept up to ~25–30% below valuation —
  //     genuine room to negotiate)
  //   Wages are roughly aligned but a touch tighter — players are pickier
  //   about their own paycheque than their selling club is about the fee.
  //   luck=1  → friendliest threshold (low number, easy to clear)
  //   luck=0  → toughest threshold (high number)
  const feeFloor  = isStar ? 0.92 : 0.70;
  const feeBand   = isStar ? 0.04 : 0.10;
  const wageFloor = isStar ? 0.94 : 0.80;
  const wageBand  = isStar ? 0.04 : 0.10;
  const feeAcceptThreshold  = feeFloor  + (1 - luck) * feeBand;
  const wageAcceptThreshold = wageFloor + (1 - luck) * wageBand;

  const meta = {
    isStar,
    feeAcceptThreshold,
    wageAcceptThreshold,
    feeRatio,
    wageRatio,
  };

  // Accepted: offer clears both thresholds (and the contract is reasonable).
  if (feeRatio >= feeAcceptThreshold && wageRatio >= wageAcceptThreshold && contractOK) {
    const reason =
      feeRatio >= 1.1
        ? 'Comfortably meets our valuation and the player\'s wage demand. Done deal.'
        : isStar
          ? 'It\'s close to the number, but the player is keen to make the move work. We\'ll take it.'
          : 'You stretched us — but we can live with the figures. Done.';
    return {
      factors,
      decision: { result: 'accept', reason },
      meta,
    };
  }

  // Contract too short: hard reject, but include a min-acceptable hint so the
  // dialog can still snap sliders sensibly.
  if (!contractOK) {
    const minFeeM  = round1(factors.fairFeeM * (isStar ? 1.0 : 0.95));
    const minWageK = Math.round(factors.fairWageK * (isStar ? 1.0 : 0.97));
    return {
      factors,
      decision: {
        result: 'reject',
        reason: 'The player wants a longer commitment — at least 2 years.',
        minFeeM,
        minWageK,
      },
      meta,
    };
  }

  // Otherwise: counter. Stars hold their asking; non-stars offer a small
  // concession scaled by how close the offer was.
  // closeness ∈ [0, 1] — 1 means we were almost across the line, 0 means miles off.
  const closeness = Math.max(
    0,
    Math.min(1, (feeRatio - feeFloor + feeBand) / Math.max(0.01, feeBand)),
  );
  const concessionPct = isStar ? 0 : closeness * 0.04; // up to 4% off
  const counterFeeM = round1(factors.fairFeeM * (1 - concessionPct));
  const counterWageK = Math.round(factors.fairWageK * (isStar ? 1.0 : 0.98));

  // Truly insulting bids get a hard reject so the dialog can frame it harshly,
  // but the counter values still come along for slider-snapping.
  if (feeRatio < 0.5) {
    return {
      factors,
      decision: {
        result: 'reject',
        reason: `Fee insufficient (${Math.round(feeRatio * 100)}% of our valuation). We're not selling at that number.`,
        minFeeM: counterFeeM,
        minWageK: counterWageK,
      },
      meta,
    };
  }

  const reason = buildCounterReason(feeRatio, wageRatio, counterFeeM, counterWageK, isStar);
  return {
    factors,
    decision: {
      result: 'counter',
      counterFeeM,
      counterWageK,
      reason,
    },
    meta,
  };
}

function buildCounterReason(
  feeRatio: number,
  wageRatio: number,
  counterFeeM: number,
  counterWageK: number,
  isStar: boolean,
): string {
  const feePct = Math.round(feeRatio * 100);
  const wagePct = Math.round(wageRatio * 100);
  const star = isStar ? 'The player won\'t move below his level. ' : '';

  if (feeRatio < 1.0 && wageRatio < 1.0) {
    return `${star}Fee is ${feePct}% of our valuation and wage is ${wagePct}% of the player's ask. We can deal at £${counterFeeM}M · £${counterWageK}k/wk.`;
  }
  if (feeRatio < 1.0) {
    return `${star}Fee is ${feePct}% of our valuation. We'd take £${counterFeeM}M.`;
  }
  if (wageRatio < 1.0) {
    return `The player wants £${counterWageK}k/wk — your wage is ${wagePct}% of that ask.`;
  }
  return `${star}We want a small premium. £${counterFeeM}M · £${counterWageK}k/wk gets it done.`;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
