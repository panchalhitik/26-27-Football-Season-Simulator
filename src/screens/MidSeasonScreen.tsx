import { AppShell, H1, SectionLabel } from '@/components/AppShell';
import { MANAGERS_BY_ID } from '@/data';
import { useGameStore } from '@/store';

const VERDICT_COLOR: Record<string, string> = {
  'DELIGHTED': 'text-emerald-300',
  'PLEASED': 'text-cyan-300',
  'NEUTRAL': 'text-white/70',
  'CONCERNS GROWING': 'text-amber-300',
  'AT RISK': 'text-rose-300',
};

export function MidSeasonScreen() {
  const mid = useGameStore((s) => s.midSeason);
  const managerId = useGameStore((s) => s.managerId);
  const goTo = useGameStore((s) => s.goTo);

  if (!mid || !managerId) return null;
  const manager = MANAGERS_BY_ID[managerId];
  if (!manager) return null;

  return (
    <AppShell>
      <div className="text-center mb-6">
        <SectionLabel>Mid-season Review · January</SectionLabel>
        <H1>How is it going?</H1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="card">
          <div className="text-mono uppercase text-[10px] tracking-widest text-white/40">League Position</div>
          <div className="text-display text-6xl text-[color:var(--color-accent-pink)] mt-2">{mid.leaguePosition}</div>
          <div className="text-mono text-[11px] text-white/45 mt-1">{mid.pointsSoFar} pts from {mid.matchesPlayed} games</div>
        </div>
        <div className="card">
          <div className="text-mono uppercase text-[10px] tracking-widest text-white/40">Board Verdict</div>
          <div className={`text-display text-3xl mt-2 ${VERDICT_COLOR[mid.boardVerdict]}`}>{mid.boardVerdict}</div>
        </div>
        <div className="card">
          <div className="text-mono uppercase text-[10px] tracking-widest text-white/40">Form</div>
          <div className="text-display text-3xl mt-2 text-[color:var(--color-accent-cyan)]">{mid.form}</div>
        </div>
      </div>

      <div className="card mt-5">
        <div className="text-mono uppercase text-[10px] tracking-widest text-white/40 mb-3">Cup Competitions</div>
        <ul className="divide-y divide-white/5">
          {mid.cupStatuses.map((c) => (
            <li key={c.competition} className="flex items-center justify-between py-2 text-sm">
              <span>{c.competition}</span>
              <span className="text-white/65 text-mono text-xs">{c.status}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="card mt-5 flex items-center justify-between">
        <div>
          <div className="text-mono uppercase text-[10px] tracking-widest text-white/40">Manager</div>
          <div className="text-display text-xl uppercase mt-0.5">{manager.name}</div>
          <div className="text-amber-300 text-xs mt-0.5">Position {mid.leaguePosition}th — {mid.boardVerdict.toLowerCase()}.</div>
        </div>
        <button onClick={() => goTo('manager-decision')} type="button" className="btn-ghost">Consider sacking →</button>
      </div>

      <div className="flex flex-wrap justify-center gap-3 mt-8">
        <button type="button" className="btn-ghost" onClick={() => goTo('january-window')}>
          Open January window →
        </button>
        <button type="button" className="btn-primary text-sm" onClick={() => goTo('simulating-h2')}>
          Skip — play second half →
        </button>
      </div>
      <p className="text-mono text-[10px] uppercase tracking-widest text-white/35 text-center mt-3">
        January window lets you sign + sell + change tactics before the run-in.
      </p>
    </AppShell>
  );
}
