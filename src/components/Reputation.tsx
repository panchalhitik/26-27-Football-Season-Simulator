export type ReputationLabel = 'Elite' | 'High' | 'Good' | 'Ok';

/**
 * Map the numeric reputation (0–100, used by the negotiation engine) to a
 * coarser label the UI shows. The numbers stay in the data layer; the rest of
 * the app only ever sees the word.
 *
 * Brackets:
 *   90+   Elite   — UCL contenders, brand-defining clubs
 *   85–89 High    — top-table regulars
 *   75–84 Good    — established giants in flux
 *   <75   Ok      — outside the elite, rebuilding
 */
export function reputationLabel(value: number): ReputationLabel {
  if (value >= 90) return 'Elite';
  if (value >= 85) return 'High';
  if (value >= 75) return 'Good';
  return 'Ok';
}

const LABEL_STYLE: Record<ReputationLabel, { dot: string; text: string }> = {
  Elite: { dot: 'bg-fuchsia-400', text: 'text-fuchsia-200' },
  High:  { dot: 'bg-cyan-300',    text: 'text-cyan-100'    },
  Good:  { dot: 'bg-emerald-300', text: 'text-emerald-100' },
  Ok:    { dot: 'bg-amber-300',   text: 'text-amber-100'   },
};

export function ReputationBadge({ value, dense }: { value: number; dense?: boolean }) {
  const label = reputationLabel(value);
  const s = LABEL_STYLE[label];
  if (dense) {
    return (
      <span className={`inline-flex items-center gap-1.5 ${s.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
        <span>{label}</span>
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1.5 ${s.text}`}>
      <span className={`w-2 h-2 rounded-full ${s.dot}`} />
      <span className="text-mono uppercase tracking-widest text-[11px]">{label}</span>
    </span>
  );
}
