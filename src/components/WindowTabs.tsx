export type WindowTab = 'squad' | 'buy' | 'sell' | 'formation';

export interface WindowTabsProps {
  active: WindowTab;
  onChange: (t: WindowTab) => void;
  squadCount: number;
  buyCount: number;
  sellCount: number;
}

const TABS: { id: WindowTab; label: string; sub: string }[] = [
  { id: 'squad', label: 'Squad', sub: 'Review & Sell' },
  { id: 'buy', label: 'Buy players', sub: 'Sign from market' },
  { id: 'sell', label: 'Sell / Loan', sub: 'Outgoing deals' },
  { id: 'formation', label: 'Formation', sub: 'Pick your XI' },
];

export function WindowTabs({ active, onChange, squadCount, buyCount, sellCount }: WindowTabsProps) {
  const badges: Record<WindowTab, number> = {
    squad: squadCount, buy: buyCount, sell: sellCount, formation: 0,
  };
  return (
    <nav className="flex flex-wrap gap-6 border-b border-white/10 pb-3 mb-6">
      {TABS.map((t) => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`group text-left ${isActive ? 'text-[color:var(--color-accent-pink)]' : 'text-white/55 hover:text-white'}`}
          >
            <div className="flex items-center gap-2 text-display text-sm uppercase tracking-wider">
              <span>{t.label}</span>
              {badges[t.id] > 0 ? (
                <span className="pill bg-white/10 text-white/80 text-[10px]">{badges[t.id]}</span>
              ) : null}
            </div>
            <div className="text-mono text-[10px] tracking-widest uppercase text-white/30">{t.sub}</div>
          </button>
        );
      })}
    </nav>
  );
}
