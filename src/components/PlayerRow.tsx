import type { Player } from '@/types';
import { PositionBadge } from './PositionBadge';

export interface PlayerRowProps {
  player: Player;
  action: 'sell' | 'buy' | 'cancel' | 'none';
  onAction?: () => void;
  showClub?: boolean;
  /**
   * When set, the action button is disabled and this short reason is shown
   * beside it (e.g. "Walked away from negotiations").
   */
  disabledMsg?: string;
}

export function PlayerRow({ player, action, onAction, showClub, disabledMsg }: PlayerRowProps) {
  const locked = Boolean(disabledMsg);
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition
        ${locked
          ? 'border-white/5 bg-[color:var(--color-bg-panel)]/30 opacity-60'
          : 'border-white/5 bg-[color:var(--color-bg-panel)]/60 hover:border-white/15'
        }`}
    >
      <PositionBadge position={player.position} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-sm font-medium truncate">
          <span className="truncate">{player.name}</span>
          {player.isStar ? (
            <span className="pill bg-pink-500/15 text-pink-300 border border-pink-500/40">★ STAR</span>
          ) : null}
        </div>
        <div className="text-mono text-[11px] text-white/45 tracking-wider">
          {player.age} · £{player.marketValueM}M · £{player.wageK}k/wk
          {showClub ? ` · ${player.clubId.toUpperCase()}` : ''}
        </div>
        {disabledMsg ? (
          <div className="text-mono text-[10px] uppercase tracking-widest text-rose-300/80 mt-1">
            {disabledMsg}
          </div>
        ) : null}
      </div>
      {action === 'sell' && (
        <button className="btn-sell" onClick={onAction} type="button" disabled={locked}>
          SELL
        </button>
      )}
      {action === 'buy' && (
        <button
          className="btn-buy disabled:opacity-40 disabled:cursor-not-allowed disabled:grayscale"
          onClick={onAction}
          type="button"
          disabled={locked}
        >
          BUY
        </button>
      )}
      {action === 'cancel' && (
        <button className="btn-ghost" onClick={onAction} type="button" disabled={locked}>
          Cancel
        </button>
      )}
    </div>
  );
}
