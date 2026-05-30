/**
 * BreathController — the single home for breath-cycle phase math (v4.4).
 *
 * Pure and framework-free: it holds no timer and never reads a clock itself.
 * The caller passes an absolute time (`AudioContext.currentTime` in the app,
 * an injected value in tests) and gets back the current phase, eased amplitude,
 * and cycle progress. Driving phase from the audio clock — rather than
 * `performance.now()` / RAF deltas — means a backgrounded tab (where RAF pauses)
 * resumes at the correct phase on refocus, and a 30+ minute session never
 * accumulates drift because phase is `mod(time, cycleLength)`, not an integral.
 */
import type { BreathTuple } from './patterns';

export type BreathPhase = 'inhale' | 'hold-full' | 'exhale' | 'hold-empty';

export interface BreathFrame {
  phase: BreathPhase;
  /** 0..1 progress within the current phase. */
  phaseProgress: number;
  /** 0..1 eased radius (0 = trough, 1 = peak). Eased for inhale/exhale. */
  amplitude: number;
  /** 0..1 progress through the whole cycle (drives the phase-indicator ring). */
  cycleProgress: number;
  /** True only on the first frame after a phase boundary is crossed. */
  transition: boolean;
}

const PHASE_ORDER: readonly BreathPhase[] = [
  'inhale',
  'hold-full',
  'exhale',
  'hold-empty',
];

/** Smooth ease-in-out (smoothstep): gentle at both ends of a breath. */
function smoothstep(x: number): number {
  const c = Math.min(1, Math.max(0, x));
  return c * c * (3 - 2 * c);
}

interface ResolvedPhase {
  phase: BreathPhase;
  start: number; // cumulative seconds at phase start
  duration: number;
}

export class BreathController {
  private phases: ResolvedPhase[] = [];
  private cycleLength = 0;
  private t0 = 0;
  private lastPhase: BreathPhase | null = null;

  constructor(tuple: BreathTuple) {
    this.setTuple(tuple);
  }

  /** Replace the active pattern. Zero-duration phases (holds) are dropped. */
  setTuple(tuple: BreathTuple): void {
    const phases: ResolvedPhase[] = [];
    let cursor = 0;
    for (let i = 0; i < PHASE_ORDER.length; i++) {
      const duration = Math.max(0, tuple[i] ?? 0);
      if (duration <= 0) continue;
      phases.push({ phase: PHASE_ORDER[i]!, start: cursor, duration });
      cursor += duration;
    }
    this.phases = phases;
    this.cycleLength = cursor;
  }

  /** Anchor the cycle so that `frameAt(nowSec)` begins a fresh inhale. */
  reset(nowSec: number): void {
    this.t0 = nowSec;
    this.lastPhase = null;
  }

  /** Total cycle length in seconds (sum of non-zero phases). */
  getCycleLength(): number {
    return this.cycleLength;
  }

  /** Compute the breath frame at an absolute time (seconds). */
  frameAt(nowSec: number): BreathFrame {
    if (this.cycleLength <= 0 || this.phases.length === 0) {
      // Degenerate pattern: hold steady at trough, no motion.
      return {
        phase: 'hold-empty',
        phaseProgress: 0,
        amplitude: 0,
        cycleProgress: 0,
        transition: false,
      };
    }

    const elapsed = nowSec - this.t0;
    // Positive modulo so negative elapsed (clock before reset) still maps sanely.
    const t = ((elapsed % this.cycleLength) + this.cycleLength) % this.cycleLength;

    let current = this.phases[this.phases.length - 1]!;
    for (const p of this.phases) {
      if (t >= p.start && t < p.start + p.duration) {
        current = p;
        break;
      }
    }

    const phaseProgress =
      current.duration > 0 ? (t - current.start) / current.duration : 0;

    let amplitude: number;
    switch (current.phase) {
      case 'inhale':
        amplitude = smoothstep(phaseProgress);
        break;
      case 'hold-full':
        amplitude = 1;
        break;
      case 'exhale':
        amplitude = smoothstep(1 - phaseProgress);
        break;
      case 'hold-empty':
      default:
        amplitude = 0;
        break;
    }

    const transition = this.lastPhase !== null && this.lastPhase !== current.phase;
    this.lastPhase = current.phase;

    return {
      phase: current.phase,
      phaseProgress,
      amplitude,
      cycleProgress: t / this.cycleLength,
      transition,
    };
  }
}
