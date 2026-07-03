/**
 * Tunable constants for the match-result model. Centralising them here so
 * future balance passes are one file, not a hunt across the codebase.
 *
 * Higher = harder to tune mistakes back in. Touch carefully.
 */

/** Baseline expected goals per side per match in a perfectly average matchup. */
export const BASE_GOALS = 1.35;

/**
 * Exponents applied to (teamAttack / leagueAvgAttack) and
 * (leagueAvgDef / opponentDef). Higher = steeper strength gradient.
 *   1.0 = linear   (current model felt close to this, ~×1.5 at 20-pt gap)
 *   1.7 = our default; 20-pt-rating advantage → ~×1.9 goals; 30-pt → ~×2.6
 */
export const ATTACK_POWER  = 1.7;
export const DEFENSE_POWER = 1.7;

/** Multiplicative home advantage. 1.18 is roughly the historical EPL home edge. */
export const HOME_FACTOR = 1.18;

/**
 * Chemistry multiplier endpoints on the rating itself (NOT on goals — those
 * happen later via the log-linear formula).
 *
 * Asymmetric on purpose: it's much easier to underperform a team's potential
 * than to overperform it. A galactico XI with no cohesion plays at 0.60× its
 * raw strength; a perfectly drilled squad gets +10%.
 *   chem 0   → CHEM_LOW  = 0.60   (catastrophic)
 *   chem 50  → ≈ 0.85            (mediocre)
 *   chem 100 → CHEM_HIGH = 1.10   (excellent)
 */
export const CHEM_LOW  = 0.60;
export const CHEM_HIGH = 1.10;

/**
 * Manager modifier scaling. The Manager type carries `attackMod` / `defenseMod`
 * in the range ±5. Dividing by MANAGER_SCALE gives the multiplicative bump:
 *   modifier ±5, scale 50 → ±0.10 (i.e. ±10% on the relevant expG component).
 */
export const MANAGER_SCALE = 50;

/**
 * "Squad depth" bonus. We average the top-7 non-XI players' ratings and add
 * (avg - 70) × DEPTH_BONUS_WEIGHT to both attack and defense. A bench
 * averaging 80 → +0.5 rating points; bench averaging 60 → −0.5.
 *
 * Marginal but real: rewards a stacked second string, punishes a thin squad.
 */
export const DEPTH_BONUS_WEIGHT = 0.05;

/**
 * Variance damping on the (legacy) goal sample. Goals are sampled as the
 * integer average of UPSET_DAMPING independent Poisson draws around the same
 * mean. Only used when USE_DIXON_COLES is false.
 */
export const UPSET_DAMPING = 2;

/**
 * Feature flag — when true (default), the match engine uses the new
 * Dixon-Coles log-linear model with antisymmetric manager/tilt and
 * symmetric tempo. When false, falls back to the previous power-ratio
 * model (kept callable as a guard against regressions).
 */
export const USE_DIXON_COLES = true;

/**
 * Dixon-Coles low-score correlation parameter (rho). Negative → reduces
 * high-scoring draws, increases 1-0 / 0-0 / 0-1 frequencies. -0.15 is the
 * standard literature value.
 */
export const DC_RHO = -0.15;

/**
 * Log-space base goals — the constant in the λ formula:
 *   log λ = LOG_BASE + α − δ + home_adv + τ_tempo + τ_tilt + μ
 * Set so that two league-average sides with neutral chemistry and neutral
 * managers produce λ ≈ 1.35 home and λ ≈ 1.10 away — matching real football.
 */
export const LOG_BASE = Math.log(1.10);

/** Home-only LOG-space additive term. e^0.27 ≈ ×1.31 multiplier. */
export const HOME_ADV_LOG = 0.27;

/**
 * Scale factors for the strength terms IN LOG SPACE. α and δ are
 * normalised rating differences (team − leagueAvg) divided by NORM_RANGE;
 * the resulting [-1, +1]-ish numbers are multiplied by STRENGTH_GAIN to
 * decide how much each rating point matters in log-goals.
 *
 * Calibrated to give realistic football: 5-pt gap → ~58% favourite win,
 * 10-pt gap → ~70%, 20-pt gap → ~82%. Past 25 pts results compress
 * naturally because λ has an upper cap of 7.
 */
export const NORM_RANGE = 15;
export const STRENGTH_GAIN = 0.45;

/**
 * Safe defaults used when callers don't supply per-league averages — keeps
 * old tests + opponent-only simulations valid. Roughly the long-term league
 * mean of our hand-built clubs.
 */
export const DEFAULT_LEAGUE_AVG = { attack: 75, defense: 75 };

/**
 * chem01 ∈ [0,1] → multiplier on the team's effective rating.
 *
 * The curve is biased: at chem 0.5 you're at ~0.85 (noticeably below
 * potential) — there's no "neutral" plateau in the middle. Same shape as
 * real football: cohesion is hard-won and easily wrecked.
 */
export function chemistryMultiplier(chem01: number): number {
  const x = Math.max(0, Math.min(1, chem01));
  // Easing curve: cubic-bias so most teams sit below max
  const eased = Math.pow(x, 1.3);
  return CHEM_LOW + (CHEM_HIGH - CHEM_LOW) * eased;
}

/** Convenience: turn an Attack/Defense manager modifier into its multiplier. */
export function managerMultiplier(modifier: number): number {
  return 1 + modifier / MANAGER_SCALE;
}
