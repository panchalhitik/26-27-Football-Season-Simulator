export type {
  Position,
  PositionGroup,
  Foot,
  Player,
  PlayerId,
  ClubId,
  Club,
  LeagueId,
  ManagerId,
  Manager,
  ManagerStyle,
  Formation,
  FormationShape,
  XI,
  PitchSlot,
} from './domain';

export type {
  Offer,
  OfferKind,
  NegotiationDecision,
  NegotiationFactors,
  WageDemand,
  TransferRecord,
  SaleRecord,
} from './transfer';

export type {
  TeamStrength,
  FixtureResult,
  LeagueRow,
  SeasonRunInput,
  SeasonRunResult,
  SeasonDistribution,
  MidSeasonReport,
  FinalReport,
  ManagerVerdict,
  BoardObjective,
  ObjectiveOutcome,
} from './season';

export type { GameState, GamePhase, BudgetTier, SeededRNG } from './state';
export { BUDGET_MIN_M, BUDGET_MAX_M, BUDGET_STEP_M, budgetTier } from './state';
