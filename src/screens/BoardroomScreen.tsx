import { AppShell, H1, SectionLabel } from '@/components/AppShell';
import { CLUBS_BY_ID } from '@/data';
import { useGameStore } from '@/store';
import { BUDGET_MAX_M, BUDGET_MIN_M, BUDGET_STEP_M, budgetTier } from '@/types';
import type { BudgetTier } from '@/types';

const TIER_STYLE: Record<BudgetTier, { text: string; ring: string; tag: string }> = {
  Bankrupt:    { text: 'text-rose-300',    ring: 'border-rose-400/50',    tag: 'On the brink — the wage bill alone will sink you.' },
  Strict:      { text: 'text-amber-300',   ring: 'border-amber-400/50',   tag: 'Tight ship — every signing is a make-or-break call.' },
  Decent:      { text: 'text-emerald-300', ring: 'border-emerald-400/50', tag: 'Reasonable kitty — enough to shape the squad.' },
  Good:        { text: 'text-cyan-300',    ring: 'border-cyan-400/50',    tag: 'Strong hand — top-end signings are on the table.' },
  'Oil Money': { text: 'text-fuchsia-300', ring: 'border-fuchsia-400/50', tag: 'No limits — buy the squad you want.' },
  Tycoon:      { text: 'text-pink-300',    ring: 'border-pink-400/50',    tag: 'Galáctico mode — write the rules of the window.' },
};

export function BoardroomScreen() {
  const clubId = useGameStore((s) => s.clubId);
  const budgetM = useGameStore((s) => s.budgetM);
  const wageRoomK = useGameStore((s) => s.wageRoomK);
  const setBudget = useGameStore((s) => s.setBudget);
  const goTo = useGameStore((s) => s.goTo);

  if (!clubId) return null;
  const club = CLUBS_BY_ID[clubId];
  if (!club) return null;

  const tier = budgetTier(budgetM);
  const tierStyle = TIER_STYLE[tier];
  const defaultBudget = club.startingBudgetM;
  const isDefault = budgetM === defaultBudget;
  const defaultPct = ((defaultBudget - BUDGET_MIN_M) / (BUDGET_MAX_M - BUDGET_MIN_M)) * 100;

  return (
    <AppShell>
      <SectionLabel>Boardroom · Day 1</SectionLabel>
      <H1>{club.name}</H1>
      <p className="text-display text-white/65 mt-2 text-lg">{club.storyline}</p>

      <div className="card mt-8">
        <div className="text-mono uppercase text-[10px] tracking-widest text-white/40 mb-2">The board, to you, {sportingDirGreeting()}</div>
        <p className="text-white/80 leading-relaxed text-[15px]">{club.boardLetter}</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-5 mt-5">
        <div className="card">
          <div className="text-mono uppercase text-[10px] tracking-widest text-white/40">Transfer Budget</div>
          <div className="flex items-baseline flex-wrap gap-x-3 gap-y-1 mt-1">
            <div className="text-display text-3xl text-[color:var(--color-accent-pink)]">£{Math.round(budgetM)}M</div>
            <div className={`pill border ${tierStyle.ring} ${tierStyle.text}`}>
              {tier}
            </div>
            {isDefault ? (
              <div className="pill bg-white/10 text-white/70 border border-white/15">default</div>
            ) : null}
          </div>

          <div className="mt-4">
            <div className="relative h-1">
              {/* Tick marker for the club's default budget */}
              <div
                aria-hidden
                className="absolute top-[-6px] w-0.5 h-3 bg-white/40"
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
              className="w-full accent-pink-400"
            />
            <div className="flex justify-between text-mono text-[10px] text-white/40 mt-1">
              <span>£{BUDGET_MIN_M}M</span>
              <span>default £{defaultBudget}M</span>
              <span>£{BUDGET_MAX_M}M</span>
            </div>
          </div>

          <div className="text-mono text-[11px] text-white/55 mt-3">{tierStyle.tag}</div>
        </div>

        <div className="card">
          <div className="text-mono uppercase text-[10px] tracking-widest text-white/40">Wage Room</div>
          <div className="text-display text-3xl text-[color:var(--color-accent-cyan)] mt-1">£{wageRoomK}k/wk</div>
          <div className="text-mono text-[11px] text-white/45 mt-3">Locked by the club's wage cap.</div>
        </div>
      </div>

      <div className="card mt-5">
        <div className="text-mono uppercase text-[10px] tracking-widest text-white/40 mb-3">Board Objectives</div>
        <ul className="divide-y divide-white/5">
          {club.objectives.map((o) => (
            <li key={o.label} className="flex items-center justify-between py-2 text-sm">
              <span className="text-white">{o.label}</span>
              <span className="text-white/70 text-mono text-[12px]">
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

function sportingDirGreeting() {
  const n = useGameStore.getState().sportingDirectorName;
  return n ? n : 'Sporting Director';
}
