import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/api/client';
import type { ListeningSession } from '@/api/types';
import { useAnnealMusic } from '@/hooks/useAnnealMusic';
import ListeningView from '@/listening/ListeningView';
import { getErrorMessage } from '@/api/client';
import { Compass, HelpCircle, ArrowLeft } from 'lucide-react';

export default function ListeningSessionPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { ensureOrchestrator } = useAnnealMusic();

  const [session, setSession] = useState<ListeningSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    loadSession();
  }, [slug]);

  const loadSession = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!api.isBackendConfigured()) {
        setError('Listening Sessions require an active server connection.');
        return;
      }
      const data = await api.getListeningSession(slug!);
      setSession(data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    navigate(-1);
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-stone-950 text-stone-400 font-mono text-[10px] uppercase tracking-[0.2em]">
        <div className="h-10 w-10 rounded-full border border-t-amber-500 border-stone-850 animate-spin mb-4" />
        Sensing ambient field...
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-stone-950 text-stone-300 font-body p-6">
        <div className="max-w-md w-full border border-stone-850 bg-stone-900/30 rounded-xl p-8 text-center backdrop-blur-md shadow-2xl">
          <Compass
            size={32}
            className="text-amber-500/80 mx-auto mb-4 animate-pulse"
          />
          <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-amber-200 mb-2">
            Session Unavailable
          </h2>
          <p className="text-[10px] uppercase tracking-wider text-stone-500 mb-6 leading-relaxed">
            {error || 'The requested listening session could not be resolved.'}
          </p>
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 rounded-full border border-stone-800 bg-stone-950 px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.18em] text-stone-400 hover:text-stone-200 hover:border-stone-700 transition-all"
          >
            <ArrowLeft size={12} />
            Back to Jam
          </button>
        </div>
      </div>
    );
  }

  // Graceful source piece missing check:
  if (!session.piece_id || !session.piece) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-stone-950 text-stone-300 font-body p-6">
        <div className="max-w-md w-full border border-stone-850 bg-stone-900/30 rounded-xl p-8 text-center backdrop-blur-md shadow-2xl">
          <HelpCircle size={32} className="text-amber-500/85 mx-auto mb-4" />
          <h2 className="font-mono text-xs uppercase tracking-[0.2em] text-amber-200 mb-2">
            Source Unavailable
          </h2>
          <p className="text-[10px] uppercase tracking-wider text-stone-500 mb-6 leading-relaxed">
            The source Piece for this session has been removed or is no longer
            accessible.
          </p>
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-2 rounded-full border border-stone-800 bg-stone-950 px-5 py-2.5 font-mono text-[10px] uppercase tracking-[0.18em] text-stone-400 hover:text-stone-200 hover:border-stone-700 transition-all"
          >
            <ArrowLeft size={12} />
            Back to Jam
          </button>
        </div>
      </div>
    );
  }

  return (
    <ListeningView
      session={session}
      ensureOrchestrator={ensureOrchestrator}
      onClose={handleClose}
    />
  );
}
