/* eslint-disable @typescript-eslint/no-explicit-any */
export interface RenderOptions {
  durationSec: number;
  sampleRate: number;
  bitDepth: 24 | 32;
  seed: number;
  outputPath?: string;

  // Stems & Audio configurations
  perPartial?: boolean;
  withFx?: boolean;

  // Datalog logging options
  logFormat?: string;
  logOut?: string;
  logRate?: number;
  logMode?: string;

  // Playback mode & spec configurations
  mode?: 'open' | 'arc' | 'piece' | 'listening-session' | 'sonification';
  piece?: any;
  listeningSession?: any;
  sonificationSpec?: any;
  captureUrls?: string[];
  previewSliceStartMs?: number;
  isCalm?: boolean;

  // Video specifications
  width?: number;
  height?: number;
  fps?: number;
  videoBitrate?: number;
  renderType?: 'audio' | 'video' | 'stems';
}

export interface RenderResult {
  outputs: Record<string, ArrayBuffer>;
  mime?: string;
}

export interface RenderEngine {
  render(payload: string, options: RenderOptions): Promise<RenderResult>;
}
