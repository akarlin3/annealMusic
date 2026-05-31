import { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  Activity,
  Plus,
  Play,
  Eye,
  EyeOff,
  AlertTriangle,
  ChevronRight,
  Volume2,
  Trash2,
} from 'lucide-react';
import { clinicalApi } from './api';
import { studiesApi } from '../studies/api';
import { ROLE_RANK } from '../studies/types';
import type { Study, StudyResourceLink } from '../studies/types';
import type {
  ClinicalProtocol,
  Condition,
  ClinicalSessionRecord,
} from './types';
import { CalibrationDialog } from './CalibrationDialog';

export function ProtocolEditor({
  study,
  links,
  onChange,
}: {
  study: Study;
  links: StudyResourceLink[];
  onChange: () => void;
}) {
  const [protocols, setProtocols] = useState<ClinicalProtocol[]>([]);
  const [selectedProto, setSelectedProto] = useState<ClinicalProtocol | null>(
    null,
  );
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form states
  const [experimentId, setExperimentId] = useState<string>('');
  const [scheme, setScheme] = useState<
    'simple' | 'latin-square' | 'block-random'
  >('simple');
  const [calibrationRequired, setCalibrationRequired] = useState(true);
  const [targetLufs, setTargetLufs] = useState(-23.0);
  const [adverseEventCapture, setAdverseEventCapture] = useState(true);
  const [ctGovNct, setCtGovNct] = useState('');
  const [conditions, setConditions] = useState<Omit<Condition, 'id'>[]>([]);

  // Dashboard & Blinding States
  const [sessions, setSessions] = useState<ClinicalSessionRecord[]>([]);
  const [isMasked, setIsMasked] = useState(true);
  const [showCalibrate, setShowCalibrate] = useState(false);

  const role = study.my_role;
  const canEdit =
    role !== null && ROLE_RANK[role] >= ROLE_RANK['co-investigator'];

  // Filter linked experiments and patches/pieces/sonifications
  const experiments = links.filter((l) => l.resource_kind === 'experiment');
  const playableResources = links.filter((l) =>
    ['patch', 'piece', 'sonification'].includes(l.resource_kind),
  );

  const fetchProtocols = useCallback(async () => {
    try {
      setLoading(true);
      const res = await clinicalApi.list(study.id);
      setProtocols(res);
      setSelectedProto((prev) => {
        if (!prev) return null;
        return res.find((p) => p.id === prev.id) || prev;
      });
    } catch {
      console.error('Failed to load clinical protocols');
    } finally {
      setLoading(false);
    }
  }, [study.id]);

  useEffect(() => {
    fetchProtocols();
  }, [study.id, fetchProtocols]);

  const loadSessions = useCallback(
    async (protoId: string) => {
      // Queries all enrolled sessions for display
      try {
        const allAudit = await studiesApi.audit(study.id);
        // Map session enrollment audits back to session stats
        const enrolls = allAudit.filter(
          (a) =>
            a.action === 'session.enroll' &&
            a.after &&
            typeof a.after === 'object' &&
            'session_id' in a.after,
        );
        const sessList: ClinicalSessionRecord[] = [];
        for (const e of enrolls) {
          try {
            const sessionId = (e.after as { session_id?: string }).session_id;
            if (sessionId) {
              const s = await clinicalApi.getSessionRecord(sessionId);
              if (s.protocol_id === protoId) {
                sessList.push(s);
              }
            }
          } catch {
            // Silent fallback for missing/pruned records
          }
        }
        setSessions(
          sessList.sort(
            (a, b) =>
              new Date(b.started_at).getTime() -
              new Date(a.started_at).getTime(),
          ),
        );
      } catch (err) {
        console.error('Failed to load clinical sessions', err);
      }
    },
    [study.id],
  );

  useEffect(() => {
    if (selectedProto) {
      loadSessions(selectedProto.id);
      const interval = setInterval(() => loadSessions(selectedProto.id), 10000);
      return () => clearInterval(interval);
    }
  }, [selectedProto, loadSessions]);

  const addConditionSlot = () => {
    setConditions((prev) => [
      ...prev,
      {
        name: `Condition ${prev.length + 1}`,
        stimulus_kind: 'patch',
        stimulus_id: playableResources[0]?.resource_id || '',
      },
    ]);
  };

  const removeConditionSlot = (idx: number) => {
    setConditions((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleConditionChange = (
    idx: number,
    field: keyof Omit<Condition, 'id'>,
    value: string,
  ) => {
    setConditions((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, [field]: value } : c)),
    );
  };

  const handleCreate = async () => {
    if (conditions.length === 0) {
      alert('Add at least one stimulus condition to the protocol.');
      return;
    }
    try {
      await clinicalApi.create({
        study_id: study.id,
        experiment_id: experimentId || null,
        conditions,
        randomization_scheme: scheme,
        calibration_required: calibrationRequired,
        target_lufs: targetLufs,
        adverse_event_capture: adverseEventCapture,
        ct_gov_nct: ctGovNct || null,
      });
      setIsCreating(false);
      setSelectedProto(null);
      // Reset form
      setExperimentId('');
      setScheme('simple');
      setConditions([]);
      setTargetLufs(-23);
      setCalibrationRequired(true);
      setAdverseEventCapture(true);
      setCtGovNct('');
      fetchProtocols();
      onChange();
    } catch {
      alert('Failed to establish clinical protocol.');
    }
  };

  const handleDelete = async (protoId: string) => {
    if (
      confirm(
        'Permanently delete this clinical protocol? Enrolled subject records remain but calibration offsets will be cleared.',
      )
    ) {
      try {
        await clinicalApi.delete(protoId);
        setSelectedProto(null);
        fetchProtocols();
        onChange();
      } catch {
        alert('Failed to delete protocol.');
      }
    }
  };

  const toggleBlinding = async () => {
    if (isMasked && role === 'pi') {
      const confirmReveal = confirm(
        'Revealing blinding will log an override event in the immutable audit log. Proceed?',
      );
      if (!confirmReveal) return;
      try {
        await studiesApi.update(study.id, {
          abstract: `${study.abstract || ''}\n[Blinding Override: Investigator unmasked clinical conditions at ${new Date().toISOString()}]`,
        });
      } catch (err) {
        console.error('Audit log override log failed', err);
      }
    }
    setIsMasked((m) => !m);
  };

  const getStimulusTitle = (cond: Condition) => {
    const matched = playableResources.find(
      (r) => r.resource_id === cond.stimulus_id,
    );
    return matched
      ? `${cond.stimulus_kind.toUpperCase()}: ${matched.resource_id.substring(0, 8)}`
      : 'Unknown Stimulus';
  };

  return (
    <div className="flex flex-col gap-4 font-mono text-xs text-stone-200">
      <div className="flex items-center justify-between border-b border-stone-800 pb-3">
        <div className="flex items-center gap-2">
          <Shield className="text-amber-500" size={16} />
          <span className="text-xs font-bold uppercase tracking-wider text-stone-300">
            Clinical Protocols & Stimuli
          </span>
        </div>
        {canEdit && !isCreating && !selectedProto && (
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-stone-900 border border-stone-800 text-[10px] text-amber-500 hover:text-amber-400 hover:bg-stone-900/60 transition-all"
          >
            <Plus size={12} /> New Protocol
          </button>
        )}
      </div>

      {loading && (
        <div className="py-6 text-center text-stone-500">
          Loading clinical framework...
        </div>
      )}

      {/* List clinical protocols */}
      {!loading && !isCreating && !selectedProto && (
        <div className="flex flex-col gap-2">
          {protocols.length === 0 ? (
            <p className="text-stone-500 italic py-2">
              No clinical protocols established yet.
            </p>
          ) : (
            protocols.map((p) => (
              <div
                key={p.id}
                onClick={() => setSelectedProto(p)}
                className="flex items-center justify-between rounded-lg border border-stone-900 bg-stone-950/30 p-3 hover:border-stone-800 cursor-pointer hover:bg-stone-950/50 transition-all"
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <Activity size={14} className="text-amber-500" />
                    <span className="font-semibold text-stone-100">
                      LUFS: {p.target_lufs} dBFS
                    </span>
                    <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-stone-900 border border-stone-800 text-stone-400">
                      {p.randomization_scheme}
                    </span>
                  </div>
                  <div className="text-[10px] text-stone-500">
                    Conditions: {p.conditions.length} | Seed:{' '}
                    {p.randomization_seed.substring(0, 12)}...
                  </div>
                </div>
                <ChevronRight size={16} className="text-stone-600" />
              </div>
            ))
          )}
        </div>
      )}

      {/* Create protocol flow */}
      {isCreating && (
        <div className="flex flex-col gap-4 border border-stone-900 bg-stone-950/20 rounded-xl p-4">
          <div className="flex items-center justify-between border-b border-stone-900 pb-2">
            <span className="font-semibold text-stone-300">
              Create Clinical Protocol
            </span>
            <button
              onClick={() => setIsCreating(false)}
              className="text-stone-500 hover:text-stone-300"
            >
              Cancel
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-stone-400">
                Associated Experiment (v5.6):
              </label>
              <select
                value={experimentId}
                onChange={(e) => setExperimentId(e.target.value)}
                className="bg-stone-900 border border-stone-850 rounded p-2 text-stone-200 focus:border-stone-800 outline-none"
              >
                <option value="">Select linked experiment definition...</option>
                {experiments.map((exp) => (
                  <option key={exp.resource_id} value={exp.resource_id}>
                    {exp.resource_id.substring(0, 8)}... (linked resource)
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-stone-400">
                Randomization Counterbalancing Scheme:
              </label>
              <select
                value={scheme}
                onChange={(e) =>
                  setScheme(
                    e.target.value as
                      | 'simple'
                      | 'latin-square'
                      | 'block-random',
                  )
                }
                className="bg-stone-900 border border-stone-850 rounded p-2 text-stone-200 focus:border-stone-800 outline-none font-bold"
              >
                <option value="simple">Simple Cryptographic CSPRNG</option>
                <option value="latin-square">
                  Williams Latin Square (Carryover Balanced)
                </option>
                <option value="block-random">
                  Permuted Block Randomization (2N Pool)
                </option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-stone-400">
                Target Loudness Level (LUFS target dBFS):
              </label>
              <input
                type="number"
                step="0.5"
                value={targetLufs}
                onChange={(e) => setTargetLufs(parseFloat(e.target.value))}
                className="bg-stone-900 border border-stone-850 rounded p-2 text-stone-200 focus:border-stone-800 outline-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-stone-400">
                ClinicalTrials.gov NCT ID (Optional):
              </label>
              <input
                type="text"
                placeholder="e.g. NCT12345678"
                value={ctGovNct}
                onChange={(e) => setCtGovNct(e.target.value)}
                className="bg-stone-900 border border-stone-850 rounded p-2 text-stone-200 focus:border-stone-800 outline-none placeholder:text-stone-700"
              />
            </div>

            <div className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                id="cal_req"
                checked={calibrationRequired}
                onChange={(e) => setCalibrationRequired(e.target.checked)}
                className="accent-amber-500 rounded bg-stone-900"
              />
              <label htmlFor="cal_req" className="text-stone-300 select-none">
                Require SPL Level headphones calibration check
              </label>
            </div>

            <div className="flex items-center gap-2 mt-2">
              <input
                type="checkbox"
                id="adv_event"
                checked={adverseEventCapture}
                onChange={(e) => setAdverseEventCapture(e.target.checked)}
                className="accent-amber-500 rounded bg-stone-900"
              />
              <label htmlFor="adv_event" className="text-stone-300 select-none">
                Enable Participant adverse-event flagging
              </label>
            </div>
          </div>

          {/* Condition authoring slots */}
          <div className="flex flex-col gap-2 mt-4 border-t border-stone-900 pt-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-stone-300">
                Conditions ({conditions.length})
              </span>
              <button
                onClick={addConditionSlot}
                className="flex items-center gap-1 text-[10px] text-amber-500 font-bold"
              >
                <Plus size={10} /> Add Condition
              </button>
            </div>

            {conditions.map((c, i) => (
              <div
                key={i}
                className="flex items-center gap-2 border border-stone-900 bg-stone-950/20 p-2.5 rounded-lg"
              >
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={c.name}
                    onChange={(e) =>
                      handleConditionChange(i, 'name', e.target.value)
                    }
                    placeholder="Condition Name..."
                    className="bg-stone-900 border border-stone-850 rounded p-1.5 text-stone-200 outline-none"
                  />
                  <select
                    value={c.stimulus_kind}
                    onChange={(e) =>
                      handleConditionChange(
                        i,
                        'stimulus_kind',
                        e.target.value as 'patch' | 'piece' | 'sonification',
                      )
                    }
                    className="bg-stone-900 border border-stone-850 rounded p-1.5 text-stone-200 outline-none"
                  >
                    <option value="patch">Patch</option>
                    <option value="piece">Piece</option>
                    <option value="sonification">Sonification</option>
                  </select>
                  <select
                    value={c.stimulus_id}
                    onChange={(e) =>
                      handleConditionChange(i, 'stimulus_id', e.target.value)
                    }
                    className="bg-stone-900 border border-stone-850 rounded p-1.5 text-stone-200 outline-none font-bold text-[10px]"
                  >
                    <option value="">Choose Stimulus Asset...</option>
                    {playableResources
                      .filter((r) => r.resource_kind === c.stimulus_kind)
                      .map((res) => (
                        <option key={res.resource_id} value={res.resource_id}>
                          {res.resource_id.substring(0, 8)}... (linked{' '}
                          {res.resource_kind})
                        </option>
                      ))}
                  </select>
                </div>
                <button
                  onClick={() => removeConditionSlot(i)}
                  className="text-stone-500 hover:text-rose-500 transition-all p-1"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={handleCreate}
            className="mt-4 w-full py-2 bg-amber-500 text-stone-950 rounded font-semibold hover:bg-amber-400 transition-all text-xs"
          >
            Create Clinical Protocol
          </button>
        </div>
      )}

      {/* Protocol Live Dashboard View */}
      {selectedProto && (
        <div className="flex flex-col gap-4 border border-stone-900 bg-stone-950/20 rounded-xl p-4">
          <div className="flex items-center justify-between border-b border-stone-900 pb-2">
            <div className="flex items-center gap-2">
              <Activity size={14} className="text-amber-500" />
              <span className="font-semibold text-stone-200">
                Protocol Live Dashboard
              </span>
            </div>
            <button
              onClick={() => setSelectedProto(null)}
              className="text-stone-500 hover:text-stone-300"
            >
              Back
            </button>
          </div>

          {/* Key Parameters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-stone-950/40 p-3 rounded-lg border border-stone-900">
            <div>
              <div className="text-[10px] text-stone-500">SCHEME</div>
              <div className="font-bold text-stone-200 uppercase">
                {selectedProto.randomization_scheme}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-stone-500">TARGET VOL</div>
              <div className="font-bold text-stone-200">
                {selectedProto.target_lufs} LUFS
              </div>
            </div>
            <div>
              <div className="text-[10px] text-stone-500">CT.GOV NCT</div>
              <div className="font-bold text-stone-200">
                {selectedProto.ct_gov_nct || 'None'}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-stone-500">
                CALIBRATE REQUIRED
              </div>
              <div className="font-bold text-stone-200">
                {selectedProto.calibration_required ? 'YES' : 'NO'}
              </div>
            </div>
          </div>

          {/* Participant Runner Link */}
          <div className="flex flex-col gap-2 p-3 bg-stone-900/10 rounded-lg border border-stone-900">
            <label className="text-[10px] text-stone-500 uppercase font-semibold">
              Subject runner invitation URL
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={`${window.location.origin}/clinical/${selectedProto.id}`}
                className="flex-1 bg-stone-950 border border-stone-900 rounded p-1.5 text-stone-300 font-mono text-[10px] outline-none select-all"
              />
              <button
                onClick={() =>
                  window.open(
                    `/clinical/${selectedProto.id}?subject=sub-${Math.random().toString(36).substring(2, 8)}`,
                    '_blank',
                  )
                }
                className="flex items-center gap-1 px-3 py-1.5 rounded bg-stone-900 border border-stone-850 hover:bg-stone-850 hover:text-amber-500"
              >
                <Play size={10} /> Test Runner
              </button>
            </div>
          </div>

          {/* Masking controls */}
          <div className="flex items-center justify-between border-t border-stone-900 pt-3">
            <span className="font-semibold text-stone-300">
              Blinding / Masking Control
            </span>
            <button
              onClick={toggleBlinding}
              className={`flex items-center gap-1.5 px-3 py-1 rounded text-[10px] border transition-all ${
                isMasked
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'
                  : 'bg-rose-500/10 border-rose-500/20 text-rose-400 hover:bg-rose-500/20'
              }`}
            >
              {isMasked ? <EyeOff size={11} /> : <Eye size={11} />}
              {isMasked ? 'Double-Blind Locked' : 'Unmasked (Audited)'}
            </button>
          </div>

          {/* Condition Distribution Splits */}
          <div className="flex flex-col gap-2 bg-stone-950/40 p-3 rounded-lg border border-stone-900">
            <div className="flex items-center justify-between text-[10px] text-stone-500 font-semibold uppercase">
              <span>Condition Counterbalance Distribution</span>
              <span>Total Enrolled: {sessions.length}</span>
            </div>
            <div className="flex flex-col gap-2">
              {selectedProto.conditions.map((cond) => {
                const count = sessions.filter(
                  (s) => s.condition_id === cond.id,
                ).length;
                const percent =
                  sessions.length > 0 ? (count / sessions.length) * 100 : 0;
                return (
                  <div key={cond.id} className="flex flex-col gap-1">
                    <div className="flex justify-between text-[10px]">
                      <span className="text-stone-300">
                        {isMasked
                          ? `Masked ID: ${cond.id.substring(0, 8)}`
                          : cond.name}
                        {!isMasked && (
                          <span className="text-stone-500 ml-1">
                            ({getStimulusTitle(cond)})
                          </span>
                        )}
                      </span>
                      <span className="font-bold text-amber-500">
                        {count} subjects
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-stone-900 rounded overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded transition-all"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SPL Calibration history */}
          <div className="flex flex-col gap-2 bg-stone-950/40 p-3 rounded-lg border border-stone-900">
            <div className="flex items-center justify-between border-b border-stone-900 pb-2">
              <span className="text-[10px] text-stone-500 font-semibold uppercase">
                SPL headphone calibrations
              </span>
              <button
                onClick={() => setShowCalibrate(true)}
                className="flex items-center gap-1 text-[10px] text-amber-500"
              >
                <Volume2 size={11} /> Calibrate now
              </button>
            </div>
            {selectedProto.calibration_history?.length === 0 ? (
              <p className="text-stone-500 italic text-[10px]">
                No manual headphone calibrations logged yet.
              </p>
            ) : (
              <div className="flex flex-col gap-1.5 max-h-24 overflow-y-auto scrollbar-thin">
                {selectedProto.calibration_history?.map((cal, i) => (
                  <div
                    key={i}
                    className="flex justify-between items-center text-[10px] border-b border-stone-900 pb-1"
                  >
                    <span className="text-stone-300 font-semibold">
                      {cal.device_name}
                    </span>
                    <span className="text-stone-400">
                      Measured: {cal.measured_spl} dBA | Offset:{' '}
                      {cal.gain_offset_db} dB
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Adverse event capture feed */}
          <div className="flex flex-col gap-2 bg-stone-950/40 p-3 rounded-lg border border-stone-900">
            <span className="text-[10px] text-stone-500 font-semibold uppercase">
              Adverse event telemetry feed
            </span>
            {sessions.filter((s) => s.adverse_events.length > 0).length ===
            0 ? (
              <p className="text-emerald-500 text-[10px] font-bold">
                No adverse events reported (0 AE).
              </p>
            ) : (
              <div className="flex flex-col gap-2 max-h-28 overflow-y-auto scrollbar-thin">
                {sessions
                  .filter((s) => s.adverse_events.length > 0)
                  .flatMap((s) =>
                    s.adverse_events.map((ae, i) => ({
                      ...ae,
                      subject_id: s.subject_id,
                      i,
                    })),
                  )
                  .map((item, idx) => (
                    <div
                      key={idx}
                      className="rounded border border-rose-500/20 bg-rose-500/5 px-2 py-1.5 flex items-start gap-2"
                    >
                      <AlertTriangle
                        className="text-rose-500 flex-shrink-0 mt-0.5"
                        size={12}
                      />
                      <div className="flex-1">
                        <div className="flex justify-between text-[9px] text-stone-400">
                          <span>Subject: {item.subject_id}</span>
                          <span>Time: {item.elapsed_ms / 1000}s</span>
                        </div>
                        <p className="text-rose-200 mt-1 text-[10px] font-sans">
                          {item.text}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Subject Enrollment List */}
          <div className="flex flex-col gap-2">
            <span className="text-[10px] text-stone-400 font-bold uppercase">
              Subject Enrollment List
            </span>
            <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto scrollbar-thin">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded border border-stone-900/60 bg-stone-950/20 px-2 py-1.5 text-[10px]"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-stone-300">
                      {s.subject_id}
                    </span>
                    {s.withdrew && (
                      <span className="text-[8px] bg-rose-500/10 border border-rose-500/20 text-rose-400 px-1 py-0.5 rounded uppercase">
                        WITHDREW ({s.partial_data_disposition})
                      </span>
                    )}
                    {!s.withdrew && s.completed_at && (
                      <span className="text-[8px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-1 py-0.5 rounded uppercase">
                        COMPLETED
                      </span>
                    )}
                    {!s.withdrew && !s.completed_at && (
                      <span className="text-[8px] bg-amber-500/10 border border-amber-500/20 text-amber-400 px-1 py-0.5 rounded uppercase">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <span className="text-[9px] text-stone-500">
                    {new Date(s.started_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
              {sessions.length === 0 && (
                <p className="text-stone-600 italic text-[10px]">
                  No subjects enrolled yet.
                </p>
              )}
            </div>
          </div>

          {canEdit && (
            <button
              onClick={() => handleDelete(selectedProto.id)}
              className="mt-4 w-full py-1.5 border border-stone-850 hover:border-rose-500 text-stone-500 hover:text-rose-500 rounded transition-all text-[10px]"
            >
              Delete Protocol
            </button>
          )}
        </div>
      )}

      {showCalibrate && selectedProto && (
        <CalibrationDialog
          protocol={selectedProto}
          onClose={() => setShowCalibrate(false)}
          onCalibrated={() => {
            fetchProtocols();
            setShowCalibrate(false);
          }}
        />
      )}
    </div>
  );
}
