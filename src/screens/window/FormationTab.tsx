import { useMemo, useRef, useState } from 'react';
import { FORMATIONS, FORMATIONS_BY_SHAPE, PLAYERS_BY_ID } from '@/data';
import { positionAffinity } from '@/engine';
import { conventionality } from '@/engine/shape';
import { TACTIC_TABLE } from '@/sim/tactics';
import { useGameStore } from '@/store';
import { PositionBadge } from '@/components/PositionBadge';
import type { FormationShape, Player, PlayerId, PositionGroup } from '@/types';

const GROUP_ORDER: PositionGroup[] = ['GK', 'DEF', 'MID', 'FWD'];

/** Drag payload — JSON encoded so we can also include source slot if any. */
type DragPayload = { playerId: PlayerId; fromSlot: number | null };

const DRAG_KEY = 'application/x-fss-drag';

export function FormationTab() {
  const formationShape = useGameStore((s) => s.formationShape);
  const setFormation = useGameStore((s) => s.setFormation);
  const xi = useGameStore((s) => s.xi);
  const autoPick = useGameStore((s) => s.autoPickXI);
  const setXI = useGameStore((s) => s.setXI);
  const squadIds = useGameStore((s) => s.squadIds);

  const formation = FORMATIONS_BY_SHAPE[formationShape];
  const assignments = xi?.assignments ?? {};

  // Fluid layout: custom slot coordinates override the preset. Positions are
  // re-derived from where each slot sits (see engine/shape.ts).
  const slots =
    xi?.customSlots && xi.customSlots.length === formation.slots.length
      ? xi.customSlots
      : formation.slots;
  const shapeVerdict = useMemo(() => conventionality(slots), [slots]);
  const tactics = TACTIC_TABLE[formationShape] ?? { openness: 0, defensiveLean: 0 };

  // Slot repositioning (pointer drag on the ✥ handle).
  const pitchRef = useRef<HTMLDivElement | null>(null);
  const [moveIdx, setMoveIdx] = useState<number | null>(null);
  const [movePos, setMovePos] = useState<{ x: number; y: number } | null>(null);

  const pctFromPointer = (e: React.PointerEvent): { x: number; y: number } | null => {
    const el = pitchRef.current;
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return {
      x: ((e.clientX - r.left) / r.width) * 100,
      y: ((e.clientY - r.top) / r.height) * 100,
    };
  };

  const squadById = useMemo(() => {
    const map: Record<string, Player> = {};
    for (const id of squadIds) {
      const p = PLAYERS_BY_ID[id];
      if (p) map[id] = p;
    }
    return map;
  }, [squadIds]);

  // Players currently on the pitch, by slot
  const startingXI = useMemo(() => {
    return formation.slots.map((_, idx) => {
      const pid = assignments[idx];
      return pid ? squadById[pid] : undefined;
    });
  }, [formation.slots, assignments, squadById]);

  // Reserves = squad - starters
  const inXISet = new Set(Object.values(assignments).filter(Boolean) as string[]);
  const reserves = useMemo(() => {
    const arr = squadIds
      .map((id) => squadById[id])
      .filter((p): p is Player => Boolean(p) && !inXISet.has((p as Player).id));
    arr.sort((a, b) => {
      // Group then rating desc
      const ga = GROUP_ORDER.indexOf(a.group);
      const gb = GROUP_ORDER.indexOf(b.group);
      if (ga !== gb) return ga - gb;
      return b.rating - a.rating;
    });
    return arr;
  }, [squadIds, squadById, inXISet]);

  // Slot index currently being dragged over (for hover styling)
  const [overSlot, setOverSlot] = useState<number | null>(null);
  const [overReserves, setOverReserves] = useState(false);

  function onDragStart(e: React.DragEvent, payload: DragPayload) {
    e.dataTransfer.setData(DRAG_KEY, JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'move';
  }

  function readPayload(e: React.DragEvent): DragPayload | null {
    try {
      const raw = e.dataTransfer.getData(DRAG_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as DragPayload;
    } catch {
      return null;
    }
  }

  /** Drop on a pitch slot — swap with whatever was there. */
  function dropOnSlot(targetSlot: number, payload: DragPayload) {
    const next = { ...assignments };
    const existingAtTarget = next[targetSlot];
    const sourcePlayerId = payload.playerId;

    if (payload.fromSlot === null) {
      // From reserves → assign, displace existing back to reserves (just drop slot)
      next[targetSlot] = sourcePlayerId;
      if (existingAtTarget) {
        // existing is now displaced to reserves automatically (no longer in any slot)
      }
    } else if (payload.fromSlot === targetSlot) {
      return; // no-op
    } else {
      // Slot ↔ slot swap
      if (existingAtTarget) {
        next[payload.fromSlot] = existingAtTarget;
      } else {
        delete next[payload.fromSlot];
      }
      next[targetSlot] = sourcePlayerId;
    }
    setXI(next);
  }

  /** Drop on reserves area — remove from XI if it was assigned. */
  function dropOnReserves(payload: DragPayload) {
    if (payload.fromSlot === null) return;
    const next = { ...assignments };
    delete next[payload.fromSlot];
    setXI(next);
  }

  const chem = xi?.chemistry ?? 0;
  const exact = xi?.exactMatches ?? 0;

  return (
    <div>
      {/* SHAPE PICKER */}
      <div className="card mb-5">
        <div className="flex items-center justify-between mb-3">
          <div className="text-mono uppercase text-[10px] tracking-widest text-white/40">
            Shape · {FORMATIONS.length} options
          </div>
          <div className="text-mono text-[11px] text-white/55">{formation.description}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {FORMATIONS.map((f) => (
            <button key={f.shape} type="button"
              onClick={() => setFormation(f.shape as FormationShape)}
              className={`text-display uppercase text-xs tracking-widest px-3 py-1.5 rounded border transition
                ${formationShape === f.shape ? 'bg-pink-500/20 border-pink-400/60 text-pink-200' : 'border-white/10 text-white/60 hover:text-white'}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* How this shape plays — feeds the match engine's tempo + tilt terms */}
        <div className="flex flex-wrap items-center gap-x-8 gap-y-2 mt-4 pt-3 border-t border-white/10">
          <TacticGauge
            label="Openness"
            value={tactics.openness}
            lowLabel="Cagey"
            highLabel="End-to-end"
            hint="Open shapes score AND concede more"
          />
          <TacticGauge
            label="Tilt"
            value={-tactics.defensiveLean}
            lowLabel="Defensive"
            highLabel="Attacking"
            hint="Attacking tilt trades goals conceded for goals scored"
          />
          <div className="flex items-center gap-2 ml-auto">
            <span className={`text-mono text-[10px] uppercase tracking-widest
              ${shapeVerdict.score01 >= 0.8 ? 'text-[color:var(--color-accent-green)]' : shapeVerdict.score01 >= 0.6 ? 'text-amber-300' : 'text-rose-300'}`}>
              {shapeVerdict.verdict}
            </span>
            {xi?.customSlots && (
              <button type="button" className="btn-ghost text-xs py-1"
                onClick={() => useGameStore.getState().resetSlots()}>
                Reset shape
              </button>
            )}
          </div>
        </div>
        {shapeVerdict.issues.length > 0 && (
          <div className="text-rose-300/85 text-[12px] mt-2">
            ⚠ {shapeVerdict.issues.join(' · ')} — team plays at {Math.round(shapeVerdict.multiplier * 100)}% strength
          </div>
        )}
      </div>

      {/* CHEM + ACTIONS HEADER */}
      <div className="card mb-5 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`text-display text-4xl ${chemistryColor(chem)}`}>{chem}</div>
          <div>
            <div className="text-mono uppercase text-[10px] tracking-widest text-white/40">Chemistry</div>
            <div className="text-white/65 text-xs">
              {xi ? `${exact}/11 exact · drag to reshuffle` : 'Auto-pick or drag players from reserves onto the pitch'}
            </div>
          </div>
        </div>
        <button onClick={autoPick} className="btn-ghost" type="button">✦ Auto-pick XI</button>
      </div>

      {/* MAIN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr_1fr] gap-4">
        {/* STARTING XI BENCH */}
        <aside className="card">
          <div className="text-mono uppercase text-[10px] tracking-widest text-pink-300 mb-3">
            Starting XI · {Object.keys(assignments).filter((k) => assignments[Number(k)]).length}/11
          </div>
          <ol className="space-y-1.5">
            {slots.map((slot, idx) => {
              const player = startingXI[idx];
              const aff = player ? positionAffinity(slot.position, player.position) : 0;
              return (
                <li key={idx}>
                  <BenchTile
                    slotPosition={slot.position}
                    player={player}
                    affinity={aff}
                    onDragStart={(e) => player && onDragStart(e, { playerId: player.id, fromSlot: idx })}
                  />
                </li>
              );
            })}
          </ol>
        </aside>

        {/* PITCH */}
        <div
          className="card relative"
          onDragOver={(e) => e.preventDefault()}
        >
          <div
            ref={pitchRef}
            className="relative w-full aspect-[3/4] bg-emerald-950/40 rounded-lg overflow-hidden border border-emerald-700/30 touch-none"
            onPointerMove={(e) => {
              if (moveIdx == null) return;
              const p = pctFromPointer(e);
              if (p) setMovePos(p);
            }}
            onPointerUp={(e) => {
              if (moveIdx == null) return;
              const p = pctFromPointer(e);
              if (p) useGameStore.getState().moveSlot(moveIdx, p.x, p.y);
              setMoveIdx(null);
              setMovePos(null);
            }}
          >
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <rect x="2" y="2" width="96" height="96" fill="none" stroke="rgba(20, 180, 140, 0.35)" strokeWidth="0.3" />
              <line x1="2" y1="50" x2="98" y2="50" stroke="rgba(20, 180, 140, 0.35)" strokeWidth="0.3" />
              <circle cx="50" cy="50" r="9" fill="none" stroke="rgba(20, 180, 140, 0.35)" strokeWidth="0.3" />
              <rect x="28" y="2"  width="44" height="14" fill="none" stroke="rgba(20, 180, 140, 0.35)" strokeWidth="0.3" />
              <rect x="28" y="84" width="44" height="14" fill="none" stroke="rgba(20, 180, 140, 0.35)" strokeWidth="0.3" />
            </svg>

            {slots.map((slot, idx) => {
              const player = startingXI[idx];
              const aff = player ? positionAffinity(slot.position, player.position) : 1;
              const isOver = overSlot === idx;
              const pos = moveIdx === idx && movePos ? movePos : { x: slot.x, y: slot.y };
              return (
                <div
                  key={idx}
                  className="absolute -translate-x-1/2 -translate-y-1/2"
                  style={{ left: `${pos.x}%`, top: `${pos.y}%`, zIndex: moveIdx === idx ? 10 : 1 }}
                  onDragOver={(e) => { e.preventDefault(); setOverSlot(idx); }}
                  onDragLeave={() => setOverSlot((cur) => (cur === idx ? null : cur))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setOverSlot(null);
                    const payload = readPayload(e);
                    if (payload) dropOnSlot(idx, payload);
                  }}
                >
                  <PitchSlot
                    slotPosition={slot.position}
                    player={player}
                    affinity={aff}
                    highlight={isOver}
                    onDragStart={(e) => player && onDragStart(e, { playerId: player.id, fromSlot: idx })}
                    canReposition={Boolean(xi)}
                    onGrabPosition={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setMoveIdx(idx);
                    }}
                  />
                </div>
              );
            })}
          </div>
          <p className="text-mono text-[10px] uppercase tracking-widest text-white/35 mt-3">
            Drag players to reshuffle · drag the ✥ handle to move a position anywhere · unconventional shapes cost strength
          </p>
        </div>

        {/* RESERVES */}
        <aside
          className={`card transition ${overReserves ? 'ring-2 ring-pink-400/50' : ''}`}
          onDragOver={(e) => { e.preventDefault(); setOverReserves(true); }}
          onDragLeave={() => setOverReserves(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOverReserves(false);
            const payload = readPayload(e);
            if (payload) dropOnReserves(payload);
          }}
        >
          <div className="text-mono uppercase text-[10px] tracking-widest text-amber-300 mb-3">
            Reserves · {reserves.length}
          </div>
          <ol className="space-y-1 max-h-[640px] overflow-y-auto pr-1">
            {reserves.map((p) => (
              <li key={p.id}>
                <ReserveTile
                  player={p}
                  onDragStart={(e) => onDragStart(e, { playerId: p.id, fromSlot: null })}
                />
              </li>
            ))}
            {reserves.length === 0 && (
              <li className="text-white/40 text-mono text-xs italic px-2 py-3">All squad members are in the XI.</li>
            )}
          </ol>
        </aside>
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────── tiles ── */

function BenchTile({
  slotPosition, player, affinity, onDragStart,
}: {
  slotPosition: Player['position'];
  player: Player | undefined;
  affinity: number;
  onDragStart: (e: React.DragEvent) => void;
}) {
  const empty = !player;
  return (
    <div
      draggable={!empty}
      onDragStart={onDragStart}
      className={`flex items-center gap-2 rounded border px-2 py-1.5 transition
        ${empty
          ? 'border-dashed border-white/15 bg-white/5 text-white/40'
          : 'border-white/10 bg-white/5 hover:border-pink-400/40 cursor-grab active:cursor-grabbing'
        }`}
    >
      <PositionBadge position={slotPosition} />
      <div className="flex-1 min-w-0">
        {empty ? (
          <div className="text-mono text-[11px] italic">— empty slot —</div>
        ) : (
          <>
            <div className="text-sm truncate">{player.name}</div>
            <div className="text-mono text-[10px] text-white/45 tracking-wider">
              <span className={affinityText(affinity)}>{player.position}</span> · {player.rating}
            </div>
          </>
        )}
      </div>
      {!empty ? <AffinityDot affinity={affinity} /> : null}
    </div>
  );
}

function PitchSlot({
  slotPosition, player, affinity, highlight, onDragStart, canReposition, onGrabPosition,
}: {
  slotPosition: Player['position'];
  player: Player | undefined;
  affinity: number;
  highlight: boolean;
  onDragStart: (e: React.DragEvent) => void;
  canReposition?: boolean;
  onGrabPosition?: (e: React.PointerEvent) => void;
}) {
  const empty = !player;
  const base = 'relative rounded-md px-2 py-1.5 text-center min-w-[96px] backdrop-blur-sm transition select-none';
  const filled = affinity === 1
    ? 'bg-emerald-500/30 border border-emerald-400/60'
    : affinity >= 0.6
      ? 'bg-amber-500/25 border border-amber-400/60'
      : affinity > 0
        ? 'bg-orange-500/25 border border-orange-400/60'
        : 'bg-rose-500/30 border border-rose-400/70';
  const emptyStyle = 'bg-emerald-900/40 border border-dashed border-emerald-700/60 text-emerald-300/80';
  const ring = highlight ? 'ring-2 ring-pink-300/70' : '';
  return (
    <div
      draggable={!empty}
      onDragStart={onDragStart}
      className={`${base} ${empty ? emptyStyle : filled} ${ring} ${empty ? '' : 'cursor-grab active:cursor-grabbing'}`}
    >
      {canReposition ? (
        <span
          className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-black/70 border border-white/30 text-white/80
            text-[10px] leading-[18px] cursor-move hover:border-[color:var(--color-accent-green)] hover:text-[color:var(--color-accent-green)]"
          title="Drag to move this position anywhere on the pitch"
          onPointerDown={onGrabPosition}
          draggable={false}
        >
          ✥
        </span>
      ) : null}
      <div className="text-[10px] font-bold tracking-wider uppercase">
        {slotPosition}
      </div>
      <div className="text-[11px] text-white truncate max-w-[120px]">
        {player?.name ?? <span className="opacity-60">—</span>}
      </div>
      {player ? (
        <div className="text-mono text-[9px] text-white/55 mt-0.5">
          {player.position} · {player.rating}
        </div>
      ) : null}
    </div>
  );
}

function TacticGauge({
  label, value, lowLabel, highLabel, hint,
}: { label: string; value: number; lowLabel: string; highLabel: string; hint: string }) {
  // value ∈ [-1, 1] → position on the gauge
  const pct = ((value + 1) / 2) * 100;
  return (
    <div title={hint} className="min-w-[200px]">
      <div className="flex justify-between text-mono text-[9px] uppercase tracking-widest text-white/40">
        <span>{lowLabel}</span>
        <span className="text-white/70">{label}</span>
        <span>{highLabel}</span>
      </div>
      <div className="relative h-1.5 rounded-full bg-white/10 mt-1">
        <span
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-[color:var(--color-accent-green)] shadow-[0_0_8px_rgba(38,247,168,0.7)]"
          style={{ left: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function ReserveTile({
  player, onDragStart,
}: { player: Player; onDragStart: (e: React.DragEvent) => void }) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="flex items-center gap-2 rounded border border-white/10 bg-white/5 px-2 py-1.5 hover:border-pink-400/40 cursor-grab active:cursor-grabbing"
    >
      <PositionBadge position={player.position} />
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate">{player.name}</div>
        <div className="text-mono text-[10px] text-white/45 tracking-wider">
          {player.position} · {player.rating}
          {player.isStar ? <span className="ml-1 text-pink-300">★</span> : null}
        </div>
      </div>
    </div>
  );
}

function AffinityDot({ affinity }: { affinity: number }) {
  const color =
    affinity === 1 ? 'bg-emerald-300' :
    affinity >= 0.6 ? 'bg-amber-300' :
    affinity > 0 ? 'bg-orange-300' :
    'bg-rose-300';
  return <span className={`w-2 h-2 rounded-full ${color}`} title={`Affinity ${(affinity * 100).toFixed(0)}%`} />;
}

function affinityText(affinity: number): string {
  if (affinity === 1) return 'text-emerald-300';
  if (affinity >= 0.6) return 'text-amber-300';
  if (affinity > 0) return 'text-orange-300';
  return 'text-rose-300';
}

function chemistryColor(c: number): string {
  if (c >= 80) return 'text-emerald-300';
  if (c >= 60) return 'text-cyan-300';
  if (c >= 40) return 'text-amber-300';
  return 'text-rose-300';
}
