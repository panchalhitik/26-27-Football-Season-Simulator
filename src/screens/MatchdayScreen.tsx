import { useEffect, useMemo, useRef, useState } from 'react';
import { AppShell, SectionLabel } from '@/components/AppShell';
import { CLUBS_BY_ID, FILLER_CLUB_NAMES, FORMATIONS, FORMATIONS_BY_SHAPE, PLAYERS_BY_ID } from '@/data';
import { conventionality } from '@/engine/shape';
import { formGuide, nextUserFixture } from '@/sim/live';
import { useGameStore } from '@/store';
import type { FormationShape, PitchSlot, Player } from '@/types';

/**
 * The playable season: one matchday at a time. Set your lineup (drag slots
 * anywhere — unconventional shapes cost you), watch for injuries, then hit
 * PLAY. Or fast-forward to the January window / final day.
 */
export function MatchdayScreen({ half }: { half: 'h1' | 'h2' }) {
  const clubId = useGameStore((s) => s.clubId);
  const live = useGameStore((s) => s.liveSeason);
  const xi = useGameStore((s) => s.xi);
  const formationShape = useGameStore((s) => s.formationShape);
  const injuries = useGameStore((s) => s.injuries);
  const strengths = useGameStore((s) => s.lastSeasonStrengths);
  const squadIds = useGameStore((s) => s.squadIds);

  const [editingLineup, setEditingLineup] = useState(false);
  const [lastPlayedMd, setLastPlayedMd] = useState<number | null>(null);

  // Kick off the season on first arrival.
  useEffect(() => {
    const { startSeason } = useGameStore.getState();
    startSeason();
  }, []);

  const guide = useMemo(() => (live ? formGuide(live) : {}), [live]);
  const next = useMemo(
    () => (live && clubId ? nextUserFixture(live, strengths, clubId) : null),
    [live, clubId, strengths],
  );

  if (!clubId || !live) return null;
  const club = CLUBS_BY_ID[clubId];
  if (!club) return null;

  const half1End = live.totalRounds / 2;
  const inH2 = half === 'h2';
  const doneForHalf = inH2
    ? live.matchday > live.totalRounds
    : live.matchday > half1End;

  const userRow = live.table.find((r) => r.clubId === clubId);
  const userPos = live.table.findIndex((r) => r.clubId === clubId) + 1;

  const lastMdResults = live.results.filter((f) => f.matchday === live.matchday - 1);

  const injuredList = Object.entries(injuries)
    .map(([pid, out]) => ({ player: PLAYERS_BY_ID[pid], out }))
    .filter((x): x is { player: Player; out: number } => Boolean(x.player));

  const playOne = () => {
    const { simMatchday } = useGameStore.getState();
    setLastPlayedMd(live.matchday);
    simMatchday();
  };
  const fastForward = () => {
    const store = useGameStore.getState();
    if (inH2) store.simToEnd();
    else store.simToMidSeason();
  };

  return (
    <AppShell>
      <SectionLabel>
        Season 2026-27 · {inH2 ? 'Second half' : 'First half'}
      </SectionLabel>

      {/* ── HERO: matchday + next fixture ─────────────────── */}
      <div className="flex flex-col lg:flex-row items-stretch gap-5 mt-4">
        <div className="flex-1">
          <div className="text-mono uppercase text-[11px] tracking-[0.3em] text-[color:var(--color-accent-green)]">
            ● Matchday {Math.min(live.matchday, live.totalRounds)} of {live.totalRounds}
          </div>
          <h1 className="text-display text-5xl md:text-6xl uppercase mt-1">
            {club.shortName}<span className="text-[color:var(--color-accent-green)]">.</span>
          </h1>
          <div className="flex flex-wrap gap-6 mt-4">
            <HeroStat label="Pos" value={userPos > 0 ? String(userPos) : '—'} />
            <HeroStat label="Pts" value={String(userRow?.points ?? 0)} />
            <HeroStat label="GD" value={fmtGd(userRow?.gd ?? 0)} />
            <HeroStat label="Form" value={(guide[clubId] ?? []).slice(0, 5).join('') || '—'} />
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-7">
            {!doneForHalf && (
              <button type="button" className="btn-primary text-base px-8 py-4" onClick={playOne}>
                ▶ Play Matchday {live.matchday}
              </button>
            )}
            {!doneForHalf && (
              <button type="button" className="btn-ghost" onClick={fastForward}>
                ⏩ Sim to {inH2 ? 'Final Day' : 'January'}
              </button>
            )}
            <button
              type="button"
              className={`btn-ghost ${editingLineup ? 'border-[color:var(--color-accent-green)] text-[color:var(--color-accent-green)]' : ''}`}
              onClick={() => setEditingLineup((v) => !v)}
            >
              ⚙ Lineup {editingLineup ? '· editing' : ''}
            </button>
          </div>
        </div>

        {/* Next fixture card */}
        {next ? (
          <div className="card lg:w-96 flex flex-col justify-center">
            <div className="text-mono uppercase text-[10px] tracking-widest text-white/40 mb-3">
              Next fixture · MD {next.matchday}
            </div>
            <div className="flex items-center justify-between gap-3">
              <FixtureSide id={next.isHome ? clubId : next.opponentId} big />
              <span className="text-mono text-white/35 text-sm">vs</span>
              <FixtureSide id={next.isHome ? next.opponentId : clubId} big right />
            </div>
            <div className="text-mono text-[11px] text-white/45 mt-4 flex justify-between">
              <span>{next.isHome ? 'HOME' : 'AWAY'}</span>
              <OpponentStrength id={next.opponentId} strengths={strengths} />
            </div>
          </div>
        ) : (
          <div className="card lg:w-96 flex items-center justify-center text-white/50">
            Season complete.
          </div>
        )}
      </div>

      {/* ── INJURIES ─────────────────────────────────────── */}
      {injuredList.length > 0 && (
        <div className="card mt-6 border-rose-400/40">
          <div className="text-mono uppercase text-[10px] tracking-widest text-rose-300 mb-2">
            ✚ Treatment room ({injuredList.length})
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            {injuredList.map(({ player, out }) => (
              <span key={player.id}>
                <span className="text-white/85">{player.name}</span>
                <span className="text-rose-300 text-mono text-[11px] ml-2">out {out} MD{out > 1 ? 's' : ''}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── LINEUP EDITOR ────────────────────────────────── */}
      {editingLineup && xi && (
        <LineupEditor
          xi={xi}
          formationShape={formationShape}
          squadIds={squadIds}
          injuries={injuries}
        />
      )}

      {/* ── LAST MATCHDAY RESULTS + TABLE ────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5 mt-6">
        <div className="lg:col-span-2 card">
          <div className="text-mono uppercase text-[10px] tracking-widest text-white/40 mb-3">
            {lastPlayedMd != null && lastMdResults.length > 0
              ? `Results · Matchday ${live.matchday - 1}`
              : 'Results'}
          </div>
          {lastMdResults.length === 0 ? (
            <div className="text-white/35 text-sm italic">The season awaits kickoff.</div>
          ) : (
            <ul className="space-y-1.5">
              {lastMdResults.map((f, i) => {
                const involved = f.homeId === clubId || f.awayId === clubId;
                return (
                  <li
                    key={i}
                    className={`grid grid-cols-[1fr_64px_1fr] items-center gap-2 text-sm rounded px-2 py-1
                      ${involved ? 'bg-[color:var(--color-accent-green)]/10 border border-[color:var(--color-accent-green)]/30' : ''}`}
                  >
                    <span className={`text-right truncate ${f.homeId === clubId ? 'font-bold' : 'text-white/65'}`}>
                      {labelClub(f.homeId)}
                    </span>
                    <span className="text-center text-mono bg-white/10 rounded py-0.5 text-[13px]">
                      {f.homeGoals}–{f.awayGoals}
                    </span>
                    <span className={`truncate ${f.awayId === clubId ? 'font-bold' : 'text-white/65'}`}>
                      {labelClub(f.awayId)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* League table */}
        <div className="lg:col-span-3 card overflow-x-auto">
          <div className="text-mono uppercase text-[10px] tracking-widest text-white/40 mb-3">League table</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-mono uppercase text-[10px] tracking-widest text-white/40 border-b border-white/10">
                <th className="text-left py-1.5 font-normal w-8">#</th>
                <th className="text-left py-1.5 font-normal">Club</th>
                <th className="text-right py-1.5 font-normal">P</th>
                <th className="text-right py-1.5 font-normal">GD</th>
                <th className="text-right py-1.5 font-normal">Pts</th>
                <th className="text-right py-1.5 font-normal hidden md:table-cell">Form</th>
              </tr>
            </thead>
            <tbody>
              {live.table.map((row, i) => {
                const pos = i + 1;
                const isUser = row.clubId === clubId;
                const zone =
                  pos === 1 ? 'border-l-2 border-[color:var(--color-accent-green)]' :
                  pos <= 4 ? 'border-l-2 border-amber-300/70' :
                  pos >= live.table.length - 2 ? 'border-l-2 border-rose-400/80' :
                  'border-l-2 border-transparent';
                return (
                  <tr
                    key={row.clubId}
                    className={`${zone} ${isUser ? 'bg-[color:var(--color-accent-green)]/10' : ''} border-b border-white/5 last:border-b-0`}
                  >
                    <td className="py-1.5 pl-2 text-mono text-white/45">{pos}</td>
                    <td className={`py-1.5 ${isUser ? 'font-bold' : ''}`}>
                      {labelClub(row.clubId)}
                      {isUser && <span className="text-[color:var(--color-accent-green)] text-mono text-[9px] uppercase ml-2">You</span>}
                    </td>
                    <td className="py-1.5 text-right text-mono text-white/55">{row.played}</td>
                    <td className="py-1.5 text-right text-mono text-white/55">{fmtGd(row.gd)}</td>
                    <td className="py-1.5 text-right text-mono font-bold">{row.points}</td>
                    <td className="py-1.5 text-right hidden md:table-cell">
                      <FormBadges results={(guide[row.clubId] ?? []).slice(0, 5)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}

/* ─────────────────────────────────────────── lineup editor ─── */

function LineupEditor({
  xi, formationShape, squadIds, injuries,
}: {
  xi: NonNullable<ReturnType<typeof useGameStore.getState>['xi']>;
  formationShape: FormationShape;
  squadIds: string[];
  injuries: Record<string, number>;
}) {
  const formation = FORMATIONS_BY_SHAPE[formationShape];
  const slots: PitchSlot[] =
    xi.customSlots && xi.customSlots.length === formation.slots.length
      ? xi.customSlots
      : formation.slots;

  const pitchRef = useRef<HTMLDivElement | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);

  const verdict = conventionality(slots);

  const squadById = useMemo(() => {
    const map: Record<string, Player> = {};
    for (const id of squadIds) {
      const p = PLAYERS_BY_ID[id];
      if (p) map[id] = p;
    }
    return map;
  }, [squadIds]);

  const xiIds = new Set(Object.values(xi.assignments));
  const bench = squadIds
    .map((id) => squadById[id])
    .filter((p): p is Player => Boolean(p) && !xiIds.has(p!.id))
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 12);

  const pctFromEvent = (e: React.PointerEvent): { x: number; y: number } | null => {
    const el = pitchRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * 100,
      y: ((e.clientY - r.top) / r.height) * 100,
    };
  };

  return (
    <div className="card mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="text-mono uppercase text-[10px] tracking-widest text-white/40">
          Weekly lineup · drag positions anywhere · click a shirt then a bench player to swap
        </div>
        <div className="flex items-center gap-3">
          <select
            className="bg-white/10 border border-white/20 rounded px-2 py-1.5 text-sm"
            value={formationShape}
            onChange={(e) => {
              const { setFormation, autoPickXI } = useGameStore.getState();
              setFormation(e.target.value as FormationShape);
              autoPickXI();
            }}
          >
            {FORMATIONS.map((f) => (
              <option key={f.shape} value={f.shape}>{f.label}</option>
            ))}
          </select>
          {xi.customSlots && (
            <button type="button" className="btn-ghost text-xs" onClick={() => useGameStore.getState().resetSlots()}>
              Reset shape
            </button>
          )}
        </div>
      </div>

      {/* Conventionality meter */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full transition-all"
            style={{
              width: `${Math.round(verdict.score01 * 100)}%`,
              background: verdict.score01 >= 0.8
                ? 'linear-gradient(90deg, #19f5a1, #a3ff12)'
                : verdict.score01 >= 0.6
                  ? 'linear-gradient(90deg, #ffb547, #ffd96a)'
                  : 'linear-gradient(90deg, #ff5e62, #ff2ea6)',
            }}
          />
        </div>
        <span className={`text-mono text-[11px] uppercase tracking-widest
          ${verdict.score01 >= 0.8 ? 'text-[color:var(--color-accent-green)]' : verdict.score01 >= 0.6 ? 'text-amber-300' : 'text-rose-300'}`}>
          {verdict.verdict}
        </span>
      </div>
      {verdict.issues.length > 0 && (
        <div className="text-rose-300/85 text-[12px] mb-3">⚠ {verdict.issues.join(' · ')}</div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] gap-5">
        {/* Pitch */}
        <div
          ref={pitchRef}
          className="relative w-full aspect-[4/3] rounded-xl overflow-hidden border border-emerald-500/25 select-none touch-none"
          style={{
            background:
              'repeating-linear-gradient(0deg, rgba(16,80,50,0.9) 0 12.5%, rgba(20,95,60,0.9) 12.5% 25%)',
          }}
          onPointerMove={(e) => {
            if (dragIdx == null) return;
            const p = pctFromEvent(e);
            if (p) setDragPos(p);
          }}
          onPointerUp={(e) => {
            if (dragIdx == null) return;
            const p = pctFromEvent(e);
            if (p) useGameStore.getState().moveSlot(dragIdx, p.x, p.y);
            setDragIdx(null);
            setDragPos(null);
          }}
        >
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
            <rect x="1.5" y="1.5" width="97" height="97" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.35" />
            <line x1="1.5" y1="50" x2="98.5" y2="50" stroke="rgba(255,255,255,0.25)" strokeWidth="0.35" />
            <circle cx="50" cy="50" r="9" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.35" />
            <rect x="28" y="1.5" width="44" height="13" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.35" />
            <rect x="28" y="85.5" width="44" height="13" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="0.35" />
          </svg>
          {slots.map((slot, idx) => {
            const pid = xi.assignments[idx];
            const player = pid ? squadById[pid] : undefined;
            const injured = pid ? injuries[pid] != null : false;
            const pos = dragIdx === idx && dragPos ? dragPos : { x: slot.x, y: slot.y };
            return (
              <div
                key={idx}
                className="absolute -translate-x-1/2 -translate-y-1/2 cursor-grab active:cursor-grabbing"
                style={{ left: `${pos.x}%`, top: `${pos.y}%`, zIndex: dragIdx === idx ? 10 : 1 }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
                  setDragIdx(idx);
                }}
                onClick={() => setSelectedSlot(selectedSlot === idx ? null : idx)}
              >
                <div
                  className={`rounded-lg px-2 py-1 text-center min-w-[64px] backdrop-blur-sm border transition
                    ${selectedSlot === idx
                      ? 'bg-[color:var(--color-accent-green)]/30 border-[color:var(--color-accent-green)] shadow-[0_0_14px_rgba(25,245,161,0.5)]'
                      : injured
                        ? 'bg-rose-500/30 border-rose-400/80'
                        : 'bg-black/45 border-white/25'}`}
                >
                  <div className="text-[9px] font-bold uppercase tracking-wider text-white/70">{slot.position}</div>
                  <div className="text-[11px] text-white font-semibold truncate max-w-[90px]">
                    {player ? lastName(player.name) : '—'}
                    {injured ? ' ✚' : ''}
                  </div>
                  {player && <div className="text-[9px] text-mono text-[color:var(--color-accent-amber)]">{player.rating}</div>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Bench */}
        <div>
          <div className="text-mono uppercase text-[10px] tracking-widest text-white/40 mb-2">
            Bench {selectedSlot != null ? '· pick a replacement' : ''}
          </div>
          <ul className="space-y-1 max-h-[420px] overflow-y-auto pr-1">
            {bench.map((p) => {
              const injured = injuries[p.id] != null;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    disabled={injured || selectedSlot == null}
                    className={`w-full flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm border transition text-left
                      ${injured
                        ? 'opacity-40 border-transparent cursor-not-allowed'
                        : selectedSlot != null
                          ? 'border-[color:var(--color-accent-green)]/50 hover:bg-[color:var(--color-accent-green)]/15 cursor-pointer'
                          : 'border-transparent text-white/60'}`}
                    onClick={() => {
                      if (selectedSlot == null) return;
                      useGameStore.getState().assignToSlot(selectedSlot, p.id);
                      setSelectedSlot(null);
                    }}
                  >
                    <span className="truncate">
                      <span className="text-mono text-[10px] text-white/45 mr-2">{p.position}</span>
                      {p.name}{injured ? ' ✚' : ''}
                    </span>
                    <span className="text-mono text-[11px] text-[color:var(--color-accent-amber)]">{p.rating}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────── small parts ─── */

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card px-4 py-2.5 min-w-[84px] text-center">
      <div className="text-mono uppercase text-[9px] tracking-widest text-white/40">{label}</div>
      <div className="text-display text-2xl mt-0.5">{value}</div>
    </div>
  );
}

function FixtureSide({ id, big, right }: { id: string; big?: boolean; right?: boolean }) {
  return (
    <span className={`${big ? 'text-display text-xl uppercase' : 'text-sm'} truncate ${right ? 'text-right' : ''}`}>
      {labelClub(id)}
    </span>
  );
}

function OpponentStrength({ id, strengths }: { id: string; strengths: { clubId: string; attack: number; defense: number }[] }) {
  const t = strengths.find((s) => s.clubId === id);
  if (!t) return null;
  return (
    <span>
      ATK {Math.round(t.attack)} · DEF {Math.round(t.defense)}
    </span>
  );
}

function FormBadges({ results }: { results: string[] }) {
  if (results.length === 0) return <span className="text-white/25">—</span>;
  return (
    <span className="inline-flex gap-1">
      {results.map((r, i) => (
        <span
          key={i}
          className={`inline-flex w-4 h-4 items-center justify-center rounded text-[9px] font-bold
            ${r === 'W' ? 'bg-[color:var(--color-accent-green)]/30 text-[color:var(--color-accent-green)]'
            : r === 'D' ? 'bg-white/15 text-white/70'
            : 'bg-rose-500/30 text-rose-300'}`}
        >
          {r}
        </span>
      ))}
    </span>
  );
}

function fmtGd(gd: number): string {
  return gd > 0 ? `+${gd}` : String(gd);
}

function labelClub(id: string): string {
  return CLUBS_BY_ID[id]?.shortName ?? FILLER_CLUB_NAMES[id] ?? id;
}

function lastName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1]! : name;
}
