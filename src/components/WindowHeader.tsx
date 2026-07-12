import { CLUBS_BY_ID, MANAGERS_BY_ID } from '@/data';
import { useGameStore } from '@/store';

export function WindowHeader({
  onStartSeason,
  ctaLabel = 'Start Season →',
  windowLabel = 'Summer Window',
}: {
  onStartSeason?: () => void;
  ctaLabel?: string;
  windowLabel?: string;
}) {
  const { clubId, managerId, budgetM, wageRoomK, squadIds } = useGameStore();
  if (!clubId) return null;
  const club = CLUBS_BY_ID[clubId];
  const manager = managerId ? MANAGERS_BY_ID[managerId] : null;
  if (!club || !manager) return null;

  return (
    <header className="rounded-xl overflow-hidden border border-white/10 bg-black/50 mb-6">
      <div className="flex items-stretch">
        {/* club color spine */}
        <span
          aria-hidden
          className="w-2 flex-shrink-0"
          style={{ background: `linear-gradient(180deg, ${club.primaryColor}, ${club.secondaryColor})` }}
        />
        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-3 px-5 py-4 flex-1">
          <div>
            <h1 className="text-broadcast text-2xl text-white">{club.name}</h1>
            <div className="text-mono text-[10px] text-white/45 tracking-widest uppercase mt-1">
              {manager.name} · {windowLabel}
            </div>
          </div>

          <div className="flex items-center gap-6">
            <Stat label="Budget" value={`£${Math.round(budgetM)}M`} accent="text-[color:var(--color-accent-green)]" />
            <Stat label="Wage Room" value={`£${wageRoomK}k/wk`} accent="text-[color:var(--color-accent-amber)]" />
            <Stat label="Squad" value={String(squadIds.length)} />
            {onStartSeason ? (
              <button className="btn-primary text-sm" onClick={onStartSeason} type="button">
                {ctaLabel}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="text-center">
      <div className="text-mono text-[9px] uppercase tracking-widest text-white/40">{label}</div>
      <div className={`text-broadcast text-lg ${accent ?? 'text-white'}`}>{value}</div>
    </div>
  );
}
