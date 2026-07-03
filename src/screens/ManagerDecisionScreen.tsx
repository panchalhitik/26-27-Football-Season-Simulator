import { useState } from 'react';
import { AppShell, H1, SectionLabel } from '@/components/AppShell';
import { CLUBS_BY_ID, MANAGERS, MANAGERS_BY_ID } from '@/data';
import { useGameStore } from '@/store';
import type { Manager, ManagerId, ManagerStyle } from '@/types';

const STYLE_COLOR: Record<ManagerStyle, string> = {
  'pragmatic':  'text-amber-300',
  'possession': 'text-cyan-300',
  'high press': 'text-pink-300',
  'gegenpress': 'text-rose-300',
  'counter':    'text-violet-300',
};

export function ManagerDecisionScreen() {
  const clubId = useGameStore((s) => s.clubId);
  const managerId = useGameStore((s) => s.managerId);
  const budgetM = useGameStore((s) => s.budgetM);
  const keep = useGameStore((s) => s.keepManager);
  const replace = useGameStore((s) => s.replaceManager);
  const [previewId, setPreviewId] = useState<ManagerId | null>(null);

  if (!clubId || !managerId) return null;
  const club = CLUBS_BY_ID[clubId];
  const current = MANAGERS_BY_ID[managerId];
  if (!club || !current) return null;

  const candidates = MANAGERS.filter((m) => m.id !== current.id);
  const previewing = previewId ? MANAGERS_BY_ID[previewId] : null;
  const leftManager = previewing ?? current;
  const previewAffordable = !previewing || previewing.compensationFeeM <= budgetM;

  return (
    <AppShell>
      <SectionLabel>Step 2 · Managerial Decision</SectionLabel>
      <H1>Keep the manager, or hire someone new?</H1>
      <p className="text-white/55 mt-3">Your first major call. Every option has a real cost — and a real consequence.</p>

      <div className="grid lg:grid-cols-2 gap-6 mt-10">
        <ManagerCard
          manager={leftManager}
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

        {/* REPLACE LIST */}
        <article className="card">
          <div className="text-mono uppercase text-[10px] tracking-widest text-amber-300">Replace</div>
          <div className="text-white/55 text-xs mt-0.5">Pick a candidate to preview the deal.</div>

          <ul className="mt-4 divide-y divide-white/5">
            {candidates.map((m) => {
              const tooDear = m.compensationFeeM > budgetM;
              const isActive = previewId === m.id;
              return (
                <li key={m.id} className="py-2.5">
                  <button
                    onClick={() => setPreviewId(m.id)}
                    type="button"
                    disabled={tooDear}
                    aria-pressed={isActive}
                    className={`w-full flex items-center justify-between gap-4 px-2 py-1 rounded transition text-left
                      ${tooDear
                        ? 'opacity-40 cursor-not-allowed'
                        : isActive
                          ? 'bg-pink-500/15 ring-1 ring-pink-400/40'
                          : 'hover:bg-white/5'
                      }`}
                  >
                    <div>
                      <div className="text-display text-sm uppercase">
                        {m.name}{' '}
                        <span className="text-white/40 normal-case font-normal text-xs">({m.nationality})</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-mono text-[10px] uppercase tracking-widest ${STYLE_COLOR[m.style]}`}>
                        {m.style}
                      </span>
                      <span className={`text-mono text-sm ${m.compensationFeeM === 0 ? 'text-emerald-400' : 'text-amber-300'}`}>
                        {m.compensationFeeM === 0 ? 'Free' : `£${m.compensationFeeM}M`}
                      </span>
                    </div>
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

function ManagerCard({
  manager,
  mode,
  affordable,
  onConfirm,
  onBack,
  backToName,
}: {
  manager: Manager;
  mode: 'current' | 'preview';
  affordable: boolean;
  onConfirm: () => void;
  onBack?: () => void;
  backToName?: string;
}) {
  const isCurrent = mode === 'current';
  const labelTop = isCurrent ? 'Current manager' : 'Considering';
  const labelSub = isCurrent
    ? 'Recommended unless you have a clear plan'
    : 'Review the deal. Confirm to hire.';

  return (
    <article className="card relative">
      <span className="absolute left-0 top-4 bottom-4 w-1 bg-gradient-to-b from-pink-500 to-violet-500 rounded-r" />

      {onBack && backToName ? (
        <button
          type="button"
          onClick={onBack}
          className="group ml-3 mb-4 inline-flex items-center gap-2 rounded-md
            border border-pink-400/40 bg-pink-500/10 px-3 py-2
            text-pink-100 hover:bg-pink-500/20 hover:border-pink-400/70 transition"
        >
          <span aria-hidden className="text-pink-300 text-base leading-none transition group-hover:-translate-x-0.5">←</span>
          <span className="text-display text-sm uppercase tracking-wider">Back to {backToName}</span>
          <span className="text-pink-300/70 text-[11px] normal-case">(current)</span>
        </button>
      ) : null}

      <div className="text-mono uppercase text-[10px] tracking-widest text-pink-300 ml-3">{labelTop}</div>
      <div className="text-white/55 text-xs ml-3 mt-0.5">{labelSub}</div>

      <h2 className="text-display text-2xl uppercase mt-4 ml-3">{manager.name}</h2>
      <div className="text-white/65 text-sm ml-3 mt-1">
        {manager.nationality} · Age {manager.age} ·{' '}
        <span className="capitalize">{manager.style}</span>
      </div>
      {manager.description ? (
        <div className="text-white/55 text-[13px] italic ml-3 mt-2">"{manager.description}"</div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 mt-5 ml-3">
        <Mini
          label="Style"
          value={
            <span className={`capitalize ${STYLE_COLOR[manager.style]}`}>
              {manager.style}
            </span>
          }
        />
        <Mini label="Salary" value={`£${manager.salaryMPerYr}M/yr`} />
      </div>

      <div className="ml-3 mt-5 grid grid-cols-1 gap-3 text-sm">
        <Block title="PROS" color="text-emerald-400" items={manager.pros} sign="✓" />
        <Block title="CONS" color="text-rose-400" items={manager.cons} sign="✕" />
      </div>

      <div className="flex items-end justify-between mt-7 ml-3 gap-3">
        <div className="text-mono text-[11px] text-white/40">
          {isCurrent ? (
            <>
              If you sack later this season<br />
              <span className="text-[color:var(--color-accent-amber)]">Costs £8M</span>
            </>
          ) : manager.compensationFeeM === 0 ? (
            <>
              Free agent<br />
              <span className="text-[color:var(--color-accent-green)]">No compensation due</span>
            </>
          ) : (
            <>
              Compensation fee<br />
              <span className={affordable ? 'text-[color:var(--color-accent-amber)]' : 'text-rose-300'}>
                £{manager.compensationFeeM}M
                {!affordable && ' — over budget'}
              </span>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={onConfirm}
          disabled={!affordable}
          className="btn-primary text-sm"
        >
          {isCurrent ? 'Trust the Project' : 'Confirm hire'}
        </button>
      </div>
    </article>
  );
}

function Mini({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="bg-white/5 rounded px-3 py-2">
      <div className="text-mono text-[10px] uppercase tracking-widest text-white/40">{label}</div>
      <div className="text-display text-base mt-0.5">{value}</div>
    </div>
  );
}

function Block({ title, color, items, sign }: { title: string; color: string; items: string[]; sign: string }) {
  return (
    <div>
      <div className={`text-mono uppercase text-[10px] tracking-widest ${color}`}>{title}</div>
      <ul className="mt-1 space-y-1">
        {items.map((i) => (
          <li key={i} className="flex gap-2 text-white/80">
            <span className={color}>{sign}</span>
            <span>{i}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
