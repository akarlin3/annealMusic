/**
 * Dual-resonator synthesized bell chime placeholder for v4.0.
 * Synthesizes a beautiful, soft bell tone with inharmonic decay.
 * Compatible with both AudioContext and OfflineAudioContext via BaseAudioContext.
 */
export function playBell(
  ctx: BaseAudioContext,
  destination: AudioNode,
  frequency = 660,
  startTime = ctx.currentTime,
): void {
  const duration = 4.0; // 4 seconds decay
  const sampleRate = ctx.sampleRate;
  const bufferSize = sampleRate * 0.04; // 40ms noise burst
  const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
  const data = buffer.getChannelData(0);

  // Fill buffer with random noise for pluck trigger
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  // Filter 1: Bandpass at fundamental frequency
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.setValueAtTime(frequency, startTime);
  bp.Q.setValueAtTime(100, startTime);

  // Filter 2: Bandpass at overtone (1.5x fundamental) for metallic bell-like character
  const bp2 = ctx.createBiquadFilter();
  bp2.type = 'bandpass';
  bp2.frequency.setValueAtTime(frequency * 1.5, startTime);
  bp2.Q.setValueAtTime(80, startTime);

  // Envelope for fundamental
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(0.3, startTime + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  // Envelope for overtone
  const gain2 = ctx.createGain();
  gain2.gain.setValueAtTime(0, startTime);
  gain2.gain.linearRampToValueAtTime(0.15, startTime + 0.005);
  gain2.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);

  // Connection chain
  noise.connect(bp).connect(gain).connect(destination);
  noise.connect(bp2).connect(gain2).connect(destination);

  // Start the trigger source
  noise.start(startTime);
}
