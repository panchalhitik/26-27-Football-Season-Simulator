import { gaussian, hashSeed, mulberry32 } from '@/engine/rng';
import type {
  FixtureResult,
  LeagueRow,
  SeasonRunResult,
  TeamStrength,
} from '@/types';
import { simulateFixture } from './poisson';
import {
  applyResult,
  buildFixtures,
  buildMatchContext,
  emptyRow,
  leagueAverages,
  motivationByClub,
  sortTable,
  withForm,
} from './season';
import {
  FORM_MOMENTUM_CAP,
  FORM_MOMENTUM_RHO,
  FORM_MOMENTUM_STEP,
  FORM_SEASON_CAP,
  FORM_SEASON_SIGMA,
  MOTIVATION_WINDOW,
  USE_DIXON_COLES,
} from './balance';

const MONTHS: FixtureResult['month'][] = [
  'AUG', 'SEP', 'OCT', 'NOV', 'DEC', 'JAN', 'FEB', 'MAR', 'APR', 'MAY',
];

/**
 * Serializable snapshot of a season in progress. The store persists this so
 * a matchday-by-matchday playthrough survives reloads.
 *
 * Design note — statelessness per matchday: the match RNG and each team's
 * momentum innovation for matchday N are derived from (seed, N) and
 * (seed, clubId, N) respectively, NOT from a shared consumed stream. That
 * means the user editing their lineup between matchdays never shifts the
 * randomness of unrelated fixtures, and replaying the same matchday from the
 * same snapshot is reproducible.
 */
export interface LiveSeasonState {
  seed: number;
  /** Stable club order — drives the round-robin schedule. */
  clubOrder: string[];
  /** Next matchday to play, 1-based. */
  matchday: number;
  totalRounds: number;
  results: FixtureResult[];
  table: LeagueRow[];
  /** Per-club season campaign factor (drawn once at init). */
  seasonForm: Record<string, number>;
  /** Per-club AR(1) momentum carried between matchdays. */
  momentum: Record<string, number>;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/** Deterministic momentum innovation for one club on one matchday. */
function momentumStep(seed: number, clubId: string, matchday: number, prev: number): number {
  const rng = mulberry32(hashSeed(seed, `mom:${clubId}:${matchday}`));
  return clamp(
    FORM_MOMENTUM_RHO * prev + gaussian(rng, 0, FORM_MOMENTUM_STEP),
    -FORM_MOMENTUM_CAP,
    FORM_MOMENTUM_CAP,
  );
}

/** Start a fresh live season. Pure: same seed + clubs → same initial state. */
export function initLiveSeason(args: {
  seed: number;
  strengths: TeamStrength[];
}): LiveSeasonState {
  const { seed, strengths } = args;
  const seasonForm: Record<string, number> = {};
  const momentum: Record<string, number> = {};
  for (const t of strengths) {
    const rng = mulberry32(hashSeed(seed, 'form:' + t.clubId));
    seasonForm[t.clubId] = clamp(
      gaussian(rng, 0, FORM_SEASON_SIGMA),
      -FORM_SEASON_CAP,
      FORM_SEASON_CAP,
    );
    momentum[t.clubId] = 0;
  }
  return {
    seed,
    clubOrder: strengths.map((t) => t.clubId),
    matchday: 1,
    totalRounds: (strengths.length - 1) * 2,
    results: [],
    table: strengths.map((t) => emptyRow(t.clubId)),
    seasonForm,
    momentum,
  };
}

/**
 * Play the next matchday. Pure: returns a NEW state; the input is untouched.
 *
 * `strengths` is looked up by clubId — the caller may hand in an updated
 * user-team record (new lineup, injuries, formation) between matchdays and
 * only that club's physics change.
 */
export function playMatchday(
  state: LiveSeasonState,
  strengths: TeamStrength[],
): LiveSeasonState {
  if (state.matchday > state.totalRounds) return state;

  const byId = new Map(strengths.map((t) => [t.clubId, t]));
  // Schedule from the STABLE club order captured at init, not the caller's
  // array order — lineup edits must never reshuffle the fixture list.
  const ordered = state.clubOrder
    .map((id) => byId.get(id))
    .filter((t): t is TeamStrength => Boolean(t));
  const plan = buildFixtures(ordered).filter((f) => f.matchday === state.matchday);

  const leagueAvg = leagueAverages(ordered);
  const rng = mulberry32(hashSeed(state.seed, `md:${state.matchday}`));

  // Advance momentum for every club (deterministic per matchday).
  const momentum: Record<string, number> = {};
  for (const id of state.clubOrder) {
    momentum[id] = momentumStep(state.seed, id, state.matchday, state.momentum[id] ?? 0);
  }

  // Run-in motivation from the live table.
  const tableMap = new Map(state.table.map((r) => [r.clubId, { ...r }]));
  const inRunIn = state.matchday > state.totalRounds - MOTIVATION_WINDOW;
  const motivation = inRunIn
    ? motivationByClub(tableMap, state.clubOrder.length)
    : new Map<string, number>();

  const monthIdx = Math.min(
    MONTHS.length - 1,
    Math.floor(((state.matchday - 1) / state.totalRounds) * MONTHS.length),
  );
  const month = MONTHS[monthIdx] as FixtureResult['month'];

  const newResults: FixtureResult[] = [];
  for (const f of plan) {
    const homeForm = (state.seasonForm[f.home.clubId] ?? 0)
      + (momentum[f.home.clubId] ?? 0)
      + (motivation.get(f.home.clubId) ?? 0);
    const awayForm = (state.seasonForm[f.away.clubId] ?? 0)
      + (momentum[f.away.clubId] ?? 0)
      + (motivation.get(f.away.clubId) ?? 0);
    const home = withForm(f.home, homeForm);
    const away = withForm(f.away, awayForm);
    const context = USE_DIXON_COLES ? buildMatchContext(f.home, f.away) : undefined;
    const { homeGoals, awayGoals } = simulateFixture(rng, home, away, leagueAvg, context);
    const result: FixtureResult = {
      matchday: state.matchday,
      month,
      homeId: f.home.clubId,
      awayId: f.away.clubId,
      homeGoals,
      awayGoals,
    };
    newResults.push(result);
    applyResult(tableMap, result);
  }

  return {
    ...state,
    matchday: state.matchday + 1,
    results: [...state.results, ...newResults],
    table: sortTable([...tableMap.values()]),
    momentum,
  };
}

/** How many matchdays are left to play. */
export function matchdaysRemaining(state: LiveSeasonState): number {
  return Math.max(0, state.totalRounds - state.matchday + 1);
}

/** The user's next fixture, or null when the season is over. */
export function nextUserFixture(
  state: LiveSeasonState,
  strengths: TeamStrength[],
  userClubId: string,
): { opponentId: string; isHome: boolean; matchday: number } | null {
  if (state.matchday > state.totalRounds) return null;
  const byId = new Map(strengths.map((t) => [t.clubId, t]));
  const ordered = state.clubOrder
    .map((id) => byId.get(id))
    .filter((t): t is TeamStrength => Boolean(t));
  const plan = buildFixtures(ordered).filter((f) => f.matchday === state.matchday);
  for (const f of plan) {
    if (f.home.clubId === userClubId) {
      return { opponentId: f.away.clubId, isHome: true, matchday: state.matchday };
    }
    if (f.away.clubId === userClubId) {
      return { opponentId: f.home.clubId, isHome: false, matchday: state.matchday };
    }
  }
  return null;
}

/** Last-5 form string per club, latest first — 'W' 'D' 'L'. */
export function formGuide(state: LiveSeasonState): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const id of state.clubOrder) out[id] = [];
  for (let i = state.results.length - 1; i >= 0; i--) {
    const f = state.results[i]!;
    const homeRes = f.homeGoals > f.awayGoals ? 'W' : f.homeGoals === f.awayGoals ? 'D' : 'L';
    const awayRes = homeRes === 'W' ? 'L' : homeRes === 'L' ? 'W' : 'D';
    const h = out[f.homeId];
    const a = out[f.awayId];
    if (h && h.length < 5) h.push(homeRes);
    if (a && a.length < 5) a.push(awayRes);
  }
  return out;
}

/**
 * Assemble the finished (or in-progress) live season into the same
 * SeasonRunResult shape the reports, stats and awards pipelines consume.
 */
export function liveToSeasonResult(
  state: LiveSeasonState,
  userClubId: string,
): SeasonRunResult {
  const finalTable = sortTable(state.table);
  const userRow = finalTable.find((r) => r.clubId === userClubId);
  const userPos = finalTable.findIndex((r) => r.clubId === userClubId) + 1;
  const userCleanSheets = state.results.filter((f) =>
    (f.homeId === userClubId && f.awayGoals === 0) ||
    (f.awayId === userClubId && f.homeGoals === 0),
  ).length;
  return {
    seed: state.seed,
    fixtures: state.results,
    finalTable,
    userPoints: userRow?.points ?? 0,
    userPosition: userPos || finalTable.length,
    userGoalsFor: userRow?.gf ?? 0,
    userGoalsAgainst: userRow?.ga ?? 0,
    userCleanSheets,
  };
}
