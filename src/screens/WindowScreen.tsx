import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { WindowHeader } from '@/components/WindowHeader';
import { WindowTabs, type WindowTab } from '@/components/WindowTabs';
import { useGameStore } from '@/store';
import { SquadTab } from './window/SquadTab';
import { BuyTab } from './window/BuyTab';
import { SellTab } from './window/SellTab';
import { FormationTab } from './window/FormationTab';

export function WindowScreen() {
  const [tab, setTab] = useState<WindowTab>('squad');
  const phase = useGameStore((s) => s.phase);
  const squadIds = useGameStore((s) => s.squadIds);
  const signings = useGameStore((s) => s.signings);
  const sales = useGameStore((s) => s.sales);
  const goTo = useGameStore((s) => s.goTo);

  // 'window' = pre-season summer window → sim the whole season starting at H1.
  // 'january-window' = mid-season pause → continue from H2, don't re-sim H1.
  const isJanuary = phase === 'january-window';
  const windowLabel = isJanuary ? 'January Window' : 'Summer Window';
  const ctaLabel = isJanuary ? 'Continue Season →' : 'Start Season →';
  const targetPhase = isJanuary ? 'simulating-h2' : 'simulating-h1';

  return (
    <AppShell>
      <WindowHeader
        onStartSeason={() => goTo(targetPhase)}
        ctaLabel={ctaLabel}
        windowLabel={windowLabel}
      />
      <WindowTabs
        active={tab}
        onChange={setTab}
        squadCount={squadIds.length}
        buyCount={signings.length}
        sellCount={sales.length}
      />

      <div className="rounded-md border border-pink-500/30 bg-pink-500/5 px-4 py-3 text-sm mb-6">
        <span className="text-pink-300">→</span>{' '}
        <span className="text-white/80">
          {isJanuary ? (
            <>
              <strong className="text-white">Mid-season rebuild.</strong> Sign, sell, change tactics,
              then hit{' '}
              <span className="text-pink-300 font-semibold">Continue Season</span> to play the
              second half.
            </>
          ) : (
            <>
              <strong className="text-white">Click the tabs above</strong> to buy & sell players,
              pick your XI, then hit{' '}
              <span className="text-pink-300 font-semibold">Start season</span>. Or just sim with
              the existing squad — your call.
            </>
          )}
        </span>
      </div>

      {tab === 'squad' && <SquadTab />}
      {tab === 'buy' && <BuyTab />}
      {tab === 'sell' && <SellTab />}
      {tab === 'formation' && <FormationTab />}
    </AppShell>
  );
}
