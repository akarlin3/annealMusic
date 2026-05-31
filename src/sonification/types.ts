export type SourceType = 'file' | 'live' | 'synthetic';

export interface SourceDef {
  id: string;
  type: SourceType;
  filename?: string;
  storageKey?: string;
  columns: string[];
  url?: string; // WebSocket / SSE url for live sources
  formula?: string; // JavaScript synthetic math expression
  data?: Record<string, unknown>[]; // Interpolated time-series data rows
}

export type TransformType = 'linear' | 'log' | 'exp' | 'discrete' | 'quantile';

export interface TransformDef {
  type: TransformType;
  rawMin: number;
  rawMax: number;
  outMin: number;
  outMax: number;
  steps?: number; // for discrete
  quantiles?: number[]; // for quantile thresholds/levels
}

export interface CalibrationBounds {
  min: number;
  max: number;
}

export interface MappingRule {
  sourceId: string;
  column: string;
  targetType: 'param' | 'engineParam';
  targetKey: string; // e.g., 'brightness' or 'sine.detune'
  transform: TransformDef;
  calibrated?: boolean;
  calibrationBounds?: CalibrationBounds;
}

export interface MappingSpec {
  sources: SourceDef[];
  rules: MappingRule[];
}

export interface SonificationState {
  id?: string;
  title?: string;
  description?: string;
  mappingSpec: MappingSpec;
  durationMs?: number;
  playbackSpeed: number; // 0.1 to 5.0
  loop: boolean;
}
