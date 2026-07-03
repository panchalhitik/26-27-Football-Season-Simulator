import type { SeededRNG, TeamStrength } from '@/types';
import {
  DC_RHO,
  HOME_ADV_LOG,
  LOG_BASE,
  NORM_RANGE,
  STRENGTH_GAIN,
  chemistryMultiplier,
} from './balance';

export type LeagueAverages = { attack: number; defense: number };
export type ManagerContext = {
  /** Manager Overall Rating, 0–100 — see engine/manager.ts. Default 50. */
  mor?: number;
  /** Tactical effectiveness multiplier ∈ [0.85, 1.15]. Default 1.0. */
  tacticalEff?: number;
  /** Antisymmetric LOG-space μ for this side (caller computes from MOR diff). */
  mu?: number;
};

export type MatchupContext = {
  /** Symmetric LOG-space tempo term (same sign both sides). Default 0. */
  tauTempo?: number;
  /** Antisymmetric LOG-space tilt term (+home, −away). Default 0. */
  tauTilt?: number;
};

/**
 * Compose a team's effective attack and defense ratings — applies chemistry
 * (as a multiplier on the rating itself) and the manager's tactical
 * effectiveness multiplier. Pure.
 */
export function effectiveStrengths(team: TeamStrength, mgr?: ManagerContext): {
  effAttack: number;
  effDefense: number;
} {
  const chem = team.chemistry01 ?? 0.6;
  const chemMult = chemistryMultiplier(chem);
  const tacticalEff = mgr?.tacticalEff ?? 1.0;
  return {
    effAttack: team.attack * chemMult * tacticalEff,
    effDefense: team.defense * chemMult * tacticalEff,
  };
}

/**
 * Log-linear expected goals.
 *
 *   log λ_home = LOG_BASE + α_home − δ_away + HOME_ADV + τ_tempo + τ_tilt + μ
 *   log λ_away = LOG_BASE + α_away − δ_home            + τ_tempo − τ_tilt − μ
 *
 * α and δ are normalised rating differences scaled by STRENGTH_GAIN. The
 * manager tilt (μ) and tactical tilt (τ_tilt) flip sign across the two
 * sides; tempo and home_adv don't (tempo applies symmetrically, home_adv
 * only to the home side).
 */
export function expectedGoalsLogLinear(args: {
  home: TeamStrength;
  away: TeamStrength;
  leagueAvg: LeagueAverages;
  homeMgr?: ManagerContext;
  awayMgr?: ManagerContext;
  matchup?: MatchupContext;
}): { homeLambda: number; awayLambda: number } {
  const { home, away, leagueAvg, homeMgr, awayMgr, matchup } = args;

  const homeEff = effectiveStrengths(home, homeMgr);
  const awayEff = effectiveStrengths(away, awayMgr);

  const alphaH = STRENGTH_GAIN * (homeEff.effAttack  - leagueAvg.attack)  / NORM_RANGE;
  const alphaA = STRENGTH_GAIN * (awayEff.effAttack  - leagueAvg.attack)  / NORM_RANGE;
  const deltaH = STRENGTH_GAIN * (homeEff.effDefense - leagueAvg.defense) / NORM_RANGE;
  const deltaA = STRENGTH_GAIN * (awayEff.effDefense - leagueAvg.defense) / NORM_RANGE;

  const tempo = matchup?.tauTempo ?? 0;
  const tilt  = matchup?.tauTilt  ?? 0;
  const muH   = homeMgr?.mu ?? 0;   // already antisymmetric per side
  const muA   = awayMgr?.mu ?? -muH; // explicit if provided; otherwise mirror

  const logH = LOG_BASE + alphaH - deltaA + HOME_ADV_LOG + tempo + tilt + muH;
  const logA = LOG_BASE + alphaA - deltaH                + tempo - tilt + muA;

  return {
    homeLambda: clampLambda(Math.exp(logH)),
    awayLambda: clampLambda(Math.exp(logA)),
  };
}

/**
 * Dixon-Coles low-score correction sampler. Builds a truncated joint
 * probability grid (0..MAX_GOALS each side), applies the DC τ correction
 * to the four (0,0), (0,1), (1,0), (1,1) cells, then draws from the
 * normalised distribution.
 *
 * Pure given the seeded RNG.
 */
const MAX_GOALS = 9;

export function sampleDixonColes(
  rng: SeededRNG,
  lambdaH: number,
  lambdaA: number,
  rho: number = DC_RHO,
): { homeGoals: number; awayGoals: number } {
  const probs: number[] = new Array((MAX_GOALS + 1) * (MAX_GOALS + 1));
  let total = 0;

  const pH = poissonPmfTable(lambdaH, MAX_GOALS);
  const pA = poissonPmfTable(lambdaA, MAX_GOALS);

  for (let i = 0; i <= MAX_GOALS; i++) {
    for (let j = 0; j <= MAX_GOALS; j++) {
      const baseP = pH[i]! * pA[j]!;
      const tau = dcTau(i, j, lambdaH, lambdaA, rho);
      const p = Math.max(0, baseP * tau);
      probs[i * (MAX_GOALS + 1) + j] = p;
      total += p;
    }
  }

  if (total <= 0) return { homeGoals: 0, awayGoals: 0 };

  // Inverse-CDF sample
  const r = rng() * total;
  let acc = 0;
  for (let i = 0; i <= MAX_GOALS; i++) {
    for (let j = 0; j <= MAX_GOALS; j++) {
      acc += probs[i * (MAX_GOALS + 1) + j]!;
      if (r <= acc) return { homeGoals: i, awayGoals: j };
    }
  }
  return { homeGoals: 0, awayGoals: 0 };
}

function dcTau(i: number, j: number, lh: number, la: number, rho: number): number {
  if (i === 0 && j === 0) return 1 - lh * la * rho;
  if (i === 0 && j === 1) return 1 + lh * rho;
  if (i === 1 && j === 0) return 1 + la * rho;
  if (i === 1 && j === 1) return 1 - rho;
  return 1;
}

function poissonPmfTable(lambda: number, max: number): number[] {
  const out = new Array(max + 1).fill(0);
  let term = Math.exp(-lambda);
  out[0] = term;
  for (let k = 1; k <= max; k++) {
    term *= lambda / k;
    out[k] = term;
  }
  return out;
}

function clampLambda(x: number): number {
  if (!Number.isFinite(x)) return 0.1;
  return Math.max(0.05, Math.min(7, x));
}
