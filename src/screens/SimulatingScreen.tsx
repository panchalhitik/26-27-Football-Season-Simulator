import { useEffect, useState } from 'react';
import { AppShell, SectionLabel } from '@/components/AppShell';
import { CLUBS_BY_ID, FILLER_CLUB_NAMES, MANAGERS_BY_ID } from '@/data';
import { useGameStore } from '@/store';
import type { FixtureResult } from '@/types';

const H1_MONTHS = ['AUG', 'SEP', 'OCT', 'NOV', 'DEC'] as const;
const H2_MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY'] as const;

export function SimulatingScreen({ half }: { half: 'h1' | 'h2' }) {
  const clubId = useGameStore((s) => s.clubId);
  const managerId = useGameStore((s) => s.managerId);
  const seasonRun = useGameStore((s) => s.seasonRun);
  const months = half === 'h1' ? H1_MONTHS : H2_MONTHS;

  const [progress, setProgress] = useState(0);
  const [activeMonth, setActiveMonth] = useState<string>(months[0] as string);

  // Run the sim once on mount; deterministic so cheap to repeat.
  useEffect(() => {
    const { simulateH1, simulateH2 } = useGameStore.getState();
    if (half === 'h1') simulateH1();
    else simulateH2();
  }, [half]);

  // Animate the progress bar; on completion, advance phase.
  useEffect(() => {
    let t = 0;
    const totalTicks = 28;
    const timer = window.setInterval(() => {
      t += 1;
      const pct = Math.min(100, (t / totalTicks) * 100);
      setProgress(pct);
      const idx = Math.min(months.length - 1, Math.floor((pct / 100) * months.length));
      setActiveMonth(months[idx] as string);
      if (pct >= 100) {
        window.clearInterval(timer);
        window.setTimeout(() => {
          const { goTo } = useGameStore.getState();
          if (half === 'h1') goTo('mid-season');
          else goTo('final-report');
        }, 500);
      }
    }, 80);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [half]);

  if (!clubId) return null;
  const club = CLUBS_BY_ID[clubId];
  const manager = managerId ? MANAGERS_BY_ID[managerId] : null;
  if (!club || !manager) return null;

  // Pull what the headline run says so far (we have the full sim already,
  // we're just revealing it slowly). Sort by matchday so the ticker reads
  // in chronological order, not whichever order the schedule generator
  // pushed pairings.
  const monthSet = new Set<string>(months);
  const userFixtures: FixtureResult[] = (seasonRun?.fixtures ?? [])
    .filter((f) => f.homeId === clubId || f.awayId === clubId)
    .filter((f) => monthSet.has(f.month))
    .slice()
    .sort((a, b) => a.matchday - b.matchday);
  const upTo = userFixtures.slice(0, Math.ceil((progress / 100) * userFixtures.length));

  const pointsSoFar = upTo.reduce((sum, f) => {
    const isHome = f.homeId === clubId;
    const my = isHome ? f.homeGoals : f.awayGoals;
    const opp = isHome ? f.awayGoals : f.homeGoals;
    if (my > opp) return sum + 3;
    if (my === opp) return sum + 1;
    return sum;
  }, 0);
  const goalsScored = upTo.reduce((sum, f) => sum + (f.homeId === clubId ? f.homeGoals : f.awayGoals), 0);
  const cleanSheets = upTo.filter((f) =>
    (f.homeId === clubId && f.awayGoals === 0) || (f.awayId === clubId && f.homeGoals === 0)
  ).length;

  return (
    <AppShell>
      <div className="text-center">
        <SectionLabel>
          Simulating · {half === 'h1' ? 'First half · August → December' : 'Second half · January → May'}
        </SectionLabel>
        <h1 className="text-display text-6xl uppercase tracking-tight text-rose-500" style={{ textShadow: '0 0 32px rgba(255, 64, 96, 0.4)' }}>
          {club.name}
        </h1>
        <p className="text-white/55 mt-2">{manager.name} · 2026-27 season</p>

        <div className="flex justify-center gap-3 mt-7">
          {months.map((m) => (
            <span key={m}
              className={`text-display text-sm uppercase tracking-widest px-3 py-1.5 rounded border transition
                ${activeMonth === m ? 'bg-pink-500/30 border-pink-400/70 text-pink-100' : 'border-white/15 text-white/55'}`}
            >{m}</span>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-4 mt-8 max-w-2xl mx-auto">
          <BigStat label="Points so far" value={pointsSoFar} color="text-[color:var(--color-accent-pink)]" />
          <BigStat label="Goals scored" value={goalsScored} color="text-[color:var(--color-accent-cyan)]" />
          <BigStat label="Clean sheets" value={cleanSheets} color="text-[color:var(--color-accent-green)]" />
        </div>

        <div className="card mt-8 max-w-3xl mx-auto text-left">
          <div className="text-mono uppercase text-[10px] tracking-widest text-white/40 mb-3">Match Ticker</div>
          <ul className="space-y-1.5">
            {upTo.slice(-6).map((f, i) => (
              <li key={`${f.matchday}-${i}`} className="grid grid-cols-[80px_1fr_80px_1fr] items-center gap-2 text-sm">
                <span className="text-mono text-[10px] text-white/40 uppercase tracking-widest">MD {f.matchday}</span>
                <span className={`text-right truncate ${f.homeId === clubId ? 'text-white font-semibold' : 'text-white/55'}`}>
                  {labelClub(f.homeId)}
                </span>
                <span className="text-center text-mono bg-white/10 rounded py-0.5">{f.homeGoals} – {f.awayGoals}</span>
                <span className={`truncate ${f.awayId === clubId ? 'text-white font-semibold' : 'text-white/55'}`}>
                  {labelClub(f.awayId)}
                </span>
              </li>
            ))}
            {upTo.length === 0 && <li className="text-white/30 text-sm">Kickoff imminent…</li>}
          </ul>
        </div>

        <div className="fixed bottom-0 left-0 right-0 h-1 bg-white/5">
          <div className="h-full bg-gradient-to-r from-pink-500 via-fuchsia-500 to-cyan-400 transition-all"
            style={{ width: `${progress}%` }} />
        </div>
      </div>
    </AppShell>
  );
}

function BigStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="card">
      <div className="text-mono uppercase text-[10px] tracking-widest text-white/40">{label}</div>
      <div className={`text-display text-4xl mt-1 ${color}`}>{value}</div>
    </div>
  );
}

function labelClub(id: string): string {
  return CLUBS_BY_ID[id]?.shortName ?? FILLER_CLUB_NAMES[id] ?? id;
}
