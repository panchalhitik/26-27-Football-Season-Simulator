import { gaussian, hashSeed, mulberry32 } from '@/engine/rng';
import type {
  FixtureResult,
  LeagueRow,
  SeasonRunInput,
  SeasonRunResult,
  TeamStrength,
} from '@/types';
import { simulateFixture } from './poisson';
import { managerMu, tacticalEffectiveness } from '@/engine/manager';
import { tauTempo, tauTilt } from './tactics';
import {
  FORM_MOMENTUM_CAP,
  FORM_MOMENTUM_RHO,
  FORM_MOMENTUM_STEP,
  FORM_SEASON_CAP,
  FORM_SEASON_SIGMA,
  FORM_TOTAL_CAP,
  MOTIVATION_RELEGATION,
  MOTIVATION_SAFE_SLUMP,
  MOTIVATION_TITLE_RACE,
  MOTIVATION_WINDOW,
  USE_DIXON_COLES,
} from './balance';

const MONTHS: FixtureResult['month'][] = [
  'AUG', 'SEP', 'OCT', 'NOV', 'DEC', 'JAN', 'FEB', 'MAR', 'APR', 'MAY',
];

/**
 * Build a double round-robin fixture order across all teams in the table.
 * Pure function of the team IDs — same order for the same input.
 */
function buildFixtures(teams: TeamStrength[]): { home: TeamStrength; away: TeamStrength; matchday: number }[] {
  // Round-robin schedule using the circle method.
  const list = teams.slice();
  if (list.length % 2 === 1) list.push({ clubId: '__BYE__', attack: 0, defense: 0, homeBoost: 0 });
  const n = list.length;
  const rounds = n - 1;
  const half = n / 2;

  const fixtures: { home: TeamStrength; away: TeamStrength; matchday: number }[] = [];

  // First half
  const arr = list.slice();
  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < half; i++) {
      const a = arr[i] as TeamStrength;
      const b = arr[n - 1 - i] as TeamStrength;
      if (a.clubId !== '__BYE__' && b.clubId !== '__BYE__') {
        // Alternate home / away per round for fairness
        if ((r + i) % 2 === 0) fixtures.push({ home: a, away: b, matchday: r + 1 });
        else fixtures.push({ home: b, away: a, matchday: r + 1 });
      }
    }
    // rotate (keep first fixed)
    const last = arr.pop();
    if (last) arr.splice(1, 0, last);
  }

  // Second half: same pairings with home/away reversed; matchday = first-half
  // matchday + rounds. So MD1 ↔ MD20, MD2 ↔ MD21, ..., MD19 ↔ MD38 for a
  // 20-team league. (The old `i % rounds` math made unrelated fixtures share
  // a matchday because `i` walks every first-half fixture, not every round.)
  const firstHalfCount = fixtures.length;
  for (let i = 0; i < firstHalfCount; i++) {
    const f = fixtures[i] as { home: TeamStrength; away: TeamStrength; matchday: number };
    fixtures.push({ home: f.away, away: f.home, matchday: f.matchday + rounds });
  }

  return fixtures;
}

function emptyRow(clubId: string): LeagueRow {
  return { clubId, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 };
}

/**
 * Per-fixture context derived from the two TeamStrength records: μ from MOR
 * difference (antisymmetric), τ_tempo from both formations' openness
 * (symmetric), τ_tilt from defensive-lean clash (antisymmetric). Pure.
 */
function buildMatchContext(home: TeamStrength, away: TeamStrength): {
  homeMgr: { mor: number; tacticalEff: number; mu: number };
  awayMgr: { mor: number; tacticalEff: number; mu: number };
  matchup: { tauTempo: number; tauTilt: number };
} {
  const morH = home.mor ?? 50;
  const morA = away.mor ?? 50;
  const mu = managerMu(morH, morA);
  // Use FormationShape if present, otherwise pretend both teams played 4-3-3.
  const fh = home.formationShape ?? '4-3-3';
  const fa = away.formationShape ?? '4-3-3';
  return {
    homeMgr: { mor: morH, tacticalEff: tacticalEffectiveness(morH), mu },
    awayMgr: { mor: morA, tacticalEff: tacticalEffectiveness(morA), mu: -mu },
    matchup: { tauTempo: tauTempo(fh, fa), tauTilt: tauTilt(fh, fa) },
  };
}

/**
 * League-wide mean attack and defense ratings — used by the goal model to
 * scale each matchup against the rest of the league rather than against
 * fixed absolutes.
 */
export function leagueAverages(strengths: TeamStrength[]): { attack: number; defense: number } {
  if (strengths.length === 0) return { attack: 75, defense: 75 };
  let a = 0;
  let d = 0;
  for (const t of strengths) {
    a += t.attack;
    d += t.defense;
  }
  return { attack: a / strengths.length, defense: d / strengths.length };
}

/**
 * Pre-compute each team's form trajectory for the season: a per-season
 * campaign factor plus an AR(1) momentum process per matchday. Each team
 * gets its own RNG stream derived from (seed, clubId) so trajectories are
 * independent of the match-sampling stream and of each other.
 *
 * Exported for tests. Pure: same seed + teams + rounds → same trajectories.
 */
export function buildFormTrajectories(
  seed: number,
  teams: TeamStrength[],
  totalRounds: number,
): Map<string, number[]> {
  const out = new Map<string, number[]>();
  for (const t of teams) {
    const rng = mulberry32(hashSeed(seed, 'form:' + t.clubId));
    const seasonForm = clamp(
      gaussian(rng, 0, FORM_SEASON_SIGMA),
      -FORM_SEASON_CAP,
      FORM_SEASON_CAP,
    );
    const traj: number[] = new Array(totalRounds);
    let momentum = 0;
    for (let md = 0; md < totalRounds; md++) {
      momentum = clamp(
        FORM_MOMENTUM_RHO * momentum + gaussian(rng, 0, FORM_MOMENTUM_STEP),
        -FORM_MOMENTUM_CAP,
        FORM_MOMENTUM_CAP,
      );
      traj[md] = seasonForm + momentum;
    }
    out.set(t.clubId, traj);
  }
  return out;
}

/**
 * Run-in motivation from the live table: relegation-threatened sides fight,
 * safe mid-table drifts, the title race sharpens. Only active in the final
 * MOTIVATION_WINDOW matchdays.
 */
function motivationByClub(
  table: Map<string, LeagueRow>,
  leagueSize: number,
): Map<string, number> {
  const sorted = sortTable([...table.values()]);
  const leaderPts = sorted[0]?.points ?? 0;
  const out = new Map<string, number>();
  for (let i = 0; i < sorted.length; i++) {
    const row = sorted[i]!;
    const pos = i + 1;
    if (pos >= leagueSize - 3) {
      // In or one place above the drop zone — scrapping for survival.
      out.set(row.clubId, MOTIVATION_RELEGATION);
    } else if (leaderPts - row.points <= 6) {
      // Within touching distance of the title.
      out.set(row.clubId, MOTIVATION_TITLE_RACE);
    } else if (pos > 7 && pos < leagueSize - 5) {
      // Safe, nothing to play for.
      out.set(row.clubId, MOTIVATION_SAFE_SLUMP);
    } else {
      out.set(row.clubId, 0);
    }
  }
  return out;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/** Apply a combined form multiplier to a team's attack + defense. */
function withForm(t: TeamStrength, form: number): TeamStrength {
  const f = 1 + clamp(form, -FORM_TOTAL_CAP, FORM_TOTAL_CAP);
  return { ...t, attack: t.attack * f, defense: t.defense * f };
}

/** Apply a result to the running league table. */
function applyResult(table: Map<string, LeagueRow>, f: FixtureResult): void {
  const home = table.get(f.homeId) ?? emptyRow(f.homeId);
  const away = table.get(f.awayId) ?? emptyRow(f.awayId);
  home.played += 1;
  away.played += 1;
  home.gf += f.homeGoals;
  home.ga += f.awayGoals;
  away.gf += f.awayGoals;
  away.ga += f.homeGoals;
  if (f.homeGoals > f.awayGoals) {
    home.won += 1;
    home.points += 3;
    away.lost += 1;
  } else if (f.homeGoals < f.awayGoals) {
    away.won += 1;
    away.points += 3;
    home.lost += 1;
  } else {
    home.drawn += 1;
    away.drawn += 1;
    home.points += 1;
    away.points += 1;
  }
  home.gd = home.gf - home.ga;
  away.gd = away.gf - away.ga;
  table.set(f.homeId, home);
  table.set(f.awayId, away);
}

function sortTable(rows: LeagueRow[]): LeagueRow[] {
  return rows.slice().sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.gd !== a.gd) return b.gd - a.gd;
    return b.gf - a.gf;
  });
}

/**
 * Run a single league season. Pure function of seed + strengths.
 */
export function runSeasonOnce(input: SeasonRunInput): SeasonRunResult {
  const rng = mulberry32(input.seed);
  const fixturesPlan = buildFixtures(input.strengths);
  const totalRounds = (input.strengths.length - 1) * 2;
  const table = new Map<string, LeagueRow>();
  for (const t of input.strengths) table.set(t.clubId, emptyRow(t.clubId));

  // League-relative goals model: compute the league's mean attack and
  // defence ratings once so each match scales against them, not absolutes.
  const leagueAvg = leagueAverages(input.strengths);

  // Form layers: per-season campaign factor + per-matchday momentum streaks.
  const forms = buildFormTrajectories(input.seed, input.strengths, totalRounds);
  // Run-in motivation, recomputed from the live table when the matchday turns.
  let motivation = new Map<string, number>();
  let motivationMd = -1;

  const fixtures: FixtureResult[] = [];
  for (const f of fixturesPlan) {
    const inRunIn = f.matchday > totalRounds - MOTIVATION_WINDOW;
    if (inRunIn && f.matchday !== motivationMd) {
      motivation = motivationByClub(table, input.strengths.length);
      motivationMd = f.matchday;
    }
    const mdIdx = f.matchday - 1;
    const homeForm =
      (forms.get(f.home.clubId)?.[mdIdx] ?? 0) + (inRunIn ? motivation.get(f.home.clubId) ?? 0 : 0);
    const awayForm =
      (forms.get(f.away.clubId)?.[mdIdx] ?? 0) + (inRunIn ? motivation.get(f.away.clubId) ?? 0 : 0);
    const home = withForm(f.home, homeForm);
    const away = withForm(f.away, awayForm);

    // Context (MOR / formation clash) comes from the base records — form
    // moves a squad's level, not the manager's tactics.
    const context = USE_DIXON_COLES ? buildMatchContext(f.home, f.away) : undefined;
    const { homeGoals, awayGoals } = simulateFixture(rng, home, away, leagueAvg, context);
    const monthIdx = Math.min(
      MONTHS.length - 1,
      Math.floor(((f.matchday - 1) / totalRounds) * MONTHS.length),
    );
    const month = MONTHS[monthIdx] as FixtureResult['month'];
    const result: FixtureResult = {
      matchday: f.matchday,
      month,
      homeId: f.home.clubId,
      awayId: f.away.clubId,
      homeGoals,
      awayGoals,
    };
    fixtures.push(result);
    applyResult(table, result);
  }

  const finalTable = sortTable([...table.values()]);
  const userRow = finalTable.find((r) => r.clubId === input.userClubId);
  const userPos = finalTable.findIndex((r) => r.clubId === input.userClubId) + 1;
  const userCleanSheets = fixtures.filter((f) =>
    (f.homeId === input.userClubId && f.awayGoals === 0) ||
    (f.awayId === input.userClubId && f.homeGoals === 0),
  ).length;

  return {
    seed: input.seed,
    fixtures,
    finalTable,
    userPoints: userRow?.points ?? 0,
    userPosition: userPos || finalTable.length,
    userGoalsFor: userRow?.gf ?? 0,
    userGoalsAgainst: userRow?.ga ?? 0,
    userCleanSheets,
  };
}

export interface MonteCarloOutput {
  headline: SeasonRunResult;
  pctTitle: number;
  pctTop4: number;
  pctTop6: number;
  pctRelegation: number;
  expectedPoints: number;
  expectedPosition: number;
}

/**
 * Monte Carlo around the headline run. Returns the first run as the
 * "this is what happened" narrative, plus distributional summaries.
 */
export function monteCarloSeason(input: SeasonRunInput): MonteCarloOutput {
  const headline = runSeasonOnce(input);
  if (input.monteCarloRuns <= 1) {
    return {
      headline,
      pctTitle: headline.userPosition === 1 ? 100 : 0,
      pctTop4: headline.userPosition <= 4 ? 100 : 0,
      pctTop6: headline.userPosition <= 6 ? 100 : 0,
      pctRelegation: headline.userPosition >= input.strengths.length - 2 ? 100 : 0,
      expectedPoints: headline.userPoints,
      expectedPosition: headline.userPosition,
    };
  }

  let titles = 0;
  let top4 = 0;
  let top6 = 0;
  let releg = 0;
  let sumPoints = 0;
  let sumPosition = 0;

  for (let i = 0; i < input.monteCarloRuns; i++) {
    const run = runSeasonOnce({ ...input, seed: input.seed + i });
    if (run.userPosition === 1) titles += 1;
    if (run.userPosition <= 4) top4 += 1;
    if (run.userPosition <= 6) top6 += 1;
    if (run.userPosition >= input.strengths.length - 2) releg += 1;
    sumPoints += run.userPoints;
    sumPosition += run.userPosition;
  }

  return {
    headline,
    pctTitle: (titles / input.monteCarloRuns) * 100,
    pctTop4: (top4 / input.monteCarloRuns) * 100,
    pctTop6: (top6 / input.monteCarloRuns) * 100,
    pctRelegation: (releg / input.monteCarloRuns) * 100,
    expectedPoints: sumPoints / input.monteCarloRuns,
    expectedPosition: sumPosition / input.monteCarloRuns,
  };
}
