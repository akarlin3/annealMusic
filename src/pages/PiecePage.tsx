import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { TimelineEditor } from '@/piece/TimelineEditor';
import { useAnnealMusic } from '@/hooks/useAnnealMusic';
import Toast, { type ToastMessage } from '@/components/Toast';

export default function PiecePage() {
  const { ensureOrchestrator } = useAnnealMusic();
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = useCallback((text: string) => {
    setToast({ id: Date.now(), text });
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  return (
    <div
      className="min-h-screen w-full"
      style={{ background: '#0c0a09', color: '#f5f5f4' }}
    >
      <div className="mx-auto max-w-6xl px-6 py-12 font-body">
        {/* Navigation Header */}
        <header className="mb-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="p-2 rounded-full border border-stone-850 bg-stone-950/20 hover:border-stone-700 hover:text-white transition-colors"
              aria-label="Back to synthesizer jam"
            >
              <ArrowLeft size={16} />
            </Link>
            <div>
              <h1
                className="text-xl uppercase tracking-[0.2em]"
                style={{ color: '#fef3c7' }}
              >
                Piece Editor & Timeline
              </h1>
              <p className="text-[10px] uppercase tracking-wider text-stone-500 mt-1">
                Compose evolving horizontal timelines of sound and parameter
                segments
              </p>
            </div>
          </div>
        </header>

        {/* Timeline Editor */}
        <TimelineEditor
          ensureOrchestrator={ensureOrchestrator}
          showToast={showToast}
        />

        <Toast toast={toast} onDismiss={dismissToast} />
      </div>
    </div>
  );
}
