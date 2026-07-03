import { useGameStore } from '@/store';
import { PLAYERS_BY_ID } from '@/data';
import { PositionBadge } from '@/components/PositionBadge';

export function SellTab() {
  const sales = useGameStore((s) => s.sales);
  const budgetM = useGameStore((s) => s.budgetM);
  const cancelSale = useGameStore((s) => s.cancelSale);

  const totalIn = sales.reduce((sum, s) => sum + s.receivedM, 0);

  if (sales.length === 0) {
    return (
      <div className="card text-center text-white/55 text-sm py-12">
        <p>No outgoing deals yet.</p>
        <p className="text-mono text-[11px] mt-2 text-white/35">
          Use the Squad tab to list players for sale.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="rounded-md border border-pink-500/30 bg-pink-500/5 px-4 py-3 text-sm mb-5">
        <span className="text-pink-300">→</span>{' '}
        <span className="text-white/80">Sale agreed. Use the freed-up budget in <strong>Buy players</strong>.</span>
      </div>
      <p className="text-white/55 text-sm mb-5">Players on the way out — fees go straight into your budget.</p>

      <div className="space-y-2">
        {sales.map((s) => {
          const p = PLAYERS_BY_ID[s.playerId];
          const cantAfford = budgetM < s.receivedM;
          return (
            <div key={s.playerId} className="flex items-center gap-4 rounded-lg border border-white/5 bg-[color:var(--color-bg-panel)]/60 px-4 py-3">
              {p ? <PositionBadge position={p.position} /> : null}
              <div className="flex-1">
                <div className="text-display uppercase text-sm">{s.playerName}</div>
                {p ? (
                  <div className="text-mono text-[11px] text-white/45 tracking-wider">
                    {p.position} · Age {p.age} · Sell for £{Math.round(s.receivedM)}M
                  </div>
                ) : null}
                {cantAfford ? (
                  <div className="text-mono text-[10px] uppercase tracking-widest text-rose-300/80 mt-1">
                    Can't cancel — refund needs £{Math.round(s.receivedM)}M, you have £{Math.round(budgetM)}M
                  </div>
                ) : null}
              </div>
              <button
                className="btn-ghost disabled:opacity-40 disabled:cursor-not-allowed"
                type="button"
                onClick={() => cancelSale(s.playerId)}
                disabled={cantAfford}
              >
                Cancel
              </button>
            </div>
          );
        })}
      </div>

      <div className="card mt-6 flex items-center justify-between">
        <span className="text-mono text-[11px] uppercase tracking-widest text-white/40">Total Fees In</span>
        <span className="text-display text-3xl text-[color:var(--color-accent-pink)]">£{Math.round(totalIn)}M</span>
      </div>
    </div>
  );
}

