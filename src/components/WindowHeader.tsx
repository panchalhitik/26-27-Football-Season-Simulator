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
    <header className="flex items-end justify-between gap-6 border-b border-white/10 pb-5 mb-6">
      <div>
        <div className="flex items-center gap-3">
          <span
            className="inline-block w-1.5 h-7 rounded"
            style={{ background: `linear-gradient(180deg, ${club.primaryColor}, ${club.secondaryColor})` }}
          />
          <h1 className="text-display text-2xl uppercase tracking-tight">{club.name}</h1>
        </div>
        <div className="text-mono text-[11px] text-white/45 tracking-widest uppercase mt-1.5 ml-4">
          {manager.name} · {windowLabel}
        </div>
      </div>

      <div className="flex items-center gap-8 text-mono">
        <Stat label="Budget Left" value={`£${Math.round(budgetM)}M`} accent="text-[color:var(--color-accent-green)]" />
        <Stat label="Wage Bill"  value={`£${wageRoomK}k/wk`} />
        <Stat label="Squad" value={String(squadIds.length)} />
      </div>

      {onStartSeason ? (
        <button className="btn-primary text-sm" onClick={onStartSeason} type="button">
          {ctaLabel}
        </button>
      ) : null}
    </header>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-white/35">{label}</div>
      <div className={`text-lg ${accent ?? 'text-white'}`}>{value}</div>
    </div>
  );
}
