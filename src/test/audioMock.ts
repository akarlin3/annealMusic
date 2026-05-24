/**
 * A minimal Web Audio mock for unit tests. jsdom implements no Web Audio API,
 * so engine/orchestrator tests stub `window.AudioContext` with this. Nodes
 * record their connections and every `AudioParam` automation call, so tests can
 * assert graph structure and gain/frequency envelopes (e.g. crossfade ramps)
 * without a real audio device or offline render.
 */

export interface ParamCall {
  method: string;
  args: number[];
}

export class MockParam {
  value: number;
  readonly calls: ParamCall[] = [];

  constructor(value = 0) {
    this.value = value;
  }

  setValueAtTime(value: number, t: number): MockParam {
    this.value = value;
    this.calls.push({ method: 'setValueAtTime', args: [value, t] });
    return this;
  }

  linearRampToValueAtTime(value: number, t: number): MockParam {
    this.value = value;
    this.calls.push({ method: 'linearRampToValueAtTime', args: [value, t] });
    return this;
  }

  setTargetAtTime(value: number, t: number, tc: number): MockParam {
    this.value = value;
    this.calls.push({ method: 'setTargetAtTime', args: [value, t, tc] });
    return this;
  }

  cancelScheduledValues(t: number): MockParam {
    this.calls.push({ method: 'cancelScheduledValues', args: [t] });
    return this;
  }
}

export class MockNode {
  readonly gain = new MockParam(1);
  readonly frequency = new MockParam(440);
  readonly detune = new MockParam(0);
  readonly offset = new MockParam(0);
  readonly Q = new MockParam(1);
  type = 'sine';
  buffer: unknown = null;

  // Analyser-ish fields (used by the visualizer, harmless elsewhere).
  fftSize = 1024;
  smoothingTimeConstant = 0;
  readonly frequencyBinCount = 512;
  context: MockAudioContext | null = null;

  readonly connections: MockNode[] = [];
  started = false;
  stopped = false;

  connect(node: MockNode): MockNode {
    this.connections.push(node);
    return node;
  }

  disconnect(): void {
    this.connections.length = 0;
  }

  start(): void {
    this.started = true;
  }

  stop(): void {
    this.stopped = true;
  }

  getByteFrequencyData(): void {
    // no-op
  }
}

export class MockAudioContext {
  currentTime = 0;
  state: 'running' | 'suspended' | 'closed' = 'running';
  sampleRate = 48000;
  readonly destination = new MockNode();

  createGain(): MockNode {
    return new MockNode();
  }

  createBiquadFilter(): MockNode {
    return new MockNode();
  }

  createAnalyser(): MockNode {
    const node = new MockNode();
    node.context = this;
    return node;
  }

  createConvolver(): MockNode {
    return new MockNode();
  }

  createOscillator(): MockNode {
    return new MockNode();
  }

  createConstantSource(): MockNode {
    return new MockNode();
  }

  createBuffer(
    _channels: number,
    length: number,
  ): { getChannelData: () => Float32Array } {
    return { getChannelData: () => new Float32Array(length) };
  }

  resume(): Promise<void> {
    return Promise.resolve();
  }

  close(): Promise<void> {
    this.state = 'closed';
    return Promise.resolve();
  }
}
