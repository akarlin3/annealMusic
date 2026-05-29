/**
 * AudioWorklet wrapper for the bell. Renders the shared `ModalBank` tuned by
 * `bellEigen` with the hum-forward `bellGain`. `inharm` → inharmonicity (shape1),
 * `reed` → warmth (shape2). An optional `{ modes }` message lowers the mode
 * count under CPU pressure.
 */
import { createBellBank } from '@/audio/engines/physical-dsp/bell';

class BellProcessor extends AudioWorkletProcessor {
  private dsp = createBellBank(sampleRate);

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
        this.dsp = createBellBank(sampleRate, data.modes);
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
    this.dsp.setShape1(params.inharm?.[0] ?? 0.5); // inharmonicity
    this.dsp.setShape2(params.reed?.[0] ?? 0.5); // warmth
    this.dsp.render(out);
    return true;
  }
}

registerProcessor('bell-processor', BellProcessor);
