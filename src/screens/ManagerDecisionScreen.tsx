import { useMemo, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { CLUBS_BY_ID, MANAGERS, MANAGERS_BY_ID } from '@/data';
import { computeManagerRatings } from '@/engine/manager';
import { useGameStore } from '@/store';
import type { Manager, ManagerId, ManagerStyle } from '@/types';

const STYLE_CHIP: Record<ManagerStyle, string> = {
  'pragmatic':  'bg-amber-500/20 text-amber-300 border-amber-400/40',
  'possession': 'bg-cyan-500/20 text-cyan-300 border-cyan-400/40',
  'high press': 'bg-pink-500/20 text-pink-300 border-pink-400/40',
  'gegenpress': 'bg-rose-500/20 text-rose-300 border-rose-400/40',
  'counter':    'bg-violet-500/20 text-violet-300 border-violet-400/40',
};

export function ManagerDecisionScreen() {
  const clubId = useGameStore((s) => s.clubId);
  const managerId = useGameStore((s) => s.managerId);
  const budgetM = useGameStore((s) => s.budgetM);
  const keep = useGameStore((s) => s.keepManager);
  const replace = useGameStore((s) => s.replaceManager);
  const [previewId, setPreviewId] = useState<ManagerId | null>(null);

  const morById = useMemo(() => computeManagerRatings(MANAGERS).byId, []);

  if (!clubId || !managerId) return null;
  const club = CLUBS_BY_ID[clubId];
  const current = MANAGERS_BY_ID[managerId];
  if (!club || !current) return null;

  const candidates = MANAGERS.filter((m) => m.id !== current.id)
    .slice()
    .sort((a, b) => (morById[b.id]?.mor ?? 0) - (morById[a.id]?.mor ?? 0));
  const previewing = previewId ? MANAGERS_BY_ID[previewId] : null;
  const leftManager = previewing ?? current;
  const previewAffordable = !previewing || previewing.compensationFeeM <= budgetM;

  return (
    <AppShell>
      <div className="text-mono uppercase text-[11px] tracking-[0.3em] text-white/45">
        Boardroom <span className="text-white/25">|</span> Day 2 · Managerial decision
      </div>
      <h1 className="text-broadcast text-4xl md:text-6xl text-white mt-2">
        Keep him, or swing the axe?
      </h1>
      <p className="text-white/55 mt-3">
        Your first major call. The dugout rating feeds every single matchday — choose like it matters.
      </p>

      <div className="grid lg:grid-cols-2 gap-6 mt-8">
        {/* ── MANAGER CARD ─────────────────────────────── */}
        <ManagerCard
          manager={leftManager}
          mor={morById[leftManager.id]?.mor ?? 50}
          mode={previewing ? 'preview' : 'current'}
          affordable={previewAffordable}
          onConfirm={() => {
            if (previewing) replace(previewing.id);
            else keep();
          }}
          {...(previewing
            ? { onBack: () => setPreviewId(null), backToName: current.name }
            : {})}
        />

        {/* ── CANDIDATE MARKET ─────────────────────────── */}
        <article className="card">
          <div className="text-broadcast text-base text-white">The market</div>
          <div className="text-white/50 text-xs mt-0.5 mb-4">
            Ranked by dugout rating. Pick a candidate to preview the deal.
          </div>

          <ul className="divide-y divide-white/5">
            {candidates.map((m) => {
              const tooDear = m.compensationFeeM > budgetM;
              const isActive = previewId === m.id;
              const mor = Math.round(morById[m.id]?.mor ?? 50);
              return (
                <li key={m.id}>
                  <button
                    onClick={() => setPreviewId(m.id)}
                    type="button"
                    disabled={tooDear}
                    aria-pressed={isActive}
                    className={`w-full flex items-center gap-3 px-2 py-2.5 rounded transition text-left
                      ${tooDear
                        ? 'opacity-40 cursor-not-allowed'
                        : isActive
                          ? 'bg-pink-500/15 ring-1 ring-pink-400/50'
                          : 'hover:bg-white/5'
                      }`}
                  >
                    <span className={`text-broadcast text-lg w-9 text-center ${morTone(mor)}`}>{mor}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold truncate">{m.name}</span>
                      <span className="block text-mono text-[10px] text-white/40 uppercase tracking-wider">
                        {m.nationality} · Age {m.age}
                      </span>
                    </span>
                    <span className={`pill border text-[9px] ${STYLE_CHIP[m.style]}`}>{m.style}</span>
                    <span className={`text-mono text-sm w-14 text-right ${m.compensationFeeM === 0 ? 'text-emerald-400' : 'text-[color:var(--color-accent-amber)]'}`}>
                      {m.compensationFeeM === 0 ? 'Free' : `£${m.compensationFeeM}M`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </article>
      </div>
    </AppShell>
  );
}

/* ─────────────────────────────────────────── manager card ─── */

function ManagerCard({
  manager, mor, mode, affordable, onConfirm, onBack, backToName,
}: {
  manager: Manager;
  mor: number;
  mode: 'current' | 'preview';
  affordable: boolean;
  onConfirm: () => void;
  onBack?: () => void;
  backToName?: string;
}) {
  const isCurrent = mode === 'current';
  return (
    <article className="relative rounded-2xl overflow-hidden border border-white/15 bg-[color:var(--color-bg-card)] shadow-[0_24px_60px_rgba(0,0,0,0.55)]">
      {/* card top band */}
      <div className="flex items-center justify-between px-5 py-4 bg-gradient-to-r from-[#ff2ea6]/25 via-transparent to-transparent border-b border-white/10">
        <div>
          <div className="text-mono uppercase text-[10px] tracking-widest text-[color:var(--color-accent-pink)]">
            {isCurrent ? 'Current manager' : 'Considering'}
          </div>
          <h2 className="text-broadcast text-2xl text-white mt-1">{manager.name}</h2>
          <div className="text-mono text-[11px] text-white/50 mt-1 uppercase tracking-wider">
            {manager.nationality} · Age {manager.age}
          </div>
        </div>
        <div className="text-center">
          <div className={`text-broadcast text-5xl ${morTone(Math.round(mor))}`}>{Math.round(mor)}</div>
          <div className="text-mono text-[9px] uppercase tracking-widest text-white/40">Dugout OVR</div>
        </div>
      </div>

      <div className="p-5">
        {onBack && backToName ? (
          <button
            type="button"
            onClick={onBack}
            className="mb-4 inline-flex items-center gap-2 rounded-md border border-pink-400/40 bg-pink-500/10 px-3 py-1.5
              text-pink-100 hover:bg-pink-500/20 transition text-sm"
          >
            ← Back to {backToName} <span className="text-pink-300/70 text-[11px]">(current)</span>
          </button>
        ) : null}

        <div className="flex items-center gap-2 flex-wrap">
          <span className={`pill border ${STYLE_CHIP[manager.style]}`}>{manager.style}</span>
          <span className="pill border border-white/15 bg-white/5 text-white/70">
            £{manager.salaryMPerYr}M/yr
          </span>
        </div>

        {manager.description ? (
          <p className="text-white/55 text-[13px] italic mt-3">&ldquo;{manager.description}&rdquo;</p>
        ) : null}

        {/* stat bars — the modifiers that actually hit the match engine */}
        <div className="mt-5 space-y-3">
          <ModBar label="Attack boost" value={manager.attackMod} />
          <ModBar label="Defense boost" value={manager.defenseMod} />
        </div>

        <div className="grid grid-cols-2 gap-4 mt-5 text-sm">
          <div>
            <div className="text-mono uppercase text-[10px] tracking-widest text-emerald-400 mb-1">Pros</div>
            <ul className="space-y-1">
              {manager.pros.map((i) => (
                <li key={i} className="flex gap-2 text-white/80 text-[13px]">
                  <span className="text-emerald-400">✓</span>{i}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-mono uppercase text-[10px] tracking-widest text-rose-400 mb-1">Cons</div>
            <ul className="space-y-1">
              {manager.cons.map((i) => (
                <li key={i} className="flex gap-2 text-white/80 text-[13px]">
                  <span className="text-rose-400">✕</span>{i}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex items-end justify-between mt-6 gap-3 pt-4 border-t border-white/10">
          <div className="text-mono text-[11px] text-white/40">
            {isCurrent ? (
              <>Sack later this season<br /><span className="text-[color:var(--color-accent-amber)]">Costs £8M</span></>
            ) : manager.compensationFeeM === 0 ? (
              <>Free agent<br /><span className="text-[color:var(--color-accent-green)]">No compensation due</span></>
            ) : (
              <>Compensation fee<br />
                <span className={affordable ? 'text-[color:var(--color-accent-amber)]' : 'text-rose-300'}>
                  £{manager.compensationFeeM}M{!affordable && ' — over budget'}
                </span>
              </>
            )}
          </div>
          <button type="button" onClick={onConfirm} disabled={!affordable} className="btn-primary text-sm">
            {isCurrent ? 'Trust the Project' : 'Confirm Hire'}
          </button>
        </div>
      </div>
    </article>
  );
}

/** ±5 modifier rendered as a bar growing from centre. */
function ModBar({ label, value }: { label: string; value: number }) {
  const pct = (Math.abs(value) / 5) * 50;
  const positive = value >= 0;
  return (
    <div>
      <div className="flex justify-between text-mono text-[10px] uppercase tracking-widest">
        <span className="text-white/50">{label}</span>
        <span className={positive ? 'text-[color:var(--color-accent-green)]' : 'text-rose-300'}>
          {value > 0 ? `+${value}` : value}
        </span>
      </div>
      <div className="mod-bar mt-1">
        <i aria-hidden className="left-1/2 w-px bg-white/30" />
        <i
          style={{
            [positive ? 'left' : 'right']: '50%',
            width: `${pct}%`,
            background: positive
              ? 'linear-gradient(90deg, #2fe28e, #6ceec0)'
              : 'linear-gradient(90deg, #ff5e62, #ff2ea6)',
          }}
        />
      </div>
    </div>
  );
}

function morTone(mor: number): string {
  if (mor >= 75) return 'text-[color:var(--color-accent-green)]';
  if (mor >= 55) return 'text-[color:var(--color-accent-amber)]';
  return 'text-rose-300';
}
