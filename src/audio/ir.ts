/**
 * Synthesize a stereo impulse response: white noise shaped by an exponential
 * decay envelope. Used as the convolver buffer for the "Space" reverb.
 */
export function makeIR(
  ctx: BaseAudioContext,
  duration: number,
  decay: number,
): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * duration);
  const buf = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}
