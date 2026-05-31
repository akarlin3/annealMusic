/* eslint-disable */
export type RandomizationScheme =
  | 'simple'
  | 'latin-square'
  | 'block-random'
  | 'custom';

export interface Condition {
  id: string;
  name: string;
  stimulus_kind: 'patch' | 'piece' | 'sonification';
  stimulus_id: string; // references patch.id, piece.id, or sonification.id
  stimulus_version?: string;
  description?: string;
  params?: Record<string, unknown>; // standard fallback parameters
}

export interface CalibrationEvent {
  timestamp: string;
  account_id: string;
  device_name: string;
  measured_spl: number;
  target_spl: number;
  gain_offset_db: number;
}

export interface ClinicalProtocol {
  id: string;
  study_id: string;
  experiment_id: string | null;
  conditions: Condition[];
  calibration_history: CalibrationEvent[];
  randomization_scheme: RandomizationScheme;
  randomization_seed: string;
  calibration_required: boolean;
  target_lufs: number;
  adverse_event_capture: boolean;
  ct_gov_nct: string | null;
  biosignal_channels?: any[];
  created_at: string;
  updated_at: string;
}

export interface AdverseEvent {
  elapsed_ms: number;
  timestamp: string;
  text: string;
}

export interface AuditLogEvent {
  event:
    | 'consent'
    | 'calibration'
    | 'stimulus_start'
    | 'stimulus_end'
    | 'response'
    | 'withdraw'
    | 'flag_issue';
  timestamp: string;
  text?: string;
  elapsed_ms?: number;
}

export interface ClinicalSessionRecord {
  id: string;
  protocol_id: string;
  subject_id: string;
  condition_id: string;
  started_at: string;
  completed_at: string | null;
  stimulus_sha256: string | null;
  calibration_record: Record<string, unknown> | null;
  timing_report: Record<string, unknown> | null;
  adverse_events: AdverseEvent[];
  withdrew: boolean;
  partial_data_disposition: 'kept' | 'discarded' | null;
  client_audit_log: AuditLogEvent[];
}

export interface EnrollmentResult {
  session_id: string;
  condition_id: string;
  condition: Condition;
  calibration_required: boolean;
  target_lufs: number;
  adverse_event_capture: boolean;
  biosignal_channels?: any[];
}
