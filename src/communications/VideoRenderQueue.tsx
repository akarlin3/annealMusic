import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import type { RenderedArtifactOut } from '@/api/types';
import { Loader2, Download, Copy, Clock } from 'lucide-react';

interface VideoRenderQueueProps {
  initialArtifacts: RenderedArtifactOut[];
  showToast: (msg: string) => void;
}

export default function VideoRenderQueue({
  initialArtifacts,
  showToast,
}: VideoRenderQueueProps) {
  const [artifacts, setArtifacts] =
    useState<RenderedArtifactOut[]>(initialArtifacts);

  useEffect(() => {
    setArtifacts(initialArtifacts);
  }, [initialArtifacts]);

  // Poll active pending renders
  useEffect(() => {
    const pendingIds = artifacts
      .filter((a) => a.bytes === null)
      .map((a) => a.id);

    if (pendingIds.length === 0) return;

    const interval = setInterval(async () => {
      let updated = false;
      const nextArtifacts = await Promise.all(
        artifacts.map(async (art) => {
          if (art.bytes !== null) return art; // already complete

          try {
            const fresh = await api.getRenderStatus(art.id);
            if (fresh.bytes !== null) {
              updated = true;
              showToast(
                `Export ${fresh.id.slice(0, 8)} has successfully completed!`,
              );
            }
            return fresh;
          } catch {
            return art; // fallback to current on error
          }
        }),
      );

      if (updated) {
        setArtifacts(nextArtifacts);
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [artifacts, showToast]);

  const copyCitation = (bib: string | null) => {
    if (!bib) return;
    navigator.clipboard.writeText(bib);
    showToast('BibTeX citation copied to clipboard!');
  };

  if (artifacts.length === 0) return null;

  return (
    <div
      className="rounded-2xl p-5 border border-stone-850"
      style={{
        background: 'rgba(18, 16, 15, 0.6)',
        backdropFilter: 'blur(10px)',
      }}
    >
      <h3 className="text-stone-300 font-mono text-[10px] uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
        <Clock size={12} className="text-violet-400" />
        Render & Export Queue
      </h3>

      <div className="space-y-3">
        {artifacts.map((art) => {
          const isPending = art.bytes === null;
          const downloadUrl = `/api/v1/renders/${art.id}/download`;

          return (
            <div
              key={art.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border border-stone-800 bg-stone-900/30 gap-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono text-violet-400 uppercase tracking-wider">
                    {art.render_kind}
                  </span>
                  <span className="text-[9px] text-stone-500 font-mono">
                    ID: {art.id.slice(0, 8)}
                  </span>
                </div>
                <div className="text-[11px] text-stone-300">
                  {art.source_kind} · {art.resolution}
                  {art.duration_ms &&
                    ` · ${Math.round(art.duration_ms / 1000)}s`}
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto">
                {isPending ? (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-950/20 border border-violet-900/30 text-[10px] font-mono text-violet-300">
                    <Loader2
                      size={11}
                      className="animate-spin text-violet-400"
                    />
                    Rendering
                  </div>
                ) : (
                  <>
                    {art.citation_bibtex && (
                      <button
                        onClick={() => copyCitation(art.citation_bibtex)}
                        className="p-1.5 rounded-lg text-stone-400 hover:text-stone-200 transition-colors border border-stone-800 bg-stone-900/50 hover:bg-stone-850"
                        title="Copy BibTeX Citation"
                      >
                        <Copy size={12} />
                      </button>
                    )}
                    <a
                      href={downloadUrl}
                      download
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-violet-600 hover:bg-violet-500 text-white text-[10px] font-mono transition-all"
                    >
                      <Download size={11} />
                      Download
                    </a>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
