/**
 * Single home for reading a normalized RMS (0..1) from an analyser's
 * time-domain data — used by the level meter, the visualizer input ring, and
 * the feedback guard so they all agree on "how loud is the input right now."
 */
export function readRms(analyser: AnalyserNode): number {
  const buf = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(buf);
  let sum = 0;
  for (let i = 0; i < buf.length; i++) {
    const v = ((buf[i] ?? 128) - 128) / 128;
    sum += v * v;
  }
  return Math.sqrt(sum / buf.length);
}
