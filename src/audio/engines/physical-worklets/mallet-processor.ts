/**
 * AudioWorklet wrapper for the mallet (vibraphone/marimba). Renders the shared
 * `ModalBank` tuned by `malletEigen`, driven by a `TremoloExciter` so the bars
 * shimmer as a sustained roll. `reed` → roll rate (on the exciter), `inharm` →
 * material hardness (shape1, stretches the bar ratios). An optional `{ modes }`
 * message lowers the mode count under CPU pressure.
 */
import {
  createMalletBank,
  malletRate,
  type TremoloExciter,
} from '@/audio/engines/physical-dsp/mallet';
import type { ModalBank } from '@/audio/engines/physical-dsp/modal-bank';

class MalletProcessor extends AudioWorkletProcessor {
  private bank: ModalBank;
  private exciter: TremoloExciter;

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
    const parts = createMalletBank(sampleRate);
    this.bank = parts.bank;
    this.exciter = parts.exciter;
    this.port.onmessage = (e: MessageEvent): void => {
      const data = e.data as { modes?: number };
      if (typeof data?.modes === 'number') {
        const next = createMalletBank(sampleRate, data.modes);
        this.bank = next.bank;
        this.exciter = next.exciter;
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
    this.bank.setFrequency(params.f0?.[0] ?? 110);
    this.bank.setDetuneCents(params.detune?.[0] ?? 0);
    this.bank.setDamping(params.damping?.[0] ?? 0.4);
    this.bank.setBrightness(params.brightness?.[0] ?? 0.5);
    this.bank.setExcitation(params.excitation?.[0] ?? 0.5);
    this.bank.setShape1(params.inharm?.[0] ?? 0.5); // material hardness
    this.exciter.setRate(malletRate(params.reed?.[0] ?? 0.5)); // roll rate
    this.bank.render(out);
    return true;
  }
}

registerProcessor('mallet-processor', MalletProcessor);
