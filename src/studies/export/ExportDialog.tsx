import { useState } from 'react';
import { Download, ShieldAlert, Sparkles, X } from 'lucide-react';
import { studiesApi, ApiError } from '../api';
import type { Study, StudyVersion } from '../types';
import { AnonymizationPreview } from './AnonymizationPreview';

export function ExportDialog({
  study,
  preselectedVersion,
  versions,
  onClose,
}: {
  study: Study;
  preselectedVersion?: StudyVersion | null;
  versions: StudyVersion[];
  onClose: () => void;
}) {
  const [selectedVersionId, setSelectedVersionId] = useState(
    preselectedVersion?.id || versions[0]?.id || '',
  );
  const [reproducibilityLevel, setReproducibilityLevel] =
    useState('bytes-identical');
  const [includeSubjectData, setIncludeSubjectData] = useState(false);
  const [differentialPrivacy, setDifferentialPrivacy] = useState(false);
  const [piAttestation, setPiAttestation] = useState(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  const startExport = async () => {
    if (!selectedVersionId) {
      setError('Please select a study snapshot version first.');
      return;
    }
    if (includeSubjectData && !piAttestation) {
      setError(
        'You must attest to IRB compliance before exporting subject data.',
      );
      return;
    }

    setBusy(true);
    setError(null);
    setProgress(
      'Assembling study export bundle (hashing resources, generating manifest)...',
    );

    try {
      // 1. Hit the server export endpoint
      const result = await studiesApi.export(study.id, {
        version_id: selectedVersionId,
        reproducibility_level: reproducibilityLevel,
        includes_subject_data: includeSubjectData,
        differential_privacy: differentialPrivacy,
        pi_attestation: piAttestation,
      });

      setProgress(
        'Export bundle compiled successfully! Initiating download...',
      );

      // 2. Stream the download by hitting the download URL directly in a new window/tab or navigation
      window.location.href = `/api/v1/study-exports/${result.id}/download`;

      setTimeout(() => {
        setBusy(false);
        setProgress(null);
        onClose();
      }, 1000);
    } catch (e) {
      setError(
        e instanceof ApiError
          ? (e.detail?.error as string) || 'Export bundle failed.'
          : 'Failed to create export bundle.',
      );
      setBusy(false);
      setProgress(null);
    }
  };

  // Dummy original record for preview
  const originalRecordsPreview = [
    {
      id: 'rec_82f1',
      subject_id: 'Patient-Avery-Karlin',
      condition_id: 'active_waveguide',
      timing_report: { latencies: [12, 14, 18] },
      adverse_events: [{ type: 'headache', severity: 3 }],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/80 backdrop-blur-md animate-fade-in select-none">
      <div className="w-full max-w-lg rounded-2xl border border-stone-850 bg-stone-950 p-6 shadow-2xl overflow-y-auto max-h-[90vh] scrollbar-thin">
        <div className="flex items-center justify-between border-b border-stone-900 pb-3 mb-4">
          <h3 className="text-sm font-mono uppercase tracking-wider text-stone-200 flex items-center gap-2">
            <Download size={16} className="text-amber-500" />
            Export Study Bundle
          </h3>
          <button
            onClick={onClose}
            className="text-stone-500 hover:text-stone-300 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {/* Target Version Select */}
          <div>
            <label className="text-[9px] font-mono uppercase tracking-widest text-stone-500">
              Target Snapshot Version
            </label>
            <select
              disabled={!!preselectedVersion}
              value={selectedVersionId}
              onChange={(e) => setSelectedVersionId(e.target.value)}
              className="mt-1 w-full bg-stone-900 border border-stone-800 rounded-lg px-3 py-2 text-xs font-mono text-stone-200 focus:border-amber-500/50 outline-none"
            >
              {versions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.version_label} {v.doi ? `(${v.doi})` : ''}
                </option>
              ))}
              {versions.length === 0 && (
                <option value="">No snapshots found</option>
              )}
            </select>
          </div>

          {/* Reproducibility Level */}
          <div>
            <label className="text-[9px] font-mono uppercase tracking-widest text-stone-500">
              Reproducibility Level Goal
            </label>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {[
                {
                  id: 'bytes-identical',
                  label: 'Bytes Identical',
                  desc: 'Sample parity',
                },
                {
                  id: 'perceptually-identical',
                  label: 'Perceptual',
                  desc: 'Floating drift',
                },
                {
                  id: 'statistically-equivalent',
                  label: 'Statistical',
                  desc: 'Stochastic',
                },
              ].map((level) => (
                <button
                  key={level.id}
                  type="button"
                  onClick={() => setReproducibilityLevel(level.id)}
                  className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all ${
                    reproducibilityLevel === level.id
                      ? 'border-amber-500/50 bg-amber-500/5 text-stone-100'
                      : 'border-stone-900 bg-stone-950/40 hover:border-stone-800 text-stone-400'
                  }`}
                >
                  <span className="text-[10px] font-mono font-semibold">
                    {level.label}
                  </span>
                  <span className="text-[8px] font-mono text-stone-500 mt-0.5">
                    {level.desc}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Include Subject Data Toggle */}
          <div className="flex items-center justify-between border-t border-b border-stone-900/60 py-3">
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-mono font-bold text-stone-300">
                Include Subject Session Records
              </span>
              <span className="text-[9px] font-mono text-stone-500">
                Pack anonymized database records & biological signal streams
              </span>
            </div>
            <button
              onClick={() => setIncludeSubjectData(!includeSubjectData)}
              className={`w-9 h-5 rounded-full p-0.5 transition-all ${
                includeSubjectData ? 'bg-amber-500' : 'bg-stone-900'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-stone-950 shadow-md transition-all ${
                  includeSubjectData ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Anonymization Preview and DP Settings */}
          {includeSubjectData && (
            <div className="flex flex-col gap-4 animate-fade-in">
              <div className="flex items-center justify-between border-b border-stone-900/60 pb-2">
                <span className="text-[10px] font-mono font-bold tracking-wide text-stone-400">
                  Privacy Settings
                </span>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={differentialPrivacy}
                    onChange={(e) => setDifferentialPrivacy(e.target.checked)}
                    className="sr-only"
                  />
                  <div
                    className={`w-8 h-4 rounded-full p-0.5 transition-all ${
                      differentialPrivacy ? 'bg-emerald-500' : 'bg-stone-900'
                    }`}
                  >
                    <div
                      className={`w-3 h-3 rounded-full bg-stone-950 transition-all ${
                        differentialPrivacy ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </div>
                  <span className="text-[9px] font-mono text-stone-400 flex items-center gap-0.5">
                    <Sparkles size={10} className="text-emerald-400" />
                    DP Noise
                  </span>
                </label>
              </div>

              <AnonymizationPreview
                originalRecords={originalRecordsPreview}
                differentialPrivacy={differentialPrivacy}
              />

              {/* PI attestation check */}
              <label className="flex items-start gap-2.5 border border-stone-900 bg-stone-950 p-3 rounded-xl cursor-pointer hover:border-amber-500/20 transition-all select-none">
                <input
                  type="checkbox"
                  checked={piAttestation}
                  onChange={(e) => setPiAttestation(e.target.checked)}
                  className="rounded border-stone-850 bg-stone-900 text-amber-500 focus:ring-0 w-3.5 h-3.5 mt-0.5 shrink-0"
                />
                <span className="text-[10px] font-mono text-stone-400 leading-relaxed">
                  I certify that all clinical data conforms to HIPAA/IRB
                  anonymization protocols, that no direct identifiers exist, and
                  that I have appropriate approvals to publish these records
                  publicly.
                </span>
              </label>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-400 p-2.5 rounded-lg text-[10px] font-mono leading-relaxed">
              <ShieldAlert size={14} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {progress && (
            <div className="flex items-center gap-2 bg-amber-500/5 border border-amber-500/10 text-amber-400 p-2.5 rounded-lg text-[10px] font-mono">
              <div className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent border-amber-500 animate-spin shrink-0" />
              <span>{progress}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 border-t border-stone-900/60 pt-3">
            <button
              onClick={onClose}
              disabled={busy}
              className="px-3.5 py-1.5 rounded-lg text-[10px] font-mono text-stone-400 hover:text-stone-200 transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              onClick={startExport}
              disabled={busy || (includeSubjectData && !piAttestation)}
              className="px-5 py-1.5 rounded-lg bg-amber-500 text-stone-950 text-[10px] font-mono font-bold hover:bg-amber-400 transition-all shadow-md disabled:opacity-40 flex items-center gap-1.5"
            >
              <Download size={13} />
              Build Export ZIP
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
