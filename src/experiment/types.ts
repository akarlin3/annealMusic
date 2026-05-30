export interface Stimulus {
  id: string;
  patch: Record<string, unknown>;
  duration: number; // in seconds
  visualizer?: boolean;
}

export type ResponseType =
  | 'LikertResponse'
  | 'ForcedChoice'
  | 'FreeText'
  | 'AdjustValue'
  | 'ReactionTime'
  | 'Continuous';

export interface ResponseDefinition {
  type: ResponseType;
  prompt: string;
  scale?: number;
  options?: string[];
  max_chars?: number;
  range?: [number, number];
  step?: number;
  target_param?: string;
  target_key?: string;
  duration?: number;
}

export interface Trial {
  stimulus: Stimulus;
  response: ResponseDefinition;
}

export interface Block {
  type: 'block';
  name: string;
  trials: Trial[];
  randomize: 'full' | 'within-block' | 'fixed';
  counterbalance: boolean;
}

export interface Break {
  type: 'break';
  message: string;
}

export type ExperimentStep = Block | Break;

export interface DemographicsDefinition {
  fields: string[];
}

export interface ExperimentDefinition {
  title: string;
  description: string;
  consent_text: string;
  debrief_text: string;
  demographics?: DemographicsDefinition | null;
  steps: ExperimentStep[];
}

export interface TrialResult {
  subject_id: string;
  trial_index: number;
  stimulus_id: string;
  response_type: ResponseType;
  response_value: unknown;
  rt_ms: number | null;
  timestamp: string;
  continuous_values?: { time_ms: number; value: number }[];
  datalogger_ticks?: Record<string, unknown>[];
}

export interface SubjectDemographics {
  age?: number;
  hearing_loss?: string;
  musical_experience_years?: number;
  [key: string]: unknown;
}
