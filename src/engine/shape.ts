import type { PitchSlot, Position } from '@/types';

/**
 * Fluid formations — the player can drag any slot anywhere on the pitch.
 * Two pure functions make that meaningful:
 *
 *   deriveSlotPosition(x, y)  — what role a slot at these coordinates plays.
 *     Drag your striker back to the halfway line and he IS a midfielder now:
 *     chemistry re-scores players against the derived role.
 *
 *   conventionality(slots)    — how sane the layout is. Real shapes score
 *     ~1.0; a keeper-less 0-0-10 scores near 0 and pays up to a 15% strength
 *     penalty. Unconventional ≠ forbidden — just costly.
 *
 * Coordinates: x ∈ [0,100] left→right, y ∈ [0,100] where y≈92 is our goal
 * and y≈14 the opponent's box (matches src/data/formations.ts).
 */

/** Map pitch coordinates to the role a slot plays there. */
export function deriveSlotPosition(x: number, y: number): Position {
  const wideLeft = x < 26;
  const wideRight = x > 74;
  if (y >= 85) return 'GK';
  if (y >= 64) {
    if (wideLeft) return 'LB';
    if (wideRight) return 'RB';
    return 'CB';
  }
  if (y >= 52) {
    if (wideLeft) return 'LM';
    if (wideRight) return 'RM';
    return 'CDM';
  }
  if (y >= 38) {
    if (wideLeft) return 'LM';
    if (wideRight) return 'RM';
    return 'CM';
  }
  if (y >= 26) {
    if (wideLeft) return 'LW';
    if (wideRight) return 'RW';
    return 'CAM';
  }
  if (wideLeft) return 'LW';
  if (wideRight) return 'RW';
  return 'ST';
}

export interface ShapeVerdict {
  /** 0 (chaos) .. 1 (textbook). */
  score01: number;
  /** Multiplier on team attack + defense: 0.85 (chaos) .. 1.0 (sane). */
  multiplier: number;
  /** Short verdict copy for the UI. */
  verdict: string;
  /** Human-readable list of what's wrong. */
  issues: string[];
}

/**
 * Score how conventional a slot layout is. Pure heuristics:
 *   - exactly one keeper, in the keeper's zone, roughly central
 *   - at least three players in the defensive band
 *   - at least two in midfield
 *   - not everyone crammed forward / into one flank
 *   - no two slots stacked on top of each other
 */
export function conventionality(slots: PitchSlot[]): ShapeVerdict {
  const issues: string[] = [];
  let penalty = 0;

  const gks = slots.filter((s) => s.y >= 85);
  if (gks.length === 0) {
    penalty += 0.35;
    issues.push('No goalkeeper zone coverage');
  } else if (gks.length > 1) {
    penalty += 0.15 * (gks.length - 1);
    issues.push('Multiple players camped in the keeper zone');
  } else {
    const gk = gks[0]!;
    if (gk.x < 30 || gk.x > 70) {
      penalty += 0.10;
      issues.push('Keeper positioned off-centre');
    }
  }

  const outfield = slots.filter((s) => s.y < 85);
  const defenders = outfield.filter((s) => s.y >= 64);
  const midfielders = outfield.filter((s) => s.y >= 38 && s.y < 64);
  const forwards = outfield.filter((s) => s.y < 38);

  if (defenders.length < 3) {
    penalty += 0.10 * (3 - defenders.length);
    issues.push(`Only ${defenders.length} in the defensive line`);
  }
  if (midfielders.length < 2) {
    penalty += 0.08 * (2 - midfielders.length);
    issues.push('Midfield deserted');
  }
  if (forwards.length === 0) {
    penalty += 0.08;
    issues.push('No attacking outlet');
  }
  if (forwards.length > 5) {
    penalty += 0.06 * (forwards.length - 5);
    issues.push('Absurdly top-heavy');
  }

  if (outfield.length > 1) {
    const xs = outfield.map((s) => s.x);
    const spreadX = Math.max(...xs) - Math.min(...xs);
    if (spreadX < 40) {
      penalty += 0.10;
      issues.push('No width at all');
    }
    const meanX = xs.reduce((a, b) => a + b, 0) / xs.length;
    if (meanX < 35 || meanX > 65) {
      penalty += 0.12;
      issues.push('Everyone shoved onto one flank');
    }
  }

  // Stacked slots: two players in each other's pockets help nobody.
  let stacked = 0;
  for (let i = 0; i < slots.length; i++) {
    for (let j = i + 1; j < slots.length; j++) {
      const a = slots[i]!;
      const b = slots[j]!;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (d < 6) stacked++;
    }
  }
  if (stacked > 0) {
    penalty += Math.min(0.15, 0.03 * stacked);
    issues.push('Players standing on each other\'s toes');
  }

  const score01 = Math.max(0, Math.min(1, 1 - penalty));
  const multiplier = 0.85 + 0.15 * score01;
  const verdict =
    score01 >= 0.95 ? 'Balanced shape' :
    score01 >= 0.80 ? 'Slightly unorthodox' :
    score01 >= 0.60 ? 'Risky shape' :
    'Tactical chaos';

  return { score01, multiplier, verdict, issues };
}

/**
 * Re-label a custom slot layout with derived positions — this is what
 * chemistry scores against, so dragging a slot into a new band changes
 * which players fit it.
 */
export function withDerivedPositions(slots: PitchSlot[]): PitchSlot[] {
  return slots.map((s) => ({ ...s, position: deriveSlotPosition(s.x, s.y) }));
}
