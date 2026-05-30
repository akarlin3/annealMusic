import React, { useState } from 'react';
import type {
  ExperimentDefinition,
  TrialResult,
  SubjectDemographics,
} from '../types';
import {
  Award,
  Download,
  CloudUpload,
  FileText,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface DebriefScreenProps {
  definition: ExperimentDefinition;
  results: TrialResult[];
  demographics: SubjectDemographics;
  onDownload: () => void;
  onSubmit: (postUrl: string) => Promise<boolean>;
  onWithdraw: () => void;
  postUrlFromParams?: string;
}

export const DebriefScreen: React.FC<DebriefScreenProps> = ({
  definition,
  results,
  demographics,
  onDownload,
  onSubmit,
  onWithdraw,
  postUrlFromParams,
}) => {
  const [postUrl, setPostUrl] = useState<string>(postUrlFromParams || '');
  const [submitStatus, setSubmitStatus] = useState<
    'idle' | 'loading' | 'success' | 'error'
  >('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showDataReview, setShowDataReview] = useState(false);

  const handleUploadSubmit = async () => {
    if (!postUrl) return;
    setSubmitStatus('loading');
    setErrorMessage('');
    try {
      const success = await onSubmit(postUrl);
      if (success) {
        setSubmitStatus('success');
      } else {
        setSubmitStatus('error');
        setErrorMessage('Server rejected the payload or endpoint not found.');
      }
    } catch (err: unknown) {
      setSubmitStatus('error');
      setErrorMessage(
        err instanceof Error ? err.message : 'Network request failed.',
      );
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 md:p-8 border border-stone-900 bg-stone-900/10 rounded-2xl shadow-xl flex flex-col gap-6 select-none animate-fadeIn">
      {/* Debrief Header */}
      <div className="flex items-center gap-3 border-b border-stone-900 pb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/20">
          <Award size={20} strokeWidth={1.5} />
        </div>
        <div>
          <h1 className="text-base font-mono uppercase tracking-wider font-semibold text-stone-200">
            Study Debriefing
          </h1>
          <p className="text-[10px] text-stone-500 font-mono uppercase tracking-widest mt-0.5">
            Thank you for participating
          </p>
        </div>
      </div>

      {/* Debrief Message */}
      <div className="text-sm font-sans text-stone-400 leading-relaxed">
        {definition.debrief_text ||
          'Thank you for your valuable participation in this research study! Your data is compiled below and is entirely kept local to your device until you decide to export it.'}
      </div>

      {/* Structured Transparency Data Review */}
      <div className="border border-stone-900 rounded-xl bg-stone-900/30 overflow-hidden">
        <button
          type="button"
          onClick={() => setShowDataReview(!showDataReview)}
          className="w-full flex items-center justify-between px-4 py-3 bg-stone-900/20 text-xs font-mono uppercase tracking-wider text-stone-400 hover:text-stone-200 hover:bg-stone-900/40 transition-all focus:outline-none"
        >
          <span className="flex items-center gap-2">
            <FileText size={14} className="text-amber-500/80" />
            Transparency Review ({results.length} trials logged)
          </span>
          <span className="text-[10px] text-stone-500">
            {showDataReview ? 'COLLAPSE [-]' : 'EXPAND [+]'}
          </span>
        </button>

        {showDataReview && (
          <div className="p-4 border-t border-stone-900 bg-stone-950 font-mono text-[10px] leading-relaxed max-h-48 overflow-y-auto scrollbar-thin flex flex-col gap-3">
            <div>
              <span className="text-stone-500 font-semibold uppercase tracking-wider block border-b border-stone-900 pb-1 mb-1">
                Demographic Profile
              </span>
              <pre className="text-stone-300 whitespace-pre-wrap break-all">
                {JSON.stringify(demographics, null, 2)}
              </pre>
            </div>
            <div>
              <span className="text-stone-500 font-semibold uppercase tracking-wider block border-b border-stone-900 pb-1 mb-1">
                Trial-by-Trial Responses
              </span>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-stone-300">
                  <thead>
                    <tr className="text-stone-500 border-b border-stone-900">
                      <th className="pb-1 pr-2">Trial</th>
                      <th className="pb-1 pr-2">Stimulus</th>
                      <th className="pb-1 pr-2">Response</th>
                      <th className="pb-1 pr-2">RT (ms)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => (
                      <tr
                        key={i}
                        className="border-b border-stone-900/50 hover:bg-stone-900/20"
                      >
                        <td className="py-1 pr-2">{r.trial_index + 1}</td>
                        <td className="py-1 pr-2">{r.stimulus_id}</td>
                        <td className="py-1 pr-2 max-w-[120px] truncate">
                          {typeof r.response_value === 'object'
                            ? 'Continuous data'
                            : String(r.response_value)}
                        </td>
                        <td className="py-1 pr-2">
                          {r.rt_ms !== null ? `${r.rt_ms}ms` : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Export Options */}
      <div className="flex flex-col md:flex-row gap-4 items-stretch mt-4 border-t border-stone-900 pt-6">
        {/* Local Download ZIP */}
        <div className="flex-1 flex flex-col gap-3 p-4 rounded-xl border border-stone-900 bg-stone-900/10 hover:border-stone-850 transition-all">
          <div className="flex items-center gap-2 text-stone-300 font-mono text-xs uppercase tracking-wider font-semibold">
            <Download size={15} className="text-amber-500" />
            1. Save to Device
          </div>
          <p className="text-[10px] text-stone-500 leading-relaxed font-sans">
            Downloads a zipped folder containing the responses table (CSV), raw
            engine features (JSONL), and manifests. Excellent for offline review
            or manual email submission.
          </p>
          <button
            type="button"
            onClick={onDownload}
            className="w-full mt-auto py-2.5 rounded-lg text-xs font-mono uppercase tracking-wider bg-stone-900 border border-stone-800 text-stone-300 hover:border-stone-700 hover:text-stone-200 transition-all font-semibold"
          >
            Download Data (.zip)
          </button>
        </div>

        {/* HTTP POST Submit */}
        <div className="flex-1 flex flex-col gap-3 p-4 rounded-xl border border-stone-900 bg-stone-900/10 hover:border-stone-850 transition-all">
          <div className="flex items-center gap-2 text-stone-300 font-mono text-xs uppercase tracking-wider font-semibold">
            <CloudUpload size={15} className="text-amber-500" />
            2. Upload to Lab Server
          </div>
          <div className="flex flex-col gap-2 w-full mt-1">
            <input
              type="text"
              placeholder="https://lab-server.com/api/submit"
              value={postUrl}
              onChange={(e) => setPostUrl(e.target.value)}
              disabled={
                submitStatus === 'loading' || submitStatus === 'success'
              }
              className="w-full py-1.5 px-3 rounded-lg border border-stone-850 bg-stone-950 text-stone-350 font-mono text-[10px] focus:outline-none focus:border-amber-500/50 disabled:opacity-50"
            />
          </div>
          <button
            type="button"
            disabled={
              !postUrl ||
              submitStatus === 'loading' ||
              submitStatus === 'success'
            }
            onClick={handleUploadSubmit}
            className="w-full py-2.5 rounded-lg text-xs font-mono uppercase tracking-wider bg-amber-500 text-stone-950 font-semibold hover:bg-amber-400 disabled:opacity-30 disabled:cursor-not-allowed shadow-md shadow-amber-500/5 transition-all mt-auto"
          >
            {submitStatus === 'loading' && 'Uploading...'}
            {submitStatus === 'success' && 'Uploaded Successfully ✓'}
            {submitStatus === 'error' && 'Retry Upload'}
            {submitStatus === 'idle' && 'Submit Results'}
          </button>

          {submitStatus === 'success' && (
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald-400 mt-1 uppercase justify-center">
              <CheckCircle2 size={12} />
              Session uploaded successfully!
            </div>
          )}
          {submitStatus === 'error' && (
            <div className="flex items-start gap-1.5 text-[10px] font-mono text-rose-400 mt-1 uppercase">
              <AlertCircle size={12} className="mt-0.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}
        </div>
      </div>

      {/* Discard / Withdraw */}
      <div className="flex items-center justify-between border-t border-stone-900 pt-4 mt-2">
        <span className="text-[10px] font-mono text-stone-600 uppercase">
          IRB Reference: ANNEAL-MUSIC-5.6
        </span>
        <button
          type="button"
          onClick={onWithdraw}
          className="px-4 py-2 rounded-lg text-[10px] font-mono uppercase tracking-wider text-rose-500 hover:bg-rose-950/20 border border-transparent hover:border-rose-900/30 transition-all"
        >
          Withdraw & Discard Data
        </button>
      </div>
    </div>
  );
};
