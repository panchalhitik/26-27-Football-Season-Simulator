import type { ClubId, FixtureResult, Player, XI } from '@/types';

/**
 * Walk the fixture stream in matchday order, applying results to a running
 * table, and record the user club's league position after every matchday.
 * Pure: same fixtures → same trace.
 */
export function computePositionProgression(args: {
  fixtures: FixtureResult[];
  userClubId: ClubId;
  allClubIds: ClubId[];
}): { matchday: number; position: number; points: number }[] {
  const { fixtures, userClubId, allClubIds } = args;

  const table = new Map<string, { points: number; gd: number; gf: number }>();
  for (const id of allClubIds) table.set(id, { points: 0, gd: 0, gf: 0 });

  // Group fixtures by matchday so we update the table per gameweek
  const byMatchday = new Map<number, FixtureResult[]>();
  for (const f of fixtures) {
    const list = byMatchday.get(f.matchday) ?? [];
    list.push(f);
    byMatchday.set(f.matchday, list);
  }
  const matchdays = [...byMatchday.keys()].sort((a, b) => a - b);

  const trace: { matchday: number; position: number; points: number }[] = [];
  for (const md of matchdays) {
    const games = byMatchday.get(md) ?? [];
    for (const f of games) {
      const home = table.get(f.homeId) ?? { points: 0, gd: 0, gf: 0 };
      const away = table.get(f.awayId) ?? { points: 0, gd: 0, gf: 0 };
      home.gf += f.homeGoals;
      away.gf += f.awayGoals;
      home.gd += f.homeGoals - f.awayGoals;
      away.gd += f.awayGoals - f.homeGoals;
      if (f.homeGoals > f.awayGoals) home.points += 3;
      else if (f.homeGoals < f.awayGoals) away.points += 3;
      else { home.points += 1; away.points += 1; }
      table.set(f.homeId, home);
      table.set(f.awayId, away);
    }

    const sorted = [...table.entries()].sort(([, a], [, b]) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.gd !== a.gd) return b.gd - a.gd;
      return b.gf - a.gf;
    });
    const position = sorted.findIndex(([id]) => id === userClubId) + 1;
    const user = table.get(userClubId) ?? { points: 0, gd: 0, gf: 0 };
    trace.push({ matchday: md, position: position || sorted.length, points: user.points });
  }

  return trace;
}

/**
 * Pick the "top scorer" for the season from the XI. We don't track individual
 * goals in the sim, so this is the highest-rated attacker — a sensible proxy.
 * Returns the player + an apportioned share of the team's total goals.
 */
export function pickTopScorer(args: {
  xi: XI;
  squadById: Record<string, Player>;
  totalGoalsFor: number;
}): { player: Player; goals: number } | null {
  const players = Object.values(args.xi.assignments)
    .map((id) => args.squadById[id])
    .filter((p): p is Player => Boolean(p));

  // Strikers and wingers first
  const attackers = players.filter(
    (p) => p.group === 'FWD' || p.position === 'CAM',
  );
  if (attackers.length === 0) return null;

  const top = attackers.slice().sort((a, b) => b.rating - a.rating)[0];
  if (!top) return null;

  // Apportion ~30–40% of team goals to the top scorer, scaled by rating gap
  const totalAttackRating = attackers.reduce((s, p) => s + p.rating, 0);
  const share = top.rating / totalAttackRating;
  // Strikers get an extra ~25% boost
  const stShare = top.position === 'ST' ? share * 1.25 : share;
  const goals = Math.round(args.totalGoalsFor * Math.min(0.45, Math.max(0.18, stShare * 0.9)));

  return { player: top, goals };
}

/**
 * "Player of the season" — highest-rated XI player overall. GKs are
 * downweighted slightly so an outfielder typically wins.
 */
export function pickPlayerOfSeason(args: {
  xi: XI;
  squadById: Record<string, Player>;
}): Player | null {
  const players = Object.values(args.xi.assignments)
    .map((id) => args.squadById[id])
    .filter((p): p is Player => Boolean(p));
  if (players.length === 0) return null;

  const scored = players
    .map((p) => ({ p, score: p.rating + (p.position === 'GK' ? -3 : 0) + (p.isStar ? 2 : 0) }))
    .sort((a, b) => b.score - a.score);
  return scored[0]?.p ?? null;
}
