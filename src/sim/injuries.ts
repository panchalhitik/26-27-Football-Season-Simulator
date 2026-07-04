import type { Player, PlayerId, SeededRNG } from '@/types';

/**
 * Injury model — every starter carries a small per-match injury risk,
 * age-weighted. Durations skew short (knocks) with a long tail (ruptures).
 * Pure: same RNG stream → same injuries.
 */

/** Base probability a starter picks up an injury in one match. */
export const INJURY_BASE_P = 0.035;

/** matchdaysOut distribution: mostly knocks, occasionally months out. */
const DURATION_WEIGHTS: { out: number; w: number }[] = [
  { out: 1, w: 38 },
  { out: 2, w: 26 },
  { out: 3, w: 15 },
  { out: 4, w: 9 },
  { out: 5, w: 5 },
  { out: 6, w: 4 },
  { out: 8, w: 2 },
  { out: 10, w: 1 },
];
const DURATION_TOTAL = DURATION_WEIGHTS.reduce((a, d) => a + d.w, 0);

export interface InjuryEvent {
  playerId: PlayerId;
  matchdaysOut: number;
}

/** Age multiplier: veterans break down more, kids bounce. */
export function injuryRiskMultiplier(age: number): number {
  if (age >= 34) return 1.6;
  if (age >= 31) return 1.3;
  if (age <= 21) return 0.85;
  return 1.0;
}

/**
 * Roll injuries for the players who just played a match.
 * Returns the (usually empty) list of new injuries.
 */
export function rollMatchdayInjuries(args: {
  rng: SeededRNG;
  players: Player[];
}): InjuryEvent[] {
  const { rng, players } = args;
  const events: InjuryEvent[] = [];
  for (const p of players) {
    const risk = INJURY_BASE_P * injuryRiskMultiplier(p.age);
    if (rng() < risk) {
      const roll = rng() * DURATION_TOTAL;
      let acc = 0;
      let out = 1;
      for (const d of DURATION_WEIGHTS) {
        acc += d.w;
        if (roll <= acc) { out = d.out; break; }
      }
      events.push({ playerId: p.id, matchdaysOut: out });
    }
  }
  return events;
}

/**
 * Advance the injury table one matchday: everyone heals by 1; the recovered
 * drop out of the record.
 */
export function tickInjuries(
  injuries: Record<PlayerId, number>,
): Record<PlayerId, number> {
  const out: Record<PlayerId, number> = {};
  for (const [id, left] of Object.entries(injuries)) {
    if (left > 1) out[id] = left - 1;
  }
  return out;
}

/** Merge freshly rolled injuries into the table (longer spell wins). */
export function addInjuries(
  injuries: Record<PlayerId, number>,
  events: InjuryEvent[],
): Record<PlayerId, number> {
  const out = { ...injuries };
  for (const ev of events) {
    out[ev.playerId] = Math.max(out[ev.playerId] ?? 0, ev.matchdaysOut);
  }
  return out;
}
