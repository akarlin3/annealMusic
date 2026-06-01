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

/**
 * Resamples an AudioBuffer to a target sample rate using OfflineAudioContext.
 * If the buffer's sample rate matches the target sample rate, it returns the buffer unchanged.
 */
export async function resampleAudioBuffer(
  buffer: AudioBuffer,
  targetSampleRate: number,
): Promise<AudioBuffer> {
  if (buffer.sampleRate === targetSampleRate) {
    return buffer;
  }

  const channels = buffer.numberOfChannels;
  const duration = buffer.duration;
  const length = Math.ceil(duration * targetSampleRate);

  const OfflineCtxClass =
    typeof OfflineAudioContext !== 'undefined'
      ? OfflineAudioContext
      : typeof window !== 'undefined'
        ? (
            window as unknown as {
              OfflineAudioContext?: typeof OfflineAudioContext;
              webkitOfflineAudioContext?: typeof OfflineAudioContext;
            }
          ).OfflineAudioContext ||
          (
            window as unknown as {
              OfflineAudioContext?: typeof OfflineAudioContext;
              webkitOfflineAudioContext?: typeof OfflineAudioContext;
            }
          ).webkitOfflineAudioContext
        : null;

  if (!OfflineCtxClass) {
    console.warn(
      '[ir] OfflineAudioContext is not supported. Skipping resampling.',
    );
    return buffer;
  }

  const offlineCtx = new OfflineCtxClass(channels, length, targetSampleRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(offlineCtx.destination);
  source.start(0);

  return await offlineCtx.startRendering();
}

/**
 * Ensures that the buffer assigned to a ConvolverNode matches the BaseAudioContext's
 * active sample rate. If it differs, it resamples the buffer using an OfflineAudioContext,
 * returns the resampled buffer, and assigns it to the convolver.
 * Returns a Promise that resolves when the buffer is set.
 */
export async function setupConvolverBuffer(
  ctx: BaseAudioContext,
  convolver: ConvolverNode,
  buffer: AudioBuffer,
): Promise<AudioBuffer> {
  if (buffer.sampleRate === ctx.sampleRate) {
    convolver.buffer = buffer;
    return buffer;
  }

  try {
    const resampled = await resampleAudioBuffer(buffer, ctx.sampleRate);
    convolver.buffer = resampled;
    return resampled;
  } catch (err) {
    console.error('[ir] Failed to resample impulse response buffer:', err);
    convolver.buffer = buffer;
    return buffer;
  }
}
