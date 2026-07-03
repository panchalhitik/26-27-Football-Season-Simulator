import { describe, expect, it } from 'vitest';
import {
  tauTempo,
  tauTilt,
  TAU_TEMPO_CLAMP,
  TAU_TILT_CLAMP,
} from './tactics';

describe('tauTempo (symmetric)', () => {
  it('order-independent (τ_tempo(A, B) = τ_tempo(B, A))', () => {
    expect(tauTempo('4-3-3', '3-5-2')).toBeCloseTo(tauTempo('3-5-2', '4-3-3'), 9);
    expect(tauTempo('4-3-3', '3-4-3')).toBeCloseTo(tauTempo('3-4-3', '4-3-3'), 9);
  });

  it('both ultra-open shapes produce positive tempo', () => {
    expect(tauTempo('3-4-3', '4-3-3')).toBeGreaterThan(0);
  });

  it('respects the ±TAU_TEMPO_CLAMP bound', () => {
    expect(Math.abs(tauTempo('3-4-3', '3-4-3'))).toBeLessThanOrEqual(TAU_TEMPO_CLAMP);
  });
});

describe('tauTilt (antisymmetric)', () => {
  it('antisymmetric: τ_tilt(A, B) = -τ_tilt(B, A)', () => {
    expect(tauTilt('4-3-3', '4-1-4-1')).toBeCloseTo(-tauTilt('4-1-4-1', '4-3-3'), 9);
    expect(tauTilt('3-4-3', '4-3-2-1')).toBeCloseTo(-tauTilt('4-3-2-1', '3-4-3'), 9);
  });

  it('is zero when both sides play the same shape', () => {
    expect(tauTilt('4-3-3', '4-3-3')).toBe(0);
    expect(tauTilt('4-2-3-1', '4-2-3-1')).toBe(0);
  });

  it('respects the ±TAU_TILT_CLAMP bound', () => {
    // Construct the most extreme matchup we have: 3-4-3 (defensiveLean -0.4) vs 4-1-4-1 (+0.1)
    expect(Math.abs(tauTilt('3-4-3', '4-1-4-1'))).toBeLessThanOrEqual(TAU_TILT_CLAMP);
    expect(Math.abs(tauTilt('4-1-4-1', '3-4-3'))).toBeLessThanOrEqual(TAU_TILT_CLAMP);
  });
});
