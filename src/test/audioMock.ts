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

export type NodeKind =
  | 'gain'
  | 'oscillator'
  | 'constant'
  | 'filter'
  | 'analyser'
  | 'convolver'
  | 'destination';

export class MockNode {
  readonly gain = new MockParam(1);
  readonly frequency = new MockParam(440);
  readonly detune = new MockParam(0);
  readonly offset = new MockParam(0);
  readonly Q = new MockParam(1);
  type = 'sine';
  buffer: unknown = null;
  readonly kind: NodeKind;

  constructor(kind: NodeKind = 'gain') {
    this.kind = kind;
  }

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
  /** Every context constructed, in order — lets tests reach a context the code
   * under test created internally. Clear between tests. */
  static readonly instances: MockAudioContext[] = [];

  currentTime = 0;
  state: 'running' | 'suspended' | 'closed' = 'running';
  sampleRate = 48000;
  readonly destination = new MockNode('destination');

  /** Every node created through this context, in creation order. */
  readonly created: MockNode[] = [];

  constructor() {
    MockAudioContext.instances.push(this);
  }

  private track(node: MockNode): MockNode {
    this.created.push(node);
    return node;
  }

  /** Nodes of a given kind, in creation order. */
  nodesOfKind(kind: NodeKind): MockNode[] {
    return this.created.filter((n) => n.kind === kind);
  }

  createGain(): MockNode {
    return this.track(new MockNode('gain'));
  }

  createBiquadFilter(): MockNode {
    return this.track(new MockNode('filter'));
  }

  createAnalyser(): MockNode {
    const node = new MockNode('analyser');
    node.context = this;
    return this.track(node);
  }

  createConvolver(): MockNode {
    return this.track(new MockNode('convolver'));
  }

  createOscillator(): MockNode {
    return this.track(new MockNode('oscillator'));
  }

  createConstantSource(): MockNode {
    return this.track(new MockNode('constant'));
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
