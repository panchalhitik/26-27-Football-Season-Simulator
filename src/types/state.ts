import type { ClubId, ManagerId, PlayerId, XI } from './domain';
import type { Offer, SaleRecord, TransferRecord } from './transfer';
import type { FinalReport, MidSeasonReport, SeasonRunResult } from './season';

export type GamePhase =
  | 'landing'
  | 'choose-club'
  | 'boardroom'
  | 'manager-decision'
  | 'window'           // squad / buy / sell / formation tabs
  | 'simulating-h1'    // Aug -> Dec
  | 'mid-season'
  | 'january-window'   // optional second window
  | 'simulating-h2'    // Jan -> May
  | 'final-report';

/** Slider bounds for the boardroom budget control. */
export const BUDGET_MIN_M = 0;
export const BUDGET_MAX_M = 500;
export const BUDGET_STEP_M = 20;

/** Label brackets for the budget slider. Pure helper — same input → same label. */
export type BudgetTier =
  | 'Bankrupt' | 'Strict' | 'Decent' | 'Good' | 'Oil Money' | 'Tycoon';

export function budgetTier(m: number): BudgetTier {
  if (m < 30) return 'Bankrupt';
  if (m < 80) return 'Strict';
  if (m < 150) return 'Decent';
  if (m < 250) return 'Good';
  if (m < 350) return 'Oil Money';
  return 'Tycoon';
}

/**
 * Seeded PRNG signature. Engine and sim code take this as an argument
 * rather than calling Math.random() so runs are reproducible.
 */
export type SeededRNG = () => number;

export interface GameState {
  phase: GamePhase;

  /** Player-supplied name shown on the final report. */
  sportingDirectorName: string;

  /** PRNG seed for the whole run; shareable. */
  seed: number;

  /** Selected club; null until the user picks. */
  clubId: ClubId | null;

  /** Current manager — defaults to club's startingManagerId, can be replaced. */
  managerId: ManagerId | null;

  budgetM: number;
  wageRoomK: number;

  /** PlayerIds currently on the user's books. */
  squadIds: PlayerId[];

  /** PlayerIds currently sold/loaned out this window. */
  pendingSales: PlayerId[];

  /**
   * PlayerIds whose selling club has walked away from negotiation this window.
   * Once a player is in this set, the buy UI hides them and the negotiation
   * dialog refuses to re-open. Cleared on `reset()`.
   */
  walkedAwayPlayerIds: PlayerId[];

  /** Bought players this window — they're already in squadIds. */
  signings: TransferRecord[];
  sales: SaleRecord[];

  /** Chosen XI + formation. */
  xi: XI | null;

  /** Pending or last offer the user is composing in the negotiation dialog. */
  draftOffer: Offer | null;

  /** Filled after the H1 sim. */
  midSeason: MidSeasonReport | null;

  /** Filled after the H2 sim. */
  seasonRun: SeasonRunResult | null;
  finalReport: FinalReport | null;
}
