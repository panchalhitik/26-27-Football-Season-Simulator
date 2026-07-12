import { AppShell } from '@/components/AppShell';
import { ClubCrest } from '@/components/ClubCrest';
import { CLUBS_BY_ID } from '@/data';
import { useGameStore } from '@/store';
import { BUDGET_MAX_M, BUDGET_MIN_M, BUDGET_STEP_M, budgetTier } from '@/types';
import type { BoardObjective, BudgetTier } from '@/types';

const TIER_STYLE: Record<BudgetTier, { text: string; tag: string }> = {
  Bankrupt:    { text: 'text-rose-300',    tag: 'On the brink — the wage bill alone will sink you.' },
  Strict:      { text: 'text-amber-300',   tag: 'Tight ship — every signing is a make-or-break call.' },
  Decent:      { text: 'text-emerald-300', tag: 'Reasonable kitty — enough to shape the squad.' },
  Good:        { text: 'text-cyan-300',    tag: 'Strong hand — top-end signings are on the table.' },
  'Oil Money': { text: 'text-fuchsia-300', tag: 'No limits — buy the squad you want.' },
  Tycoon:      { text: 'text-pink-300',    tag: 'Galáctico mode — write the rules of the window.' },
};

const OBJECTIVE_ICON: Record<BoardObjective['kind'], string> = {
  PL: '🏟',
  UCL: '⭐',
  'FA Cup': '🏆',
  EFL: '🥈',
};

export function BoardroomScreen() {
  const clubId = useGameStore((s) => s.clubId);
  const budgetM = useGameStore((s) => s.budgetM);
  const wageRoomK = useGameStore((s) => s.wageRoomK);
  const sd = useGameStore((s) => s.sportingDirectorName);
  const setBudget = useGameStore((s) => s.setBudget);
  const goTo = useGameStore((s) => s.goTo);

  if (!clubId) return null;
  const club = CLUBS_BY_ID[clubId];
  if (!club) return null;

  const tier = budgetTier(budgetM);
  const tierStyle = TIER_STYLE[tier];
  const defaultBudget = club.startingBudgetM;
  const defaultPct = ((defaultBudget - BUDGET_MIN_M) / (BUDGET_MAX_M - BUDGET_MIN_M)) * 100;

  return (
    <AppShell>
      {/* ── HEADER ─────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="text-mono uppercase text-[11px] tracking-[0.3em] text-white/45">
            Boardroom <span className="text-white/25">|</span> Day 1
          </div>
          <h1 className="text-broadcast text-5xl md:text-7xl text-white mt-2 drop-shadow-[0_4px_20px_rgba(0,0,0,0.7)]">
            {club.name}
          </h1>
          <p className="text-display text-[color:var(--color-accent-pink)] mt-2 text-lg">
            &ldquo;{club.storyline.replace(/^["'“]+|["'”]+$/g, '')}&rdquo;
          </p>
        </div>
        <div className="hidden sm:block flex-shrink-0">
          <ClubCrest club={club} size={92} />
        </div>
      </div>

      {/* ── BOARD LETTER ───────────────────────────────── */}
      <div className="card mt-7 border-[color:var(--color-accent-pink)]/40 shadow-[0_0_28px_rgba(255,46,166,0.15)]">
        <div className="text-mono uppercase text-[10px] tracking-widest text-[color:var(--color-accent-pink)] mb-2">
          [The board, to you, {sd || 'Sporting Director'}]
        </div>
        <p className="text-white/85 leading-relaxed text-[15px]">{club.boardLetter}</p>
      </div>

      {/* ── BUDGET + WAGES ─────────────────────────────── */}
      <div className="grid sm:grid-cols-2 gap-5 mt-5">
        <div className="card">
          <div className="text-mono uppercase text-[10px] tracking-widest text-[color:var(--color-accent-green)]">
            Transfer budget
          </div>
          <div className="flex items-baseline flex-wrap gap-x-3 gap-y-1 mt-1">
            <div className="text-broadcast text-4xl text-[color:var(--color-accent-green)]">
              £{Math.round(budgetM)}M
            </div>
            <div className={`pill border border-current ${tierStyle.text}`}>{tier}</div>
            {budgetM === defaultBudget ? (
              <div className="pill bg-white/10 text-white/70 border border-white/15">default</div>
            ) : null}
          </div>

          <div className="mt-5">
            <div className="relative h-1">
              <div
                aria-hidden
                className="absolute top-[-4px] w-0.5 h-3.5 bg-white/50"
                style={{ left: `calc(${defaultPct}% - 1px)` }}
                title={`Default: £${defaultBudget}M`}
              />
            </div>
            <input
              type="range"
              min={BUDGET_MIN_M}
              max={BUDGET_MAX_M}
              step={BUDGET_STEP_M}
              value={budgetM}
              onChange={(e) => setBudget(Number(e.target.value))}
              aria-label="Transfer budget"
              className="range-budget"
            />
            <div className="flex justify-between text-mono text-[10px] text-white/40 mt-2">
              <span>£{BUDGET_MIN_M}M</span>
              <span>│ default £{defaultBudget}M</span>
              <span>£{BUDGET_MAX_M}M</span>
            </div>
          </div>

          <div className="text-mono text-[11px] text-white/55 mt-3">{tierStyle.tag}</div>
        </div>

        <div className="card relative overflow-hidden">
          <div className="text-mono uppercase text-[10px] tracking-widest text-[color:var(--color-accent-cyan)]">
            Wage room
          </div>
          <div className="text-broadcast text-4xl text-[color:var(--color-accent-cyan)] mt-1">
            £{wageRoomK}k/wk
          </div>
          <div className="text-mono text-[11px] text-white/45 mt-3">Locked by the club's wage cap.</div>
          <span
            aria-hidden
            className="absolute right-5 bottom-3 text-5xl opacity-30 select-none"
            style={{ filter: 'drop-shadow(0 0 10px rgba(34,217,238,0.8))' }}
          >
            🔒
          </span>
        </div>
      </div>

      {/* ── OBJECTIVES ─────────────────────────────────── */}
      <div className="card mt-5">
        <div className="text-mono uppercase text-[10px] tracking-widest text-[color:var(--color-accent-green)] mb-2">
          Board objectives
        </div>
        <ul className="divide-y divide-white/5">
          {club.objectives.map((o) => (
            <li key={o.label} className="flex items-center justify-between py-2.5 text-sm">
              <span className="flex items-center gap-3 text-white">
                <span aria-hidden className="text-base">{OBJECTIVE_ICON[o.kind] ?? '⚽'}</span>
                {o.label}
              </span>
              <span className="text-mono text-[12px] text-[color:var(--color-accent-amber)]">
                {o.kind === 'PL' ? `Top ${o.targetPosition}` : o.targetRound}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex justify-center mt-8">
        <button className="btn-primary" onClick={() => goTo('manager-decision')} type="button">
          Address the Manager →
        </button>
      </div>
    </AppShell>
  );
}
