/**
 * AudioWorklet processor for the Pulse engine.
 * Generates sample-accurate, rhythmically locked percussive grains (filtered noise + pitched resonators)
 * at subdivisions of the piece tempo. Supports swing, humanize, tone (cutoff/decay), and accents.
 */

const HARMONICS = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5];

const DENSITY_RATIOS = [0.25, 0.5, 1.0, 2.0, 4.0, 3.0];
// whole = 0 (1/4 beat), half = 1 (1/2 beat), quarter = 2 (1 beat), eighth = 3 (2/beat), sixteenth = 4 (4/beat), triplet = 5 (3/beat)
const DENSITY_SUBDIVISIONS_PER_BAR = [1, 2, 4, 8, 16, 12];

class PulseProcessor extends AudioWorkletProcessor {
  private currentSampleCount = 0;
  private nextStrikeSample = 0;
  private strikeIndex = 0;

  // Synthesis states for 8 partials
  private phases = new Float32Array(8);
  private envelopes = new Float32Array(8);
  private partialGains = new Float32Array(8);
  // Per-partial fusion gain multipliers, pushed from the main thread (computed
  // by the pure fusion core in audio/fusion.ts). Unity = behavior-preserving.
  private fusionGains = new Float32Array(8).fill(1);

  // Noise state
  private noiseEnvelope = 0;
  private noiseFilterState = 0;

  static get parameterDescriptors(): AudioParamDescriptor[] {
    return [
      { name: 'f0', defaultValue: 110, automationRate: 'k-rate' },
      { name: 'tempoBpm', defaultValue: 60, automationRate: 'k-rate' },
      { name: 'tempoSet', defaultValue: 0, automationRate: 'k-rate' },
      { name: 'density', defaultValue: 2, automationRate: 'k-rate' }, // default: quarter
      { name: 'accent', defaultValue: 1, automationRate: 'k-rate' },
      { name: 'tone', defaultValue: 0.5, automationRate: 'k-rate' },
      { name: 'swing', defaultValue: 0, automationRate: 'k-rate' },
      { name: 'humanize', defaultValue: 0, automationRate: 'k-rate' },
      { name: 'detune', defaultValue: 0, automationRate: 'k-rate' },
      { name: 'spread', defaultValue: 1, automationRate: 'k-rate' },
      { name: 'densityVal', defaultValue: 6, automationRate: 'k-rate' },
    ];
  }

  constructor() {
    super();
    // Initialize gains with falling shape for higher harmonics
    for (let i = 0; i < 8; i++) {
      this.partialGains[i] = 1.0 / (i + 1);
    }

    // Apply fusion multipliers pushed from the main thread. The worklet is a
    // thin applier — it never derives the fusion math itself.
    this.port.onmessage = (event: MessageEvent) => {
      const data = event.data as { type?: string; gains?: number[] };
      if (data?.type === 'fusionGains' && Array.isArray(data.gains)) {
        for (let i = 0; i < 8; i++) {
          const m = data.gains[i];
          this.fusionGains[i] = typeof m === 'number' && m >= 0 ? m : 1;
        }
      }
    };
  }

  private triggerStrike(isAccent: boolean, densityVal: number) {
    const accentMultiplier = isAccent ? 1.6 : 0.8;

    // Reset resonators envelopes
    for (let i = 0; i < 8; i++) {
      if (i < densityVal) {
        const gain = this.partialGains[i] ?? 0;
        const fusion = this.fusionGains[i] ?? 1;
        this.envelopes[i] = gain * fusion * accentMultiplier;
      } else {
        this.envelopes[i] = 0;
      }
    }

    // Reset noise envelope
    this.noiseEnvelope = 0.5 * accentMultiplier;
  }

  private calculateNextStrike(
    bpm: number,
    densityIdx: number,
    swing: number,
    humanize: number,
  ) {
    const ratio =
      DENSITY_RATIOS[Math.max(0, Math.min(5, Math.round(densityIdx)))] ?? 1.0;
    const samplesPerBeat = sampleRate * (60.0 / Math.max(10, bpm));
    const samplesPerSub = samplesPerBeat / ratio;

    // Base target sample for this strike index
    const baseSampleIndex = this.strikeIndex * samplesPerSub;

    // Apply Swing (only applies to even subdivisions: eighth and sixteenth notes)
    let swingOffset = 0;
    if (ratio >= 2.0 && this.strikeIndex % 2 === 1) {
      swingOffset = swing * (samplesPerSub / 3.0);
    }

    // Apply Humanization Timing Jitter (up to 15ms)
    const maxJitterSamples = sampleRate * 0.015;
    const jitterOffset = (Math.random() * 2 - 1) * humanize * maxJitterSamples;

    this.nextStrikeSample = Math.round(
      baseSampleIndex + swingOffset + jitterOffset,
    );
  }

  process(
    _inputs: Float32Array[][],
    outputs: Float32Array[][],
    params: Record<string, Float32Array>,
  ): boolean {
    const out = outputs[0]?.[0];
    if (!out) return true;

    // Get current parameter values (take first index since they are k-rate)
    const f0 = params.f0?.[0] ?? 110;
    const bpm = params.tempoBpm?.[0] ?? 60;
    const tempoSet = params.tempoSet?.[0] ?? 0;
    const densityIdx = params.density?.[0] ?? 2;
    const accent = params.accent?.[0] ?? 1;
    const tone = params.tone?.[0] ?? 0.5;
    const swing = params.swing?.[0] ?? 0;
    const humanize = params.humanize?.[0] ?? 0;
    const detune = params.detune?.[0] ?? 0;
    const spread = params.spread?.[0] ?? 1;
    const densityVal = Math.round(params.densityVal?.[0] ?? 6);

    const len = out.length;

    // Calculate dynamic decay rates based on tone
    // Low tone = longer decay (deep thuds), High tone = short decay (bright ticks)
    const decaySec = (1.0 - tone * 0.8) * 0.35; // 0.07s to 0.35s
    const noiseDecaySec = (1.0 - tone * 0.5) * 0.06; // 0.03s to 0.06s

    // Calculate one-pole filter coefficient for noise tone control
    const cutoff = 150 + tone * 7350; // 150Hz to 7500Hz
    const alpha = (2 * Math.PI * cutoff) / sampleRate;

    // Pre-calculate frequencies and per-sample decay factors
    const freqs = new Float32Array(8);
    const decayFactors = new Float32Array(8);
    for (let i = 0; i < 8; i++) {
      const ratio = HARMONICS[i] ?? 1.0;
      // Frequency over the harmonic lattice
      const baseFreq = f0 * Math.pow(ratio, spread);
      // Detune cents translation
      const detunedFreq = baseFreq * Math.pow(2.0, detune / 1200.0);
      freqs[i] = detunedFreq;

      // Higher partials decay faster for realistic struck-plate physics
      const pDecaySec = decaySec * (1.0 / ratio);
      decayFactors[i] = Math.exp(
        -1.0 / (sampleRate * Math.max(0.01, pDecaySec)),
      );
    }
    const noiseDecayFactor = Math.exp(
      -1.0 / (sampleRate * Math.max(0.005, noiseDecaySec)),
    );

    for (let n = 0; n < len; n++) {
      const sampleTime = this.currentSampleCount;

      // Check if we reached the scheduled strike sample
      if (sampleTime >= this.nextStrikeSample) {
        // Accent logic: Emphasize beat 1 of each bar
        const subdivisionsPerBar =
          DENSITY_SUBDIVISIONS_PER_BAR[
            Math.max(0, Math.min(5, Math.round(densityIdx)))
          ] ?? 4;
        const isAccent = this.strikeIndex % subdivisionsPerBar === 0;

        this.triggerStrike(isAccent && accent === 1, densityVal);

        // Schedule next strike
        this.strikeIndex++;
        this.calculateNextStrike(bpm, densityIdx, swing, humanize);
      }

      // 1. Synthesize 8 partials (damped resonators)
      let resonatorsSum = 0;
      for (let i = 0; i < 8; i++) {
        if (i < densityVal) {
          const env = this.envelopes[i] ?? 0;
          if (env > 0.0001) {
            const phase = this.phases[i] ?? 0;
            const freq = freqs[i] ?? 0;
            resonatorsSum += Math.sin(phase) * env;
            // Advance phase
            let nextPhase = phase + (2 * Math.PI * freq) / sampleRate;
            if (nextPhase > 2 * Math.PI) {
              nextPhase -= 2 * Math.PI;
            }
            this.phases[i] = nextPhase;
            // Decay envelope
            const decay = decayFactors[i] ?? 0.99;
            this.envelopes[i] = env * decay;
          }
        }
      }

      // 2. Synthesize filtered white noise burst
      let noiseVal = 0;
      if (this.noiseEnvelope > 0.0001) {
        const whiteNoise = Math.random() * 2 - 1;
        const shapedNoise = whiteNoise * this.noiseEnvelope;
        // One-pole lowpass filter for the noise burst
        this.noiseFilterState += alpha * (shapedNoise - this.noiseFilterState);
        noiseVal = this.noiseFilterState;
        // Decay noise envelope
        this.noiseEnvelope *= noiseDecayFactor;
      }

      // 3. Master mix
      // If tempo is not set, the master volume is muted (0.0), but we still progress scheduling
      const volumeMute = tempoSet === 1 ? 1.0 : 0.0;
      out[n] = (resonatorsSum * 0.35 + noiseVal * 0.2) * volumeMute;

      this.currentSampleCount++;
    }

    return true;
  }
}

registerProcessor('pulse-processor', PulseProcessor);
