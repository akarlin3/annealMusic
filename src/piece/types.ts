import type { AnnealMusicParams } from '@/state/params';
import type { EngineId, EngineParams } from '@/audio/engines/types';

export type SegmentType = 'fixed' | 'arc' | 'open' | 'transition' | 'meta-arc';

export interface VariationPoint {
  id: string;
  paramKey: string;
  constraint: {
    type: 'range' | 'enum' | 'relative' | 'correlated';
    min?: number;
    max?: number;
    choices?: number[];
    percent?: number;
    targetParam?: string;
    coefficient?: number;
  };
  rule: 'per-play' | 'per-segment' | 'per-render';
}

export interface PieceSegment {
  id?: string;
  position: number;
  type: SegmentType;
  durationMs: number | null;
  config: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  variations?: VariationPoint[];
}

export interface NotationNote {
  id: string;
  onset_ms: number;
  duration_ms: number;
  pitch_midi: number;
}

export interface Movement {
  name: string;
  description?: string;
  transition_in_ms?: number;
  transition_out_ms?: number;
  startSegmentIndex: number;
  endSegmentIndex: number;
}

export type InterpolationMode = 'linear' | 'exponential' | 'hold';

export interface AutomationPoint {
  id: string;
  timeMs: number;
  value: number;
  interpolation: InterpolationMode;
}

export interface AutomationTrack {
  id: string;
  paramKey: string;
  points: AutomationPoint[];
}

export interface Piece {
  id?: string;
  schemaVer: number;
  defaultsState: {
    params: Partial<AnnealMusicParams>;
    engineId: EngineId;
    engineParams: Partial<Record<EngineId, EngineParams>>;
  };
  title: string | null;
  description: string | null;
  visibility: 'unlisted' | 'public';
  tempoBpm: number | null; // <-- NEW
  totalDurationMs: number | null;
  hasOpenSegment: boolean;
  segments: PieceSegment[];
  shortSlug?: string;
  notation?: NotationNote[];
  variationSeed?: number | null;
  variations?: VariationPoint[];
  movements?: Movement[];
  automationTracks?: AutomationTrack[];
}
