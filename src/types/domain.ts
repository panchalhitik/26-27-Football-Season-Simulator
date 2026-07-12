export type Position =
  | 'GK'
  | 'CB' | 'LB' | 'RB'
  | 'CDM' | 'CM' | 'CAM' | 'LM' | 'RM'
  | 'LW' | 'RW' | 'ST';

export type PositionGroup = 'GK' | 'DEF' | 'MID' | 'FWD';

export type Foot = 'L' | 'R' | 'Both';

export type PlayerId = string;
export type ClubId = string;
export type LeagueId = 'PL' | 'LL' | 'SA' | 'BL' | 'L1' | 'OTHER';
export type ManagerId = string;

export interface Player {
  id: PlayerId;
  name: string;
  age: number;
  position: Position;
  group: PositionGroup;
  rating: number;          // 50–94 overall
  potential: number;       // ≥ rating
  marketValueM: number;    // in millions GBP
  wageK: number;           // weekly wage in £k
  contractYearsLeft: number; // 0–5
  clubId: ClubId;          // owning club at season start
  foot: Foot;
  nationality: string;
  isStar?: boolean;        // shown as ★ STAR badge in market
}

export interface Club {
  id: ClubId;
  name: string;
  shortName: string;
  league: LeagueId;
  europe: 'Champions League' | 'Europa League' | 'Conference League' | 'None';
  primaryColor: string;
  secondaryColor: string;
  startingBudgetM: number;
  wageRoomK: number;
  storyline: string;
  boardLetter: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  startingManagerId: ManagerId;
  objectives: import('./season').BoardObjective[];
  baseAttack: number;   // 0–100 derived strength
  baseDefense: number;  // 0–100
  /**
   * Club prestige on a 0–100 scale. Drives the `prestigePremium` factor in
   * the negotiation engine: a low-reputation buyer chasing a high-rated player
   * owned by a high-reputation seller pays a steep premium (and may be told
   * no at any fee, for the top brackets).
   */
  reputation: number;
}

export type ManagerStyle =
  | 'pragmatic'
  | 'possession'
  | 'high press'
  | 'gegenpress'
  | 'counter';

export interface Manager {
  id: ManagerId;
  name: string;
  nationality: string;
  age: number;
  style: ManagerStyle;
  salaryMPerYr: number;
  compensationFeeM: number;  // cost to prise away
  /**
   * Career honours on a 0–100 scale — the LegacyScore axis of the Dugout
   * OVR. Serial winners ~90, proven title winners ~70s, promising coaches
   * without major silverware ~50s, unproven ~40.
   */
  pedigree: number;
  pros: string[];
  cons: string[];
  description?: string;
  // small per-style modifiers applied to club strength
  attackMod: number;   // -5 .. +5
  defenseMod: number;  // -5 .. +5
}

export type FormationShape =
  | '4-3-3'
  | '4-2-3-1'
  | '4-4-2'
  | '4-4-2-Diamond'
  | '4-1-4-1'
  | '4-3-2-1'
  | '4-2-2-2'
  | '3-5-2'
  | '3-4-3'
  | '5-3-2'
  | '5-4-1'
  | '4-5-1';

export interface PitchSlot {
  position: Position;
  x: number; // 0..100, left to right
  y: number; // 0..100, GK = 100 (bottom), ST = 0 (top)
}

export interface Formation {
  shape: FormationShape;
  label: string;
  description: string;
  slots: PitchSlot[]; // exactly 11
}

export interface XI {
  shape: FormationShape;
  // slotIndex (0..10) -> PlayerId
  assignments: Record<number, PlayerId>;
  chemistry: number; // 0..100
  exactMatches: number; // 0..11
  /**
   * Fluid positioning — when present, overrides the preset formation's slot
   * coordinates. Slot POSITIONS are re-derived from where each slot actually
   * sits on the pitch, and unconventional layouts pay a strength penalty
   * (see engine/shape.ts conventionality).
   */
  customSlots?: PitchSlot[];
}
