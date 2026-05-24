import type { CurveName } from '@/session/types';

/** Maps normalized progress (0..1) to eased progress (0..1). */
export type Easing = (t: number) => number;

const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t);

export const linear: Easing = (t) => clamp01(t);

/** Symmetric ease — slow at both ends, fastest in the middle. */
export const easeInOut: Easing = (t) => {
  const x = clamp01(t);
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
};

/** Steeper symmetric ease (exponential in/out) — long flat tails, sharp middle. */
export const exponential: Easing = (t) => {
  const x = clamp01(t);
  if (x === 0) return 0;
  if (x === 1) return 1;
  return x < 0.5
    ? Math.pow(2, 20 * x - 10) / 2
    : (2 - Math.pow(2, -20 * x + 10)) / 2;
};

export const CURVES: Record<CurveName, Easing> = {
  linear,
  easeInOut,
  exponential,
};
