import type { Manager } from '@/types';

/**
 * Manager Overall Rating (MOR) on a 0–100 scale.
 *
 * Two genuinely independent inputs (per the spec's Correction 2: money and
 * legacy must NOT be collapsed into one signal — that's how bargains and
 * busts exist):
 *
 *   LegacyScore : the explicit `pedigree` field, used DIRECTLY — it is
 *                 already authored on a 0-100 scale (serial winners ~90,
 *                 young coaches doing well ~60-75, unproven ~40-50), so
 *                 re-ranking it would only distort the authored ordering.
 *   MoneyScore  : pool-percentile of log(1 + 2·salary + compFee). Salary is
 *                 weighted double so a FREE AGENT legend (fee 0) is read as
 *                 "commands a top salary", not "the market rejected him".
 *
 * MOR = MONEY_WEIGHT × MoneyScore + (1 − MONEY_WEIGHT) × LegacyScore
 * Legacy dominates heavily: silverware is what the board respects; market
 * heat only nudges.
 */

export const MONEY_WEIGHT = 0.1;

/** Pure: same managers pool → same scores. */
export function computeManagerRatings(pool: Manager[]): {
  byId: Record<string, { mor: number; moneyScore: number; legacyScore: number }>;
} {
  if (pool.length === 0) return { byId: {} };

  // Raw signals
  const money: number[] = pool.map((m) =>
    Math.log(1 + 2 * Math.max(0, m.salaryMPerYr) + Math.max(0, m.compensationFeeM)),
  );
  // Only money is percentile-normalised; pedigree is already 0-100.
  const moneyPct = percentileNormalise(money);

  const byId: Record<string, { mor: number; moneyScore: number; legacyScore: number }> = {};
  pool.forEach((m, i) => {
    const ms = moneyPct[i] ?? 50;
    const ls = Math.max(0, Math.min(100, m.pedigree));
    const mor = MONEY_WEIGHT * ms + (1 - MONEY_WEIGHT) * ls;
    byId[m.id] = { mor, moneyScore: ms, legacyScore: ls };
  });

  return { byId };
}

function percentileNormalise(values: number[]): number[] {
  if (values.length === 0) return [];
  if (values.length === 1) return [50];
  // For each value, what fraction of the pool is strictly less than it?
  // Returns rank in [0, 1] then × 100.
  const sorted = values.slice().sort((a, b) => a - b);
  const lookup = new Map<number, number>();
  // For ties take the average rank
  let i = 0;
  while (i < sorted.length) {
    let j = i;
    while (j < sorted.length - 1 && sorted[j + 1] === sorted[i]) j++;
    const avgRank = (i + j) / 2;
    lookup.set(sorted[i]!, avgRank);
    i = j + 1;
  }
  const denom = sorted.length - 1;
  return values.map((v) => ((lookup.get(v) ?? 0) / denom) * 100);
}

/**
 * Tactical effectiveness multiplier — bounded [0.92, 1.08]. This is the
 * spec's "bounded ±8% performance ceiling" — the manager must NEVER turn a
 * relegation squad into a title contender. A 50 MOR manager is neutral
 * (1.00); 100 MOR caps at 1.08, 0 MOR bottoms at 0.92.
 */
export function tacticalEffectiveness(mor: number): number {
  const t = Math.max(0, Math.min(100, mor)) / 100;
  return 0.92 + 0.16 * t;
}

/**
 * Manager head-to-head goal tilt term μ, in LOG space. Antisymmetric:
 * applied with +sign to home, −sign to away.
 *
 * μ = K × (MOR_home − MOR_away) / 100, clamped to ±MGR_MU_CLAMP.
 *
 * The clamp is intentionally smaller than the squad-strength spread so a
 * better manager can tilt a close match but can NEVER flip a clear quality gap.
 */
export const MGR_MU_GAIN = 0.5;
export const MGR_MU_CLAMP = 0.07;

export function managerMu(morHome: number, morAway: number): number {
  const raw = MGR_MU_GAIN * (morHome - morAway) / 100;
  return Math.max(-MGR_MU_CLAMP, Math.min(MGR_MU_CLAMP, raw));
}
