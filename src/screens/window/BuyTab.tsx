import { useMemo, useState } from 'react';
import { CLUBS, CLUBS_BY_ID, PLAYERS } from '@/data';
import { useGameStore } from '@/store';
import { PlayerRow } from '@/components/PlayerRow';
import { NegotiationDialog } from './NegotiationDialog';
import type { LeagueId, Player, Position } from '@/types';

const POSITION_CHIPS: { id: 'ALL' | Position; label: string }[] = [
  { id: 'ALL', label: 'All' }, { id: 'GK', label: 'GK' },
  { id: 'CB', label: 'CB' }, { id: 'LB', label: 'LB' }, { id: 'RB', label: 'RB' },
  { id: 'CDM', label: 'CDM' }, { id: 'CM', label: 'CM' }, { id: 'CAM', label: 'CAM' },
  { id: 'LM', label: 'LM' }, { id: 'RM', label: 'RM' },
  { id: 'LW', label: 'LW' }, { id: 'RW', label: 'RW' }, { id: 'ST', label: 'ST' },
];

export function BuyTab() {
  const userClubId = useGameStore((s) => s.clubId);
  const signings = useGameStore((s) => s.signings);
  const walkedAwayIds = useGameStore((s) => s.walkedAwayPlayerIds);
  const [search, setSearch] = useState('');
  const [posFilter, setPosFilter] = useState<'ALL' | Position>('ALL');
  const [clubFilter, setClubFilter] = useState<string>('all');
  const [leagueFilter, setLeagueFilter] = useState<'all' | LeagueId>('all');
  const [target, setTarget] = useState<Player | null>(null);

  const buyableSource = useMemo(() => {
    // Buyable = market pool + every other club's player (not the user's club).
    return PLAYERS.filter((p) => p.clubId !== userClubId);
  }, [userClubId]);

  const walkedSet = useMemo(() => new Set(walkedAwayIds), [walkedAwayIds]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const signedIds = new Set(signings.map((s) => s.playerId));
    return buyableSource.filter((p) => {
      if (signedIds.has(p.id)) return false;
      if (posFilter !== 'ALL' && p.position !== posFilter) return false;
      if (clubFilter !== 'all' && p.clubId !== clubFilter) return false;
      if (leagueFilter !== 'all') {
        const club = CLUBS_BY_ID[p.clubId];
        if (!club || club.league !== leagueFilter) return false;
      }
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    }).sort((a, b) => b.rating - a.rating);
  }, [buyableSource, search, posFilter, clubFilter, leagueFilter, signings]);

  const stars = filtered.filter((p) => p.isStar);
  const others = filtered.filter((p) => !p.isStar);
  const visible = [...stars, ...others].slice(0, 80);

  return (
    <div>
      <div className="card mb-6">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name..."
          className="w-full bg-transparent border border-white/15 rounded-md py-2 px-3 outline-none focus:border-pink-400/50"
        />
        <div className="grid sm:grid-cols-2 gap-3 mt-3">
          <SelectField label="League" value={leagueFilter} onChange={(v) => setLeagueFilter(v as 'all' | LeagueId)}>
            <option value="all">All leagues</option>
            <option value="PL">Premier League</option>
            <option value="LL">La Liga</option>
            <option value="SA">Serie A</option>
            <option value="BL">Bundesliga</option>
            <option value="L1">Ligue 1</option>
          </SelectField>
          <SelectField label="Team" value={clubFilter} onChange={setClubFilter}>
            <option value="all">All teams</option>
            <option value="market">Free / Other clubs</option>
            {CLUBS.filter((c) => c.id !== userClubId).map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </SelectField>
        </div>

        <div className="mt-3">
          <div className="text-mono text-[10px] uppercase tracking-widest text-white/40 mb-2">Position</div>
          <div className="flex flex-wrap gap-1.5">
            {POSITION_CHIPS.map((c) => (
              <button key={c.id} type="button" onClick={() => setPosFilter(c.id)}
                className={`text-mono text-[10px] uppercase tracking-widest px-2.5 py-1 rounded border transition
                  ${posFilter === c.id ? 'bg-pink-500/20 border-pink-400/60 text-pink-200' : 'border-white/10 text-white/55 hover:text-white'}`}
              >{c.label}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="text-mono uppercase text-[10px] tracking-widest text-white/40 mb-3">
        Market · showing {visible.length} of {filtered.length}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {visible.map((p) => {
          const locked = walkedSet.has(p.id);
          return (
            <PlayerRow
              key={p.id}
              player={p}
              action="buy"
              onAction={() => setTarget(p)}
              showClub
              {...(locked ? { disabledMsg: 'Walked away from negotiations' } : {})}
            />
          );
        })}
      </div>

      {target ? <NegotiationDialog player={target} onClose={() => setTarget(null)} /> : null}
    </div>
  );
}

function SelectField({
  label, value, onChange, children,
}: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-mono text-[10px] uppercase tracking-widest text-white/40 mb-1">{label}</div>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent border border-white/15 rounded-md py-2 px-3 outline-none focus:border-pink-400/50"
      >
        {children}
      </select>
    </label>
  );
}
