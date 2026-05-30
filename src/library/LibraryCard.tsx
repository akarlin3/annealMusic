import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Play, Square, ArrowRight } from 'lucide-react';
import type { LibraryListing } from '@/api/types';
import { libraryApi } from '@/library/api';
import {
  labelForIntention,
  labelForLength,
  labelForCharacter,
} from '@/library/taxonomy';

interface LibraryCardProps {
  listing: LibraryListing;
  playing: boolean;
  onTogglePreview: () => void;
}

function fmtDuration(ms: number | null): string {
  if (!ms || ms <= 0) return '';
  const m = Math.round(ms / 60000);
  return `${m} min`;
}

export default function LibraryCard({
  listing,
  playing,
  onTogglePreview,
}: LibraryCardProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const previewReady = listing.preview_status === 'ready';
  const previewSrc = libraryApi.previewUrl(listing.preview_url);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    try {
      if (playing) {
        void audio.play().catch(() => undefined);
      } else {
        audio.pause();
        audio.currentTime = 0;
      }
    } catch {
      // jsdom (tests) doesn't implement media playback; harmless.
    }
  }, [playing]);

  return (
    <div className="flex flex-col rounded-xl border border-stone-850 bg-stone-900/20 p-4 transition-colors hover:border-stone-700">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-lg leading-tight text-stone-100">
          {listing.session_title || 'Listening Session'}
        </h3>
        {listing.editor_pick && (
          <span className="shrink-0 rounded-full border border-amber-500/40 px-2 py-0.5 font-mono text-[8px] uppercase tracking-wider text-amber-400/90">
            Pick
          </span>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {listing.intention && (
          <span className="rounded-full bg-stone-800/60 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-stone-300">
            {labelForIntention(listing.intention)}
          </span>
        )}
        {listing.length_category && (
          <span className="rounded-full bg-stone-800/40 px-2 py-0.5 font-mono text-[9px] uppercase tracking-wider text-stone-400">
            {labelForLength(listing.length_category)}
            {fmtDuration(listing.total_duration_ms)
              ? ` · ${fmtDuration(listing.total_duration_ms)}`
              : ''}
          </span>
        )}
      </div>

      {listing.character_tags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {listing.character_tags.map((t) => (
            <span
              key={t}
              className="font-mono text-[8px] uppercase tracking-wider text-stone-500"
            >
              {labelForCharacter(t)}
            </span>
          ))}
        </div>
      )}

      {listing.curator_note && (
        <p className="mt-2 text-sm font-body italic text-stone-400 leading-snug">
          {listing.curator_note}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        {previewReady && previewSrc ? (
          <button
            onClick={onTogglePreview}
            className="flex items-center gap-1.5 rounded-full border border-stone-800 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-stone-300 transition-colors hover:border-amber-500/50 hover:text-amber-400"
            style={{
              background: playing ? 'rgba(245,158,11,0.12)' : 'transparent',
            }}
          >
            {playing ? <Square size={11} /> : <Play size={11} />}
            {playing ? 'Stop' : 'Preview'}
          </button>
        ) : (
          <span className="font-mono text-[9px] uppercase tracking-wider text-stone-600">
            {listing.preview_status === 'failed'
              ? 'no preview'
              : 'preview rendering'}
          </span>
        )}

        {listing.session_slug && (
          <Link
            to={`/listening/${listing.session_slug}`}
            className="flex items-center gap-1.5 rounded-full bg-amber-500/90 px-3 py-1 font-mono text-[10px] uppercase tracking-wider text-stone-950 transition-colors hover:bg-amber-400"
          >
            Listen
            <ArrowRight size={11} />
          </Link>
        )}
      </div>

      {previewReady && previewSrc && (
        <audio
          ref={audioRef}
          src={previewSrc}
          preload="none"
          onEnded={onTogglePreview}
        />
      )}
    </div>
  );
}
