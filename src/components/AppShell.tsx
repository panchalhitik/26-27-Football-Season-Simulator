import type { ReactNode } from 'react';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen w-full">
      <div className="mx-auto max-w-6xl px-6 py-10">{children}</div>
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-mono text-[11px] tracking-[0.25em] text-[color:var(--color-accent-pink)] uppercase mb-3">
      {children}
    </div>
  );
}

export function H1({ children }: { children: ReactNode }) {
  return (
    <h1 className="text-display text-4xl sm:text-5xl md:text-6xl leading-[0.95] uppercase">
      {children}
    </h1>
  );
}
