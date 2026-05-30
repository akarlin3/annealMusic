/* eslint-disable @typescript-eslint/no-explicit-any */
export type DatalogMode =
  | 'lightweight'
  | 'standard'
  | 'full'
  | 'research-extreme';

export interface SessionLogRecord {
  // --- Timing ---
  timestamp: number; // AudioContext.currentTime in seconds since session start
  wallTime: string; // ISO 8601 string of the real-world time

  // --- Sculpt Params (v1.0+) ---
  params: {
    rootFreq: number; // Base carrier frequency in Hz
    spread: number; // Spectral spread factor (-1..1)
    density: number; // Harmonic density / partial count (1..32)
    coupling: number; // Kuramoto coupling strength (0..1)
    drift: number; // Drift random walk speed (0..1)
    brightness: number; // Filter cutoff warp (0..1)
    space: number; // Convolver wet mix gain (0..1)
    volume: number; // Master channel volume (0..1)
  };

  // --- Session Metadata ---
  metadata: {
    mode: 'sketch' | 'drone';
    engineId: string; // Active engine ('sine', 'granular', etc.)
    engineParams: Record<string, any>; // Active engine's internal parameters
    tuning: {
      system: 'equal' | 'just' | 'pythagorean' | 'custom';
      referenceA4Hz: number;
      sclId?: string;
    };
    schemaVersion: string; // State schema version (e.g. 'v20')
    logSchemaVersion: string; // Datalog schema version ('1.0')
  };

  // --- Drift Internal State ---
  drift: {
    meanDetune: number; // Mean detune across all partials (cents)
    orderParameter: number; // Kuramoto phase coherence r(t) (0..1)
    partials: number[]; // Per-partial current detune value (cents)
  };

  // --- Audio Engine State ---
  partials: {
    frequencies: number[]; // Per-partial current absolute frequency (Hz)
    amplitudes: number[]; // Per-partial current linear amplitude
  };

  // --- Audio Analysis Features ---
  features: {
    rms: number; // Root Mean Square amplitude of final block
    spectralCentroid: number; // Center of mass of current spectrum (Hz)
    spectralFlux: number; // Difference between current and previous frame
    zcr: number; // Zero Crossing Rate of the audio block (0..1)
    spectrum?: number[]; // Optional: 512-bin magnitude spectrum (clamped dB)
  };

  // --- Event Flags ---
  event: string | null; // 'session-start' | 'session-stop' | 'engine-swap' | 'arc-segment-boundary' | 'midi-input' | 'osc-input' | 'ring-buffer-overflow' | null
  eventData?: Record<string, any>; // Context metadata for the event
}

export const DATALOG_SCHEMA_VERSION = '1.0';
