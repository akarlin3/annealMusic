/* eslint-disable */
import type {
  ClinicalProtocol,
  ClinicalSessionRecord,
  EnrollmentResult,
  Condition,
  CalibrationEvent,
} from './types';

const BASE = '/api/v1/clinical-protocols';

export class ApiError extends Error {
  status: number;
  code: string;
  detail: Record<string, unknown>;
  constructor(status: number, detail: Record<string, unknown>) {
    super((detail?.error as string) || `HTTP ${status}`);
    this.status = status;
    this.code = (detail?.error as string) || `http_${status}`;
    this.detail = detail || {};
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}

export const clinicalApi = {
  list: (studyId: string) =>
    request<ClinicalProtocol[]>(`${BASE}?study_id=${studyId}`),

  get: (id: string) => request<ClinicalProtocol>(`${BASE}/${id}`),

  create: (body: {
    study_id: string;
    experiment_id?: string | null;
    conditions: Omit<Condition, 'id'>[];
    randomization_scheme: string;
    calibration_required: boolean;
    target_lufs: number;
    adverse_event_capture: boolean;
    ct_gov_nct?: string | null;
  }) =>
    request<ClinicalProtocol>(BASE, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  update: (id: string, body: Partial<ClinicalProtocol>) =>
    request<ClinicalProtocol>(`${BASE}/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  delete: (id: string) => request<void>(`${BASE}/${id}`, { method: 'DELETE' }),

  enroll: (protocolId: string, subjectId: string) =>
    request<EnrollmentResult>(`${BASE}/${protocolId}/enroll`, {
      method: 'POST',
      body: JSON.stringify({ subject_id: subjectId }),
    }),

  createOrFinalizeSession: (
    body: Partial<ClinicalSessionRecord> & { id: string },
  ) =>
    request<ClinicalSessionRecord>(`${BASE}/sessions`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getSessionRecord: (sessionId: string) =>
    request<ClinicalSessionRecord>(`${BASE}/sessions/${sessionId}`),

  recordCalibration: (
    id: string,
    body: {
      device_name: string;
      measured_spl: number;
      target_spl: number;
      gain_offset_db: number;
    },
  ) =>
    request<ClinicalProtocol>(`${BASE}/${id}/calibrate`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  getCalibrationHistory: (id: string) =>
    request<CalibrationEvent[]>(`${BASE}/${id}/calibration-history`),

  uploadBiosignalStream: (
    sessionId: string,
    body: {
      device_id: string;
      channel_name: string;
      consented_at: string;
      sample_rate_hz?: number;
      frames: { timestamp: number; value: number }[];
    },
  ) =>
    request<any>(
      `/api/v1/clinical-session-records/${sessionId}/biosignal-stream`,
      {
        method: 'POST',
        body: JSON.stringify(body),
      },
    ),

  deleteBiosignalStream: (streamId: string) =>
    request<void>(`/api/v1/biosignal-streams/${streamId}`, {
      method: 'DELETE',
    }),
};
