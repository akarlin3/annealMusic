/* eslint-disable @typescript-eslint/no-explicit-any */
import { Eye, ShieldAlert, Sparkles } from 'lucide-react';

interface PreviewRecord {
  id: string;
  originalSubjectId: string;
  anonSubjectId: string;
  conditionId: string;
  relativeStarted: number;
  relativeCompleted: number;
  latencies: number[];
  adverseSeverity: number;
}

export function AnonymizationPreview({
  originalRecords,
  differentialPrivacy,
}: {
  originalRecords: any[];
  differentialPrivacy: boolean;
}) {
  // Generate stable mock anonymized records based on original records
  const previewRecords: PreviewRecord[] = originalRecords.map((r, idx) => {
    const originalSubj = r.subject_id || `Patient-${idx + 1}`;

    // Stable pseudo-anonymization for preview
    const anonSubj = `subj_${Math.abs(
      originalSubj
        .split('')
        .reduce((acc: number, char: string) => acc + char.charCodeAt(0), 0),
    )
      .toString(16)
      .slice(0, 8)}`;

    const originalLatencies = r.timing_report?.latencies || [12, 14, 18];
    const originalSeverity = r.adverse_events?.[0]?.severity || 3;

    // Apply mock DP Laplace noise for display if enabled
    const latencies = differentialPrivacy
      ? originalLatencies.map((v: number) =>
          Math.max(1, Math.round(v + (Math.random() - 0.5) * 5)),
        )
      : originalLatencies;

    const adverseSeverity = differentialPrivacy
      ? Math.max(
          0,
          Math.min(5, Math.round(originalSeverity + (Math.random() - 0.5) * 2)),
        )
      : originalSeverity;

    return {
      id: r.id || `rec_${idx + 1}`,
      originalSubjectId: originalSubj,
      anonSubjectId: anonSubj,
      conditionId: r.condition_id || 'baseline',
      relativeStarted: 0.0,
      relativeCompleted: 300.0,
      latencies,
      adverseSeverity,
    };
  });

  return (
    <div className="flex flex-col gap-3 border border-stone-850 bg-stone-950/40 backdrop-blur-md rounded-xl p-4 animate-fade-in select-none">
      <div className="flex items-center justify-between border-b border-stone-850 pb-2">
        <span className="text-xs font-mono font-bold tracking-wide text-stone-300 flex items-center gap-1.5">
          <Eye size={13} className="text-amber-500" />
          Anonymization Preview
        </span>
        {differentialPrivacy && (
          <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
            <Sparkles size={10} className="animate-pulse" />
            Differential Privacy Active
          </span>
        )}
      </div>

      <p className="text-[10px] font-mono text-stone-500 leading-relaxed">
        Verify that direct patient identifiers are scrubbed and absolute
        datetimes are translated to relative second offsets.
      </p>

      <div className="overflow-x-auto border border-stone-900 rounded-lg">
        <table className="w-full text-left border-collapse text-[10px] font-mono text-stone-400">
          <thead>
            <tr className="bg-stone-900/60 text-stone-500 uppercase border-b border-stone-850">
              <th className="px-3 py-2">Field</th>
              <th className="px-3 py-2">Original State</th>
              <th className="px-3 py-2 text-stone-200">Anonymized State</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-900/40 bg-stone-950/20">
            {previewRecords.slice(0, 2).map((rec) => (
              <tr
                key={rec.id}
                className="hover:bg-stone-900/10 transition-colors"
              >
                <td className="px-3 py-2 text-stone-500">Subject ID</td>
                <td className="px-3 py-2 line-through text-stone-600">
                  {rec.originalSubjectId}
                </td>
                <td className="px-3 py-2 text-amber-400 font-semibold">
                  {rec.anonSubjectId}
                </td>
              </tr>
            ))}
            <tr>
              <td className="px-3 py-2 text-stone-500">Timestamps</td>
              <td className="px-3 py-2 line-through text-stone-600">
                2026-05-31 03:10:00
              </td>
              <td className="px-3 py-2 text-stone-200">
                0.0s (Relative Offset)
              </td>
            </tr>
            {previewRecords.slice(0, 1).map((rec) => (
              <>
                <tr key={rec.id + '_timing'}>
                  <td className="px-3 py-2 text-stone-500">Timing Latencies</td>
                  <td className="px-3 py-2 text-stone-600">[12s, 14s, 18s]</td>
                  <td className="px-3 py-2 text-emerald-400">
                    [{rec.latencies.map((v) => `${v}s`).join(', ')}]
                  </td>
                </tr>
                <tr key={rec.id + '_adverse'}>
                  <td className="px-3 py-2 text-stone-500">Adverse Severity</td>
                  <td className="px-3 py-2 text-stone-600">3 (Grade 3)</td>
                  <td className="px-3 py-2 text-emerald-400">
                    {rec.adverseSeverity} {differentialPrivacy && '(DP added)'}
                  </td>
                </tr>
              </>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-start gap-2 bg-amber-500/5 border border-amber-500/10 rounded-lg p-2.5">
        <ShieldAlert size={14} className="text-amber-500 shrink-0 mt-0.5" />
        <p className="text-[9px] font-mono text-amber-500/80 leading-relaxed">
          Subject identification codes are uniquely salted and stable *only*
          within this bundle. Re-exporting this study version will generate a
          completely different set of anonymous IDs.
        </p>
      </div>
    </div>
  );
}
