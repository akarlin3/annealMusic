// v7.0 Studies — shared frontend types (mirror api/app/schemas.py).

export type StudyStatus =
  | 'planning'
  | 'pre-registered'
  | 'active'
  | 'data-collection'
  | 'analysis'
  | 'published'
  | 'archived';

export type StudyVisibility = 'private' | 'public';

export type InvestigatorRole = 'pi' | 'co-investigator' | 'analyst' | 'viewer';

export type ResourceKind =
  | 'patch'
  | 'piece'
  | 'listening_session'
  | 'audio_clip'
  | 'experiment'
  | 'user_script'
  | 'dataset'
  | 'sonification';

export type ResourceRole = 'stimulus' | 'protocol' | 'data' | 'analysis';

export interface FundingSource {
  source: string;
  grant_number?: string | null;
  role?: string | null;
}

export interface Investigator {
  account_id: string;
  role: InvestigatorRole;
  added_at: string;
  display_name?: string | null;
  orcid?: string | null;
  affiliation_ror?: string | null;
}

export interface Study {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  abstract: string | null;
  status: StudyStatus;
  visibility: StudyVisibility;
  preregistration_url: string | null;
  ethics_statement: string | null;
  funding_sources: FundingSource[];
  concept_doi: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  investigators: Investigator[];
  my_role: InvestigatorRole | null;
}

export interface StudyResourceLink {
  id: string;
  resource_kind: ResourceKind;
  resource_id: string;
  role: ResourceRole | null;
  added_by: string | null;
  added_at: string;
}

export interface StudyVersion {
  id: string;
  study_id: string;
  version_label: string;
  doi: string | null;
  created_by: string | null;
  created_at: string;
}

export interface AuditEntry {
  id: string;
  account_id: string | null;
  timestamp: string;
  action: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

export interface PublishResult {
  version_id: string;
  doi: string;
  concept_doi: string;
  stub: boolean;
}

export const ROLE_RANK: Record<InvestigatorRole, number> = {
  viewer: 0,
  analyst: 1,
  'co-investigator': 2,
  pi: 3,
};

/** Items still missing before a study can be published (mirrors the server
 * pre-flight in api/app/routers/studies.py `_preflight`). */
export function publishPreflight(study: Study): string[] {
  const missing: string[] = [];
  if (!study.abstract || !study.abstract.trim()) missing.push('abstract');
  if (!study.ethics_statement || !study.ethics_statement.trim())
    missing.push('ethics_statement');
  if (!study.investigators.some((i) => i.role === 'pi'))
    missing.push('principal_investigator');
  if (study.investigators.some((i) => !i.orcid))
    missing.push('investigator_orcid');
  return missing;
}
