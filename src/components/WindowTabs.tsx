export type WindowTab = 'squad' | 'buy' | 'sell' | 'formation';

export interface WindowTabsProps {
  active: WindowTab;
  onChange: (t: WindowTab) => void;
  squadCount: number;
  buyCount: number;
  sellCount: number;
}

const TABS: { id: WindowTab; label: string }[] = [
  { id: 'squad', label: 'Squad' },
  { id: 'buy', label: 'Buy players' },
  { id: 'sell', label: 'Sell / Loan' },
  { id: 'formation', label: 'Formation' },
];

export function WindowTabs({ active, onChange, squadCount, buyCount, sellCount }: WindowTabsProps) {
  const badges: Record<WindowTab, number> = {
    squad: squadCount, buy: buyCount, sell: sellCount, formation: 0,
  };
  return (
    <nav className="flex border-b-2 border-[color:var(--color-accent-pink)]/70 mb-6 overflow-x-auto">
      {TABS.map((t) => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`text-broadcast text-[13px] px-5 py-2.5 whitespace-nowrap transition rounded-t-md
              ${isActive
                ? 'bg-[color:var(--color-accent-pink)] text-white shadow-[0_-4px_18px_rgba(255,46,166,0.35)]'
                : 'text-white/55 hover:text-white hover:bg-white/5'}`}
          >
            {t.label}
            {badges[t.id] > 0 ? (
              <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded ${isActive ? 'bg-black/25 text-white' : 'bg-white/10 text-white/70'}`}>
                {badges[t.id]}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
