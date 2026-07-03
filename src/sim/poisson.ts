import { poissonSample } from '@/engine/rng';
import type { SeededRNG, TeamStrength } from '@/types';
import {
  ATTACK_POWER,
  BASE_GOALS,
  CHEM_HIGH,
  CHEM_LOW,
  DEFAULT_LEAGUE_AVG,
  DEFENSE_POWER,
  HOME_FACTOR,
  MANAGER_SCALE,
  UPSET_DAMPING,
  USE_DIXON_COLES,
  chemistryMultiplier,
  managerMultiplier,
} from './balance';
import {
  expectedGoalsLogLinear,
  sampleDixonColes,
  type ManagerContext,
  type MatchupContext,
} from './dixon-coles';
import { managerMu, tacticalEffectiveness } from '@/engine/manager';
import { tauTempo, tauTilt } from './tactics';
import type { TeamStrength as _TS } from '@/types';

export type LeagueAverages = { attack: number; defense: number };

/**
 * Auto-derive the per-match context from the two TeamStrength records when
 * the caller hasn't supplied one. Keeps the public 2-arg signature
 * meaningful — direct callers (Monte Carlo scripts, tests) get the full
 * model without manually wiring context.
 */
function autoContext(home: _TS, away: _TS): {
  homeMgr: ManagerContext;
  awayMgr: ManagerContext;
  matchup: MatchupContext;
} {
  const morH = home.mor ?? 50;
  const morA = away.mor ?? 50;
  const mu = managerMu(morH, morA);
  const fh = home.formationShape ?? '4-3-3';
  const fa = away.formationShape ?? '4-3-3';
  return {
    homeMgr: { mor: morH, tacticalEff: tacticalEffectiveness(morH), mu },
    awayMgr: { mor: morA, tacticalEff: tacticalEffectiveness(morA), mu: -mu },
    matchup: { tauTempo: tauTempo(fh, fa), tauTilt: tauTilt(fh, fa) },
  };
}

/**
 * Public entry — same 2-arg signature as before. Drop-in: branches by
 * USE_DIXON_COLES feature flag. When true (default), the log-linear /
 * Dixon-Coles model in dixon-coles.ts runs. When false, the legacy
 * power-ratio model below runs.
 */
export function expectedGoals(
  home: TeamStrength,
  away: TeamStrength,
  leagueAvg: LeagueAverages = DEFAULT_LEAGUE_AVG,
  context?: { homeMgr?: ManagerContext; awayMgr?: ManagerContext; matchup?: MatchupContext },
): { homeLambda: number; awayLambda: number } {
  if (USE_DIXON_COLES) {
    const effective = context ?? autoContext(home, away);
    return expectedGoalsLogLinear({
      home, away, leagueAvg,
      ...(effective.homeMgr ? { homeMgr: effective.homeMgr } : {}),
      ...(effective.awayMgr ? { awayMgr: effective.awayMgr } : {}),
      ...(effective.matchup ? { matchup: effective.matchup } : {}),
    });
  }
  return expectedGoalsLegacy(home, away, leagueAvg);
}

/** Sample a single match scoreline. Pure given the RNG. */
export function simulateFixture(
  rng: SeededRNG,
  home: TeamStrength,
  away: TeamStrength,
  leagueAvg: LeagueAverages = DEFAULT_LEAGUE_AVG,
  context?: { homeMgr?: ManagerContext; awayMgr?: ManagerContext; matchup?: MatchupContext },
): { homeGoals: number; awayGoals: number } {
  const { homeLambda, awayLambda } = expectedGoals(home, away, leagueAvg, context);
  if (USE_DIXON_COLES) {
    return sampleDixonColes(rng, homeLambda, awayLambda);
  }
  return { homeGoals: sampleGoalsLegacy(rng, homeLambda), awayGoals: sampleGoalsLegacy(rng, awayLambda) };
}

/* ───────────────────────────────────────── Legacy engine (rollback path) ─── */

/** Old power-ratio model, kept callable as a fallback / regression guard. */
export function expectedGoalsLegacy(
  home: TeamStrength,
  away: TeamStrength,
  leagueAvg: LeagueAverages = DEFAULT_LEAGUE_AVG,
): { homeLambda: number; awayLambda: number } {
  const homeLambda = sideExpGLegacy(home, away, leagueAvg, true);
  const awayLambda = sideExpGLegacy(away, home, leagueAvg, false);
  return { homeLambda: clampLambda(homeLambda), awayLambda: clampLambda(awayLambda) };
}

function sideExpGLegacy(
  team: TeamStrength,
  opponent: TeamStrength,
  leagueAvg: LeagueAverages,
  isHome: boolean,
): number {
  const attackFactor = safePow(team.attack / Math.max(40, leagueAvg.attack), ATTACK_POWER);
  const defenseFactor = safePow(leagueAvg.defense / Math.max(40, opponent.defense), DEFENSE_POWER);
  const teamChem = team.chemistry01 ?? 0.6;
  const chemMult = chemistryMultiplier(teamChem);
  const teamMgrMod = team.managerMod ?? 0;
  const mgrMult = managerMultiplier(teamMgrMod / 2);
  const homeMult = isHome ? HOME_FACTOR : 1;
  return BASE_GOALS * attackFactor * defenseFactor * chemMult * mgrMult * homeMult;
}

function sampleGoalsLegacy(rng: SeededRNG, lambda: number): number {
  if (UPSET_DAMPING <= 1) return poissonSample(rng, lambda);
  let total = 0;
  for (let i = 0; i < UPSET_DAMPING; i++) total += poissonSample(rng, lambda);
  return Math.round(total / UPSET_DAMPING);
}

function safePow(base: number, exp: number): number {
  if (!Number.isFinite(base) || base <= 0) return 0.5;
  return Math.pow(base, exp);
}

function clampLambda(x: number): number {
  if (!Number.isFinite(x)) return 0.1;
  return Math.max(0.05, Math.min(7, x));
}

/* ───────────────────────────────────────── re-exports for callers ─── */
export {
  ATTACK_POWER,
  BASE_GOALS,
  CHEM_HIGH,
  CHEM_LOW,
  DEFENSE_POWER,
  HOME_FACTOR,
  MANAGER_SCALE,
  UPSET_DAMPING,
};
