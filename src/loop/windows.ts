/**
 * Window + crossfade curve utilities. The single home for grain windowing and
 * equal-power fades, referenced by `GranularPlayer` and `SeamLoopPlayer` so the
 * windowing math is never redefined (heuristic-drift rule).
 */

/**
 * A raised-cosine (Hann) window of `length` samples, suitable for
 * `AudioParam.setValueCurveAtTime` as a per-grain amplitude envelope. Starts and
 * ends at 0, peaks at 1 in the middle, so overlapping grains sum smoothly.
 */
export function hannWindow(length: number): Float32Array {
  const n = Math.max(2, Math.floor(length));
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (n - 1)));
  }
  return out;
}

/**
 * Equal-power fade-in curve (sin ramp) over `length` samples: rises 0→1 such
 * that, paired with `equalPowerFadeOut`, the summed power stays constant across
 * a crossfade (sin² + cos² = 1) — no dip or bump at the loop seam.
 */
export function equalPowerFadeIn(length: number): Float32Array {
  const n = Math.max(2, Math.floor(length));
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = Math.sin((Math.PI / 2) * (i / (n - 1)));
  }
  return out;
}

/** Equal-power fade-out curve (cos ramp), the complement of `equalPowerFadeIn`. */
export function equalPowerFadeOut(length: number): Float32Array {
  const n = Math.max(2, Math.floor(length));
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    out[i] = Math.cos((Math.PI / 2) * (i / (n - 1)));
  }
  return out;
}
