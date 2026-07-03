import type { SeededRNG, TeamStrength } from '@/types';
import { expectedGoals, type LeagueAverages } from './poisson';
import { sampleDixonColes } from './dixon-coles';

export type CupKind = 'FA Cup' | 'EFL' | 'UCL';

/* ─────────────────────────────────────────── tunables ─── */

/** Early-round squad rotation: big clubs field weakened XIs. EFL rotates hardest. */
const ROTATION_EARLY: Record<CupKind, number> = { 'FA Cup': 0.95, EFL: 0.92, UCL: 1 };
/** Chance the early-round draw is a lower-division side. */
const LOWER_LEAGUE_CHANCE: Record<CupKind, number> = { 'FA Cup': 0.55, EFL: 0.45, UCL: 0 };
/** Strength scale applied to a lower-division opponent. */
const LOWER_LEAGUE_FACTOR = 0.84;
/** How strongly later rounds skew toward stronger surviving opponents. */
const PROGRESS_BIAS = 2.5;
/** UCL league phase: matches played and points needed to reach the Last16. */
const GROUP_MATCHES = 6;
const GROUP_ADVANCE_PTS = 10;
/** Group draws include weaker pots — opponents scaled into [0.86, 1.0]. */
const GROUP_POT_SCALE_MIN = 0.86;
/** Penalty shootouts are near coin-flips with a small favourite edge. */
const PENS_BIAS_PER_POINT = 0.004;
const PENS_BIAS_CAP = 0.10;
/**
 * Knockout football is tighter than league form — one-off ties are cagey,
 * underdogs raise their game, and favourites can't grind out a bad night
 * over 38 games. Compress the λ gap toward the tie's mean in log space:
 * 0 = league physics, 1 = pure coin flip. League-phase matches compress less.
 */
const KNOCKOUT_TIGHTNESS = 0.30;
const GROUP_TIGHTNESS = 0.10;
/**
 * UCL opponents are Europe's best at full strength — not domestic mid-elite.
 * The pool passed in gets promoted to continental class.
 */
const EURO_SCALE = 1.04;
const EURO_MIN_CHEM = 0.85;
const EURO_MIN_MOR = 75;

/* ─────────────────────────────────────────── structure ─── */

/**
 * Ordered stages of each cup, from PL entry to lifting the trophy.
 * The LAST entry is always 'Winners' — reached only by winning every round.
 */
const CUP_PATHS: Record<CupKind, string[]> = {
  'FA Cup': ['R3', 'R4', 'R5', 'QF', 'SF', 'Final', 'Winners'],
  'EFL':    ['R3', 'R4',       'QF', 'SF', 'Final', 'Winners'],
  'UCL':    ['Group', 'Last16','QF', 'SF', 'Final', 'Winners'],
};

const EARLY_ROUNDS = new Set(['R3', 'R4']);

/** Numeric rank used to compare reached vs target round. */
export const CUP_ROUND_RANK: Record<string, number> = {
  Group: 1, R3: 2, R4: 3, R5: 4, Last16: 4, QF: 5, SF: 6, Final: 7, Winners: 8,
};

export interface CupRun {
  /** The deepest round reached — if knocked out in round X, `reached = X`.
   *  If they win every round, `reached = 'Winners'`. */
  reached: string;
  /** Count of knockout rounds won. */
  roundsWon: number;
}

/* ─────────────────────────────────────────── helpers ─── */

function strengthSum(t: TeamStrength): number {
  return t.attack + t.defense;
}

function scaled(t: TeamStrength, f: number): TeamStrength {
  return { ...t, attack: t.attack * f, defense: t.defense * f };
}

/**
 * Draw a cup opponent from the pool. Early rounds sample uniformly; later
 * rounds skew toward the strong end — the weak sides have been knocked out,
 * so semis and finals are usually against another big club.
 */
function drawOpponent(
  rng: SeededRNG,
  sortedAscending: TeamStrength[],
  round: number,
  totalRounds: number,
): TeamStrength {
  const progress = totalRounds <= 1 ? 0 : round / (totalRounds - 1);
  const bias = 1 + progress * PROGRESS_BIAS;
  const u = Math.pow(rng(), 1 / bias); // bias > 1 skews u toward 1 (stronger)
  const idx = Math.min(sortedAscending.length - 1, Math.floor(u * sortedAscending.length));
  return sortedAscending[idx]!;
}

/** Shootout: coin flip with a small edge for the stronger squad. */
function penaltyShootout(rng: SeededRNG, user: TeamStrength, opp: TeamStrength): boolean {
  const edge = (strengthSum(user) - strengthSum(opp)) * PENS_BIAS_PER_POINT;
  const bias = Math.max(-PENS_BIAS_CAP, Math.min(PENS_BIAS_CAP, edge));
  return rng() < 0.5 + bias;
}

/**
 * One cup match through the Dixon-Coles engine with the λ gap compressed
 * toward the tie's geometric mean — knockout football runs tighter than
 * league form. Chemistry / MOR / formation still flow through expectedGoals.
 * (Cup ties always sample via the DC grid regardless of the league flag —
 * the low-score correction matters most in tight one-offs.)
 */
function playMatch(
  rng: SeededRNG,
  home: TeamStrength,
  away: TeamStrength,
  leagueAvg: LeagueAverages,
  tightness: number,
): { homeGoals: number; awayGoals: number } {
  const { homeLambda, awayLambda } = expectedGoals(home, away, leagueAvg);
  const mid = Math.sqrt(homeLambda * awayLambda);
  const h = Math.pow(homeLambda, 1 - tightness) * Math.pow(mid, tightness);
  const a = Math.pow(awayLambda, 1 - tightness) * Math.pow(mid, tightness);
  return sampleDixonColes(rng, h, a);
}

/**
 * One knockout tie at a randomized venue (50/50 models neutral grounds and
 * random draws). Level after 90' → extra time / penalties.
 * Returns true if the user advances.
 */
function playSingleLeg(
  rng: SeededRNG,
  user: TeamStrength,
  opp: TeamStrength,
  leagueAvg: LeagueAverages,
): boolean {
  const userHome = rng() < 0.5;
  const r = userHome
    ? playMatch(rng, user, opp, leagueAvg, KNOCKOUT_TIGHTNESS)
    : playMatch(rng, opp, user, leagueAvg, KNOCKOUT_TIGHTNESS);
  const userGoals = userHome ? r.homeGoals : r.awayGoals;
  const oppGoals = userHome ? r.awayGoals : r.homeGoals;
  if (userGoals !== oppGoals) return userGoals > oppGoals;
  return penaltyShootout(rng, user, opp);
}

/** Two-legged tie (away leg then home leg). Aggregate; level → penalties. */
function playTwoLegs(
  rng: SeededRNG,
  user: TeamStrength,
  opp: TeamStrength,
  leagueAvg: LeagueAverages,
): boolean {
  const away = playMatch(rng, opp, user, leagueAvg, KNOCKOUT_TIGHTNESS);
  const home = playMatch(rng, user, opp, leagueAvg, KNOCKOUT_TIGHTNESS);
  const userAgg = away.awayGoals + home.homeGoals;
  const oppAgg = away.homeGoals + home.awayGoals;
  if (userAgg !== oppAgg) return userAgg > oppAgg;
  return penaltyShootout(rng, user, opp);
}

/**
 * UCL league phase: six fixtures against pot-scaled draws from the European
 * pool (3 home, 3 away). Advance on points — one bad night doesn't end the
 * campaign, but a poor phase does.
 */
function playGroupStage(
  rng: SeededRNG,
  user: TeamStrength,
  sortedAscending: TeamStrength[],
  leagueAvg: LeagueAverages,
): boolean {
  let pts = 0;
  for (let m = 0; m < GROUP_MATCHES; m++) {
    const base = drawOpponent(rng, sortedAscending, 0, 1); // uniform draw
    const potScale = GROUP_POT_SCALE_MIN + (1 - GROUP_POT_SCALE_MIN) * rng();
    const opp = scaled(base, potScale);
    const userHome = m % 2 === 0;
    const r = userHome
      ? playMatch(rng, user, opp, leagueAvg, GROUP_TIGHTNESS)
      : playMatch(rng, opp, user, leagueAvg, GROUP_TIGHTNESS);
    const userGoals = userHome ? r.homeGoals : r.awayGoals;
    const oppGoals = userHome ? r.awayGoals : r.homeGoals;
    pts += userGoals > oppGoals ? 3 : userGoals === oppGoals ? 1 : 0;
  }
  return pts >= GROUP_ADVANCE_PTS;
}

/* ─────────────────────────────────────────── entry ─── */

/**
 * Simulate a club's full cup campaign using the SAME Dixon-Coles match engine
 * as the league — chemistry, manager MOR, and formation all matter here too.
 *
 * Pure: same inputs + same RNG → same run.
 *
 * Realism levers, in the spirit of Football Manager:
 *   - every tie is an actual simulated match (single-elimination variance)
 *   - early domestic rounds: user rotates the squad; draws can be lower-league
 *   - later rounds draw from the strong end of the surviving pool
 *   - UCL: league phase on points, then two-legged knockouts, one-off final
 *   - level ties go to extra time / penalties (small favourite edge)
 */
export function simulateUserCupRun(args: {
  rng: SeededRNG;
  cup: CupKind;
  user: TeamStrength;
  /** Opponent pool for this competition (report passes domestic or elite). */
  opponents: TeamStrength[];
  leagueAvg: LeagueAverages;
}): CupRun {
  const { rng, cup, user, leagueAvg } = args;
  const path = CUP_PATHS[cup];
  const winsNeeded = path.length - 1;
  let pool: TeamStrength[] =
    args.opponents.length > 0
      ? args.opponents
      : [{ clubId: 'cup-neutral', attack: 75, defense: 75, homeBoost: 4 }];
  if (cup === 'UCL') {
    // Promote the pool to continental class: Europe's elite arrive at full
    // strength with settled squads and top managers.
    pool = pool.map((t) => ({
      ...scaled(t, EURO_SCALE),
      chemistry01: Math.max(t.chemistry01 ?? 0.6, EURO_MIN_CHEM),
      mor: Math.max(t.mor ?? 50, EURO_MIN_MOR),
    }));
  }
  const sorted = [...pool].sort((a, b) => strengthSum(a) - strengthSum(b));

  let roundsWon = 0;
  for (let r = 0; r < winsNeeded; r++) {
    const roundName = path[r]!;
    let advanced: boolean;

    if (cup === 'UCL' && roundName === 'Group') {
      advanced = playGroupStage(rng, user, sorted, leagueAvg);
    } else {
      let opp = drawOpponent(rng, sorted, r, winsNeeded);
      let self = user;
      if (EARLY_ROUNDS.has(roundName)) {
        self = scaled(user, ROTATION_EARLY[cup]);
        if (rng() < LOWER_LEAGUE_CHANCE[cup]) {
          opp = scaled(opp, LOWER_LEAGUE_FACTOR);
        }
      }
      // UCL knockouts before the final are two-legged; everything else one-off.
      const twoLegged = cup === 'UCL' && roundName !== 'Final';
      advanced = twoLegged
        ? playTwoLegs(rng, self, opp, leagueAvg)
        : playSingleLeg(rng, self, opp, leagueAvg);
    }

    if (!advanced) return { reached: roundName, roundsWon };
    roundsWon++;
  }
  return { reached: 'Winners', roundsWon };
}
