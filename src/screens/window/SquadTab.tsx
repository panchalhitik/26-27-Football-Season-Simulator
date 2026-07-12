import { useMemo } from 'react';
import { useGameStore } from '@/store';
import { CLUBS_BY_ID, PLAYERS_BY_ID } from '@/data';
import { PositionBadge } from '@/components/PositionBadge';
import type { Player, Position, PositionGroup } from '@/types';

const GROUP_ORDER: PositionGroup[] = ['GK', 'DEF', 'MID', 'FWD'];
/** Below these counts a department is flagged THIN on the dugout board. */
const GROUP_MIN: Record<PositionGroup, number> = { GK: 2, DEF: 6, MID: 6, FWD: 4 };

/**
 * How many bodies a healthy squad wants per position. LM/RM are optional in
 * modern squads (0 = only shown when someone actually plays there).
 */
const POSITION_IDEAL: { pos: Position; ideal: number }[] = [
  { pos: 'GK', ideal: 2 },
  { pos: 'CB', ideal: 4 },
  { pos: 'LB', ideal: 2 },
  { pos: 'RB', ideal: 2 },
  { pos: 'CDM', ideal: 2 },
  { pos: 'CM', ideal: 3 },
  { pos: 'CAM', ideal: 1 },
  { pos: 'LM', ideal: 0 },
  { pos: 'RM', ideal: 0 },
  { pos: 'LW', ideal: 2 },
  { pos: 'RW', ideal: 2 },
  { pos: 'ST', ideal: 2 },
];

export function SquadTab() {
  const squadIds = useGameStore((s) => s.squadIds);
  const sellPlayer = useGameStore((s) => s.sellPlayer);
  const budgetM = useGameStore((s) => s.budgetM);
  const wageRoomK = useGameStore((s) => s.wageRoomK);
  const clubId = useGameStore((s) => s.clubId);
  const signings = useGameStore((s) => s.signings);
  const sales = useGameStore((s) => s.sales);

  const grouped = useMemo(() => {
    const m: Record<PositionGroup, Player[]> = { GK: [], DEF: [], MID: [], FWD: [] };
    for (const id of squadIds) {
      const p = PLAYERS_BY_ID[id];
      if (p) m[p.group].push(p);
    }
    for (const g of GROUP_ORDER) m[g].sort((a, b) => b.rating - a.rating);
    return m;
  }, [squadIds]);

  const club = clubId ? CLUBS_BY_ID[clubId] : null;
  const startingBudget = club?.startingBudgetM ?? budgetM;
  const spentM = signings.reduce((s, r) => s + r.feeM, 0);
  const raisedM = sales.reduce((s, r) => s + r.receivedM, 0);

  const totalWageK = useMemo(
    () => squadIds.reduce((s, id) => s + (PLAYERS_BY_ID[id]?.wageK ?? 0), 0),
    [squadIds],
  );
  const wageCapacityK = totalWageK + wageRoomK;
  const wageUsedPct = wageCapacityK > 0 ? Math.round((totalWageK / wageCapacityK) * 100) : 0;

  const thinGroups = GROUP_ORDER.filter((g) => grouped[g].length < GROUP_MIN[g]);

  // Per-position depth: how many bodies + how good they are.
  const depthByPos = useMemo(() => {
    const players = squadIds
      .map((id) => PLAYERS_BY_ID[id])
      .filter((p): p is Player => Boolean(p));
    return POSITION_IDEAL
      .map(({ pos, ideal }) => {
        const here = players.filter((p) => p.position === pos);
        const avg = here.length
          ? Math.round(here.reduce((s, p) => s + p.rating, 0) / here.length)
          : 0;
        return { pos, ideal, count: here.length, avg };
      })
      .filter((d) => d.ideal > 0 || d.count > 0);
  }, [squadIds]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
      {/* ── DUGOUT BOARD ─────────────────────────────────── */}
      <div>
        <div className="flex items-baseline justify-between mb-4">
          <div className="text-mono uppercase text-[10px] tracking-widest text-white/40">Dugout board</div>
          <div className="text-mono text-[10px] text-white/35 uppercase tracking-widest hidden md:block">
            Age · Value | Wage · Quick action
          </div>
        </div>

        {GROUP_ORDER.map((g) => (
          <section key={g} className="mb-6">
            <h2 className="flex items-center gap-2 mb-2">
              <span className="text-broadcast text-sm text-white">
                {g} [{grouped[g].length}]
              </span>
              {grouped[g].length < GROUP_MIN[g]
                ? <span className="chip-thin">Thin</span>
                : <span className="chip-ok">OK</span>}
            </h2>
            <ul className="divide-y divide-white/5 rounded-lg overflow-hidden border border-white/10 bg-black/25">
              {grouped[g].map((p) => (
                <SquadRow key={p.id} player={p} onSell={() => sellPlayer(p.id)} />
              ))}
              {grouped[g].length === 0 && (
                <li className="px-3 py-3 text-white/35 text-mono text-xs italic">
                  Nobody on the books.
                </li>
              )}
            </ul>
          </section>
        ))}
      </div>

      {/* ── WINDOW PLAN sidebar ──────────────────────────── */}
      <aside className="lg:sticky lg:top-6 self-start space-y-4">
        <div className="text-broadcast text-base text-white">Window plan</div>

        <div className="card p-4">
          <div className="text-mono uppercase text-[10px] tracking-widest text-white/45 mb-2">
            Net spend tracker
          </div>
          <div className="h-2.5 rounded-full bg-white/10 overflow-hidden flex">
            <div
              className="h-full bg-gradient-to-r from-[#ff2ea6] to-[#ff4d7d]"
              style={{ width: `${Math.min(100, Math.round((spentM / Math.max(1, startingBudget + raisedM)) * 100))}%` }}
            />
            <div
              className="h-full bg-gradient-to-r from-[#2fe28e] to-[#6ceec0]"
              style={{ width: `${Math.min(100, Math.round((budgetM / Math.max(1, startingBudget + raisedM)) * 100))}%` }}
            />
          </div>
          <div className="text-mono text-[10px] uppercase tracking-wider mt-2">
            <span className="text-[color:var(--color-accent-pink)]">Spent: £{Math.round(spentM)}M</span>
            <span className="text-white/35"> | </span>
            <span className="text-[color:var(--color-accent-green)]">Remaining: £{Math.round(budgetM)}M</span>
          </div>
          {raisedM > 0 && (
            <div className="text-mono text-[10px] uppercase tracking-wider text-white/45 mt-1">
              Raised from sales: £{Math.round(raisedM)}M
            </div>
          )}
        </div>

        <div className="card p-4">
          <div className="text-mono uppercase text-[10px] tracking-widest text-white/45 mb-3">
            Wage headroom
          </div>
          <div className="flex items-center justify-center">
            <WageGauge pct={wageUsedPct} />
          </div>
          <div className="text-mono text-[10px] uppercase tracking-wider text-white/45 text-center mt-2">
            Used | <span className="text-white">£{wageRoomK}k/wk room</span>
          </div>
        </div>

        <div className="card p-4">
          <div className="text-mono uppercase text-[10px] tracking-widest text-white/45 mb-1">
            Squad depth
          </div>
          <div className="text-mono text-[9px] uppercase tracking-wider text-white/30 mb-3">
            Blocks = players · colour = quality
          </div>
          <ul className="space-y-1.5">
            {depthByPos.map((d) => (
              <DepthRow key={d.pos} {...d} />
            ))}
          </ul>
          <div className="flex gap-3 mt-3 pt-2 border-t border-white/10 text-mono text-[9px] uppercase tracking-wider">
            <span><i className="inline-block w-2 h-2 rounded-[2px] align-middle mr-1" style={{ background: '#2fe28e' }} />83+</span>
            <span><i className="inline-block w-2 h-2 rounded-[2px] align-middle mr-1" style={{ background: '#ffd200' }} />77-82</span>
            <span><i className="inline-block w-2 h-2 rounded-[2px] align-middle mr-1" style={{ background: '#ff5e62' }} />&lt;77</span>
          </div>
        </div>

        {thinGroups.length > 0 && (
          <div className="card p-4 border-rose-400/40">
            <div className="text-mono uppercase text-[10px] tracking-widest text-rose-300 mb-2">
              Board notes
            </div>
            <ul className="space-y-1.5">
              {thinGroups.map((g) => (
                <li key={g} className="text-[12px] text-white/80">
                  ⚠ {g} looks thin — {grouped[g].length} in squad, want {GROUP_MIN[g]}+
                </li>
              ))}
            </ul>
          </div>
        )}
      </aside>
    </div>
  );
}

function SquadRow({ player, onSell }: { player: Player; onSell: () => void }) {
  return (
    <li className="flex items-center gap-3 px-3 py-2 hover:bg-white/5 transition group">
      <PositionBadge position={player.position} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold truncate">
          {player.name}
          {player.isStar ? <span className="text-[color:var(--color-accent-pink)] ml-1">★</span> : null}
        </div>
      </div>
      <div className="text-mono text-[11px] text-white/45 w-8 text-right hidden sm:block">{player.age}</div>
      <div className="text-mono text-[11px] text-white/65 w-32 text-right hidden md:block">
        £{player.marketValueM}M <span className="text-white/30">|</span> £{player.wageK}k/wk
      </div>
      <div className="text-mono text-[12px] w-10 text-right text-[color:var(--color-accent-amber)]">
        {player.rating}
      </div>
      <button
        type="button"
        onClick={onSell}
        className="btn-sell text-[10px] px-3 py-1 opacity-0 group-hover:opacity-100 focus:opacity-100 transition"
      >
        Sell
      </button>
    </li>
  );
}

/**
 * One position line on the depth meter: filled blocks per player (colour =
 * avg rating band), hollow blocks for missing bodies vs the ideal count.
 */
function DepthRow({ pos, ideal, count, avg }: { pos: Position; ideal: number; count: number; avg: number }) {
  const color = avg >= 83 ? '#2fe28e' : avg >= 77 ? '#ffd200' : '#ff5e62';
  const slots = Math.max(ideal, count);
  const short = count < ideal;
  return (
    <li className="flex items-center gap-2">
      <span className="text-mono text-[10px] uppercase tracking-wider text-white/60 w-9">{pos}</span>
      <span className="flex gap-[3px] flex-1">
        {Array.from({ length: slots }, (_, i) => (
          <i
            key={i}
            className="h-2.5 rounded-[2px]"
            style={{
              width: `${Math.max(10, Math.floor(100 / Math.max(slots, 4)))}%`,
              maxWidth: '22px',
              background: i < count ? color : 'transparent',
              border: i < count ? 'none' : '1px dashed rgba(255,255,255,0.25)',
            }}
          />
        ))}
      </span>
      <span className={`text-mono text-[10px] w-7 text-right ${count === 0 ? 'text-rose-300' : 'text-white/70'}`}>
        {count}
      </span>
      <span className="text-mono text-[10px] w-8 text-right" style={{ color: count ? color : 'rgba(255,255,255,0.3)' }}>
        {count ? avg : '—'}
      </span>
      <span className={`text-mono text-[8px] uppercase w-10 text-right ${short ? 'text-rose-300' : 'text-white/25'}`}>
        {count === 0 ? 'None' : short ? 'Short' : 'OK'}
      </span>
    </li>
  );
}

/** Semicircle wage gauge, FIFA career-mode style. */
function WageGauge({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  const angle = (clamped / 100) * 180;
  const rad = ((180 - angle) * Math.PI) / 180;
  const x = 50 + 40 * Math.cos(rad);
  const y = 50 - 40 * Math.sin(rad);
  const large = angle > 180 ? 1 : 0;
  const color = clamped >= 90 ? '#ff3b3b' : clamped >= 70 ? '#ffd200' : '#2fe28e';
  return (
    <svg viewBox="0 0 100 58" className="w-36">
      <path d="M 10 50 A 40 40 0 0 1 90 50" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="9" strokeLinecap="round" />
      <path
        d={`M 10 50 A 40 40 0 ${large} 1 ${x.toFixed(1)} ${y.toFixed(1)}`}
        fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
      />
      <text x="50" y="48" textAnchor="middle" fontSize="17" fill="white" fontFamily="'Archivo Black', sans-serif">
        {clamped}%
      </text>
    </svg>
  );
}
