import type { Player, PlayerId, Position, SeededRNG, XI } from '@/types';

/**
 * Per-position weights for sampling SCORERS. Strikers and wingers carry
 * almost all goals; midfielders chip in, defenders rarely score, the keeper
 * essentially never.
 */
const SCORER_WEIGHTS: Record<Position, number> = {
  ST:  1.00,
  LW:  0.55,
  RW:  0.55,
  CAM: 0.40,
  CM:  0.18,
  LM:  0.25,
  RM:  0.25,
  CDM: 0.06,
  CB:  0.05,
  LB:  0.04,
  RB:  0.04,
  GK:  0.001,
};

/**
 * Per-position weights for sampling ASSISTERS. Playmakers (CAM, CM, wingers)
 * dominate; defenders and strikers contribute less; keepers nearly never.
 */
const ASSIST_WEIGHTS: Record<Position, number> = {
  CAM: 1.00,
  CM:  0.65,
  LW:  0.75,
  RW:  0.75,
  LM:  0.55,
  RM:  0.55,
  ST:  0.30,
  CDM: 0.15,
  LB:  0.18,
  RB:  0.18,
  CB:  0.05,
  GK:  0.002,
};

/** Weighted pick from an array. Returns -1 if total weight is 0. */
function weightedPick(rng: SeededRNG, weights: number[]): number {
  let total = 0;
  for (const w of weights) total += w;
  if (total <= 0) return -1;
  const r = rng() * total;
  let acc = 0;
  for (let i = 0; i < weights.length; i++) {
    acc += weights[i]!;
    if (r <= acc) return i;
  }
  return weights.length - 1;
}

export interface GoalEvent {
  scorerId: PlayerId;
  assisterId: PlayerId | null;
}

/**
 * Given the user's XI (player list) and a number of goals scored in this
 * fixture, sample which player scored and (optionally) who assisted.
 *
 * Weighted by position × rating. Pure given the seeded RNG.
 */
export function attributeGoals(args: {
  rng: SeededRNG;
  xiPlayers: Player[];
  goals: number;
}): GoalEvent[] {
  const { rng, xiPlayers, goals } = args;
  if (goals === 0 || xiPlayers.length === 0) return [];

  const scorerWeights = xiPlayers.map((p) => (SCORER_WEIGHTS[p.position] ?? 0) * Math.max(40, p.rating));
  const assistWeights = xiPlayers.map((p) => (ASSIST_WEIGHTS[p.position] ?? 0) * Math.max(40, p.rating));

  const events: GoalEvent[] = [];
  for (let g = 0; g < goals; g++) {
    const scorerIdx = weightedPick(rng, scorerWeights);
    if (scorerIdx < 0) break;
    const scorer = xiPlayers[scorerIdx]!;
    // ~70% of goals get an assist, attributed to a different XI player
    const wantAssist = rng() < 0.7;
    let assisterId: PlayerId | null = null;
    if (wantAssist) {
      const weightsNoSelf = assistWeights.map((w, i) => (i === scorerIdx ? 0 : w));
      const ai = weightedPick(rng, weightsNoSelf);
      if (ai >= 0) assisterId = xiPlayers[ai]!.id;
    }
    events.push({ scorerId: scorer.id, assisterId });
  }
  return events;
}

/**
 * Aggregated season stat line for a single player.
 */
export interface PlayerSeasonStats {
  playerId: PlayerId;
  goals: number;
  assists: number;
  cleanSheets: number;   // matches where the team kept a clean sheet AND this player started
  appearances: number;   // matches the team played (every starter gets credit each fixture for now)
}

/**
 * Compute every user-XI player's season tally from the fixture stream.
 * Pure given inputs + a seeded RNG that controls per-goal attribution.
 */
export function computeSeasonStats(args: {
  seed: number;
  xi: XI;
  squadById: Record<string, Player>;
  fixtures: { homeId: string; awayId: string; homeGoals: number; awayGoals: number }[];
  userClubId: string;
  rng: SeededRNG;
}): Record<PlayerId, PlayerSeasonStats> {
  const { xi, squadById, fixtures, userClubId, rng } = args;
  const xiPlayers: Player[] = Object.values(xi.assignments)
    .map((id) => squadById[id])
    .filter((p): p is Player => Boolean(p));

  const stats: Record<PlayerId, PlayerSeasonStats> = {};
  for (const p of xiPlayers) {
    stats[p.id] = { playerId: p.id, goals: 0, assists: 0, cleanSheets: 0, appearances: 0 };
  }

  for (const f of fixtures) {
    const isHome = f.homeId === userClubId;
    const isAway = f.awayId === userClubId;
    if (!isHome && !isAway) continue;
    const myGoals = isHome ? f.homeGoals : f.awayGoals;
    const oppGoals = isHome ? f.awayGoals : f.homeGoals;

    // Every starter "appears" — when we add injuries/rotation this becomes finer.
    for (const p of xiPlayers) {
      const s = stats[p.id]!;
      s.appearances += 1;
      if (oppGoals === 0) s.cleanSheets += 1;
    }

    if (myGoals > 0) {
      const events = attributeGoals({ rng, xiPlayers, goals: myGoals });
      for (const ev of events) {
        const sc = stats[ev.scorerId];
        if (sc) sc.goals += 1;
        if (ev.assisterId) {
          const a = stats[ev.assisterId];
          if (a) a.assists += 1;
        }
      }
    }
  }

  return stats;
}
