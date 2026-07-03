import type { FormationShape } from '@/types';

/**
 * Tactical attributes per formation shape.
 *
 *   openness     : -1 (cagey, low-scoring) ... +1 (open, high-scoring)
 *                  Feeds the SYMMETRIC τ_tempo term.
 *   defensiveLean: -1 (offensive) ... +1 (defensive)
 *                  Feeds the ANTISYMMETRIC τ_tilt term (rock-paper-scissors).
 *
 * Numbers chosen by inspection of each shape — calibration may shift these
 * but the structure is stable. All values clamped to ±1.
 */
export const TACTIC_TABLE: Record<FormationShape, { openness: number; defensiveLean: number }> = {
  '4-3-3':           { openness: +0.6, defensiveLean: -0.2 },
  '4-2-3-1':         { openness: +0.2, defensiveLean: -0.1 },
  '4-4-2':           { openness: +0.3, defensiveLean: -0.1 },
  '4-4-2-Diamond':   { openness: +0.4, defensiveLean: -0.2 },
  '4-1-4-1':         { openness:  0.0, defensiveLean: +0.1 },
  '4-3-2-1':         { openness: -0.1, defensiveLean: +0.1 },  // Christmas tree, narrow
  '4-2-2-2':         { openness: +0.5, defensiveLean: -0.3 },
  '3-5-2':           { openness: +0.1, defensiveLean:  0.0 },
  '3-4-3':           { openness: +0.7, defensiveLean: -0.4 },
};

/** Symmetric "tempo" term in LOG space — both sides get the same sign. */
export const TAU_TEMPO_GAIN  = 0.10;
export const TAU_TEMPO_CLAMP = 0.10;

/** Antisymmetric "tilt" term in LOG space — home + tilt, away − tilt. */
export const TAU_TILT_GAIN  = 0.15;
export const TAU_TILT_CLAMP = 0.18;

/**
 * Tempo (symmetric) — how open the game will be. Average the two sides'
 * openness, scaled by TAU_TEMPO_GAIN, clamped.
 */
export function tauTempo(home: FormationShape, away: FormationShape): number {
  const ho = TACTIC_TABLE[home]?.openness ?? 0;
  const ao = TACTIC_TABLE[away]?.openness ?? 0;
  const raw = TAU_TEMPO_GAIN * ((ho + ao) / 2);
  return Math.max(-TAU_TEMPO_CLAMP, Math.min(TAU_TEMPO_CLAMP, raw));
}

/**
 * Tilt (antisymmetric) — formation matchup. If home is more attack-leaning
 * than away, home gets a small boost (and away gets equally hurt).
 * The "rock-paper-scissors" effect: ultra-attacking vs ultra-defensive is
 * a clash, while two similar shapes net out near 0.
 */
export function tauTilt(home: FormationShape, away: FormationShape): number {
  const hd = TACTIC_TABLE[home]?.defensiveLean ?? 0;
  const ad = TACTIC_TABLE[away]?.defensiveLean ?? 0;
  // Sign: more defensive away → easier for home to attack → +tilt
  const raw = TAU_TILT_GAIN * (ad - hd);
  return Math.max(-TAU_TILT_CLAMP, Math.min(TAU_TILT_CLAMP, raw));
}
