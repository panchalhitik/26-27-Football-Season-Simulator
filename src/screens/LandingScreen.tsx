import { useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { useGameStore } from '@/store';

export function LandingScreen() {
  const setName = useGameStore((s) => s.setSportingDirectorName);
  const goTo = useGameStore((s) => s.goTo);
  const saved = useGameStore((s) => s.sportingDirectorName);
  const [name, setNameLocal] = useState(saved);

  const submit = () => {
    if (name.trim().length === 0) return;
    setName(name);
    goTo('choose-club');
  };

  return (
    <AppShell>
      <div className="min-h-[80vh] flex items-center justify-center text-center">
        <div className="max-w-2xl w-full">
          <div className="pill bg-pink-500/10 text-pink-300 border border-pink-500/30 mb-8">
            Summer 2026 · Transfer Window Open
          </div>
          <h1 className="text-display text-7xl sm:text-8xl tracking-tighter leading-none">26/27 FSS</h1>
          <p className="text-display uppercase tracking-[0.3em] text-[color:var(--color-accent-cyan)] mt-3 text-sm">
            26/27 Football Season Simulator
          </p>
          <p className="text-white/70 max-w-xl mx-auto mt-6 leading-relaxed">
            You're the new Sporting Director. One summer. Six clubs. 3,300+ real players.
            <br /> Make the calls — live with the consequences.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-10 text-left">
            <ExplainerCard n="01" title="Pick Your Club"
              body="Six European giants, each with a real-world crisis going into summer 2026. Arsenal defending the title. Real Madrid trophyless. Liverpool nursing a £440M hangover." />
            <ExplainerCard n="02" title="Run The Window"
              body="Hire or sack the manager (full salary + control negotiation). Sign and sell across 3,300+ players from the top 5 leagues — every transfer is a transparent negotiation with visible factors." />
            <ExplainerCard n="03" title="Live With It"
              body="Pick your XI. Set tactics. Sim the season instantly — no match-by-match grind. Get 10 season highlights, a grade, the owner's verdict, and a share card." />
          </div>

          <div className="mt-10">
            <div className="text-mono text-[10px] tracking-widest text-white/40 uppercase">
              Your name, Sporting Director
            </div>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setNameLocal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder="Your Name"
              className="mt-2 w-full sm:w-96 mx-auto block bg-transparent text-display text-2xl uppercase
                text-center border border-white/15 focus:border-pink-400/60 rounded-md py-3 px-4 outline-none"
            />
            <button onClick={submit} disabled={name.trim().length === 0} className="btn-primary mt-5">
              Enter Your Name
            </button>
            <p className="text-mono text-[10px] tracking-widest text-white/40 uppercase mt-5">
              Based on real summer 2026 squads · seed-based simulation
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function ExplainerCard({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="card card-hover">
      <div className="text-display text-pink-400 text-3xl">{n}</div>
      <div className="text-display uppercase mt-2 text-base">{title}</div>
      <p className="text-white/65 text-sm mt-2 leading-relaxed">{body}</p>
    </div>
  );
}
