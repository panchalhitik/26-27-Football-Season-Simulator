import { useMemo, useRef, useState } from 'react';
import { negotiate, negotiationFactors, importanceFromRating } from '@/engine';
import { CLUBS_BY_ID } from '@/data';
import { useGameStore } from '@/store';
import { reputationLabel } from '@/components/Reputation';
import type { Club, Offer, Player } from '@/types';

const MAX_FAILED_ROUNDS = 5;

type DialogPhase =
  | { kind: 'idle' }
  | { kind: 'accepted'; message: string }
  | { kind: 'counter'; counterFeeM: number; counterWageK: number; message: string }
  | { kind: 'counterAccepted' }
  | { kind: 'walkedAway' };

export function NegotiationDialog({ player, onClose }: { player: Player; onClose: () => void }) {
  const userClubId = useGameStore((s) => s.clubId);
  const budgetM = useGameStore((s) => s.budgetM);
  const buyPlayer = useGameStore((s) => s.buyPlayer);
  const walkAwayFromPlayer = useGameStore((s) => s.walkAwayFromPlayer);
  const isAlreadyWalkedAway = useGameStore((s) => s.walkedAwayPlayerIds.includes(player.id));

  const [feeM, setFeeM] = useState<number>(Math.max(1, Math.round(player.marketValueM)));
  // Asking wage starts ~15% above current — slight raise to make signing actually attractive.
  const [wageK, setWageK] = useState<number>(Math.max(5, Math.round(player.wageK * 1.15)));
  const [contractYears, setContractYears] = useState<number>(4);

  const [phase, setPhase] = useState<DialogPhase>(
    isAlreadyWalkedAway ? { kind: 'walkedAway' } : { kind: 'idle' },
  );
  const [failedRounds, setFailedRounds] = useState(isAlreadyWalkedAway ? MAX_FAILED_ROUNDS : 0);

  const fromClub = CLUBS_BY_ID[player.clubId];
  const myClub = userClubId ? CLUBS_BY_ID[userClubId] : undefined;

  // Used to re-roll luck on each Suggest click — survives across clicks so we
  // don't lose entropy when React re-renders.
  const luckSeedRef = useRef<number>(Math.random());

  // Assistant suggestion is computed at neutral luck (0.5) from the same
  // valuation factors so the user sees a useful "target range" up front.
  const advisory = useMemo(() => {
    const factors = negotiationFactors(player, {
      importanceToClub: importanceFromRating(player.rating),
      ...(fromClub ? { sellerReputation: fromClub.reputation } : {}),
      ...(myClub ? { buyerReputation: myClub.reputation } : {}),
    });
    const isStar = player.isStar || player.rating >= 88;
    return {
      feeLow:  Math.round(factors.fairFeeM * (isStar ? 0.98 : 0.88)),
      feeHigh: Math.round(factors.fairFeeM * (isStar ? 1.05 : 1.00)),
      wageLow:  Math.round(factors.fairWageK * 0.95),
      wageHigh: Math.round(factors.fairWageK * (isStar ? 1.08 : 1.02)),
      isStar,
      prestigeHeavy: factors.prestigePremium > 1.15,
      keyToSeller: factors.importanceMultiplier > 1.3,
      fairFeeM: factors.fairFeeM,
      fairWageK: factors.fairWageK,
    };
  }, [player, fromClub, myClub]);

  // The actual fee/wage that would be paid if the user confirms NOW. In counter
  // / counterAccepted phases the sliders are already snapped to those numbers,
  // so feeM / wageK are the source of truth.
  const targetFeeM = feeM;
  const overBudget = targetFeeM > budgetM;

  /** A user-initiated slider change clears any pending verdict back to idle. */
  function userMovedSlider(setter: (n: number) => void, value: number) {
    setter(value);
    if (phase.kind === 'accepted' || phase.kind === 'counter' || phase.kind === 'counterAccepted') {
      setPhase({ kind: 'idle' });
    }
  }

  function onSuggestTerms() {
    if (overBudget) return;
    const offer: Offer = {
      kind: 'buy', playerId: player.id,
      fromClubId: userClubId ?? '', toClubId: player.clubId,
      feeM, wageK, contractYears,
    };
    // Cheap deterministic-ish "luck": stable seed + click count XORed in so we
    // get a fresh number each Suggest without storing it in store state.
    luckSeedRef.current = (luckSeedRef.current * 1664525 + 1013904223) >>> 0;
    const luckRoll = (luckSeedRef.current % 10000) / 10000;

    const result = negotiate({
      player,
      offer,
      luckRoll,
      ...(fromClub ? { sellerReputation: fromClub.reputation } : {}),
      ...(myClub ? { buyerReputation: myClub.reputation } : {}),
    });

    if (result.decision.result === 'accept') {
      setPhase({ kind: 'accepted', message: result.decision.reason });
      return;
    }

    // Both 'reject' and 'counter' produce a snap-to value for the dialog.
    const counterFeeM =
      result.decision.result === 'counter'
        ? result.decision.counterFeeM
        : result.decision.minFeeM;
    const counterWageK =
      result.decision.result === 'counter'
        ? result.decision.counterWageK
        : result.decision.minWageK;

    const newFailed = failedRounds + 1;
    setFailedRounds(newFailed);
    if (newFailed >= MAX_FAILED_ROUNDS) {
      setPhase({ kind: 'walkedAway' });
      // Persist into the store so re-opening the buy market hides this player.
      walkAwayFromPlayer(player.id);
      return;
    }
    // Snap sliders to the club's asking values for visual continuity.
    setFeeM(counterFeeM);
    setWageK(counterWageK);
    setPhase({
      kind: 'counter',
      counterFeeM,
      counterWageK,
      message: result.decision.reason,
    });
  }

  function onAcceptCounter() {
    if (phase.kind !== 'counter') return;
    setPhase({ kind: 'counterAccepted' });
  }

  function onConfirmTransfer() {
    if (overBudget) return;
    buyPlayer({ playerId: player.id, feeM, wageK, contractYears });
    onClose();
  }

  // Primary button driven by phase.
  const primary =
    phase.kind === 'idle'
      ? { label: 'Suggest Terms', onClick: onSuggestTerms, kind: 'primary' as const, disabled: overBudget }
      : phase.kind === 'accepted'
        ? { label: 'Confirm Transfer', onClick: onConfirmTransfer, kind: 'primary' as const, disabled: overBudget }
        : phase.kind === 'counter'
          ? { label: 'Accept Terms', onClick: onAcceptCounter, kind: 'primary' as const, disabled: overBudget }
          : phase.kind === 'counterAccepted'
            ? { label: 'Confirm Transfer', onClick: onConfirmTransfer, kind: 'primary' as const, disabled: overBudget }
            : { label: 'Walked Away', onClick: () => {}, kind: 'disabled' as const, disabled: true };

  const sliderLocked = phase.kind === 'walkedAway';

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="card w-full max-w-2xl border border-white/15">
        {/* HEADER */}
        <div className="flex items-start justify-between">
          <div>
            <div className="text-mono text-[10px] uppercase tracking-widest text-pink-300">Negotiate</div>
            <h2 className="text-display text-2xl uppercase mt-1">{player.name}</h2>
            <div className="text-mono text-[11px] text-white/45 tracking-wider mt-0.5">
              {player.position} · Age {player.age} · {fromClub?.name ?? 'Free / Other club'}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/50 hover:text-white text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* PLAYER FACTS */}
        <div className="grid grid-cols-3 gap-3 mt-5 text-mono">
          <Stat label="Market Value" value={`£${player.marketValueM}M`} />
          <Stat label="Current Wage" value={`£${player.wageK}k/wk`} />
          <Stat label="Contract" value={`${player.contractYearsLeft} yr left`} />
        </div>

        {/* SLIDERS */}
        <div className="mt-5 space-y-3">
          <Field label={`Offer Fee — £${feeM}M`}>
            <input
              type="range"
              min={1}
              // Slider tops out at the larger of: a comfortable 1.8× market
              // value, or whatever budget the user actually has. Without the
              // budget term you can be stuck below the assistant's suggested
              // range for a player who's expensive relative to his TM value.
              max={Math.max(40, Math.round(player.marketValueM * 1.8), Math.round(budgetM))}
              value={feeM}
              disabled={sliderLocked}
              onChange={(e) => userMovedSlider(setFeeM, Number(e.target.value))}
              className="w-full accent-pink-400 disabled:opacity-50"
            />
          </Field>
          <Field label={`Weekly Wage — £${wageK}k/wk`}>
            <input
              type="range"
              min={5}
              max={Math.max(50, Math.round(player.wageK * 2))}
              value={wageK}
              disabled={sliderLocked}
              onChange={(e) => userMovedSlider(setWageK, Number(e.target.value))}
              className="w-full accent-cyan-400 disabled:opacity-50"
            />
          </Field>
          <Field label={`Contract — ${contractYears} years`}>
            <input
              type="range"
              min={2}
              max={5}
              value={contractYears}
              disabled={sliderLocked}
              onChange={(e) => userMovedSlider(setContractYears, Number(e.target.value))}
              className="w-full accent-violet-400 disabled:opacity-50"
            />
          </Field>
        </div>

        {/* OVER-BUDGET WARNING */}
        {overBudget && phase.kind !== 'walkedAway' ? (
          <div className="mt-4 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            Over budget — this would cost £{Math.round(targetFeeM)}M and you only have £{Math.round(budgetM)}M.
          </div>
        ) : null}

        {/* PHASE-DEPENDENT MESSAGE BLOCK */}
        {phase.kind === 'idle' ? (
          <AdvisoryPanel
            advisory={advisory}
            {...(fromClub ? { fromClub } : {})}
            {...(myClub ? { myClub } : {})}
          />
        ) : phase.kind === 'accepted' ? (
          <VerdictBlock tone="accept" label="Accepted" body={phase.message} />
        ) : phase.kind === 'counter' ? (
          <VerdictBlock tone="counter" label="Counter offer" body={phase.message} extra={
            <div className="text-mono text-xs mt-2 opacity-85">
              Club asks: £{phase.counterFeeM}M fee · £{phase.counterWageK}k/wk · sliders snapped to match.
            </div>
          } />
        ) : phase.kind === 'counterAccepted' ? (
          <VerdictBlock tone="accept" label="Terms agreed" body="You've accepted the club's terms. Confirm to complete the transfer." />
        ) : (
          <VerdictBlock tone="reject" label="Club has walked away" body={
            `${fromClub?.name ?? 'The club'} won't continue this negotiation. You can't sign this player this window.`
          } />
        )}

        {/* PRESTIGE CALLOUT (only when meaningful) */}
        {advisory.prestigeHeavy && fromClub && myClub ? (
          <div className="mt-3 rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-mono text-[11px] text-amber-100">
            <div className="uppercase tracking-widest text-amber-300">Prestige step-down</div>
            <div className="mt-1 text-amber-100/85">
              {myClub.name} reputation <span className="text-amber-200">{reputationLabel(myClub.reputation)}</span>
              {' '}vs {fromClub.name} <span className="text-amber-200">{reputationLabel(fromClub.reputation)}</span>.
              {' '}Expect to overpay if you want this signing through.
            </div>
          </div>
        ) : null}

        {/* ACTION ROW */}
        <div className="flex items-center justify-between mt-5">
          <div className="text-mono text-[10px] uppercase tracking-widest">
            {phase.kind !== 'walkedAway' && failedRounds > 0 ? (
              <span className="text-amber-300/80">
                Rejected rounds: {failedRounds} / {MAX_FAILED_ROUNDS}
              </span>
            ) : null}
            {phase.kind === 'walkedAway' ? (
              <span className="text-rose-300">Negotiation closed.</span>
            ) : null}
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} className="btn-ghost">Walk away</button>
            <button
              type="button"
              onClick={primary.onClick}
              disabled={primary.disabled}
              className="btn-primary text-sm"
            >
              {primary.label}
            </button>
          </div>
        </div>

        {/* COLLAPSIBLE FACTOR BREAKDOWN (kept for transparency) */}
        <details className="mt-4 text-mono text-[11px] text-white/55">
          <summary className="cursor-pointer text-white/45">Show factor breakdown</summary>
          <ul className="mt-2 space-y-0.5">
            <li>Suggested fair fee: £{advisory.fairFeeM}M · Suggested fair wage: £{advisory.fairWageK}k/wk</li>
            <li>{advisory.isStar ? 'Star profile' : 'Regular profile'} — {advisory.isStar ? 'narrow accept band (~±2%)' : 'wider accept band (~±10%)'}</li>
            <li>Prestige premium: ×{(advisory.fairFeeM / Math.max(0.1, advisory.fairFeeM)).toFixed(2)}</li>
          </ul>
        </details>
      </div>
    </div>
  );
}

function AdvisoryPanel({
  advisory,
}: {
  advisory: {
    feeLow: number; feeHigh: number; wageLow: number; wageHigh: number;
    isStar: boolean; prestigeHeavy: boolean; keyToSeller: boolean;
  };
  fromClub?: Club;
  myClub?: Club;
}) {
  const stance =
    advisory.isStar
      ? 'Star profile — they\'ll dig in. Don\'t expect a discount below their valuation.'
      : advisory.prestigeHeavy
        ? 'Prestige gap — expect to overpay above the suggested range.'
        : advisory.keyToSeller
          ? 'Key to the selling club — they\'ll hold out for top dollar.'
          : 'Squad player — there\'s honest room to negotiate.';

  return (
    <div className="mt-4 rounded-md border border-cyan-400/40 bg-cyan-500/5 px-3 py-3">
      <div className="text-mono uppercase text-[10px] tracking-widest text-cyan-300">Assistant recommendation</div>
      <div className="mt-2 grid grid-cols-2 gap-3 text-mono text-xs">
        <div>
          <div className="text-white/45 uppercase tracking-widest text-[10px]">Suggested fee</div>
          <div className="text-white text-sm mt-0.5">£{advisory.feeLow}M – £{advisory.feeHigh}M</div>
        </div>
        <div>
          <div className="text-white/45 uppercase tracking-widest text-[10px]">Suggested wage</div>
          <div className="text-white text-sm mt-0.5">£{advisory.wageLow}k – £{advisory.wageHigh}k/wk</div>
        </div>
      </div>
      <div className="text-white/65 text-[13px] italic mt-2">"{stance}"</div>
      <div className="text-mono text-[10px] tracking-widest text-white/35 uppercase mt-2">
        Hit Suggest Terms when you're happy with the sliders.
      </div>
    </div>
  );
}

function VerdictBlock({
  tone, label, body, extra,
}: { tone: 'accept' | 'counter' | 'reject'; label: string; body: string; extra?: React.ReactNode }) {
  const style =
    tone === 'accept' ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-100' :
    tone === 'counter' ? 'border-amber-500/40 bg-amber-500/10 text-amber-100' :
    'border-rose-500/40 bg-rose-500/10 text-rose-100';
  return (
    <div className={`mt-4 rounded-md border px-3 py-3 ${style}`}>
      <div className="text-mono text-[10px] uppercase tracking-widest opacity-80">{label}</div>
      <div className="text-sm mt-1">{body}</div>
      {extra}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-mono text-[11px] uppercase tracking-wider text-white/55 mb-1">{label}</div>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/5 rounded px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest text-white/40">{label}</div>
      <div className="text-sm">{value}</div>
    </div>
  );
}
