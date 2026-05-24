import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '@/api/client';
import { ApiError, type RecordingMeta } from '@/api/types';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; meta: RecordingMeta }
  | { kind: 'gated' }
  | { kind: 'error' };

/** Public player for a shared recording short link `/r/<slug>`. */
export default function RecordingPage() {
  const { slug } = useParams<{ slug: string }>();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  useEffect(() => {
    if (!slug) {
      setState({ kind: 'error' });
      return;
    }
    if (!api.isBackendConfigured()) {
      setState({ kind: 'error' });
      return;
    }
    let cancelled = false;
    void api
      .recordingMeta(slug)
      .then((meta) => {
        if (!cancelled) setState({ kind: 'ready', meta });
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setState({ kind: 'gated' });
        } else {
          setState({ kind: 'error' });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return (
    <div
      className="flex min-h-screen w-full items-center justify-center p-6"
      style={{ background: '#0c0a09', color: '#f5f5f4' }}
    >
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="font-display text-3xl tracking-tight"
          style={{ color: '#fef3c7' }}
        >
          <em>AnnealMusic</em>
        </Link>

        {state.kind === 'loading' && (
          <p
            className="mt-6 font-mono text-[11px] uppercase tracking-[0.18em]"
            style={{ color: '#78716c' }}
          >
            Loading…
          </p>
        )}

        {state.kind === 'gated' && (
          <p className="mt-6 font-body text-sm" style={{ color: '#a8a29e' }}>
            This recording is private or no longer available.
          </p>
        )}

        {state.kind === 'error' && (
          <p className="mt-6 font-body text-sm" style={{ color: '#a8a29e' }}>
            Couldn’t load this recording.
          </p>
        )}

        {state.kind === 'ready' && slug && (
          <div
            className="mt-6 rounded-xl p-5"
            style={{ border: '1px solid #292524' }}
          >
            <div className="font-body text-lg" style={{ color: '#f5f5f4' }}>
              {state.meta.title || 'Untitled session'}
            </div>
            <div
              className="mb-4 mt-1 font-mono text-[10px] uppercase tracking-[0.16em]"
              style={{ color: '#78716c' }}
            >
              {state.meta.format} · {Math.round(state.meta.duration_ms / 1000)}s
            </div>
            <audio
              controls
              autoPlay
              preload="auto"
              src={api.recordingAudioUrl(slug)}
              className="w-full"
            />
            {state.meta.patch_id && (
              <Link
                to={`/p/${state.meta.patch_id}`}
                className="mt-4 inline-block font-mono text-[10px] uppercase tracking-[0.18em]"
                style={{ color: '#f59e0b' }}
              >
                Open the source patch →
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
