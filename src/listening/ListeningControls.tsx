import { useEffect, useState } from 'react';
import { api } from '@/api/client';
import type { APIPiece, ListeningSession } from '@/api/types';
import { SCHEMA_VERSION } from '@/share/schema';
import { getErrorMessage } from '@/api/client';
import {
  Bell,
  Clock,
  Compass,
  FileText,
  HelpCircle,
  Layout,
  Save,
  Sparkles,
} from 'lucide-react';

interface ListeningControlsProps {
  initialPiece?: APIPiece | null;
  onSessionCreated: (session: ListeningSession) => void;
  onCancel?: () => void;
}

export default function ListeningControls({
  initialPiece = null,
  onSessionCreated,
  onCancel,
}: ListeningControlsProps) {
  const [pieces, setPieces] = useState<APIPiece[]>([]);
  const [selectedPieceId, setSelectedPieceId] = useState<string>('');
  const [title, setTitle] = useState('');
  const [intention, setIntention] = useState('Deep Calm');
  const [lengthCategory, setLengthCategory] = useState<
    'short' | 'medium' | 'long' | 'extended'
  >('medium');
  const [recommendedEnvironment, setRecommendedEnvironment] = useState(
    'Quiet space, eyes closed',
  );
  const [settleInSec, setSettleInSec] = useState(30); // in seconds
  const [integrationSec, setIntegrationSec] = useState(60); // in seconds
  const [openingTone, setOpeningTone] = useState(true);
  const [closingTone, setClosingTone] = useState(true);
  const [visibility, setVisibility] = useState<'unlisted' | 'public'>(
    'unlisted',
  );

  const [loadingPieces, setLoadingPieces] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialPiece) {
      setSelectedPieceId(initialPiece.id);
      setTitle(`${initialPiece.title || 'Untitled Piece'} Session`);
    } else {
      loadPieces();
    }
  }, [initialPiece]);

  const loadPieces = async () => {
    if (!api.isBackendConfigured()) return;
    setLoadingPieces(true);
    try {
      const res = await api.myPieces();
      setPieces(res.items);
      const firstPiece = res.items[0];
      if (firstPiece) {
        setSelectedPieceId(firstPiece.id);
        setTitle(`${firstPiece.title || 'Untitled Piece'} Session`);
      }
    } catch (err) {
      setError('Could not load pieces: ' + getErrorMessage(err));
    } finally {
      setLoadingPieces(false);
    }
  };

  const handlePieceChange = (pieceId: string) => {
    setSelectedPieceId(pieceId);
    const piece = pieces.find((p) => p.id === pieceId);
    if (piece) {
      setTitle(`${piece.title || 'Untitled Piece'} Session`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPieceId) {
      setError('Please select or create a composed Piece first.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const body = {
        piece_id: selectedPieceId,
        schema_ver: SCHEMA_VERSION,
        title: title || 'Meditation Session',
        description: null,
        intention: intention || null,
        length_category: lengthCategory,
        recommended_environment: recommendedEnvironment || null,
        settle_in_ms: settleInSec * 1000,
        integration_ms: integrationSec * 1000,
        opening_tone: openingTone,
        closing_tone: closingTone,
        visibility,
      };

      const session = await api.createListeningSession(body);
      onSessionCreated(session);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full rounded border border-stone-850 bg-stone-950/60 p-6 font-body text-stone-300 shadow-2xl backdrop-blur-xl">
      <header className="mb-6 border-b border-stone-900 pb-4">
        <h2 className="flex items-center gap-2.5 font-mono text-xs uppercase tracking-[0.2em] text-amber-200">
          <Sparkles size={14} className="text-amber-400" />
          Create Listening Session
        </h2>
        <p className="text-[10px] uppercase tracking-wider text-stone-500 mt-1">
          Configure a quiet, immersive experience based on a composed Piece.
        </p>
      </header>

      {error && (
        <div className="mb-5 rounded border border-red-950/30 bg-red-950/10 px-4 py-2.5 font-mono text-[9px] uppercase tracking-wider text-red-400">
          Error: {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Piece Selection */}
        {!initialPiece && (
          <div>
            <label className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-stone-400 mb-2">
              <Layout size={10} className="text-stone-500" />
              Source Composed Piece
            </label>
            {loadingPieces ? (
              <div className="font-mono text-[9px] uppercase text-stone-600 animate-pulse">
                Retrieving your compositions...
              </div>
            ) : pieces.length === 0 ? (
              <div className="font-mono text-[9px] uppercase text-stone-500 border border-stone-900 rounded p-3 text-center bg-stone-950/30">
                No pieces found. Save a composition in the timeline view first.
              </div>
            ) : (
              <select
                value={selectedPieceId}
                onChange={(e) => handlePieceChange(e.target.value)}
                className="w-full rounded border border-stone-850 bg-stone-950 px-3 py-2 font-mono text-[11px] uppercase tracking-wider text-stone-200 focus:border-amber-500/50 focus:outline-none"
              >
                {pieces.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title || 'Untitled Piece'}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {/* Title */}
        <div>
          <label className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-stone-400 mb-2">
            <FileText size={10} className="text-stone-500" />
            Session Title
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Evening Release Session"
            className="w-full rounded border border-stone-850 bg-stone-950 px-3 py-2 font-mono text-[11px] tracking-wide text-stone-200 focus:border-amber-500/50 focus:outline-none placeholder-stone-700"
          />
        </div>

        {/* Intention and Recommended Environment */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-stone-400 mb-2">
              <Compass size={10} className="text-stone-500" />
              Intention / Focus
            </label>
            <input
              type="text"
              value={intention}
              onChange={(e) => setIntention(e.target.value)}
              placeholder="e.g. Deep Settle, Stress Relief"
              className="w-full rounded border border-stone-850 bg-stone-950 px-3 py-2 font-mono text-[11px] tracking-wide text-stone-200 focus:border-amber-500/50 focus:outline-none placeholder-stone-700"
            />
          </div>
          <div>
            <label className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-stone-400 mb-2">
              <HelpCircle size={10} className="text-stone-500" />
              Recommended Environment
            </label>
            <input
              type="text"
              value={recommendedEnvironment}
              onChange={(e) => setRecommendedEnvironment(e.target.value)}
              placeholder="e.g. Dim lighting, comfortable posture"
              className="w-full rounded border border-stone-850 bg-stone-950 px-3 py-2 font-mono text-[11px] tracking-wide text-stone-200 focus:border-amber-500/50 focus:outline-none placeholder-stone-700"
            />
          </div>
        </div>

        {/* Length Category & Visibility */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-stone-400 mb-2">
              <Clock size={10} className="text-stone-500" />
              Target Duration
            </label>
            <div className="flex gap-1.5">
              {(['short', 'medium', 'long', 'extended'] as const).map((cat) => {
                const active = lengthCategory === cat;
                return (
                  <button
                    type="button"
                    key={cat}
                    onClick={() => setLengthCategory(cat)}
                    className={`flex-1 rounded py-1.5 text-center font-mono text-[8px] font-semibold uppercase tracking-wider transition-all border ${
                      active
                        ? 'bg-amber-500/10 text-amber-500 border-amber-500/30 font-bold'
                        : 'border-stone-900 bg-stone-950 hover:border-stone-800 text-stone-400'
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <label className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-stone-400 mb-2">
              Visibility
            </label>
            <div className="flex gap-1.5">
              {(['unlisted', 'public'] as const).map((vis) => {
                const active = visibility === vis;
                return (
                  <button
                    type="button"
                    key={vis}
                    onClick={() => setVisibility(vis)}
                    className={`flex-1 rounded py-1.5 text-center font-mono text-[8px] font-semibold uppercase tracking-wider transition-all border ${
                      active
                        ? 'bg-amber-500/10 text-amber-500 border-amber-500/30 font-bold'
                        : 'border-stone-900 bg-stone-950 hover:border-stone-800 text-stone-400'
                    }`}
                  >
                    {vis}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Fades: Settle-in and Integration */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-stone-900 pt-5">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="font-mono text-[9px] uppercase tracking-[0.16em] text-stone-400">
                Settle-In Fade
              </label>
              <span className="font-mono text-[10px] text-amber-400 font-semibold">
                {settleInSec} seconds
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="120"
              step="5"
              value={settleInSec}
              onChange={(e) => setSettleInSec(Number(e.target.value))}
              className="w-full h-1 bg-stone-900 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
            <span className="text-[8px] uppercase tracking-wider text-stone-500 block mt-1">
              Time elapsed at start before volume reaches full scale.
            </span>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="font-mono text-[9px] uppercase tracking-[0.16em] text-stone-400">
                Integration Fade
              </label>
              <span className="font-mono text-[10px] text-amber-400 font-semibold">
                {integrationSec} seconds
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="180"
              step="5"
              value={integrationSec}
              onChange={(e) => setIntegrationSec(Number(e.target.value))}
              className="w-full h-1 bg-stone-900 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
            <span className="text-[8px] uppercase tracking-wider text-stone-500 block mt-1">
              Time at end spent fading volume back to absolute silence.
            </span>
          </div>
        </div>

        {/* Opening and Closing Chime Tones */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-stone-900 pt-5">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => setOpeningTone(!openingTone)}
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                openingTone
                  ? 'border-amber-500 bg-amber-500/10 text-amber-500'
                  : 'border-stone-800 bg-stone-950'
              }`}
            >
              {openingTone && <Bell size={8} />}
            </button>
            <div>
              <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-stone-400 block mb-1">
                Opening Chime
              </span>
              <span className="text-[8px] uppercase tracking-wider text-stone-500">
                Triggers a dual-resonator bell chime at t = 0 before settle
                fade.
              </span>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => setClosingTone(!closingTone)}
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors ${
                closingTone
                  ? 'border-amber-500 bg-amber-500/10 text-amber-500'
                  : 'border-stone-800 bg-stone-950'
              }`}
            >
              {closingTone && <Bell size={8} />}
            </button>
            <div>
              <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-stone-400 block mb-1">
                Closing Chime
              </span>
              <span className="text-[8px] uppercase tracking-wider text-stone-500">
                Triggers a calming closing chime at absolute session end.
              </span>
            </div>
          </div>
        </div>

        {/* Footer controls */}
        <div className="flex items-center justify-end gap-3 border-t border-stone-900 pt-6">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded px-4 py-2 font-mono text-[10px] uppercase tracking-[0.18em] text-stone-500 hover:text-stone-300 transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={submitting || (!initialPiece && pieces.length === 0)}
            className="flex items-center gap-2 rounded-full bg-amber-500 px-5 py-2.5 text-stone-950 hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold shadow-lg shadow-amber-500/10"
          >
            <Save size={12} />
            <span className="font-mono text-[10px] uppercase tracking-[0.2em]">
              {submitting ? 'Creating...' : 'Create Session'}
            </span>
          </button>
        </div>
      </form>
    </div>
  );
}
