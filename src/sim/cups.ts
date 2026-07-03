import type { SeededRNG } from '@/types';

export type CupKind = 'FA Cup' | 'EFL' | 'UCL';

/**
 * Ordered stages of each domestic / European cup, from PL entry to lifting.
 * The LAST entry is always 'Winners' — reached only by winning every prior round.
 */
const CUP_PATHS: Record<CupKind, string[]> = {
  'FA Cup': ['R3', 'R4', 'R5', 'QF', 'SF', 'Final', 'Winners'],
  'EFL':    ['R3', 'R4',       'QF', 'SF', 'Final', 'Winners'],
  'UCL':    ['Group', 'Last16','QF', 'SF', 'Final', 'Winners'],
};

/** Numeric rank used to compare reached vs target round. */
export const CUP_ROUND_RANK: Record<string, number> = {
  Group: 1, R3: 2, R4: 3, R5: 4, Last16: 4, QF: 5, SF: 6, Final: 7, Winners: 8,
};

export interface CupRun {
  /** The deepest round reached — if knocked out in round X, `reached = X`.
   *  If they win every round, `reached = 'Winners'`. */
  reached: string;
  /** Count of knockout wins. winsNeeded varies by cup. */
  roundsWon: number;
}

/**
 * Simulate a single club's run through a knockout cup.
 * Pure: same inputs + same RNG → same result.
 *
 * Each round draws a random opponent strength from `opponentStrengths` and
 * plays a single decisive tie. Win probability is a sigmoid of the strength
 * margin (gain ≈ 1.0 per 7 combined points). A top-tier side wins roughly
 * 15-25% of cups; an average side ~3%; a weak side essentially never.
 *
 * Pre-condition: `opponentStrengths` should be non-empty. Empty falls back
 * to a neutral 150 strength so callers don't have to special-case.
 */
export function simulateUserCupRun(args: {
  rng: SeededRNG;
  cup: CupKind;
  /** User club's combined attack + defense. */
  userStrength: number;
  /** Pool of attack+defense sums of plausible opponents for this competition. */
  opponentStrengths: number[];
}): CupRun {
  const path = CUP_PATHS[args.cup];
  const winsNeeded = path.length - 1;
  const pool = args.opponentStrengths.length > 0 ? args.opponentStrengths : [150];

  let roundsWon = 0;
  for (let r = 0; r < winsNeeded; r++) {
    const oppIdx = Math.floor(args.rng() * pool.length);
    const oppStrength = pool[oppIdx] ?? 150;
    const margin = args.userStrength - oppStrength;
    const winProb = 1 / (1 + Math.exp(-margin / 14));
    if (args.rng() > winProb) {
      return { reached: path[r]!, roundsWon };
    }
    roundsWon++;
  }
  return { reached: 'Winners', roundsWon };
}
