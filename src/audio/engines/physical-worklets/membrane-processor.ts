/**
 * AudioWorklet wrapper for the circular membrane. Renders the shared `ModalBank`
 * tuned by `membraneEigen`. `reed` → tension (shape1), `inharm` → modeStretch
 * (shape2). An optional `{ modes }` message lowers the mode count under CPU
 * pressure.
 */
import { createMembraneBank } from '@/audio/engines/physical-dsp/membrane';

class MembraneProcessor extends AudioWorkletProcessor {
  private dsp = createMembraneBank(sampleRate);

  static get parameterDescriptors(): AudioParamDescriptor[] {
    return [
      { name: 'f0', defaultValue: 110, automationRate: 'k-rate' },
      { name: 'excitation', defaultValue: 0.5, automationRate: 'k-rate' },
      { name: 'damping', defaultValue: 0.4, automationRate: 'k-rate' },
      { name: 'brightness', defaultValue: 0.5, automationRate: 'k-rate' },
      { name: 'detune', defaultValue: 0, automationRate: 'k-rate' },
      { name: 'reed', defaultValue: 0.5, automationRate: 'k-rate' },
      { name: 'inharm', defaultValue: 0.5, automationRate: 'k-rate' },
    ];
  }

  constructor() {
    super();
    this.port.onmessage = (e: MessageEvent): void => {
      const data = e.data as { modes?: number };
      if (typeof data?.modes === 'number') {
        this.dsp = createMembraneBank(sampleRate, data.modes);
      }
    };
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
    this.dsp.setShape1(params.reed?.[0] ?? 0.5); // tension
    this.dsp.setShape2(params.inharm?.[0] ?? 0.5); // modeStretch
    this.dsp.render(out);
    return true;
  }
}

registerProcessor('membrane-processor', MembraneProcessor);
