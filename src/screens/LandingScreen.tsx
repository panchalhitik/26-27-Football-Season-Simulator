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
    <AppShell backdrop="hero">
      <div className="min-h-[86vh] flex items-center">
        <div className="max-w-2xl">
          {/* Broadcast tags */}
          <div className="flex items-center gap-3">
            <span className="chip-broadcast">Summer 2026 · Transfer Window Open</span>
            <span className="badge-live">Live</span>
          </div>

          {/* Headline */}
          <h1 className="text-broadcast text-white text-[17vw] sm:text-8xl lg:text-[7.5rem] mt-6 drop-shadow-[0_4px_24px_rgba(0,0,0,0.8)]">
            26/27 Season<br />Simulator
          </h1>

          <p className="text-white/85 text-lg mt-5 max-w-md leading-snug">
            You're the new Sporting Director. One summer.
            Twelve clubs. Live with the consequences.
          </p>

          <div className="mt-8">
            {/* Contract card */}
            <div className="bg-white/95 text-neutral-900 rounded-lg p-5 w-full sm:w-[340px] shadow-[0_20px_50px_rgba(0,0,0,0.6)] rotate-[-0.5deg]">
              <div className="flex items-center justify-between">
                <div className="text-broadcast text-sm text-neutral-900">Sign your contract</div>
                <span aria-hidden className="text-neutral-300 tracking-[0.2em] text-xs">⣿⣿</span>
              </div>
              <div className="flex items-end gap-2 mt-4 border-b border-neutral-300 pb-1">
                <span aria-hidden className="text-script text-2xl text-neutral-400 italic select-none">Signature</span>
                <span aria-hidden className="text-neutral-300">|</span>
                <input
                  autoFocus
                  type="text"
                  value={name}
                  onChange={(e) => setNameLocal(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && submit()}
                  placeholder="Enter Your Name"
                  className="text-script text-2xl flex-1 min-w-0 bg-transparent outline-none text-neutral-900 placeholder:text-neutral-400"
                />
              </div>
              <button
                onClick={submit}
                disabled={name.trim().length === 0}
                className="btn-primary w-full mt-4 text-sm"
                type="button"
              >
                Take the Job
              </button>
            </div>
          </div>

          <p className="text-mono text-[10px] tracking-widest text-white/45 uppercase mt-8">
            3,500+ real players · seeded simulation · every save is a different season
          </p>
        </div>
      </div>
    </AppShell>
  );
}
