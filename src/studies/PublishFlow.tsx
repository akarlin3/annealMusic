import { useState } from 'react';
import { BadgeCheck, X, Check, AlertCircle } from 'lucide-react';
import { studiesApi, ApiError } from './api';
import { publishPreflight } from './types';
import type { PublishResult, Study } from './types';

const CHECK_LABELS: Record<string, string> = {
  abstract: 'Abstract is filled in',
  ethics_statement: 'Ethics statement is present',
  principal_investigator: 'At least one PI',
  investigator_orcid: 'Every investigator has an ORCID',
};

export function PublishFlow({
  study,
  onClose,
  onPublished,
}: {
  study: Study;
  onClose: () => void;
  onPublished: () => void;
}) {
  const missing = publishPreflight(study);
  const ready = missing.length === 0;
  const [label, setLabel] = useState('published');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PublishResult | null>(null);

  const checks = Object.keys(CHECK_LABELS).map((key) => ({
    key,
    label: CHECK_LABELS[key],
    ok: !missing.includes(key),
  }));

  const publish = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await studiesApi.publish(study.id, {
        version_label: label.trim(),
      });
      setResult(res);
      onPublished();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'preflight_failed') {
        setError(
          'Pre-flight failed: ' + (e.detail.missing as string[]).join(', '),
        );
      } else if (e instanceof ApiError && e.code === 'zenodo_error') {
        setError('Zenodo error — the study was not published. Try again.');
      } else if (
        e instanceof ApiError &&
        e.code === 'duplicate_version_label'
      ) {
        setError('That version label already exists.');
      } else {
        setError('Publish failed.');
      }
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-stone-800 bg-stone-950 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-mono uppercase tracking-wider text-stone-200 flex items-center gap-2">
            <BadgeCheck size={16} className="text-amber-500" />
            Publish &amp; mint DOI
          </h3>
          <button
            onClick={onClose}
            className="text-stone-500 hover:text-stone-300"
          >
            <X size={16} />
          </button>
        </div>

        {result ? (
          <div className="flex flex-col gap-3">
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-950/20 p-4">
              <p className="text-xs font-mono text-emerald-300 flex items-center gap-2">
                <Check size={14} /> Published
                {result.stub ? ' (sandbox/stub)' : ''}
              </p>
              <p className="mt-2 text-[11px] font-mono text-stone-300 break-all">
                DOI: {result.doi}
              </p>
              <p className="text-[11px] font-mono text-stone-400 break-all">
                Concept DOI: {result.concept_doi}
              </p>
            </div>
            <button
              onClick={onClose}
              className="self-end px-4 py-1.5 rounded bg-amber-500 text-stone-950 text-[11px] font-mono font-semibold hover:bg-amber-400"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <p className="text-[11px] font-mono text-stone-500 mb-3">
              Pre-flight checklist
            </p>
            <ul className="flex flex-col gap-1.5 mb-4">
              {checks.map((c) => (
                <li
                  key={c.key}
                  className={`flex items-center gap-2 text-[11px] font-mono ${c.ok ? 'text-emerald-400' : 'text-rose-400'}`}
                >
                  {c.ok ? <Check size={13} /> : <AlertCircle size={13} />}
                  {c.label}
                </li>
              ))}
            </ul>

            <label className="text-[10px] font-mono uppercase tracking-widest text-stone-500">
              Version label
            </label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="mt-1 w-full bg-stone-900 border border-stone-800 rounded px-2 py-2 text-xs font-mono text-stone-200"
            />

            {error && (
              <p className="mt-2 text-[10px] font-mono text-rose-400">
                {error}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={onClose}
                className="px-3 py-1.5 rounded text-[11px] font-mono text-stone-400 hover:text-stone-200"
              >
                Cancel
              </button>
              <button
                onClick={publish}
                disabled={!ready || busy || !label.trim()}
                title={ready ? '' : 'Complete the checklist first'}
                className="px-4 py-1.5 rounded bg-amber-500 text-stone-950 text-[11px] font-mono font-semibold hover:bg-amber-400 disabled:opacity-40"
              >
                {busy ? 'Minting…' : 'Mint DOI'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
