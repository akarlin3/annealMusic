/**
 * Single home for the input-latency estimate (heuristic-drift rule: used by both
 * `InputVoice.connect()` and the UI readout).
 *
 * Web Audio does not expose true mic→node input latency, so this is an
 * output-pipeline *estimate*, surfaced as such in the UI ("~30ms input
 * latency"). `baseLatency` is the context's internal block latency;
 * `outputLatency` (Chrome/Firefox) is the full output-pipeline latency and is
 * absent on Safari, where we fall back to 2× `baseLatency` as a coarse proxy.
 */
export function estimateLatencyMs(ctx: AudioContext): number {
  const base = ctx.baseLatency ?? 0;
  const out = (ctx as { outputLatency?: number }).outputLatency ?? base;
  return Math.round((base + out) * 1000);
}
