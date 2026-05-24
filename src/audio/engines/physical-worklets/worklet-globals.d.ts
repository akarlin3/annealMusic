/**
 * Ambient declarations for the AudioWorkletGlobalScope. lib.dom ships none of
 * these, so declaring them here is conflict-free and lets the processor wrappers
 * typecheck inside the main app project (no separate tsconfig needed).
 */

/** Sample rate of the rendering AudioContext, available in worklet scope. */
declare const sampleRate: number;

interface AudioParamDescriptor {
  name: string;
  defaultValue?: number;
  minValue?: number;
  maxValue?: number;
  automationRate?: 'a-rate' | 'k-rate';
}

declare abstract class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor();
  abstract process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean;
}

declare function registerProcessor(
  name: string,
  ctor: new () => AudioWorkletProcessor,
): void;
