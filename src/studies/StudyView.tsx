import { useCallback, useEffect, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  BadgeCheck,
  History,
  Globe,
  Lock,
  Save,
} from 'lucide-react';
import { studiesApi } from './api';
import { InvestigatorManager } from './InvestigatorManager';
import { ResourceLinker } from './ResourceLinker';
import { SnapshotDialog } from './SnapshotDialog';
import { PublishFlow } from './PublishFlow';
import { ExportDialog } from './export/ExportDialog';
import { ROLE_RANK } from './types';
import { ProtocolEditor } from '../clinical/ProtocolEditor';
import type {
  AuditEntry,
  Study,
  StudyResourceLink,
  StudyStatus,
  StudyVersion,
} from './types';

const STATUSES: StudyStatus[] = [
  'planning',
  'pre-registered',
  'active',
  'data-collection',
  'analysis',
];

export function StudyView({
  studyId,
  onBack,
}: {
  studyId: string;
  onBack: () => void;
}) {
  const [study, setStudy] = useState<Study | null>(null);
  const [links, setLinks] = useState<StudyResourceLink[]>([]);
  const [versions, setVersions] = useState<StudyVersion[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [showSnapshot, setShowSnapshot] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [exportVersion, setExportVersion] = useState<StudyVersion | null>(null);
  const [dirty, setDirty] = useState<Partial<Study>>({});

  const reload = useCallback(async () => {
    const s = await studiesApi.get(studyId);
    setStudy(s);
    setDirty({});
    const [l, v, a] = await Promise.all([
      studiesApi.listResources(studyId).catch(() => []),
      studiesApi.listVersions(studyId).catch(() => []),
      studiesApi.audit(studyId).catch(() => []),
    ]);
    setLinks(l);
    setVersions(v);
    setAudit(a);
  }, [studyId]);

  useEffect(() => {
    reload();
  }, [reload]);

  if (!study) {
    return (
      <div className="p-8 text-center text-xs font-mono text-stone-500">
        Loading study…
      </div>
    );
  }

  const role = study.my_role;
  const canEdit =
    role !== null && ROLE_RANK[role] >= ROLE_RANK['co-investigator'];
  const isPi = role === 'pi';
  const edited = { ...study, ...dirty };
  const hasChanges = Object.keys(dirty).length > 0;

  const save = async () => {
    await studiesApi.update(study.id, dirty);
    await reload();
  };

  return (
    <div className="flex-1 flex gap-6 overflow-hidden">
      <div className="flex-1 overflow-y-auto pr-2 flex flex-col gap-6 scrollbar-thin">
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-[11px] font-mono text-stone-400 hover:text-stone-200"
          >
            <ArrowLeft size={14} /> All studies
          </button>
          <div className="flex items-center gap-2">
            {canEdit && (
              <button
                onClick={() => setShowSnapshot(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-stone-900 border border-stone-800 text-[11px] font-mono text-stone-300 hover:text-amber-400"
              >
                <Camera size={13} /> Snapshot
              </button>
            )}
            {isPi && study.status !== 'published' && (
              <button
                onClick={() => setShowPublish(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-amber-500 text-stone-950 text-[11px] font-mono font-semibold hover:bg-amber-400"
              >
                <BadgeCheck size={13} /> Publish
              </button>
            )}
          </div>
        </div>

        {/* Header / metadata */}
        <div className="flex flex-col gap-3 border border-stone-900 bg-stone-900/10 rounded-xl p-5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {edited.status}
            </span>
            <span className="flex items-center gap-1 text-[10px] font-mono text-stone-500">
              {study.visibility === 'public' ? (
                <>
                  <Globe size={11} /> public
                </>
              ) : (
                <>
                  <Lock size={11} /> private
                </>
              )}
            </span>
            {study.concept_doi && (
              <span className="text-[10px] font-mono text-emerald-400">
                DOI {study.concept_doi}
              </span>
            )}
            {role && (
              <span className="text-[10px] font-mono text-stone-600">
                your role: {role}
              </span>
            )}
          </div>

          {canEdit ? (
            <input
              value={edited.title}
              onChange={(e) =>
                setDirty((d) => ({ ...d, title: e.target.value }))
              }
              className="bg-transparent text-lg font-mono font-semibold text-stone-100 border-b border-transparent focus:border-stone-800 outline-none"
            />
          ) : (
            <h2 className="text-lg font-mono font-semibold text-stone-100">
              {study.title}
            </h2>
          )}

          <textarea
            readOnly={!canEdit}
            value={edited.abstract || ''}
            placeholder="Abstract…"
            onChange={(e) =>
              setDirty((d) => ({ ...d, abstract: e.target.value }))
            }
            className="bg-stone-950/50 border border-stone-900 rounded p-2 text-[11px] font-mono text-stone-300 min-h-[60px] placeholder:text-stone-700"
          />
          <textarea
            readOnly={!canEdit}
            value={edited.ethics_statement || ''}
            placeholder="Ethics statement…"
            onChange={(e) =>
              setDirty((d) => ({ ...d, ethics_statement: e.target.value }))
            }
            className="bg-stone-950/50 border border-stone-900 rounded p-2 text-[11px] font-mono text-stone-300 min-h-[44px] placeholder:text-stone-700"
          />

          {canEdit && (
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={edited.status}
                onChange={(e) =>
                  setDirty((d) => ({
                    ...d,
                    status: e.target.value as StudyStatus,
                  }))
                }
                className="bg-stone-900 border border-stone-800 rounded text-[10px] font-mono text-stone-300 px-1.5 py-1"
              >
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
                {edited.status === 'published' && (
                  <option value="published">published</option>
                )}
              </select>
              <button
                onClick={() =>
                  setDirty((d) => ({
                    ...d,
                    visibility:
                      edited.visibility === 'public' ? 'private' : 'public',
                  }))
                }
                className="text-[10px] font-mono px-2 py-1 rounded bg-stone-900 border border-stone-800 text-stone-300 hover:text-amber-400"
              >
                Make {edited.visibility === 'public' ? 'private' : 'public'}
              </button>
              {hasChanges && (
                <button
                  onClick={save}
                  className="flex items-center gap-1 text-[10px] font-mono px-3 py-1 rounded bg-amber-500 text-stone-950 font-semibold hover:bg-amber-400"
                >
                  <Save size={12} /> Save
                </button>
              )}
            </div>
          )}
        </div>

        <div className="border border-stone-900 bg-stone-900/10 rounded-xl p-5">
          <InvestigatorManager study={study} onChange={reload} />
        </div>

        <div className="border border-stone-900 bg-stone-900/10 rounded-xl p-5">
          <ResourceLinker study={study} links={links} onChange={reload} />
        </div>

        <div className="border border-stone-900 bg-stone-900/10 rounded-xl p-5">
          <ProtocolEditor study={study} links={links} onChange={reload} />
        </div>

        {/* Versions */}
        <div className="border border-stone-900 bg-stone-900/10 rounded-xl p-5 flex flex-col gap-2">
          <span className="text-xs font-mono uppercase tracking-wider text-stone-400">
            Versions ({versions.length})
          </span>
          {versions.length === 0 ? (
            <p className="text-[11px] font-mono text-stone-600">
              No snapshots yet.
            </p>
          ) : (
            versions.map((v) => (
              <div
                key={v.id}
                className="flex items-center justify-between rounded border border-stone-900 bg-stone-900/20 px-3 py-1.5"
              >
                <span className="text-[11px] font-mono text-stone-300">
                  {v.version_label}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-stone-500">
                    {v.doi ? (
                      <span className="text-emerald-400">{v.doi}</span>
                    ) : (
                      new Date(v.created_at).toLocaleDateString()
                    )}
                  </span>
                  {role && ROLE_RANK[role] >= ROLE_RANK['co-investigator'] && (
                    <button
                      onClick={() => {
                        setExportVersion(v);
                        setShowExport(true);
                      }}
                      className="text-[10px] font-mono px-2 py-0.5 rounded border border-stone-850 bg-stone-950 text-stone-400 hover:text-amber-500 hover:border-amber-500/30 transition-all font-semibold"
                    >
                      Export
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Audit sidebar */}
      <aside className="w-72 border-l border-stone-900 pl-4 overflow-y-auto scrollbar-thin">
        <span className="text-xs font-mono uppercase tracking-wider text-stone-400 flex items-center gap-2 mb-3">
          <History size={14} className="text-amber-500" /> Provenance
        </span>
        <ul className="flex flex-col gap-2">
          {audit.map((a) => (
            <li
              key={a.id}
              className="rounded border border-stone-900/60 bg-stone-900/20 px-2.5 py-1.5"
            >
              <div className="text-[10px] font-mono text-amber-400/90">
                {a.action}
              </div>
              <div className="text-[9px] font-mono text-stone-600">
                {new Date(a.timestamp).toLocaleString()}
              </div>
            </li>
          ))}
          {audit.length === 0 && (
            <li className="text-[10px] font-mono text-stone-600">
              No activity.
            </li>
          )}
        </ul>
      </aside>

      {showSnapshot && (
        <SnapshotDialog
          study={study}
          onClose={() => setShowSnapshot(false)}
          onCreated={reload}
        />
      )}
      {showPublish && (
        <PublishFlow
          study={study}
          onClose={() => setShowPublish(false)}
          onPublished={reload}
        />
      )}
      {showExport && (
        <ExportDialog
          study={study}
          preselectedVersion={exportVersion}
          versions={versions}
          onClose={() => {
            setShowExport(false);
            setExportVersion(null);
          }}
        />
      )}
    </div>
  );
}
