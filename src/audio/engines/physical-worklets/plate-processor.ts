/**
 * AudioWorklet wrapper for the modal plate. Renders the shared `ModalBank` DSP
 * class; an optional structural `{ modes }` message lets the host lower the mode
 * count under CPU pressure (the bank is rebuilt on the next param touch).
 */
import { ModalBank, PLATE_MODES } from '@/audio/engines/physical-dsp/plate';

class PlateProcessor extends AudioWorkletProcessor {
  private dsp = new ModalBank(sampleRate);

  static get parameterDescriptors(): AudioParamDescriptor[] {
    return [
      { name: 'f0', defaultValue: 110, automationRate: 'k-rate' },
      { name: 'excitation', defaultValue: 0.5, automationRate: 'k-rate' },
      { name: 'damping', defaultValue: 0.4, automationRate: 'k-rate' },
      { name: 'brightness', defaultValue: 0.5, automationRate: 'k-rate' },
      { name: 'detune', defaultValue: 0, automationRate: 'k-rate' },
      { name: 'inharm', defaultValue: 0.5, automationRate: 'k-rate' },
    ];
  }

  constructor() {
    super();
    this.port.onmessage = (e: MessageEvent): void => {
      const data = e.data as { modes?: number };
      if (typeof data?.modes === 'number') {
        this.dsp = new ModalBank(
          sampleRate,
          110,
          0.4,
          0.5,
          0.5,
          0.5,
          Math.random,
          data.modes,
        );
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
    this.dsp.setInharmonicity(params.inharm?.[0] ?? 0.5);
    this.dsp.render(out);
    return true;
  }
}

registerProcessor('plate-processor', PlateProcessor);
void PLATE_MODES;
