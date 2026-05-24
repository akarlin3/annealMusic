import { clampParam, type AnnealMusicParams } from '@/state/params';
import { CURVES, type Easing } from '@/session/curves';
import type { Arc, ArcFrame, ArcTargetKey, TargetValue } from '@/session/types';
import type { AnnealEngineCapabilities } from '@/audio/engines/types';

const FRACTION_EPSILON = 1e-6;

/** Resolve a `'min'`/`'max'` sentinel via the existing per-key clamp bounds. */
function boundValue(key: ArcTargetKey, which: 'min' | 'max'): number {
  return clampParam(key, which === 'min' ? -Infinity : Infinity);
}

/** Resolve one target to an absolute value (multiplier-on-start, or a bound). */
function resolveTarget(
  key: ArcTargetKey,
  target: TargetValue,
  startParams: AnnealMusicParams,
): number {
  if (target === 'min' || target === 'max') return boundValue(key, target);
  return clampParam(key, startParams[key] * target);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Pure forward driver for an arc. All clocks live outside: `tick(elapsedSec)` is
 * a deterministic function of elapsed time and the constructor inputs — no
 * `Date`, no `performance.now`, no timers. The orchestrator drives `tick()` from
 * an interval whose `elapsedSec` is derived from `AudioContext.currentTime`.
 *
 * Sentinels (`'min'`/`'max'`/`'restoreStart'`) and the per-segment anchor chain
 * are resolved once at construction, so `tick()` is plain arithmetic.
 */
export class ArcRunner {
  readonly warnings: string[] = [];

  private readonly durationSec: number;
  private readonly activeKeys: ArcTargetKey[];
  private readonly segStart: number[];
  private readonly segDur: number[];
  private readonly segCurve: Easing[] = [];
  /** Per-segment start/end absolute values, keyed by active key. */
  private readonly start: Partial<Record<ArcTargetKey, number>>[] = [];
  private readonly end: Partial<Record<ArcTargetKey, number>>[] = [];

  constructor(
    arc: Arc,
    durationSec: number,
    startParams: AnnealMusicParams,
    caps: AnnealEngineCapabilities,
  ) {
    this.durationSec = durationSec;

    const sum = arc.segments.reduce((s, seg) => s + seg.fraction, 0);
    if (Math.abs(sum - 1) > FRACTION_EPSILON) {
      throw new Error(
        `arc '${arc.id}' segment fractions sum to ${sum}, expected 1`,
      );
    }

    // Active key set: the union of keys named by any per-key (non-restore) segment.
    const keys = new Set<ArcTargetKey>();
    for (const seg of arc.segments) {
      if (seg.targets === 'restoreStart') continue;
      for (const k of Object.keys(seg.targets) as ArcTargetKey[]) keys.add(k);
    }

    // Drop density targets when the engine locks density while playing.
    if (caps.densityLockedWhilePlaying && keys.has('density')) {
      keys.delete('density');
      this.warnings.push(
        'density target ignored: engine locks density while playing',
      );
    }
    this.activeKeys = [...keys];

    // Per-segment timing.
    this.segStart = [];
    this.segDur = [];
    let acc = 0;
    for (const seg of arc.segments) {
      this.segStart.push(acc * durationSec);
      this.segDur.push(seg.fraction * durationSec);
      this.segCurve.push(CURVES[seg.curve]);
      acc += seg.fraction;
    }

    // Anchor chain: start[0] = captured start; end[i] resolves the segment's
    // targets (multiplier always on the START value); a key absent from a
    // segment holds; start[i+1] = end[i] for continuity.
    let prevEnd: Partial<Record<ArcTargetKey, number>> = {};
    for (const k of this.activeKeys) prevEnd[k] = startParams[k];

    arc.segments.forEach((seg, i) => {
      const segStart = { ...prevEnd };
      const segEnd: Partial<Record<ArcTargetKey, number>> = {};
      for (const k of this.activeKeys) {
        if (seg.targets === 'restoreStart') {
          segEnd[k] = startParams[k];
        } else if (k in seg.targets) {
          segEnd[k] = resolveTarget(
            k,
            seg.targets[k] as TargetValue,
            startParams,
          );
        } else {
          segEnd[k] = segStart[k]; // holds across this segment
        }
      }
      this.start[i] = segStart;
      this.end[i] = segEnd;
      prevEnd = segEnd;
    });
  }

  /** Compute the param values for a given elapsed time. Pure. */
  tick(elapsedSec: number): ArcFrame {
    const lastIndex = this.segStart.length - 1;
    const progress =
      this.durationSec > 0
        ? Math.min(1, Math.max(0, elapsedSec / this.durationSec))
        : 1;

    if (elapsedSec >= this.durationSec) {
      return {
        params: this.materialize(this.end[lastIndex] ?? {}),
        segmentIndex: lastIndex,
        progress: 1,
        done: true,
      };
    }

    // Locate the active segment (segments are contiguous and cover [0, duration]).
    let i = 0;
    while (i < lastIndex && elapsedSec >= this.segStart[i]! + this.segDur[i]!) {
      i += 1;
    }

    const dur = this.segDur[i]!;
    const localT = dur > 0 ? (elapsedSec - this.segStart[i]!) / dur : 1;
    const eased = this.segCurve[i]!(localT);

    const start = this.start[i]!;
    const end = this.end[i]!;
    const out: Partial<Record<ArcTargetKey, number>> = {};
    for (const k of this.activeKeys) {
      out[k] = lerp(start[k]!, end[k]!, eased);
    }

    return {
      params: this.materialize(out),
      segmentIndex: i,
      progress,
      done: false,
    };
  }

  /** Coerce structural integer params (density) and widen the key type. */
  private materialize(
    values: Partial<Record<ArcTargetKey, number>>,
  ): Partial<AnnealMusicParams> {
    const out: Partial<AnnealMusicParams> = {};
    for (const k of this.activeKeys) {
      const v = values[k];
      if (v === undefined) continue;
      out[k] = k === 'density' ? Math.round(v) : v;
    }
    return out;
  }
}
