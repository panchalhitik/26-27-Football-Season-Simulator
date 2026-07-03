import type { Position } from '@/types';

const COLORS: Record<Position, string> = {
  GK:  'bg-amber-500/20 text-amber-300 border border-amber-500/40',
  CB:  'bg-sky-500/20 text-sky-300 border border-sky-500/40',
  LB:  'bg-sky-500/20 text-sky-300 border border-sky-500/40',
  RB:  'bg-sky-500/20 text-sky-300 border border-sky-500/40',
  CDM: 'bg-violet-500/20 text-violet-300 border border-violet-500/40',
  CM:  'bg-violet-500/20 text-violet-300 border border-violet-500/40',
  CAM: 'bg-pink-500/20 text-pink-300 border border-pink-500/40',
  LM:  'bg-pink-500/20 text-pink-300 border border-pink-500/40',
  RM:  'bg-pink-500/20 text-pink-300 border border-pink-500/40',
  LW:  'bg-rose-500/20 text-rose-300 border border-rose-500/40',
  RW:  'bg-rose-500/20 text-rose-300 border border-rose-500/40',
  ST:  'bg-fuchsia-500/20 text-fuchsia-300 border border-fuchsia-500/40',
};

export function PositionBadge({ position }: { position: Position }) {
  return (
    <span className={`pos-badge py-0.5 ${COLORS[position]}`}>{position}</span>
  );
}
