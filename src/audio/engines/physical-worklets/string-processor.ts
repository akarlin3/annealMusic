/**
 * AudioWorklet wrapper for the Karplus-Strong string model. Thin: it owns no DSP
 * of its own — it pulls k-rate params and renders the shared `KarplusStrong`
 * class (the single source of truth, also unit-tested directly).
 */
import { KarplusStrong } from '@/audio/engines/physical-dsp/string';

class StringProcessor extends AudioWorkletProcessor {
  private readonly dsp = new KarplusStrong(sampleRate);

  static get parameterDescriptors(): AudioParamDescriptor[] {
    return [
      { name: 'f0', defaultValue: 110, automationRate: 'k-rate' },
      { name: 'excitation', defaultValue: 0.5, automationRate: 'k-rate' },
      { name: 'damping', defaultValue: 0.4, automationRate: 'k-rate' },
      { name: 'brightness', defaultValue: 0.5, automationRate: 'k-rate' },
      { name: 'detune', defaultValue: 0, automationRate: 'k-rate' },
    ];
  }

  process(
    _inputs: Float32Array[][],
    outputs: Float32Array[][],
    params: Record<string, Float32Array>,
  ): boolean {
    const out = outputs[0]?.[0];
    if (!out) return true;
    this.dsp.setFrequency(params.f0?.[0] ?? 110);
    this.dsp.setDetuneCents(params.detune?.[0] ?? 0);
    this.dsp.setDamping(params.damping?.[0] ?? 0.4);
    this.dsp.setBrightness(params.brightness?.[0] ?? 0.5);
    this.dsp.setExcitation(params.excitation?.[0] ?? 0.5);
    this.dsp.render(out);
    return true;
  }
}

registerProcessor('string-processor', StringProcessor);
