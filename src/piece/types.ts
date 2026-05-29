import type { AnnealMusicParams } from '@/state/params';
import type { EngineId, EngineParams } from '@/audio/engines/types';

export type SegmentType = 'fixed' | 'arc' | 'open' | 'transition';

export interface PieceSegment {
  id?: string;
  position: number;
  type: SegmentType;
  durationMs: number | null;
  config: Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
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
  totalDurationMs: number | null;
  hasOpenSegment: boolean;
  segments: PieceSegment[];
  shortSlug?: string;
}
