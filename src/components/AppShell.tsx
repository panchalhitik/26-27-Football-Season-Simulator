import type { ReactNode } from 'react';
import { useGameStore } from '@/store';
import { CLUBS_BY_ID } from '@/data';
import stadiumUrl from '@/assets/stadium-tunnel.png';

/**
 * App chrome: stadium backdrop + broadcast news ticker on every screen.
 * `backdrop="hero"` (landing) shows the stadium bright; default is a dim
 * atmospheric wash so content screens stay readable.
 */
export function AppShell({
  children,
  backdrop = 'dim',
}: {
  children: ReactNode;
  backdrop?: 'hero' | 'dim';
}) {
  return (
    <div className="min-h-screen w-full relative">
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none bg-cover bg-center"
        style={{
          backgroundImage: `url(${stadiumUrl})`,
          opacity: backdrop === 'hero' ? 0.55 : 0.14,
        }}
      />
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            backdrop === 'hero'
              ? 'linear-gradient(90deg, rgba(6,10,19,0.97) 0%, rgba(6,10,19,0.82) 45%, rgba(6,10,19,0.25) 100%), linear-gradient(0deg, rgba(6,10,19,0.9) 0%, transparent 40%)'
              : 'linear-gradient(180deg, rgba(6,10,19,0.55) 0%, rgba(6,10,19,0.92) 60%, rgba(6,10,19,0.98) 100%)',
        }}
      />
      <div className="relative mx-auto max-w-6xl px-6 py-10 pb-16">{children}</div>
      <NewsTicker />
    </div>
  );
}

/** Bottom breaking-news marquee. Headlines follow the game state. */
function NewsTicker() {
  const phase = useGameStore((s) => s.phase);
  const clubId = useGameStore((s) => s.clubId);
  const live = useGameStore((s) => s.liveSeason);
  const injuries = useGameStore((s) => s.injuries);
  const sd = useGameStore((s) => s.sportingDirectorName);

  const club = clubId ? CLUBS_BY_ID[clubId] : null;
  const items: string[] = [];

  if (phase === 'landing') {
    items.push(
      'BREAKING: New sporting director expected to be announced today…',
      'Major clubs monitoring situation…',
      'Unprecedented transfer budgets confirmed…',
      'Fans awaiting decision…',
    );
  } else {
    if (club && sd) items.push(`OFFICIAL: ${club.name} appoint ${sd} as sporting director`);
    if (phase === 'window' || phase === 'january-window') {
      items.push(
        `${phase === 'january-window' ? 'JANUARY' : 'SUMMER'} WINDOW: agents circling — every deal is a negotiation`,
        'Deadline day approaching…',
      );
    }
    if (live && club) {
      const pos = live.table.findIndex((r) => r.clubId === clubId) + 1;
      const pts = live.table.find((r) => r.clubId === clubId)?.points ?? 0;
      if (pos > 0 && live.matchday > 1) {
        items.push(`TABLE: ${club.shortName} sit ${ordinal(pos)} on ${pts} points after MD ${live.matchday - 1}`);
      }
      const out = Object.keys(injuries).length;
      if (out > 0) items.push(`INJURY NEWS: ${out} first-team ${out === 1 ? 'player' : 'players'} in the treatment room`);
      items.push(`MATCHDAY ${Math.min(live.matchday, live.totalRounds)} of ${live.totalRounds} — all eyes on the touchline`);
    }
    if (items.length === 0) {
      items.push('SKY IS FALLING: board demands results…', 'Sources: dressing room awaiting new signings…');
    }
  }

  // Track is doubled for the seamless −50% loop.
  const track = [...items, ...items];

  return (
    <div className="ticker-bar" aria-hidden>
      <span className="ticker-label">⚽ Breaking</span>
      <div className="ticker-viewport">
        <div className="ticker-track">
          {track.map((t, i) => (
            <span key={i} className="ticker-item">{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? 'th'}`;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-mono text-[11px] tracking-[0.25em] text-[color:var(--color-accent-amber)] uppercase mb-3">
      {children}
    </div>
  );
}

export function H1({ children }: { children: ReactNode }) {
  return (
    <h1 className="text-broadcast text-4xl sm:text-5xl md:text-6xl">
      {children}
    </h1>
  );
}
