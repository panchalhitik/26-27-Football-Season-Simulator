import type { Formation, Player, Position, PositionGroup, XI } from '@/types';

const GROUP_OF: Record<Position, PositionGroup> = {
  GK: 'GK',
  CB: 'DEF', LB: 'DEF', RB: 'DEF',
  CDM: 'MID', CM: 'MID', CAM: 'MID', LM: 'MID', RM: 'MID',
  LW: 'FWD', RW: 'FWD', ST: 'FWD',
};

/**
 * Graded position-affinity score in [0, 1] for "player whose natural position
 * is `actual` slotted at a position-`slot` role". Drives chemistry.
 *
 *   exact match            → 1.00  (full chem)
 *   same group             → 0.60  (CAM ↔ CM, CB ↔ LB — "slightly off")
 *   adjacent group         → 0.15  (CDM ↔ CB — a stretch, but workable)
 *   far apart              → 0.00  (ST ↔ CB — "cut all chem points")
 *   GK is unique           → 0.00  against anything other than GK
 */
export function positionAffinity(slot: Position, actual: Position): number {
  if (slot === actual) return 1;
  const slotGroup = GROUP_OF[slot];
  const actualGroup = GROUP_OF[actual];
  if (slotGroup === 'GK' || actualGroup === 'GK') return 0;
  if (slotGroup === actualGroup) return 0.6;
  // Adjacent only if their groups touch on the pitch
  if (
    (slotGroup === 'DEF' && actualGroup === 'MID') ||
    (slotGroup === 'MID' && actualGroup === 'DEF') ||
    (slotGroup === 'MID' && actualGroup === 'FWD') ||
    (slotGroup === 'FWD' && actualGroup === 'MID')
  ) return 0.15;
  return 0;
}

/**
 * Compute 0–100 chemistry score for an XI against a formation.
 * Empty slots count as zero affinity — an incomplete XI hurts chem.
 */
export function chemistryFor(args: {
  squadById: Record<string, Player>;
  xi: XI;
  formation: Formation;
}): { chemistry: number; exactMatches: number; perSlot: number[] } {
  const { squadById, xi, formation } = args;
  const perSlot: number[] = [];
  let exactMatches = 0;
  let total = 0;

  for (let i = 0; i < formation.slots.length; i++) {
    const slot = formation.slots[i];
    if (!slot) {
      perSlot.push(0);
      continue;
    }
    const pid = xi.assignments[i];
    const player = pid ? squadById[pid] : undefined;
    if (!player) {
      perSlot.push(0);
      continue;
    }
    const affinity = positionAffinity(slot.position, player.position);
    if (affinity === 1) exactMatches += 1;
    perSlot.push(affinity);
    total += affinity;
  }

  const chemistry = Math.round((total / formation.slots.length) * 100);
  return { chemistry, exactMatches, perSlot };
}

/**
 * Greedy auto-pick: for each slot, pick the highest-rated player whose
 * position affinity to the slot is the best available among unused squad
 * members.
 */
export function autoPickXI(squad: Player[], formation: Formation): XI {
  const used = new Set<string>();
  const assignments: Record<number, string> = {};
  const squadById: Record<string, Player> = Object.fromEntries(
    squad.map((p) => [p.id, p]),
  );

  formation.slots.forEach((slot, idx) => {
    const remaining = squad.filter((p) => !used.has(p.id));
    if (remaining.length === 0) return;

    // Score = affinity × 100 + rating. Affinity dominates; rating breaks ties.
    let best: Player | undefined;
    let bestScore = -Infinity;
    for (const p of remaining) {
      const score = positionAffinity(slot.position, p.position) * 100 + p.rating;
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    if (best) {
      assignments[idx] = best.id;
      used.add(best.id);
    }
  });

  const partialXi: XI = {
    shape: formation.shape,
    assignments,
    chemistry: 0,
    exactMatches: 0,
  };
  const { chemistry, exactMatches } = chemistryFor({ squadById, xi: partialXi, formation });
  return { ...partialXi, chemistry, exactMatches };
}

/**
 * Repair an XI after injuries (or sales): keep every available assigned
 * starter where the user put him, and fill vacant / unavailable slots with
 * the best-fitting remaining squad player. Pure.
 */
export function fillVacantSlots(args: {
  squad: Player[];
  formation: Formation;
  xi: XI;
  /** PlayerIds that cannot play (injured, sold). */
  unavailable: Set<string>;
}): XI {
  const { squad, formation, xi, unavailable } = args;
  const squadById: Record<string, Player> = Object.fromEntries(squad.map((p) => [p.id, p]));

  const assignments: Record<number, string> = {};
  const used = new Set<string>();
  formation.slots.forEach((_, idx) => {
    const pid = xi.assignments[idx];
    if (pid && !unavailable.has(pid) && squadById[pid] && !used.has(pid)) {
      assignments[idx] = pid;
      used.add(pid);
    }
  });

  formation.slots.forEach((slot, idx) => {
    if (assignments[idx]) return;
    let best: Player | undefined;
    let bestScore = -Infinity;
    for (const p of squad) {
      if (used.has(p.id) || unavailable.has(p.id)) continue;
      const score = positionAffinity(slot.position, p.position) * 100 + p.rating;
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    if (best) {
      assignments[idx] = best.id;
      used.add(best.id);
    }
  });

  const partial: XI = {
    ...xi,
    shape: formation.shape,
    assignments,
  };
  const { chemistry, exactMatches } = chemistryFor({ squadById, xi: partial, formation });
  return { ...partial, chemistry, exactMatches };
}

/** Weighted contribution of each position group to ATTACK and DEFENSE ratings. */
const ATTACK_WEIGHTS: Record<PositionGroup, number> = { GK: 0.05, DEF: 0.20, MID: 0.35, FWD: 0.40 };
const DEFENSE_WEIGHTS: Record<PositionGroup, number> = { GK: 0.30, DEF: 0.40, MID: 0.25, FWD: 0.05 };

/**
 * Bench size used for the depth bonus calculation. Seven is "a typical
 * matchday bench" — enough to cover injuries + tactical changes but doesn't
 * reward bloated squads disproportionately.
 */
const BENCH_SIZE = 7;
/** Depth bonus is (avg(top-7 non-XI ratings) − 70) × this weight. */
const DEPTH_BONUS_WEIGHT = 0.05;

/**
 * Compute team attack/defense strengths from the XI + manager + squad depth.
 * Pure: same inputs → same strengths.
 *
 * Differences from the old model:
 *  - Every position group contributes to BOTH attack and defense via weighted
 *    averages, so a great CM helps you score AND defend.
 *  - GK is weighted heavier on defense than the DEF group (a world-class
 *    keeper now matters more than another centre-back).
 *  - Chemistry is NO LONGER baked into the rating. The caller (engine /
 *    match sim) applies it as a separate multiplier so it isn't double-counted.
 *  - Squad depth adds a small (±2 pts max) bump to both ends — rewards a deep
 *    bench, punishes a thin one.
 */
export function teamStrengthFromXI(input: {
  squadById: Record<string, Player>;
  xi: XI;
  baseAttack: number;
  baseDefense: number;
  managerAttackMod: number;
  managerDefenseMod: number;
  /** Optional full squad list — when supplied, the top-7 non-XI players add a depth bonus. */
  squad?: Player[];
  /**
   * Optional shape-conventionality multiplier from engine/shape.ts —
   * 0.85 (tactical chaos) .. 1.0 (textbook). Applied to both ends.
   */
  shapeMultiplier?: number;
}): { attack: number; defense: number } {
  const playersInXI = Object.values(input.xi.assignments)
    .map((id) => input.squadById[id])
    .filter((p): p is Player => Boolean(p));

  if (playersInXI.length === 0) {
    return {
      attack: clamp(input.baseAttack + input.managerAttackMod, 30, 99),
      defense: clamp(input.baseDefense + input.managerDefenseMod, 30, 99),
    };
  }

  // Group XI by family
  const byGroup: Record<PositionGroup, Player[]> = { GK: [], DEF: [], MID: [], FWD: [] };
  for (const p of playersInXI) byGroup[p.group].push(p);
  const groupAvg = (g: PositionGroup): number => {
    const xs = byGroup[g];
    if (xs.length === 0) {
      // Fall back to base club rating when no player covers a group
      return g === 'GK' ? input.baseDefense : g === 'FWD' ? input.baseAttack : (input.baseAttack + input.baseDefense) / 2;
    }
    return xs.reduce((s, p) => s + p.rating, 0) / xs.length;
  };

  const gk  = groupAvg('GK');
  const def = groupAvg('DEF');
  const mid = groupAvg('MID');
  const fwd = groupAvg('FWD');

  const attackRating =
    ATTACK_WEIGHTS.GK  * gk  +
    ATTACK_WEIGHTS.DEF * def +
    ATTACK_WEIGHTS.MID * mid +
    ATTACK_WEIGHTS.FWD * fwd;
  const defenseRating =
    DEFENSE_WEIGHTS.GK  * gk  +
    DEFENSE_WEIGHTS.DEF * def +
    DEFENSE_WEIGHTS.MID * mid +
    DEFENSE_WEIGHTS.FWD * fwd;

  // Squad depth bonus from the next-best 7 players
  let depthBonus = 0;
  if (input.squad && input.squad.length > 0) {
    const xiIds = new Set(playersInXI.map((p) => p.id));
    const bench = input.squad
      .filter((p) => !xiIds.has(p.id))
      .slice()
      .sort((a, b) => b.rating - a.rating)
      .slice(0, BENCH_SIZE);
    if (bench.length > 0) {
      const benchAvg = bench.reduce((s, p) => s + p.rating, 0) / bench.length;
      depthBonus = (benchAvg - 70) * DEPTH_BONUS_WEIGHT;
    }
  }

  const shapeMult = input.shapeMultiplier ?? 1;
  return {
    attack: clamp((attackRating + input.managerAttackMod + depthBonus) * shapeMult, 30, 99),
    defense: clamp((defenseRating + input.managerDefenseMod + depthBonus) * shapeMult, 30, 99),
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
