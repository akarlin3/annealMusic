export interface RenderEngineOptions {
  durationSec: number;
  sampleRate: number;
  bitDepth: 24 | 32;
  seed: number;
  outputPath?: string;

  // Stems options
  perPartial?: boolean;
  withFx?: boolean;

  // Datalog options
  logFormat?: string;
  logOut?: string;
  logRate?: number;
  logMode?: string;

  // Listening Session / Piece specific
  pieceMode?: 'piece' | 'listening-session';
}

export interface RenderEngineResult {
  /** Map of stem ID / master to ArrayBuffer containing WAV data */
  outputs: Record<string, ArrayBuffer>;
}

export interface RenderEngine {
  renderPatch(
    payload: string,
    options: RenderEngineOptions,
  ): Promise<RenderEngineResult>;
  renderPiece(
    payload: string,
    options: RenderEngineOptions,
  ): Promise<RenderEngineResult>;
  renderListeningSession(
    payload: string,
    options: RenderEngineOptions,
  ): Promise<RenderEngineResult>;
}
