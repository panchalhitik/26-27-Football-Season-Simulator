import { useMemo } from 'react';
import { AppShell, SectionLabel } from '@/components/AppShell';
import { PositionBadge } from '@/components/PositionBadge';
import {
  CLUBS_BY_ID,
  FORMATIONS_BY_SHAPE,
  MANAGERS_BY_ID,
  PLAYERS_BY_ID,
} from '@/data';
import {
  computePositionProgression,
  computeSeasonStats,
  departmentBalance,
  finishVerdict,
  pickAwards,
  pickPlayerOfSeason,
  pickTopScorer,
  projectedPosition,
} from '@/sim';
import { mulberry32 } from '@/engine/rng';
import { useGameStore } from '@/store';
import type { BoardObjective, ObjectiveOutcome, Player } from '@/types';

const GRADE_THEME: Record<string, { ring: string; text: string; glow: string; quote: string }> = {
  S: { ring: 'border-fuchsia-300', text: 'text-fuchsia-200', glow: 'rgba(232, 121, 249, 0.55)', quote: 'A make-it-yours season. Unforgettable.' },
  A: { ring: 'border-emerald-300', text: 'text-emerald-200', glow: 'rgba(110, 231, 183, 0.55)', quote: 'Brilliant year. Silverware to show for it.' },
  B: { ring: 'border-emerald-400', text: 'text-emerald-100', glow: 'rgba(74, 222, 128, 0.40)', quote: 'No celebrations, but trust intact.' },
  C: { ring: 'border-amber-300',   text: 'text-amber-200',   glow: 'rgba(252, 211, 77, 0.40)', quote: 'Could be better. Could be worse.' },
  D: { ring: 'border-orange-300',  text: 'text-orange-200',  glow: 'rgba(253, 186, 116, 0.40)', quote: 'Position under review. Plan needed.' },
  F: { ring: 'border-rose-300',    text: 'text-rose-200',    glow: 'rgba(252, 165, 165, 0.55)', quote: "This isn't working. You know what's next." },
};

const VERDICT_COLOR: Record<string, string> = {
  EXTENDED: 'text-cyan-300',
  'KEPT ON': 'text-cyan-300',
  SACKED: 'text-rose-300',
  WALKED: 'text-amber-300',
};

export function FinalReportScreen() {
  const clubId = useGameStore((s) => s.clubId);
  const managerId = useGameStore((s) => s.managerId);
  const report = useGameStore((s) => s.finalReport);
  const sportingDir = useGameStore((s) => s.sportingDirectorName);
  const signings = useGameStore((s) => s.signings);
  const sales = useGameStore((s) => s.sales);
  const seasonRun = useGameStore((s) => s.seasonRun);
  const xi = useGameStore((s) => s.xi);
  const squadIds = useGameStore((s) => s.squadIds);
  const formationShape = useGameStore((s) => s.formationShape);
  const seed = useGameStore((s) => s.seed);
  const strengths = useGameStore((s) => s.lastSeasonStrengths);
  const reset = useGameStore((s) => s.reset);

  const squadById = useMemo(() => {
    const map: Record<string, Player> = {};
    for (const id of squadIds) {
      const p = PLAYERS_BY_ID[id];
      if (p) map[id] = p;
    }
    return map;
  }, [squadIds]);

  const progression = useMemo(() => {
    if (!seasonRun || !clubId) return [];
    return computePositionProgression({
      fixtures: seasonRun.fixtures,
      userClubId: clubId,
      allClubIds: seasonRun.finalTable.map((r) => r.clubId),
    });
  }, [seasonRun, clubId]);

  const topScorer = useMemo(() => {
    if (!xi || !seasonRun) return null;
    return pickTopScorer({ xi, squadById, totalGoalsFor: seasonRun.userGoalsFor });
  }, [xi, squadById, seasonRun]);

  const mvp = useMemo(() => {
    if (!xi) return null;
    return pickPlayerOfSeason({ xi, squadById });
  }, [xi, squadById]);

  // ─── per-player season stats (G/A/CS) ─────────────────────
  const seasonStats = useMemo(() => {
    if (!xi || !seasonRun || !clubId) return {};
    return computeSeasonStats({
      seed,
      xi,
      squadById,
      fixtures: seasonRun.fixtures,
      userClubId: clubId,
      rng: mulberry32(seed ^ 0xa1b2c3),
    });
  }, [xi, seasonRun, clubId, squadById, seed]);

  // ─── XI in starting order (used for stats table + balance) ─
  const xiPlayers = useMemo<Player[]>(() => {
    if (!xi) return [];
    return Object.values(xi.assignments)
      .map((id) => squadById[id])
      .filter((p): p is Player => Boolean(p));
  }, [xi, squadById]);

  const awards = useMemo(() => {
    if (Object.keys(seasonStats).length === 0) return null;
    return pickAwards({ stats: seasonStats, squadById });
  }, [seasonStats, squadById]);

  const balance = useMemo(() => {
    if (xiPlayers.length === 0) return null;
    return departmentBalance(xiPlayers);
  }, [xiPlayers]);

  const projected = useMemo(() => {
    if (!clubId || strengths.length === 0) return null;
    return projectedPosition({ userClubId: clubId, strengths });
  }, [clubId, strengths]);

  const verdict = useMemo(() => {
    if (projected == null || !seasonRun) return null;
    return finishVerdict(projected, seasonRun.userPosition);
  }, [projected, seasonRun]);

  if (!clubId || !managerId || !report || !seasonRun) return null;
  const club = CLUBS_BY_ID[clubId];
  const manager = managerId ? MANAGERS_BY_ID[managerId] : null;
  if (!club || !manager) return null;

  const theme = GRADE_THEME[report.grade] ?? GRADE_THEME.B!;
  const formation = FORMATIONS_BY_SHAPE[formationShape];
  const totalGames = seasonRun.finalTable[0]?.played ?? 38;
  const ppg = totalGames > 0 ? (seasonRun.userPoints / totalGames).toFixed(2) : '0.00';
  const goalDiff = seasonRun.userGoalsFor - seasonRun.userGoalsAgainst;

  return (
    <AppShell>
      <SectionLabel>Season 2026-27 · Final Report</SectionLabel>
      <p className="text-mono text-white/55 text-xs text-center mt-3">Sporting Director · {sportingDir || '—'}</p>
      <h1
        className="text-display text-5xl md:text-7xl uppercase mt-3 text-center text-rose-500"
        style={{ textShadow: '0 0 40px rgba(255, 64, 96, 0.45)' }}
      >
        {club.name}
      </h1>

      {/* HERO MEDALLION */}
      <div className="flex flex-col items-center mt-14">
        <div className="relative">
          {/* glow */}
          <div
            aria-hidden
            className="absolute inset-0 rounded-full blur-3xl opacity-70"
            style={{ background: theme.glow, transform: 'scale(1.4)' }}
          />
          <div
            className={`relative w-56 h-56 md:w-72 md:h-72 rounded-full border-4 ${theme.ring} flex items-center justify-center`}
            style={{
              background:
                'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.18), rgba(0,0,0,0.55) 70%)',
              boxShadow: `0 0 80px ${theme.glow}, inset 0 0 40px rgba(0,0,0,0.4)`,
            }}
          >
            <div
              aria-hidden
              className="absolute inset-3 rounded-full border border-white/15"
            />
            <div className="text-center">
              <div className="text-mono uppercase text-[10px] tracking-[0.3em] text-white/55">Final Grade</div>
              <div
                className={`text-display text-[8rem] md:text-[11rem] leading-none ${theme.text} mt-1`}
                style={{ textShadow: `0 0 28px ${theme.glow}` }}
              >
                {report.grade}
              </div>
            </div>
          </div>
        </div>

        <p className="text-display uppercase tracking-[0.25em] text-white/80 mt-8 text-center text-sm md:text-base">
          {theme.quote}
        </p>

        <div className="flex flex-wrap items-center justify-center gap-8 mt-6">
          <Mini label="Manager"        value={manager.name} />
          <Mini label="Owner's verdict" value={report.ownerVerdict} {...(VERDICT_COLOR[report.ownerVerdict] ? { valueClass: VERDICT_COLOR[report.ownerVerdict] } : {})} />
          <Mini label="Finished"        value={ordinal(seasonRun.userPosition)} />
          <Mini label="Points"          value={`${seasonRun.userPoints} · ${ppg} ppg`} />
        </div>
      </div>

      {/* TROPHY CABINET */}
      <TrophyCabinet
        objectives={report.objectiveOutcomes}
        finalPosition={seasonRun.userPosition}
        leagueLabel={club.league}
      />

      {/* SEASON NARRATIVE */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-10">
        {/* Position chart spans 2 cols */}
        <div className="lg:col-span-2 card">
          <div className="text-mono uppercase text-[10px] tracking-widest text-white/40 mb-3">Position by Matchday</div>
          <PositionChart trace={progression} userClubId={clubId} />
        </div>

        {/* Goals for / against */}
        <div className="card">
          <div className="text-mono uppercase text-[10px] tracking-widest text-white/40 mb-3">Goals For / Against</div>
          <div className="space-y-3">
            <Bar label="Scored"    value={seasonRun.userGoalsFor} max={Math.max(seasonRun.userGoalsFor, seasonRun.userGoalsAgainst)} color="bg-emerald-400" />
            <Bar label="Conceded"  value={seasonRun.userGoalsAgainst} max={Math.max(seasonRun.userGoalsFor, seasonRun.userGoalsAgainst)} color="bg-rose-400" />
          </div>
          <div className="text-mono text-[11px] mt-4 flex items-center justify-between">
            <span className="text-white/40">Goal Difference</span>
            <span className={goalDiff >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
              {goalDiff >= 0 ? '+' : ''}{goalDiff}
            </span>
          </div>
          <div className="text-mono text-[11px] mt-2 flex items-center justify-between">
            <span className="text-white/40">Clean Sheets</span>
            <span className="text-cyan-300">{seasonRun.userCleanSheets}</span>
          </div>
        </div>

        {/* Top scorer + MVP cards (each takes a col) */}
        {topScorer ? (
          <PlayerSpotlight
            title="Top Scorer"
            player={topScorer.player}
            footer={`${topScorer.goals} goals`}
            accent="text-pink-300"
          />
        ) : null}
        {mvp ? (
          <PlayerSpotlight
            title="Player of the Season"
            player={mvp}
            footer={mvp.isStar ? '★ STAR · led from the front' : 'consistency made the difference'}
            accent="text-cyan-300"
          />
        ) : null}

        {/* Formation pitch */}
        <div className="card">
          <div className="text-mono uppercase text-[10px] tracking-widest text-white/40 mb-3">
            Final Formation · <span className="text-white/80">{formationShape}</span>
          </div>
          <MiniPitch
            slots={formation.slots}
            assignments={xi?.assignments ?? {}}
            squadById={squadById}
          />
        </div>
      </div>

      {/* FINISHED vs PROJECTED — hero verdict */}
      {projected != null && verdict ? (
        <FinishVerdictHero
          projected={projected}
          finished={seasonRun.userPosition}
          verdict={verdict}
        />
      ) : null}

      {/* DEPARTMENT BALANCE — qualitative grades per group */}
      {balance ? <DepartmentBalanceCard balance={balance} /> : null}

      {/* AWARDS — Golden Boot, Playmaker, Glove, POTY */}
      {awards ? <AwardsRow awards={awards} squadById={squadById} /> : null}

      {/* SQUAD STATS — G/A/CS table */}
      {xiPlayers.length > 0 ? (
        <SquadStatsTable xiPlayers={xiPlayers} stats={seasonStats} />
      ) : null}

      {/* TRANSFER SUMMARY */}
      <div className="mt-10">
        <div className="text-mono uppercase text-[10px] tracking-widest text-white/40 mb-3">Your Transfer Window</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <SummaryStat label="Signings"  value={String(report.signingsCount)} sub={`£${report.signingsSpendM}M spent`}  accent="text-[color:var(--color-accent-pink)]" />
          <SummaryStat label="Outgoing"  value={String(report.outgoingCount)} sub={`£${report.outgoingRaisedM}M raised`} accent="text-[color:var(--color-accent-cyan)]" />
          <SummaryStat label="Net Spend" value={`${report.netSpendM < 0 ? '+' : '–'}£${Math.abs(report.netSpendM)}M`} sub="cash flow" accent={report.netSpendM > 0 ? 'text-amber-300' : 'text-emerald-300'} />
          <SummaryStat label="Chemistry" value={String(xi?.chemistry ?? 0)} sub={`${xi?.exactMatches ?? 0}/11 exact`} accent="text-[color:var(--color-accent-green)]" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
          <div className="card">
            <div className="text-emerald-300 text-mono uppercase text-[10px] tracking-widest mb-3">▲ Signings ({signings.length})</div>
            <ul className="divide-y divide-white/5">
              {signings.length === 0 && <li className="text-white/40 text-sm">No signings.</li>}
              {signings.map((t) => (
                <li key={t.playerId} className="flex items-center justify-between py-2 text-sm">
                  <span>{t.playerName}</span>
                  <span className="text-mono text-white/55 text-xs">£{t.feeM}M · £{t.wageK}k/wk</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="card">
            <div className="text-rose-300 text-mono uppercase text-[10px] tracking-widest mb-3">▼ Sales / Loans ({sales.length})</div>
            <ul className="divide-y divide-white/5">
              {sales.length === 0 && <li className="text-white/40 text-sm">No outgoing.</li>}
              {sales.map((t) => (
                <li key={t.playerId} className="flex items-center justify-between py-2 text-sm">
                  <span>{t.playerName}</span>
                  <span className="text-mono text-white/55 text-xs">£{Math.round(t.receivedM)}M</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* SECONDARY: Board objectives list */}
      <div className="card mt-5">
        <div className="text-mono uppercase text-[10px] tracking-widest text-white/40 mb-3">Board Objectives · Verdict</div>
        <ul className="divide-y divide-white/5">
          {report.objectiveOutcomes.map((o) => (
            <li key={o.objective.label} className="flex items-center justify-between py-2 text-sm">
              <span>
                {o.objective.label}
                {o.reachedRound ? (
                  <span className="text-white/40 text-mono text-[11px] ml-2">reached {o.reachedRound}</span>
                ) : null}
              </span>
              <span className={`text-mono text-[11px] uppercase tracking-widest
                ${o.outcome === 'exceeded' ? 'text-emerald-300' : o.outcome === 'met' ? 'text-cyan-300' : 'text-rose-300'}`}>
                {o.outcome}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex justify-center mt-10 mb-4">
        <button onClick={reset} className="btn-primary text-sm" type="button">Play another season →</button>
      </div>
    </AppShell>
  );
}

/* ─────────────────────────────────────────────────────── trophy cabinet ── */

const LEAGUE_DISPLAY: Record<string, string> = {
  PL: 'Premier League',
  LL: 'La Liga',
  SA: 'Serie A',
  BL: 'Bundesliga',
  L1: 'Ligue 1',
  ER: 'Eredivisie',
  PT: 'Primeira Liga',
};

function TrophyCabinet({
  objectives, finalPosition, leagueLabel,
}: {
  objectives: { objective: BoardObjective; outcome: ObjectiveOutcome; reachedRound?: string }[];
  finalPosition: number;
  leagueLabel: string;
}) {
  // Build a list of real trophies + qualifications worth celebrating
  const trophies: { competition: string; subtitle: string; tone: 'gold' | 'silver' | 'bronze' }[] = [];

  if (finalPosition === 1) {
    trophies.push({
      competition: LEAGUE_DISPLAY[leagueLabel] ?? 'League',
      subtitle: 'CHAMPIONS',
      tone: 'gold',
    });
  } else if (finalPosition <= 4) {
    trophies.push({
      competition: LEAGUE_DISPLAY[leagueLabel] ?? 'League',
      subtitle: `${ordinal(finalPosition)} · UCL qualification`,
      tone: 'silver',
    });
  } else if (finalPosition <= 6) {
    trophies.push({
      competition: LEAGUE_DISPLAY[leagueLabel] ?? 'League',
      subtitle: `${ordinal(finalPosition)} · Europe secured`,
      tone: 'bronze',
    });
  }

  // Cup trophies: only count an actual trophy when the club reached 'Winners'.
  // Reaching the Final is silver (finalists), SF is bronze (semi-finalists).
  for (const o of objectives) {
    if (o.objective.kind === 'PL') continue;  // league already covered
    const reached = o.reachedRound;
    if (!reached) continue;
    if (reached === 'Winners') {
      trophies.push({ competition: o.objective.label, subtitle: 'WINNERS', tone: 'gold' });
    } else if (reached === 'Final') {
      trophies.push({ competition: o.objective.label, subtitle: 'FINALISTS', tone: 'silver' });
    } else if (reached === 'SF') {
      trophies.push({ competition: o.objective.label, subtitle: 'SEMI-FINAL', tone: 'bronze' });
    }
  }

  if (trophies.length === 0) {
    return (
      <div className="mt-12 text-center">
        <div className="text-mono uppercase text-[10px] tracking-widest text-white/40">Trophy Cabinet</div>
        <div className="text-white/50 italic mt-2">Bare shelves. {ordinal(finalPosition)} · no silverware this year.</div>
      </div>
    );
  }

  return (
    <div className="mt-12">
      <div className="text-mono uppercase text-[10px] tracking-widest text-amber-300/80 mb-3 text-center">
        Trophy Cabinet
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {trophies.map((t, i) => <Trophy key={i} {...t} />)}
      </div>
    </div>
  );
}

function Trophy({
  competition, subtitle, tone,
}: { competition: string; subtitle: string; tone: 'gold' | 'silver' | 'bronze' }) {
  const palette =
    tone === 'gold'
      ? { stroke: '#FFD96A', glow: 'rgba(253, 224, 71, 0.55)', text: 'text-amber-200', sub: 'text-amber-300' }
      : tone === 'silver'
        ? { stroke: '#E5E5F0', glow: 'rgba(229, 231, 235, 0.35)', text: 'text-white', sub: 'text-white/80' }
        : { stroke: '#C8814B', glow: 'rgba(200, 129, 75, 0.45)',  text: 'text-orange-200', sub: 'text-orange-300' };

  return (
    <div
      className="card flex flex-col items-center text-center"
      style={{ boxShadow: `0 0 24px ${palette.glow}`, borderColor: palette.stroke }}
    >
      <TrophySVG stroke={palette.stroke} />
      <div className={`text-display uppercase text-sm tracking-wider mt-3 ${palette.text}`}>
        {competition}
      </div>
      <div className={`text-mono text-[10px] uppercase tracking-widest mt-1 ${palette.sub}`}>
        {subtitle}
      </div>
    </div>
  );
}

function TrophySVG({ stroke }: { stroke: string }) {
  return (
    <svg viewBox="0 0 64 80" className="w-12 h-16" aria-hidden>
      <defs>
        <linearGradient id={`cup-${stroke}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.95" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0.55" />
        </linearGradient>
      </defs>
      {/* handles */}
      <path d="M14 20 Q4 28 14 36" fill="none" stroke={stroke} strokeWidth="2.5" />
      <path d="M50 20 Q60 28 50 36" fill="none" stroke={stroke} strokeWidth="2.5" />
      {/* cup */}
      <path d="M14 12 H50 V32 Q50 50 32 50 Q14 50 14 32 Z" fill={`url(#cup-${stroke})`} stroke={stroke} strokeWidth="2" />
      {/* stem */}
      <rect x="28" y="50" width="8" height="10" fill={stroke} opacity="0.9" />
      {/* base */}
      <rect x="18" y="60" width="28" height="6" rx="1" fill={stroke} opacity="0.9" />
      <rect x="14" y="66" width="36" height="6" rx="1" fill={stroke} opacity="0.7" />
    </svg>
  );
}

/* ──────────────────────────────────────────────────── position chart ── */

function PositionChart({
  trace, userClubId,
}: { trace: { matchday: number; position: number; points: number }[]; userClubId: string }) {
  if (trace.length === 0) {
    return <div className="text-white/30 text-sm italic">No fixtures yet.</div>;
  }

  const maxMd = trace[trace.length - 1]?.matchday ?? 38;
  const minMd = trace[0]?.matchday ?? 1;
  const maxPosObserved = Math.max(...trace.map((t) => t.position));
  const yMax = Math.max(20, maxPosObserved);  // show top 20 typically

  const W = 600;
  const H = 200;
  const padL = 28, padR = 12, padT = 12, padB = 24;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const xFor = (md: number) => padL + ((md - minMd) / Math.max(1, maxMd - minMd)) * innerW;
  // Higher position number = lower place → bigger Y value (down). y=padT is "1st".
  const yFor = (pos: number) => padT + ((pos - 1) / Math.max(1, yMax - 1)) * innerH;

  const path = trace
    .map((t, i) => `${i === 0 ? 'M' : 'L'} ${xFor(t.matchday).toFixed(1)} ${yFor(t.position).toFixed(1)}`)
    .join(' ');

  const finalPos = trace[trace.length - 1]?.position ?? 1;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-44" aria-label="League position over the season">
        {/* gridlines for top 4, top 6, mid */}
        {[1, 4, 6, 10, 17].filter((p) => p <= yMax).map((p) => (
          <g key={p}>
            <line x1={padL} y1={yFor(p)} x2={W - padR} y2={yFor(p)} stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
            <text x={padL - 6} y={yFor(p) + 3} fontSize="9" textAnchor="end" fill="rgba(255,255,255,0.4)" fontFamily="monospace">{p}</text>
          </g>
        ))}
        {/* line */}
        <path d={path} fill="none" stroke="#ff2ea6" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {/* final dot */}
        {trace.length > 0 ? (() => {
          const last = trace[trace.length - 1]!;
          return (
            <g>
              <circle cx={xFor(last.matchday)} cy={yFor(last.position)} r="4" fill="#ff2ea6" />
              <text x={xFor(last.matchday) - 8} y={yFor(last.position) - 8} fontSize="11" textAnchor="end" fill="#ff2ea6" fontWeight="bold">
                {ordinal(last.position)}
              </text>
            </g>
          );
        })() : null}
        {/* x-axis ticks every 5 matchdays */}
        {Array.from({ length: Math.floor(maxMd / 5) + 1 }, (_, i) => i * 5).filter((md) => md >= minMd).map((md) => (
          <text key={md} x={xFor(md)} y={H - padB / 2 + 2} fontSize="9" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontFamily="monospace">MD{md}</text>
        ))}
      </svg>
      <div className="text-mono text-[11px] text-white/45 mt-1 flex items-center justify-between">
        <span>From kickoff to {ordinal(finalPos)}</span>
        <span className="text-white/30">Club id: {CLUBS_BY_ID[userClubId]?.shortName ?? userClubId}</span>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────── mini-pitch ──── */

function MiniPitch({
  slots, assignments, squadById,
}: {
  slots: { position: Player['position']; x: number; y: number }[];
  assignments: Record<number, string>;
  squadById: Record<string, Player>;
}) {
  return (
    <div className="relative w-full aspect-[3/4] bg-emerald-950/40 rounded-lg overflow-hidden border border-emerald-700/30">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        <rect x="2" y="2" width="96" height="96" fill="none" stroke="rgba(20, 180, 140, 0.35)" strokeWidth="0.3" />
        <line x1="2" y1="50" x2="98" y2="50" stroke="rgba(20, 180, 140, 0.35)" strokeWidth="0.3" />
        <circle cx="50" cy="50" r="9" fill="none" stroke="rgba(20, 180, 140, 0.35)" strokeWidth="0.3" />
        <rect x="28" y="2"  width="44" height="14" fill="none" stroke="rgba(20, 180, 140, 0.35)" strokeWidth="0.3" />
        <rect x="28" y="84" width="44" height="14" fill="none" stroke="rgba(20, 180, 140, 0.35)" strokeWidth="0.3" />
      </svg>
      {slots.map((slot, idx) => {
        const pid = assignments[idx];
        const player = pid ? squadById[pid] : null;
        const family = familyTone(slot.position);
        return (
          <div
            key={idx}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${slot.x}%`, top: `${slot.y}%` }}
          >
            <div className={`rounded-md px-2 py-1 text-center min-w-[68px] backdrop-blur-sm ${family}`}>
              <div className="text-[9px] font-bold uppercase tracking-wider">{slot.position}</div>
              {player ? (
                <div className="text-[10px] text-white truncate max-w-[100px]">{lastName(player.name)}</div>
              ) : (
                <div className="text-[10px] text-white/40">—</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function familyTone(pos: Player['position']): string {
  if (pos === 'GK') return 'bg-amber-500/25 border border-amber-400/60 text-amber-100';
  if (pos === 'CB' || pos === 'LB' || pos === 'RB') return 'bg-sky-500/25 border border-sky-400/60 text-sky-100';
  if (pos === 'LW' || pos === 'RW' || pos === 'ST') return 'bg-rose-500/25 border border-rose-400/60 text-rose-100';
  return 'bg-violet-500/25 border border-violet-400/60 text-violet-100';
}

function lastName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1]! : name;
}

/* ───────────────────────────────────────────────── small parts ──── */

function PlayerSpotlight({
  title, player, footer, accent,
}: { title: string; player: Player; footer: string; accent: string }) {
  return (
    <div className="card">
      <div className={`text-mono uppercase text-[10px] tracking-widest ${accent}`}>{title}</div>
      <div className="flex items-center gap-3 mt-3">
        <PositionBadge position={player.position} />
        <div className="min-w-0">
          <div className="text-display text-lg uppercase truncate">{player.name}</div>
          <div className="text-mono text-[11px] text-white/45 tracking-wider">
            {player.position} · rating {player.rating}
            {player.isStar ? <span className="ml-1 text-pink-300">★</span> : null}
          </div>
        </div>
      </div>
      <div className="text-display text-2xl mt-3">{footer}</div>
    </div>
  );
}

function SummaryStat({ label, value, sub, accent }: { label: string; value: string; sub: string; accent: string }) {
  return (
    <div className="card">
      <div className="text-mono uppercase text-[10px] tracking-widest text-white/40">{label}</div>
      <div className={`text-display text-3xl mt-1 ${accent}`}>{value}</div>
      <div className="text-mono text-[11px] text-white/45 mt-1">{sub}</div>
    </div>
  );
}

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-mono text-[11px] uppercase tracking-widest">
        <span className="text-white/50">{label}</span>
        <span className="text-white">{value}</span>
      </div>
      <div className="h-2 rounded-full bg-white/5 mt-1 overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function Mini({ label, value, valueClass = '' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="text-center">
      <div className="text-mono uppercase text-[10px] tracking-widest text-white/40">{label}</div>
      <div className={`text-display text-lg uppercase mt-0.5 ${valueClass}`}>{value}</div>
    </div>
  );
}

/* ──────────────────────────────────────────────── finish verdict hero ──── */

function FinishVerdictHero({
  projected, finished, verdict,
}: {
  projected: number;
  finished: number;
  verdict: import('@/sim').FinishVerdict;
}) {
  const tone = verdict.tone;
  const palette: Record<string, { ring: string; text: string; glow: string }> = {
    crashers:     { ring: 'border-fuchsia-300/70', text: 'text-fuchsia-200', glow: 'rgba(232, 121, 249, 0.45)' },
    overachiever: { ring: 'border-emerald-300/70', text: 'text-emerald-200', glow: 'rgba(110, 231, 183, 0.40)' },
    expected:     { ring: 'border-white/30',       text: 'text-white/80',    glow: 'rgba(255,255,255,0.20)' },
    underperform: { ring: 'border-amber-300/70',   text: 'text-amber-200',   glow: 'rgba(252, 211, 77, 0.40)' },
    disaster:     { ring: 'border-rose-300/70',    text: 'text-rose-200',    glow: 'rgba(252, 165, 165, 0.45)' },
  };
  const p = palette[tone] ?? palette.expected!;
  return (
    <div className="mt-10">
      <div
        className={`card border-2 ${p.ring} flex flex-col md:flex-row items-center justify-between gap-6`}
        style={{ boxShadow: `0 0 36px ${p.glow}` }}
      >
        <div className="flex items-center gap-6 md:gap-10">
          <div className="text-center">
            <div className="text-mono uppercase text-[10px] tracking-widest text-white/40">Projected</div>
            <div className="text-display text-4xl mt-1 text-white/55">{ordinal(projected)}</div>
          </div>
          <div className="text-white/30 text-2xl">→</div>
          <div className="text-center">
            <div className="text-mono uppercase text-[10px] tracking-widest text-white/40">Finished</div>
            <div className={`text-display text-4xl mt-1 ${p.text}`}>{ordinal(finished)}</div>
          </div>
        </div>
        <div className="text-center md:text-right">
          <div className={`text-display uppercase text-2xl ${p.text}`}>{verdict.label}</div>
          <div className="text-mono text-[11px] text-white/55 mt-1 max-w-[280px]">{verdict.blurb}</div>
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────────────── department balance ──── */

const BAND_TONE: Record<string, string> = {
  'World Class': 'text-fuchsia-300',
  'Strong':     'text-emerald-300',
  'Very Good':  'text-cyan-300',
  'Good':       'text-sky-300',
  'Average':    'text-amber-300',
  'Weak':       'text-rose-300',
};

function DepartmentBalanceCard({ balance }: { balance: import('@/sim').DepartmentBalance }) {
  return (
    <div className="mt-5">
      <div className="text-mono uppercase text-[10px] tracking-widest text-white/40 mb-3">Department Balance</div>
      <div className="card">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <BalanceCell label="Goalkeeper" band={balance.goalkeeper.band} avg={balance.goalkeeper.avg} />
          <BalanceCell label="Defence"    band={balance.defense.band}    avg={balance.defense.avg} />
          <BalanceCell label="Midfield"   band={balance.midfield.band}   avg={balance.midfield.avg} />
          <BalanceCell label="Attack"     band={balance.attack.band}     avg={balance.attack.avg} />
        </div>
        <div className="border-t border-white/10 mt-4 pt-3 flex items-center justify-between">
          <span className="text-mono text-[11px] uppercase tracking-widest text-white/45">Verdict</span>
          <span className="text-display uppercase text-sm text-white/85">{balance.verdict}</span>
        </div>
      </div>
    </div>
  );
}

function BalanceCell({ label, band, avg }: { label: string; band: string; avg: number }) {
  const tone = BAND_TONE[band] ?? 'text-white';
  return (
    <div className="text-center">
      <div className="text-mono uppercase text-[10px] tracking-widest text-white/40">{label}</div>
      <div className={`text-display uppercase text-base md:text-lg mt-1 ${tone}`}>{band}</div>
      <div className="text-mono text-[10px] text-white/35 mt-0.5">avg {avg}</div>
    </div>
  );
}

/* ────────────────────────────────────────────── awards ──── */

function AwardsRow({
  awards, squadById,
}: { awards: import('@/sim').Awards; squadById: Record<string, Player> }) {
  return (
    <div className="mt-5">
      <div className="text-mono uppercase text-[10px] tracking-widest text-white/40 mb-3">End of Season Awards</div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <AwardCard
          title="Golden Boot"
          accent="text-amber-300"
          glow="rgba(253, 224, 71, 0.40)"
          player={awards.goldenBoot ? squadById[awards.goldenBoot.playerId] : undefined}
          stat={awards.goldenBoot ? `${awards.goldenBoot.goals} goals` : '—'}
        />
        <AwardCard
          title="Playmaker"
          accent="text-cyan-300"
          glow="rgba(103, 232, 249, 0.35)"
          player={awards.playmaker ? squadById[awards.playmaker.playerId] : undefined}
          stat={awards.playmaker ? `${awards.playmaker.assists} assists` : '—'}
        />
        <AwardCard
          title="Golden Glove"
          accent="text-emerald-300"
          glow="rgba(110, 231, 183, 0.35)"
          player={awards.goldenGlove ? squadById[awards.goldenGlove.playerId] : undefined}
          stat={awards.goldenGlove ? `${awards.goldenGlove.cleanSheets} clean sheets` : '—'}
        />
        <AwardCard
          title="Player of the Season"
          accent="text-fuchsia-300"
          glow="rgba(232, 121, 249, 0.45)"
          player={awards.playerOfSeason ? squadById[awards.playerOfSeason.playerId] : undefined}
          stat={awards.playerOfSeason ? `index ${awards.playerOfSeason.score}` : '—'}
        />
      </div>
    </div>
  );
}

function AwardCard({
  title, accent, glow, player, stat,
}: { title: string; accent: string; glow: string; player: Player | undefined; stat: string }) {
  return (
    <div className="card" style={{ boxShadow: `0 0 20px ${glow}` }}>
      <div className={`text-mono uppercase text-[10px] tracking-widest ${accent}`}>{title}</div>
      {player ? (
        <>
          <div className="flex items-center gap-2 mt-3">
            <PositionBadge position={player.position} />
            <div className="min-w-0">
              <div className="text-display uppercase text-sm truncate">{player.name}</div>
              <div className="text-mono text-[10px] text-white/40">rating {player.rating}</div>
            </div>
          </div>
          <div className="text-display text-xl mt-2">{stat}</div>
        </>
      ) : (
        <div className="text-white/40 text-sm mt-3">—</div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────── squad stats table ──── */

function SquadStatsTable({
  xiPlayers, stats,
}: {
  xiPlayers: Player[];
  stats: Record<string, import('@/sim').PlayerSeasonStats>;
}) {
  const rows = xiPlayers
    .map((p) => ({ player: p, s: stats[p.id] }))
    .filter((r): r is { player: Player; s: import('@/sim').PlayerSeasonStats } => Boolean(r.s));

  return (
    <div className="mt-5">
      <div className="text-mono uppercase text-[10px] tracking-widest text-white/40 mb-3">Starting XI · Season Stats</div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-mono uppercase text-[10px] tracking-widest text-white/40 border-b border-white/10">
              <th className="text-left py-2 font-normal">Player</th>
              <th className="text-left py-2 font-normal">Pos</th>
              <th className="text-right py-2 font-normal">Apps</th>
              <th className="text-right py-2 font-normal">G</th>
              <th className="text-right py-2 font-normal">A</th>
              <th className="text-right py-2 font-normal">CS</th>
              <th className="text-right py-2 font-normal">Rating</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ player, s }) => (
              <tr key={player.id} className="border-b border-white/5 last:border-b-0">
                <td className="py-2">
                  <div className="flex items-center gap-2">
                    <span className="truncate">{player.name}</span>
                    {player.isStar ? <span className="text-pink-300">★</span> : null}
                  </div>
                </td>
                <td className="py-2 text-white/55 text-mono text-[11px]">{player.position}</td>
                <td className="py-2 text-right text-white/55 text-mono">{s.appearances}</td>
                <td className="py-2 text-right text-mono text-emerald-300">{s.goals}</td>
                <td className="py-2 text-right text-mono text-cyan-300">{s.assists}</td>
                <td className="py-2 text-right text-mono text-amber-300">{player.position === 'GK' ? s.cleanSheets : '—'}</td>
                <td className="py-2 text-right text-mono text-white/65">{player.rating}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────── helpers ──── */

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  const suffix = s[(v - 20) % 10] ?? s[v] ?? s[0] ?? 'th';
  return `${n}${suffix}`;
}
