import type {
  Club,
  FinalReport,
  FixtureResult,
  ManagerVerdict,
  MidSeasonReport,
  ObjectiveOutcome,
  SaleRecord,
  SeasonRunResult,
  TeamStrength,
  TransferRecord,
} from '@/types';
import { mulberry32 } from '@/engine/rng';
import { CUP_ROUND_RANK, simulateUserCupRun, type CupKind } from './cups';

const H1_MONTHS = new Set(['AUG', 'SEP', 'OCT', 'NOV', 'DEC']);

/**
 * Compute the mid-season report from the headline fixture list.
 * Pure: same fixtures + user club -> same report.
 */
export function midSeasonReport(input: {
  fixtures: FixtureResult[];
  userClubId: string;
  finalTableAtH1: { clubId: string; points: number }[];
}): MidSeasonReport {
  const userFixtures = input.fixtures.filter(
    (f) => H1_MONTHS.has(f.month) && (f.homeId === input.userClubId || f.awayId === input.userClubId),
  );

  let gf = 0;
  let ga = 0;
  let cleanSheets = 0;
  let wins = 0;
  let draws = 0;
  let losses = 0;
  for (const f of userFixtures) {
    const isHome = f.homeId === input.userClubId;
    const myGoals = isHome ? f.homeGoals : f.awayGoals;
    const oppGoals = isHome ? f.awayGoals : f.homeGoals;
    gf += myGoals;
    ga += oppGoals;
    if (oppGoals === 0) cleanSheets += 1;
    if (myGoals > oppGoals) wins += 1;
    else if (myGoals === oppGoals) draws += 1;
    else losses += 1;
  }
  const pointsSoFar = wins * 3 + draws;
  const matchesPlayed = userFixtures.length;

  const sorted = input.finalTableAtH1.slice().sort((a, b) => b.points - a.points);
  const leaguePosition = sorted.findIndex((r) => r.clubId === input.userClubId) + 1 || sorted.length;

  const ppg = matchesPlayed > 0 ? pointsSoFar / matchesPlayed : 0;
  const form: MidSeasonReport['form'] =
    ppg >= 2.3 ? 'ON FIRE' :
    ppg >= 1.9 ? 'STRONG' :
    ppg >= 1.4 ? 'PATCHY' :
    ppg >= 0.9 ? 'POOR' :
    'COLLAPSING';

  const boardVerdict: MidSeasonReport['boardVerdict'] =
    leaguePosition === 1 ? 'DELIGHTED' :
    leaguePosition <= 3 ? 'PLEASED' :
    leaguePosition <= 5 ? 'NEUTRAL' :
    leaguePosition <= 8 ? 'CONCERNS GROWING' :
    'AT RISK';

  return {
    matchesPlayed,
    leaguePosition,
    pointsSoFar,
    goalsFor: gf,
    goalsAgainst: ga,
    cleanSheets,
    form,
    boardVerdict,
    cupStatuses: [
      { competition: 'FA Cup', status: 'R3' },
      { competition: 'EFL Cup', status: 'QF' },
      { competition: 'UCL', status: 'Group stage' },
    ],
  };
}

const PL_OBJECTIVE_OUTCOME = (o: { targetPosition: number }, finalPosition: number): ObjectiveOutcome => {
  if (finalPosition < o.targetPosition) return 'exceeded';
  if (finalPosition === o.targetPosition) return 'met';
  return 'missed';
};

const CUP_KIND_OF: Record<string, CupKind | null> = {
  'FA Cup': 'FA Cup',
  EFL: 'EFL',
  UCL: 'UCL',
};

function evaluateCupOutcome(target: string, reached: string): ObjectiveOutcome {
  const got = CUP_ROUND_RANK[reached] ?? 0;
  const need = CUP_ROUND_RANK[target] ?? 0;
  if (got > need) return 'exceeded';
  if (got === need) return 'met';
  return 'missed';
}

/**
 * Compute the final report from the full-season result + window activity.
 * Pure given inputs.
 */
export function finalReport(input: {
  club: Club;
  season: SeasonRunResult;
  signings: TransferRecord[];
  sales: SaleRecord[];
  finalFormation: string;
  /** Strengths used in the season sim — needed to run cup knockouts. */
  strengths: TeamStrength[];
  /** Seed used for cup RNG (offset internally per cup so each is independent). */
  seed: number;
}): FinalReport {
  const { season, club, strengths, seed } = input;

  // Build the opponent strength pool for cups.
  const userS = strengths.find((s) => s.clubId === club.id);
  const userStrength = userS ? userS.attack + userS.defense : 150;
  const allOpponents = strengths.filter((s) => s.clubId !== club.id);
  const domesticPool = allOpponents.map((s) => s.attack + s.defense);
  // UCL — only the top 8 strongest teams from this league represent the elite pool.
  const eliteCutoff = [...domesticPool].sort((a, b) => b - a).slice(0, 8);

  const outcomes = club.objectives.map((o) => {
    if (o.kind === 'PL') {
      return { objective: o, outcome: PL_OBJECTIVE_OUTCOME(o, season.userPosition) };
    }
    const cup = CUP_KIND_OF[o.kind];
    if (!cup) {
      return { objective: o, outcome: 'missed' as ObjectiveOutcome };
    }
    // Each cup gets its own deterministic RNG stream derived from seed + cup name.
    const cupSeed = (seed ^ hashString(o.kind)) >>> 0;
    const pool = cup === 'UCL' ? eliteCutoff : domesticPool;
    const run = simulateUserCupRun({
      rng: mulberry32(cupSeed),
      cup,
      userStrength,
      opponentStrengths: pool,
    });
    return {
      objective: o,
      outcome: evaluateCupOutcome(o.targetRound, run.reached),
      reachedRound: run.reached,
    };
  });

  const metCount = outcomes.filter((o) => o.outcome === 'met' || o.outcome === 'exceeded').length;
  const total = Math.max(1, outcomes.length);
  const ratio = metCount / total;
  const grade: FinalReport['grade'] =
    ratio === 1 && season.userPosition === 1 ? 'S' :
    ratio === 1 ? 'A' :
    ratio >= 0.75 ? 'B' :
    ratio >= 0.5 ? 'C' :
    ratio > 0 ? 'D' : 'F';

  const ownerVerdict: ManagerVerdict =
    grade === 'S' || grade === 'A' ? 'EXTENDED' :
    grade === 'B' ? 'KEPT ON' :
    grade === 'C' ? 'KEPT ON' :
    'SACKED';

  const signingsSpend = input.signings.reduce((s, r) => s + r.feeM, 0);
  const outgoingRaised = input.sales.reduce((s, r) => s + r.receivedM, 0);

  const quote =
    grade === 'S' ? '"Make-it-yours season. Unforgettable."' :
    grade === 'A' ? '"Brilliant year. Trophy or close to one."' :
    grade === 'B' ? '"No celebrations, but trust intact."' :
    grade === 'C' ? '"Could be better. Could be worse."' :
    grade === 'D' ? '"Position under review. Plan needed."' :
    '"This isn\'t working. You know what\'s next."';

  return {
    grade,
    ownerVerdict,
    quote,
    signingsCount: input.signings.length,
    signingsSpendM: round1(signingsSpend),
    outgoingCount: input.sales.length,
    outgoingRaisedM: round1(outgoingRaised),
    netSpendM: round1(signingsSpend - outgoingRaised),
    finalFormation: input.finalFormation,
    finalPosition: season.userPosition,
    finalPoints: season.userPoints,
    objectiveOutcomes: outcomes,
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Tiny deterministic string → uint32 hash for per-cup seed offsets. */
function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}
