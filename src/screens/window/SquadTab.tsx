import { useMemo } from 'react';
import { useGameStore } from '@/store';
import { PLAYERS_BY_ID } from '@/data';
import { PlayerRow } from '@/components/PlayerRow';
import type { Player, PositionGroup } from '@/types';

const GROUP_ORDER: PositionGroup[] = ['GK', 'DEF', 'MID', 'FWD'];
const GROUP_LABEL: Record<PositionGroup, string> = { GK: 'GK', DEF: 'DEF', MID: 'MID', FWD: 'FWD' };

export function SquadTab() {
  const squadIds = useGameStore((s) => s.squadIds);
  const sellPlayer = useGameStore((s) => s.sellPlayer);

  const grouped = useMemo(() => {
    const m: Record<PositionGroup, Player[]> = { GK: [], DEF: [], MID: [], FWD: [] };
    for (const id of squadIds) {
      const p = PLAYERS_BY_ID[id];
      if (p) m[p.group].push(p);
    }
    for (const g of GROUP_ORDER) m[g].sort((a, b) => b.rating - a.rating);
    return m;
  }, [squadIds]);

  return (
    <div>
      <p className="text-white/65 text-sm mb-5">
        Trim your squad. Selling a player frees up budget and wages — fee ≈ 95% of market value.
      </p>

      {GROUP_ORDER.map((g) => (
        <section key={g} className="mb-8">
          <h2 className="text-mono uppercase tracking-widest text-[11px] text-white/40 mb-3">
            {GROUP_LABEL[g]} ({grouped[g].length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {grouped[g].map((p) => (
              <PlayerRow key={p.id} player={p} action="sell" onAction={() => sellPlayer(p.id)} />
            ))}
            {grouped[g].length === 0 && (
              <div className="text-white/30 text-mono text-xs italic">No {GROUP_LABEL[g]} on the books.</div>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
