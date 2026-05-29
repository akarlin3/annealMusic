/**
 * Shared scaffolding for the physical-DSP unit tests (imported only by `*.test.ts`
 * files, so it is tree-shaken out of the app and worklet bundles). Kept in one
 * place so the deterministic RNG and the signal metrics don't drift across the
 * per-sub-model test files.
 */

/** Deterministic pseudo-noise so tests are reproducible. */
export function seeded(seed = 1): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export function rms(buf: Float32Array): number {
  let sum = 0;
  for (const v of buf) sum += v * v;
  return Math.sqrt(sum / buf.length);
}

export function allFinite(buf: Float32Array): boolean {
  for (const v of buf) if (!Number.isFinite(v)) return false;
  return true;
}

export function peak(buf: Float32Array): number {
  let p = 0;
  for (const v of buf) p = Math.max(p, Math.abs(v));
  return p;
}

/** Render `n` samples through a freshly built DSP `render`-able. */
export function renderN(
  dsp: { render: (b: Float32Array) => void },
  n: number,
): Float32Array {
  const out = new Float32Array(n);
  dsp.render(out);
  return out;
}

/** Standard sample rate for the DSP tests. */
export const SR = 48000;
