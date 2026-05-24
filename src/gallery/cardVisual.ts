/**
 * Deterministic static visualizer frame for a gallery card. Reuses the live
 * `drawFrame` (with `spectrum=null`) so card art matches the in-app look, but
 * renders exactly one frame with phases seeded from a hash of the payload —
 * same patch → same image, different patches → visibly different geometry.
 */
import { drawFrame, type LoopRing } from '@/visual/draw';
import { HARMONICS } from '@/types/audio';
import { decodeState } from '@/share/encode';
import { DEFAULT_PARAMS } from '@/state/params';
import { SCHEMA_VERSION } from '@/share/schema';
import { SLOT_IDS } from '@/loop/types';

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Render one deterministic frame of the patch's geometry onto a 2D context. */
export function drawCardFrame(
  ctx2d: CanvasRenderingContext2D,
  payload: string,
  w: number,
  h: number,
): void {
  const decoded = decodeState(SCHEMA_VERSION, payload);
  const params = { ...DEFAULT_PARAMS, ...decoded.params };
  const count = Math.max(2, Math.round(params.density));

  const freqs: number[] = [];
  for (let i = 0; i < count; i++) {
    const ratio = HARMONICS[i] ?? i + 1;
    freqs.push(params.rootFreq * ratio * Math.pow(params.spread, i));
  }

  // Seed phases deterministically from the payload so the frame is stable.
  const seed = hashString(payload);
  const phases = freqs.map(
    (_, i) => ((seed >> (i % 16)) % 628) / 100, // 0..~2π
  );

  const loops: LoopRing[] = [];
  SLOT_IDS.forEach((id, idx) => {
    const slot = decoded.loops[id];
    const flagged = slot.frozen || payload.includes(`L${id}.cap=1`);
    if (flagged && !slot.muted) {
      loops.push({ slot: idx, level: 0.5, frozen: slot.frozen });
    }
  });

  // Clear to the app background first (drawFrame only paints a faint trail fade).
  ctx2d.fillStyle = '#0c0a09';
  ctx2d.fillRect(0, 0, w, h);

  drawFrame(ctx2d, {
    w,
    h,
    dt: 0,
    phases,
    freqs,
    count,
    spectrum: null,
    sampleRate: 48000,
    fftSize: 1024,
    loops: loops.length > 0 ? loops : undefined,
  });
}
