import type { ClubId, PlayerId } from './domain';

export type OfferKind = 'buy' | 'sell';

export interface Offer {
  kind: OfferKind;
  playerId: PlayerId;
  fromClubId: ClubId;
  toClubId: ClubId;
  feeM: number;
  wageK: number;
  contractYears: number;
}

export type NegotiationDecision =
  | { result: 'accept'; reason: string }
  | { result: 'reject'; reason: string; minFeeM: number; minWageK: number }
  | { result: 'counter'; counterFeeM: number; counterWageK: number; reason: string };

export interface NegotiationFactors {
  baseValueM: number;
  ageMultiplier: number;       // young + long contract -> higher
  contractMultiplier: number;  // 1 yr left -> cheaper
  importanceMultiplier: number;
  starPremium: number;         // extra demand for ★ stars
  /**
   * Prestige premium: > 1 means the buyer is a step down in stature and the
   * selling club + player expect a meaningful premium to even consider it.
   * Equal to 1.0 when buyer reputation ≥ seller reputation, or when the player
   * is a low-rated squad piece nobody is precious about.
   */
  prestigePremium: number;
  /** Same shape as prestigePremium, applied to the player's wage demand. */
  prestigeWageBoost: number;
  fairFeeM: number;            // composite: what the selling club truly wants
  fairWageK: number;           // player's wage demand
}

export interface WageDemand {
  demandedWageK: number;
  willAcceptMinK: number;
}

export interface TransferRecord {
  playerId: PlayerId;
  playerName: string;
  fromClubId: ClubId;
  toClubId: ClubId;
  feeM: number;
  wageK: number;
  contractYears: number;
  signedAt: number; // ms timestamp (deterministic within a run via store action order)
}

export interface SaleRecord extends TransferRecord {
  receivedM: number; // fee minus any agent/clearance haircut
}
