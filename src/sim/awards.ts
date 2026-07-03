import type { Player, PlayerId, PositionGroup } from '@/types';
import type { PlayerSeasonStats } from './events';

export interface Awards {
  goldenBoot?: { playerId: PlayerId; goals: number };
  playmaker?:  { playerId: PlayerId; assists: number };
  goldenGlove?: { playerId: PlayerId; cleanSheets: number };
  playerOfSeason?: { playerId: PlayerId; score: number };
}

/**
 * Pure: same stats + same squad → same awards.
 *
 *   - Golden Boot: most goals (tie-break: assists, then rating)
 *   - Playmaker:   most assists (tie-break: goals, then rating)
 *   - Golden Glove: GK with most clean sheets (tie-break: rating)
 *   - Player of the Season: composite (goals + 0.7·assists + GK clean-sheets bonus)
 */
export function pickAwards(args: {
  stats: Record<PlayerId, PlayerSeasonStats>;
  squadById: Record<string, Player>;
}): Awards {
  const { stats, squadById } = args;
  const entries = Object.values(stats);
  if (entries.length === 0) return {};

  const rating = (id: PlayerId): number => squadById[id]?.rating ?? 0;
  const isGK = (id: PlayerId): boolean => squadById[id]?.position === 'GK';

  // Golden Boot
  const boot = entries.slice().sort((a, b) => {
    if (b.goals !== a.goals) return b.goals - a.goals;
    if (b.assists !== a.assists) return b.assists - a.assists;
    return rating(b.playerId) - rating(a.playerId);
  })[0];

  // Playmaker
  const maker = entries.slice().sort((a, b) => {
    if (b.assists !== a.assists) return b.assists - a.assists;
    if (b.goals !== a.goals) return b.goals - a.goals;
    return rating(b.playerId) - rating(a.playerId);
  })[0];

  // Golden Glove (GK only)
  const gks = entries.filter((e) => isGK(e.playerId));
  const glove = gks.slice().sort((a, b) => {
    if (b.cleanSheets !== a.cleanSheets) return b.cleanSheets - a.cleanSheets;
    return rating(b.playerId) - rating(a.playerId);
  })[0];

  // Player of the Season — composite score
  const scoreOf = (e: PlayerSeasonStats): number => {
    const base = e.goals + 0.7 * e.assists;
    const gkBoost = isGK(e.playerId) ? 0.4 * e.cleanSheets : 0;
    const ratingTie = rating(e.playerId) / 100;  // small tie-break
    return base + gkBoost + ratingTie;
  };
  const poty = entries.slice().sort((a, b) => scoreOf(b) - scoreOf(a))[0];

  return {
    ...(boot && boot.goals > 0 ? { goldenBoot: { playerId: boot.playerId, goals: boot.goals } } : {}),
    ...(maker && maker.assists > 0 ? { playmaker: { playerId: maker.playerId, assists: maker.assists } } : {}),
    ...(glove ? { goldenGlove: { playerId: glove.playerId, cleanSheets: glove.cleanSheets } } : {}),
    ...(poty ? { playerOfSeason: { playerId: poty.playerId, score: Math.round(scoreOf(poty) * 10) / 10 } } : {}),
  };
}

/* ─────────────────────────────────────── department balance ─── */

export type BalanceBand = 'World Class' | 'Strong' | 'Very Good' | 'Good' | 'Average' | 'Weak';

const BAND_THRESHOLDS: [number, BalanceBand][] = [
  [89, 'World Class'],
  [85, 'Strong'],
  [82, 'Very Good'],
  [78, 'Good'],
  [74, 'Average'],
  [0,  'Weak'],
];

export function bandFor(avgRating: number): BalanceBand {
  for (const [threshold, band] of BAND_THRESHOLDS) {
    if (avgRating >= threshold) return band;
  }
  return 'Weak';
}

export interface DepartmentBalance {
  attack:  { avg: number; band: BalanceBand };
  midfield:{ avg: number; band: BalanceBand };
  defense: { avg: number; band: BalanceBand };
  goalkeeper: { avg: number; band: BalanceBand };
  /** Highest − lowest department avg. Lower = more balanced. */
  spread: number;
  /** Short verdict copy. */
  verdict: string;
}

const GROUP_OF = (pos: Player['position']): PositionGroup => {
  if (pos === 'GK') return 'GK';
  if (pos === 'CB' || pos === 'LB' || pos === 'RB') return 'DEF';
  if (pos === 'LW' || pos === 'RW' || pos === 'ST') return 'FWD';
  return 'MID';
};

export function departmentBalance(xiPlayers: Player[]): DepartmentBalance {
  const buckets: Record<PositionGroup, number[]> = { GK: [], DEF: [], MID: [], FWD: [] };
  for (const p of xiPlayers) {
    buckets[GROUP_OF(p.position)].push(p.rating);
  }
  const avg = (xs: number[]): number => (xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length);

  const attackAvg = avg(buckets.FWD);
  const midAvg = avg(buckets.MID);
  const defAvg = avg(buckets.DEF);
  const gkAvg = avg(buckets.GK);

  const values = [attackAvg, midAvg, defAvg, gkAvg].filter((v) => v > 0);
  const spread = values.length === 0 ? 0 : Math.max(...values) - Math.min(...values);

  let verdict = 'An evenly balanced side across the pitch.';
  if (spread > 12) verdict = 'Lopsided shape — one area carrying the others.';
  else if (spread > 7) verdict = 'A noticeable mismatch between departments.';
  else if (spread > 4) verdict = 'A small dip in one area otherwise solid.';

  return {
    attack:    { avg: round1(attackAvg), band: bandFor(attackAvg) },
    midfield:  { avg: round1(midAvg),    band: bandFor(midAvg) },
    defense:   { avg: round1(defAvg),    band: bandFor(defAvg) },
    goalkeeper:{ avg: round1(gkAvg),     band: bandFor(gkAvg) },
    spread: round1(spread),
    verdict,
  };
}

/* ─────────────────────────────────────── projected position + verdict ─── */

/**
 * Predict where a team SHOULD finish based on raw pre-season strength,
 * before the dice rolled. Higher attack+defense+chem+manager = better
 * predicted rank.
 *
 * Used to derive the "Party Crashers" / "Disappointment" narrative.
 */
export function projectedPosition(args: {
  userClubId: string;
  strengths: { clubId: string; attack: number; defense: number; chemistry01?: number; mor?: number }[];
}): number {
  const score = (t: { attack: number; defense: number; chemistry01?: number; mor?: number }): number => {
    const chem = t.chemistry01 ?? 0.6;
    const mor = t.mor ?? 50;
    return (t.attack + t.defense) * (0.7 + 0.3 * chem) + 0.05 * mor;
  };
  const sorted = args.strengths.slice().sort((a, b) => score(b) - score(a));
  const idx = sorted.findIndex((t) => t.clubId === args.userClubId);
  return idx >= 0 ? idx + 1 : sorted.length;
}

export type FinishVerdict =
  | { tone: 'crashers';   label: 'Party Crashers';   blurb: string }
  | { tone: 'overachiever'; label: 'Overachievers';  blurb: string }
  | { tone: 'expected';   label: 'As Expected';      blurb: string }
  | { tone: 'underperform'; label: 'Underperformed'; blurb: string }
  | { tone: 'disaster';   label: 'Disaster';         blurb: string };

export function finishVerdict(projected: number, finished: number): FinishVerdict {
  const delta = projected - finished;  // positive = finished better
  if (delta >= 6) return { tone: 'crashers', label: 'Party Crashers', blurb: `Projected ${projected}th, finished ${finished}st.` };
  if (delta >= 3) return { tone: 'overachiever', label: 'Overachievers', blurb: `Beat their preseason call by ${delta} places.` };
  if (delta >= -1) return { tone: 'expected', label: 'As Expected', blurb: `Right around the preseason call.` };
  if (delta >= -5) return { tone: 'underperform', label: 'Underperformed', blurb: `Finished ${-delta} places below preseason rank.` };
  return { tone: 'disaster', label: 'Disaster', blurb: `Projected ${projected}th but finished ${finished}th.` };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
