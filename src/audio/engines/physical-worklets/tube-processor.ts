/**
 * AudioWorklet wrapper for the cylindrical-waveguide tube model. Renders the
 * shared `Waveguide` DSP class.
 */
import { Waveguide } from '@/audio/engines/physical-dsp/tube';

class TubeProcessor extends AudioWorkletProcessor {
  private readonly dsp = new Waveguide(sampleRate);

  static get parameterDescriptors(): AudioParamDescriptor[] {
    return [
      { name: 'f0', defaultValue: 110, automationRate: 'k-rate' },
      { name: 'excitation', defaultValue: 0.5, automationRate: 'k-rate' },
      { name: 'damping', defaultValue: 0.4, automationRate: 'k-rate' },
      { name: 'brightness', defaultValue: 0.5, automationRate: 'k-rate' },
      { name: 'detune', defaultValue: 0, automationRate: 'k-rate' },
      { name: 'reed', defaultValue: 0.5, automationRate: 'k-rate' },
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
    this.dsp.setReed(params.reed?.[0] ?? 0.5);
    this.dsp.render(out);
    return true;
  }
}

registerProcessor('tube-processor', TubeProcessor);
