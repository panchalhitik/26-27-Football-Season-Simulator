import type { ClubId } from './domain';

export interface TeamStrength {
  clubId: ClubId;
  attack: number;  // 0..100 after squad + manager (chemistry no longer baked in)
  defense: number; // 0..100
  homeBoost: number; // ~3..7 — legacy field, retained but no longer the main lever
  /**
   * Chemistry on a 0..1 scale. The match engine applies this as a single
   * multiplier per team — not double-counted into attack and defense.
   * Optional: defaults to neutral (0.6) when not provided.
   */
  chemistry01?: number;
  /**
   * Sum of manager attack + defense modifiers (so a ±5/±5 manager carries
   * ~±10 here). The match engine derives an attack-side and defense-side
   * multiplier from this. Optional: defaults to 0.
   */
  managerMod?: number;
  /**
   * Manager Overall Rating, 0–100. Drives the antisymmetric μ term in the
   * Dixon-Coles model and the tactical-effectiveness multiplier on the
   * effective rating. Optional: defaults to 50 (median).
   */
  mor?: number;
  /**
   * Formation shape currently set — feeds the tactical matchup terms
   * (τ_tempo symmetric, τ_tilt antisymmetric). Optional: when missing the
   * engine treats the matchup as neutral.
   */
  formationShape?: import('./domain').FormationShape;
}

export interface FixtureResult {
  matchday: number;
  month: 'AUG' | 'SEP' | 'OCT' | 'NOV' | 'DEC' | 'JAN' | 'FEB' | 'MAR' | 'APR' | 'MAY';
  homeId: ClubId;
  awayId: ClubId;
  homeGoals: number;
  awayGoals: number;
  scorerHighlight?: string;
}

export interface LeagueRow {
  clubId: ClubId;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
}

export type BoardObjective =
  | { kind: 'PL'; label: string; targetPosition: number }
  | { kind: 'UCL'; label: string; targetRound: 'Group' | 'Last16' | 'QF' | 'SF' | 'Final' | 'Winners' }
  | { kind: 'FA Cup'; label: string; targetRound: 'R3' | 'R4' | 'R5' | 'QF' | 'SF' | 'Final' | 'Winners' }
  | { kind: 'EFL'; label: string; targetRound: 'R3' | 'R4' | 'QF' | 'SF' | 'Final' | 'Winners' };

export type ObjectiveOutcome = 'met' | 'missed' | 'exceeded';

export interface SeasonRunInput {
  seed: number;
  userClubId: ClubId;
  // strengths derived from final squad/XI/manager for every club in the table
  strengths: TeamStrength[];
  monteCarloRuns: number; // default 1, set higher for distributions
}

export interface SeasonRunResult {
  seed: number;
  fixtures: FixtureResult[]; // headline run (run #1)
  finalTable: LeagueRow[];
  userPoints: number;
  userPosition: number;
  userGoalsFor: number;
  userGoalsAgainst: number;
  userCleanSheets: number;
}

export interface SeasonDistribution {
  pctTitle: number;
  pctTop4: number;
  pctTop6: number;
  pctRelegation: number;
  expectedPoints: number;
  expectedPosition: number;
}

export interface MidSeasonReport {
  matchesPlayed: number;
  leaguePosition: number;
  pointsSoFar: number;
  goalsFor: number;
  goalsAgainst: number;
  cleanSheets: number;
  form: 'ON FIRE' | 'STRONG' | 'PATCHY' | 'POOR' | 'COLLAPSING';
  boardVerdict: 'DELIGHTED' | 'PLEASED' | 'NEUTRAL' | 'CONCERNS GROWING' | 'AT RISK';
  cupStatuses: {
    competition: 'FA Cup' | 'EFL Cup' | 'UCL';
    status: string;
  }[];
}

export type ManagerVerdict = 'KEPT ON' | 'EXTENDED' | 'SACKED' | 'WALKED';

export interface FinalReport {
  grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  ownerVerdict: ManagerVerdict;
  quote: string;
  signingsCount: number;
  signingsSpendM: number;
  outgoingCount: number;
  outgoingRaisedM: number;
  netSpendM: number;
  finalFormation: string;
  finalPosition: number;
  finalPoints: number;
  objectiveOutcomes: {
    objective: BoardObjective;
    outcome: ObjectiveOutcome;
    /** For cup objectives only: the round the club actually reached
     *  ('R3' | 'R4' | 'R5' | 'Last16' | 'QF' | 'SF' | 'Final' | 'Winners' | 'Group').
     *  Undefined for PL objectives. */
    reachedRound?: string;
  }[];
}
