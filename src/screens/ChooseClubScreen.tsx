import { useMemo, useState } from 'react';
import { AppShell, H1, SectionLabel } from '@/components/AppShell';
import { ReputationBadge } from '@/components/Reputation';
import { CLUBS, MANAGERS_BY_ID } from '@/data';
import { useGameStore } from '@/store';
import type { Club, LeagueId } from '@/types';

type ClubTab = 'PL' | 'OTHER';

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
  const [tab, setTab] = useState<ClubTab>('PL');

  const { pl, other } = useMemo(() => ({
    pl: CLUBS.filter((c) => c.league === 'PL'),
    other: CLUBS.filter((c) => c.league !== 'PL'),
  }), []);
  const visible = tab === 'PL' ? pl : other;

  return (
    <AppShell>
      <SectionLabel>Step 1 · Choose Your Crisis</SectionLabel>
      <H1>Which storyline do you want?</H1>
      <p className="text-white/55 mt-3 max-w-xl">Each club is a different challenge. Pick the headline you want to write.</p>

      <nav className="flex gap-6 border-b border-white/10 mt-8 pb-3">
        <TabButton
          active={tab === 'PL'}
          onClick={() => setTab('PL')}
          label="Premier League"
          count={pl.length}
        />
        <TabButton
          active={tab === 'OTHER'}
          onClick={() => setTab('OTHER')}
          label="Other Leagues"
          count={other.length}
        />
      </nav>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-6">
        {visible.map((c) => (
          <ClubCard key={c.id} club={c} onPick={() => chooseClub(c.id)} />
        ))}
      </div>
    </AppShell>
  );
}

function TabButton({
  active, onClick, label, count,
}: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group text-left transition ${
        active ? 'text-[color:var(--color-accent-pink)]' : 'text-white/55 hover:text-white'
      }`}
    >
      <div className="flex items-center gap-2 text-display text-sm uppercase tracking-wider">
        <span>{label}</span>
        <span className={`pill text-[10px] ${active ? 'bg-pink-500/15 text-pink-200' : 'bg-white/10 text-white/70'}`}>
          {count}
        </span>
      </div>
    </button>
  );
}

function ClubCard({ club, onPick }: { club: Club; onPick: () => void }) {
  const mgr = MANAGERS_BY_ID[club.startingManagerId];
  return (
    <button onClick={onPick} type="button"
      className="card card-hover text-left relative overflow-hidden cursor-pointer"
    >
      <div
        className="absolute inset-x-0 top-0 h-[3px]"
        style={{ background: `linear-gradient(90deg, ${club.primaryColor}, ${club.secondaryColor})` }}
      />
      <div className="flex items-start justify-between">
        <div>
          <div className="text-display uppercase text-xl leading-tight">{club.name}</div>
          <div className="text-mono text-[10px] text-white/45 uppercase tracking-widest mt-1">
            {LEAGUE_LABEL[club.league]}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[9px] uppercase text-white/40 tracking-widest">Difficulty</div>
          <div className="text-amber-400 text-sm">{'★'.repeat(club.difficulty)}<span className="text-white/15">{'★'.repeat(5 - club.difficulty)}</span></div>
        </div>
      </div>

      <p className="text-display text-base sm:text-lg mt-4 leading-snug">{club.storyline}</p>

      <dl className="text-mono text-[11px] mt-5 space-y-1 tracking-wider">
        <Row k="Manager" v={mgr?.name ?? 'Vacant'} />
        <Row k="Budget" v={<span className="text-[color:var(--color-accent-pink)]">£{club.startingBudgetM}M</span>} />
        <Row k="Europe" v={
          <span className={club.europe === 'None' ? 'text-white/40' : 'text-[color:var(--color-accent-green)]'}>
            {club.europe}
          </span>
        } />
        <Row k="Reputation" v={<ReputationBadge value={club.reputation} dense />} />
      </dl>
    </button>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-white/40">{k}</dt>
      <dd>{v}</dd>
    </div>
  );
}

