export interface LoopRing {
  /** Slot index 0..2 (selects ring color + radius). */
  slot: number;
  /** Amplitude proxy (0..1). */
  level: number;
  frozen: boolean;
}

export interface VisualState {
  /** CSS-pixel canvas size. */
  w: number;
  /** CSS-pixel canvas size. */
  h: number;
  /** Frame delta in seconds. */
  dt: number;
  /** Visual phase per partial, in radians. Mutated in-place. */
  phases: number[];
  /** Resolved frequency (Hz) per partial. */
  freqs: number[];
  /** Number of partials currently sounding. */
  count: number;
  /** Latest analyser magnitude spectrum, or null when silent. */
  spectrum: Uint8Array<ArrayBuffer> | null;
  sampleRate: number;
  fftSize: number;
  /** Live-input amplitude (0..1); undefined when no input is connected. */
  inputLevel?: number;
  /** Active loop slots, in slot order, contributing orbital rings. */
  loops?: LoopRing[];
}

export interface VisualRenderer {
  mount(canvas: HTMLCanvasElement): void;
  unmount(): void;
  resize(width: number, height: number, dpr: number): void;
  drawFrame(state: VisualState, now: number): void;
  setQuality(level: 'low' | 'medium' | 'high'): void;
  dispose(): void;
}
