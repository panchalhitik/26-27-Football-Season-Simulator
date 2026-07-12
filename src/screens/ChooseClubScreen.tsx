import { useMemo, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { ClubCrest } from '@/components/ClubCrest';
import { CLUBS, MANAGERS_BY_ID, PLAYERS_BY_CLUB } from '@/data';
import { useGameStore } from '@/store';
import type { Club, LeagueId } from '@/types';

const LEAGUE_LABEL: Record<LeagueId, string> = {
  PL: 'Premier League',
  LL: 'La Liga',
  BL: 'Bundesliga',
  L1: 'Ligue 1',
  SA: 'Serie A',
  OTHER: 'Other',
};

export function ChooseClubScreen() {
  const chooseClub = useGameStore((s) => s.chooseClub);
  const [idx, setIdx] = useState(0);

  const clubs = CLUBS;
  const club = clubs[Math.min(idx, clubs.length - 1)]!;
  const mgr = MANAGERS_BY_ID[club.startingManagerId];

  const depth = useMemo(() => squadDepth(club), [club]);
  const prev = () => setIdx((i) => (i - 1 + clubs.length) % clubs.length);
  const next = () => setIdx((i) => (i + 1) % clubs.length);

  return (
    <AppShell>
      <div className="min-h-[82vh] flex flex-col justify-center">
        {/* ── HERO ─────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-10 items-center">
          {/* Left: the storyline */}
          <div className="relative pl-5">
            <span
              aria-hidden
              className="absolute left-0 top-1 bottom-1 w-1 rounded"
              style={{ background: club.primaryColor }}
            />
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div className="text-mono uppercase text-[12px] tracking-[0.25em] text-[color:var(--color-accent-pink)]">
                {club.name} · {LEAGUE_LABEL[club.league]}
              </div>
              <div className="text-mono uppercase text-[11px] tracking-[0.2em] text-white/50">
                Difficulty{' '}
                <span className="text-amber-400 text-sm tracking-normal">
                  {'★'.repeat(club.difficulty)}
                </span>
                <span className="text-white/20 text-sm tracking-normal">
                  {'★'.repeat(5 - club.difficulty)}
                </span>
              </div>
            </div>

            <h1 className="text-broadcast text-4xl sm:text-6xl lg:text-[4.2rem] mt-4 drop-shadow-[0_4px_20px_rgba(0,0,0,0.7)]">
              &lsquo;{club.storyline.replace(/^["'“]+|["'”.]+$/g, '')}.&rsquo;
            </h1>

            <div className="text-mono uppercase text-[12px] tracking-wider text-white/55 mt-6 flex flex-wrap gap-x-2">
              <span>Manager <strong className="text-white">{mgr?.name ?? 'Vacant'}</strong></span>
              <span aria-hidden>·</span>
              <span>Budget <strong className="text-[color:var(--color-accent-pink)]">£{club.startingBudgetM}M</strong></span>
              <span aria-hidden>·</span>
              <strong className="text-white">{club.europe === 'None' ? 'No Europe' : club.europe}</strong>
              <span aria-hidden>·</span>
              <span>Reputation <strong className="text-white">{repLabel(club.reputation)}</strong></span>
            </div>

            <button
              type="button"
              className="btn-story mt-8 text-base"
              onClick={() => chooseClub(club.id)}
            >
              Write this story <span aria-hidden>→</span>
            </button>
          </div>

          {/* Right: the club card */}
          <div className="relative max-w-[360px] w-full mx-auto lg:mx-0">
            <div
              aria-hidden
              className="absolute inset-0 rounded-2xl rotate-3 bg-white/5 border border-white/10"
            />
            <div className="relative rounded-2xl overflow-hidden border border-white/15 bg-[color:var(--color-bg-card)] shadow-[0_24px_60px_rgba(0,0,0,0.6)] -rotate-1">
              <div
                className="flex items-center justify-center py-6"
                style={{ background: `linear-gradient(120deg, ${club.primaryColor}, ${club.secondaryColor})` }}
              >
                <ClubCrest club={club} size={110} />
              </div>
              <div className="p-5">
                <RatingRow label="Attack rating" value={club.baseAttack} />
                <RatingRow label="Defense rating" value={club.baseDefense} />
                <RatingRow label="Squad depth" value={depth} />
                <p className="text-white/60 text-[13px] leading-relaxed mt-4 line-clamp-4">
                  {club.boardLetter || club.storyline}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── CAROUSEL ────────────────────────────────────── */}
        <div className="mt-12">
          <div className="flex items-center justify-center gap-4">
            <button type="button" className="btn-ghost text-xs px-3 py-1.5" onClick={prev}>
              ‹ Prev
            </button>
            <div className="flex items-center gap-2">
              {clubs.map((c, i) => (
                <button
                  key={c.id}
                  type="button"
                  aria-label={c.name}
                  onClick={() => setIdx(i)}
                  className={`w-2 h-2 rounded-full transition ${
                    i === idx ? 'bg-[color:var(--color-accent-pink)] scale-125' : 'bg-white/25 hover:bg-white/50'
                  }`}
                />
              ))}
            </div>
            <button type="button" className="btn-ghost text-xs px-3 py-1.5" onClick={next}>
              Next ›
            </button>
          </div>

          <div className="flex justify-center gap-3 mt-5 flex-wrap">
            {clubs.map((c, i) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setIdx(i)}
                title={c.name}
                className={`rounded-xl p-2 border transition bg-black/40 ${
                  i === idx
                    ? 'border-[color:var(--color-accent-pink)] shadow-[0_0_18px_rgba(255,46,166,0.45)]'
                    : 'border-white/10 hover:border-white/35'
                }`}
              >
                <ClubCrest club={c} size={40} />
              </button>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function RatingRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between border-b border-white/10 py-2.5">
      <span className="text-mono uppercase text-[11px] tracking-widest text-white/55">{label}:</span>
      <span className="text-mono text-lg">
        <strong className="text-white">{Math.round(value)}</strong>
        <span className="text-white/35 text-sm">/100</span>
      </span>
    </div>
  );
}

function repLabel(rep: number): string {
  if (rep >= 90) return 'Elite';
  if (rep >= 80) return 'High';
  if (rep >= 70) return 'Solid';
  return 'Modest';
}

/** Bench quality proxy: average rating of squad players ranked 12-18. */
function squadDepth(club: Club): number {
  const squad = (PLAYERS_BY_CLUB[club.id] ?? []).slice().sort((a, b) => b.rating - a.rating);
  const bench = squad.slice(11, 18);
  if (bench.length === 0) return Math.round((club.baseAttack + club.baseDefense) / 2);
  return Math.round(bench.reduce((s, p) => s + p.rating, 0) / bench.length);
}
