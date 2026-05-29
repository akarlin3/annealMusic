/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import type { Piece, PieceSegment, VariationPoint } from '@/piece/types';
import { PiecePlayer } from '@/piece/PiecePlayer';
import { SegmentProperties } from '@/piece/SegmentProperties';
import { NotationEditor } from '@/piece/components/NotationEditor';
import { api } from '@/api/client';
import { useParamStore, CONTROL_DEFS } from '@/state/params';
import { SCHEMA_VERSION } from '@/share/schema';
import {
  Play,
  Pause,
  Square,
  Plus,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Save,
  Share2,
  FolderOpen,
  Volume2,
  Activity,
  Dices,
} from 'lucide-react';
import type { Orchestrator } from '@/audio/orchestrator';
import { VariationEditorPanel } from '@/piece/components/VariationEditorPanel';
import { VariationDialog } from '@/piece/components/VariationDialog';

interface TimelineEditorProps {
  ensureOrchestrator: () => Orchestrator;
  showToast: (msg: string) => void;
}

const PX_PER_SEC = 6; // comfortable scale: 1 minute = 360px
const MIN_SEG_WIDTH = 60;

export const TimelineEditor: React.FC<TimelineEditorProps> = ({
  ensureOrchestrator,
  showToast,
}) => {
  // Main piece state
  const [piece, setPiece] = useState<Piece>({
    schemaVer: SCHEMA_VERSION,
    tempoBpm: null,
    title: 'New Ambient Piece',
    description: 'A custom timeline composition.',
    visibility: 'unlisted',
    defaultsState: {
      params: useParamStore.getState().params,
      engineId: useParamStore.getState().engineId,
      engineParams: useParamStore.getState().engineParams,
    },
    totalDurationMs: 15000,
    hasOpenSegment: false,
    segments: [
      { position: 0, type: 'fixed', durationMs: 5000, config: { params: {} } },
      {
        position: 1,
        type: 'transition',
        durationMs: 5000,
        config: { easing: 'easeInOut' },
      },
      {
        position: 2,
        type: 'fixed',
        durationMs: 5000,
        config: { params: { rootFreq: 180 } },
      },
    ],
  });

  const [selectedIdx, setSelectedIdx] = useState<number | null>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playheadProgress, setPlayheadProgress] = useState(0); // 0 to 1 inside active segment
  const [activeSegIdx, setActiveSegIdx] = useState(0);
  const [savedPieces, setSavedPieces] = useState<any[]>([]); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showNotation, setShowNotation] = useState(false);

  const [activeVpEdit, setActiveVpEdit] = useState<{
    paramKey: string;
    paramLabel: string;
    initialPoint?: VariationPoint;
    minVal: number;
    maxVal: number;
    stepVal: number;
    target: 'piece' | 'segment';
    segmentIndex?: number;
  } | null>(null);

  const handleEditPoint = (
    point: VariationPoint,
    target: 'piece' | 'segment',
    segmentIndex?: number,
  ) => {
    const def = CONTROL_DEFS.find((d) => d.key === point.paramKey);
    setActiveVpEdit({
      paramKey: point.paramKey,
      paramLabel: def?.label || point.paramKey,
      initialPoint: point,
      minVal: def?.min || 0,
      maxVal: def?.max || 1,
      stepVal: def?.step || 0.01,
      target,
      segmentIndex,
    });
  };

  const handleSavePieceVariation = (vp: VariationPoint) => {
    if (!activeVpEdit) return;

    if (activeVpEdit.target === 'piece') {
      const vars = [...(piece.variations || [])].filter((v) => v.id !== vp.id);
      vars.push(vp);
      const updated = { ...piece, variations: vars };
      setPiece(updated);
      if (playerRef.current) {
        playerRef.current.updatePiece(updated);
      }
    } else {
      const segmentIndex = activeVpEdit.segmentIndex!;
      const updatedSegments = piece.segments.map((seg, idx) => {
        if (idx === segmentIndex) {
          const vars = [...(seg.variations || [])].filter(
            (v) => v.id !== vp.id,
          );
          vars.push(vp);
          return { ...seg, variations: vars };
        }
        return seg;
      });
      const updated = { ...piece, segments: updatedSegments };
      setPiece(updated);
      if (playerRef.current) {
        playerRef.current.updatePiece(updated);
      }
    }
    setActiveVpEdit(null);
  };

  const handleDeletePieceVariation = () => {
    if (!activeVpEdit) return;

    if (activeVpEdit.target === 'piece') {
      const updated = {
        ...piece,
        variations: (piece.variations || []).filter(
          (v) => v.paramKey !== activeVpEdit.paramKey,
        ),
      };
      setPiece(updated);
      if (playerRef.current) {
        playerRef.current.updatePiece(updated);
      }
    } else {
      const segmentIndex = activeVpEdit.segmentIndex!;
      const updatedSegments = piece.segments.map((seg, idx) => {
        if (idx === segmentIndex) {
          return {
            ...seg,
            variations: (seg.variations || []).filter(
              (v) => v.paramKey !== activeVpEdit.paramKey,
            ),
          };
        }
        return seg;
      });
      const updated = { ...piece, segments: updatedSegments };
      setPiece(updated);
      if (playerRef.current) {
        playerRef.current.updatePiece(updated);
      }
    }
    setActiveVpEdit(null);
  };

  const playerRef = useRef<PiecePlayer | null>(null);
  const { slug } = useParams<{ slug: string }>();

  // Helpers for notation playback progress tracking
  const getSegmentDuration = (seg: PieceSegment): number => {
    const raw = seg.durationMs ?? 5000;
    if (
      seg.config?.tempoLocked &&
      piece.tempoBpm !== null &&
      piece.tempoBpm > 0
    ) {
      return raw * 4 * (60 / piece.tempoBpm) * 1000;
    }
    return raw;
  };

  const globalPlayheadMs = useMemo(() => {
    if (!isPlaying) return 0;
    let total = 0;
    for (let i = 0; i < activeSegIdx; i++) {
      const seg = piece.segments[i];
      if (seg) {
        total += getSegmentDuration(seg);
      }
    }
    const currentSeg = piece.segments[activeSegIdx];
    const dur = currentSeg ? getSegmentDuration(currentSeg) : 5000;
    return total + playheadProgress * dur;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isPlaying,
    activeSegIdx,
    playheadProgress,
    piece.segments,
    piece.tempoBpm,
  ]);

  // Load user's saved pieces on mount, and fetch targeted piece by slug if present
  useEffect(() => {
    fetchSavedPieces();
    if (slug) {
      void api
        .getPiece(slug)
        .then((item) => {
          handleLoadPiece(item);
        })
        .catch(() => {
          showToast('Failed to load piece from URL');
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const fetchSavedPieces = async () => {
    if (!api.isBackendConfigured()) return;
    try {
      const res = await api.myPieces();
      setSavedPieces(res.items);
    } catch {
      // Offline/unconfigured
    }
  };

  // Clean up player on unmount
  useEffect(() => {
    return () => {
      if (playerRef.current) {
        playerRef.current.stop();
      }
    };
  }, []);

  // Sync baseline piece defaults from the active param store state
  const handleCaptureDefaults = () => {
    const s = useParamStore.getState();
    setPiece({
      ...piece,
      defaultsState: {
        params: s.params,
        engineId: s.engineId,
        engineParams: s.engineParams,
      },
    });
    showToast('Defaults captured from active patch');
  };

  // Segment Manipulation
  const handleAddSegment = (type: PieceSegment['type']) => {
    const nextPos = piece.segments.length;
    const newSeg: PieceSegment = {
      position: nextPos,
      type,
      durationMs: type === 'open' ? null : 5000,
      config:
        type === 'transition'
          ? { easing: 'linear' }
          : type === 'arc'
            ? { arcId: 'bell' }
            : type === 'meta-arc'
              ? {
                  kind: 'random-walk',
                  seed: null,
                  randomWalk: {
                    params: ['rootFreq', 'brightness', 'space'],
                    driftStrength: 0.15,
                    meanReversion: 0.1,
                    steps: 20,
                    bounds: {
                      rootFreq: { min: 0.5, max: 1.5 },
                      brightness: { min: 0.3, max: 0.9 },
                      space: { min: 0.2, max: 0.8 },
                    },
                  },
                }
              : { params: {} },
    };
    const updatedSegs = [...piece.segments, newSeg];
    updatePieceSegments(updatedSegs);
    setSelectedIdx(nextPos);
  };

  const handleDeleteSegment = (idx: number) => {
    const updated = piece.segments
      .filter((_, i) => i !== idx)
      .map((seg, i) => ({ ...seg, position: i }));
    updatePieceSegments(updated);
    setSelectedIdx(updated.length > 0 ? 0 : null);
  };

  const handleMoveSegment = (idx: number, direction: 'left' | 'right') => {
    const targetIdx = direction === 'left' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= piece.segments.length) return;

    const updated = [...piece.segments];
    const temp = updated[idx]!;
    updated[idx] = updated[targetIdx]!;
    updated[targetIdx] = temp;

    const finalized = updated.map((seg, i) => ({ ...seg, position: i }));
    updatePieceSegments(finalized);
    setSelectedIdx(targetIdx);
  };

  const handleSegmentChange = (updatedSeg: PieceSegment) => {
    const updated = piece.segments.map((seg, i) =>
      i === updatedSeg.position ? updatedSeg : seg,
    );
    updatePieceSegments(updated);
  };

  const updatePieceSegments = (segments: PieceSegment[]) => {
    const hasOpen = segments.some((s) => s.type === 'open');
    const totalDuration = hasOpen
      ? null
      : segments.reduce((sum, s) => sum + (s.durationMs || 0), 0);

    setPiece({
      ...piece,
      segments,
      hasOpenSegment: hasOpen,
      totalDurationMs: totalDuration,
    });
  };

  // Playback handlers
  const handlePlayPause = () => {
    const orch = ensureOrchestrator();
    if (isPlaying) {
      playerRef.current?.pause();
      setIsPlaying(false);
    } else {
      if (!playerRef.current) {
        playerRef.current = new PiecePlayer(piece, orch);
      }
      // Register global reference for the notation editor glide toggle
      (window as unknown as Record<string, unknown>).activePiecePlayer =
        playerRef.current;

      setIsPlaying(true);
      playerRef.current.start(
        (progress, idx) => {
          setPlayheadProgress(progress);
          setActiveSegIdx(idx);
        },
        () => {
          setIsPlaying(false);
          setPlayheadProgress(0);
          setActiveSegIdx(0);
          showToast('Playback completed');
        },
      );
    }
  };

  const handleStop = () => {
    playerRef.current?.stop();
    setIsPlaying(false);
    setPlayheadProgress(0);
    setActiveSegIdx(0);
  };

  const handleReRoll = () => {
    const nextSeed = Math.floor(Math.random() * 1000000);
    const updated = { ...piece, variationSeed: nextSeed };
    setPiece(updated);
    if (playerRef.current) {
      playerRef.current.updatePiece(updated);
      playerRef.current.reRoll();
    }
    showToast(`Procedural variations re-rolled! (Seed: ${nextSeed})`);
  };

  const handleNotationChange = (updatedPiece: Piece) => {
    setPiece(updatedPiece);
    if (playerRef.current) {
      playerRef.current.updatePiece(updatedPiece);
    }
  };

  const handleAdvanceOpen = () => {
    if (playerRef.current) {
      playerRef.current.nextSegment();
      showToast('Advancing segment');
    }
  };

  const snapToGrid = (ms: number, tempo: number | null): number => {
    if (tempo === null) return ms;
    const beatDurationMs = (60 / tempo) * 1000;
    const beats = Math.round(ms / beatDurationMs);
    return Math.max(1, beats) * beatDurationMs;
  };

  // Horizontal Resize handler
  const handleMouseDownResize = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    e.preventDefault();
    const seg = piece.segments[idx];
    if (!seg || seg.type === 'open') return;

    const startX = e.clientX;
    const startDur = seg.durationMs || 5000;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaMs = Math.round((deltaX / PX_PER_SEC) * 1000);
      let newDur = Math.max(1000, startDur + deltaMs); // minimum 1s

      if (piece.tempoBpm !== null) {
        newDur = snapToGrid(newDur, piece.tempoBpm);
      }

      const updated = piece.segments.map((s, i) =>
        i === idx ? { ...s, durationMs: newDur } : s,
      );
      updatePieceSegments(updated);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // CRUD Persistence
  const handleSavePiece = async () => {
    if (!api.isBackendConfigured()) {
      showToast('Persistence requires active backend');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        defaults_state: piece.defaultsState,
        schema_ver: SCHEMA_VERSION,
        title: piece.title,
        description: piece.description,
        visibility: piece.visibility,
        tempo_bpm: piece.tempoBpm,
        notation: piece.notation || [],
        variation_seed: piece.variationSeed,
        variations: piece.variations || [],
        segments: piece.segments.map((s) => ({
          type: s.type,
          duration_ms: s.durationMs,
          config: s.config,
          variations: s.variations || [],
        })),
      };

      if (piece.id) {
        await api.updatePiece(piece.id, payload);
        showToast('Piece updated');
      } else {
        const res = await api.createPiece(payload);
        setPiece({
          ...piece,
          id: res.id,
          shortSlug: res.short_slug,
        });
        showToast('Piece saved successfully');
      }
      fetchSavedPieces();
    } catch {
      showToast('Failed to save piece');
    } finally {
      setSaving(false);
    }
  };

  const handleLoadPiece = (item: any) => {
    // eslint-disable-line @typescript-eslint/no-explicit-any
    setPiece({
      id: item.id,
      schemaVer: item.schema_ver,
      title: item.title,
      description: item.description,
      visibility: item.visibility,
      tempoBpm: item.tempo_bpm !== undefined ? item.tempo_bpm : null,
      defaultsState: item.defaults_state,
      totalDurationMs: item.total_duration_ms,
      hasOpenSegment: item.has_open_segment,
      notation: item.notation !== undefined ? item.notation : [],
      variationSeed:
        item.variation_seed !== undefined ? item.variation_seed : null,
      variations: item.variations !== undefined ? item.variations : [],
      segments: item.segments.map((s: any) => ({
        // eslint-disable-line @typescript-eslint/no-explicit-any
        id: s.id,
        position: s.position,
        type: s.type,
        durationMs: s.duration_ms,
        config: s.config,
        variations: s.variations !== undefined ? s.variations : [],
      })),
      shortSlug: item.short_slug,
    });
    setSelectedIdx(item.segments.length > 0 ? 0 : null);
    setShowLoadModal(false);
    showToast(`Loaded "${item.title || 'Untitled Piece'}"`);
  };

  const handleSharePiece = () => {
    if (!piece.shortSlug) {
      showToast('Save the piece first to generate a share link!');
      return;
    }
    const url = `${window.location.origin}/piece/${piece.shortSlug}`;
    navigator.clipboard.writeText(url);
    showToast('Share link copied to clipboard!');
  };

  return (
    <div className="space-y-6 w-full max-w-6xl mx-auto p-4 select-none">
      {/* Top Header & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#18151f]/80 backdrop-blur-xl border border-white/5 p-6 rounded-3xl shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center gap-6">
          <div className="space-y-1">
            <input
              type="text"
              value={piece.title || ''}
              onChange={(e) => setPiece({ ...piece, title: e.target.value })}
              className="bg-transparent text-xl font-extrabold text-white border-b border-transparent hover:border-white/20 focus:border-teal-500 focus:outline-none py-1 transition w-64 md:w-80"
              placeholder="Piece Title..."
            />
            <p className="text-xs text-white/40">
              v3.1 Pieces · Tempo + Pulse Engine
            </p>
          </div>

          {/* Piece-level Tempo Control */}
          <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-2.5 rounded-2xl">
            {piece.tempoBpm === null ? (
              <button
                onClick={() => setPiece({ ...piece, tempoBpm: 120 })}
                className="flex items-center gap-2 text-xs font-bold text-teal-400 hover:text-teal-300 transition"
              >
                <Plus className="w-4 h-4" />
                Add Tempo Layer
              </button>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-white/60">
                  Tempo:
                </span>
                <input
                  type="number"
                  min="40"
                  max="240"
                  value={piece.tempoBpm}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setPiece({
                      ...piece,
                      tempoBpm: isNaN(val)
                        ? 120
                        : Math.max(40, Math.min(240, val)),
                    });
                  }}
                  className="bg-white/5 border border-white/10 rounded-lg text-xs font-bold text-white text-center py-1 w-16 focus:outline-none focus:border-teal-500"
                />
                <span className="text-xs text-white/40 font-mono">BPM</span>
                <button
                  onClick={() => setPiece({ ...piece, tempoBpm: null })}
                  className="text-xs font-bold text-rose-400 hover:text-rose-300 transition pl-2 border-l border-white/10"
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowLoadModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white/5 border border-white/10 rounded-2xl text-xs font-bold text-white hover:bg-white/10 transition"
          >
            <FolderOpen className="w-4 h-4 text-teal-400" />
            Load
          </button>
          <button
            onClick={handleSavePiece}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2.5 bg-teal-500/20 border border-teal-500/50 rounded-2xl text-xs font-bold text-teal-300 hover:bg-teal-500/30 transition disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={handleSharePiece}
            className="flex items-center gap-2 px-4 py-2.5 bg-violet-500/20 border border-violet-500/50 rounded-2xl text-xs font-bold text-violet-300 hover:bg-violet-500/30 transition"
          >
            <Share2 className="w-4 h-4" />
            Share
          </button>
        </div>
      </div>

      {/* Main Timeline Arrangment Grid */}
      <div className="bg-[#18151f]/80 border border-white/5 p-6 rounded-3xl shadow-xl space-y-6">
        {/* Transport Controller */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handlePlayPause}
              className={`p-3 rounded-2xl transition-all border ${
                isPlaying
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                  : 'bg-teal-500/20 border-teal-500/50 text-teal-300 shadow-[0_0_15px_rgba(20,184,166,0.15)]'
              }`}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5 fill-current" />
              ) : (
                <Play className="w-5 h-5 fill-current" />
              )}
            </button>
            <button
              onClick={handleStop}
              className="p-3 bg-white/5 border border-white/10 rounded-2xl text-white/80 hover:bg-white/10 transition"
            >
              <Square className="w-5 h-5 fill-current" />
            </button>

            {/* Re-Roll Variation Seed Button */}
            <button
              onClick={handleReRoll}
              className="p-3 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-2xl text-amber-300 transition flex items-center gap-1.5"
              title="Re-roll Variation Seed"
            >
              <Dices className="w-5 h-5" />
              {piece.variationSeed !== null &&
                piece.variationSeed !== undefined && (
                  <span className="text-[10px] font-mono font-black uppercase tracking-wider bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/20">
                    {piece.variationSeed}
                  </span>
                )}
            </button>

            {/* Notation Track Toggle */}
            <button
              onClick={() => setShowNotation(!showNotation)}
              className={`flex items-center gap-2 px-4 py-2.5 border rounded-2xl text-xs font-bold transition-all ${
                showNotation
                  ? 'bg-violet-500/20 border-violet-500/50 text-violet-300 shadow-[0_0_15px_rgba(139,92,246,0.15)] animate-pulse'
                  : 'bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 hover:border-white/20'
              }`}
            >
              <Activity className="w-4 h-4 text-violet-400" />
              Notation Editor
            </button>

            {/* Hold Open indicator / Advance open button */}
            {isPlaying && piece.segments[activeSegIdx]?.type === 'open' && (
              <button
                onClick={handleAdvanceOpen}
                className="flex items-center gap-2 px-4 py-2.5 bg-rose-500/20 border border-rose-500/50 rounded-2xl text-xs font-bold text-rose-300 hover:bg-rose-500/30 transition animate-pulse"
              >
                Advance Open Segment →
              </button>
            )}
          </div>

          <button
            onClick={handleCaptureDefaults}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-semibold rounded-xl text-white/60 transition"
          >
            <Volume2 className="w-4 h-4 text-teal-400" />
            Sync Piece Defaults
          </button>
        </div>

        {/* Horizontal scrollable track area */}
        <div className="w-full overflow-x-auto custom-scrollbar bg-[#110e14] border border-white/5 rounded-2xl p-6 min-h-[140px] relative flex items-center">
          {/* Visual Grid Backdrop */}
          {piece.tempoBpm !== null && (
            <div className="absolute inset-y-0 left-6 right-6 pointer-events-none z-0">
              {Array.from({
                length:
                  Math.ceil(
                    (piece.totalDurationMs || 30000) /
                      ((60 / piece.tempoBpm) * 1000),
                  ) + 1,
              }).map((_, bIdx) => {
                const beatDurationMs = (60 / piece.tempoBpm!) * 1000;
                const beatWidthPx = (beatDurationMs / 1000) * PX_PER_SEC * 10;
                const left = bIdx * beatWidthPx;
                const isBar = bIdx % 4 === 0;
                return (
                  <div
                    key={bIdx}
                    className={`absolute inset-y-0 border-l ${
                      isBar
                        ? 'border-teal-500/25 w-[2px]'
                        : 'border-white/5 w-[1px]'
                    }`}
                    style={{ left: `${left}px` }}
                  />
                );
              })}
            </div>
          )}

          <div className="flex items-center gap-1 relative min-w-full z-10">
            {piece.segments.map((seg, idx) => {
              const durationSec = seg.durationMs ? seg.durationMs / 1000 : 30; // open is mapped to constant width
              const width =
                seg.type === 'open'
                  ? 180
                  : Math.max(MIN_SEG_WIDTH, durationSec * PX_PER_SEC * 10);
              const isSelected = selectedIdx === idx;
              const isActive = isPlaying && activeSegIdx === idx;

              // Color classes based on segment type
              let colorClasses = 'border-teal-500 bg-teal-500/10 text-teal-300';
              if (seg.type === 'arc')
                colorClasses =
                  'border-violet-500 bg-violet-500/10 text-violet-300';
              if (seg.type === 'meta-arc')
                colorClasses =
                  'border-fuchsia-500 bg-fuchsia-500/10 text-fuchsia-300';
              if (seg.type === 'open')
                colorClasses = 'border-rose-500 bg-rose-500/10 text-rose-300';
              if (seg.type === 'transition')
                colorClasses =
                  'border-amber-500 bg-amber-500/10 text-amber-300';

              return (
                <div
                  key={idx}
                  onClick={() => setSelectedIdx(idx)}
                  style={{ width: `${width}px` }}
                  className={`h-24 rounded-2xl border transition-all flex flex-col justify-between p-4 cursor-pointer relative group ${colorClasses} ${
                    isSelected
                      ? 'ring-2 ring-teal-500/80 ring-offset-2 ring-offset-[#110e14]'
                      : ''
                  } ${isActive ? 'shadow-[0_0_20px_rgba(20,184,166,0.1)]' : ''}`}
                >
                  {/* Top info and reordering keys */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold uppercase tracking-wide">
                      {idx + 1}. {seg.type}
                    </span>

                    {/* Quick controls shown on hover */}
                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity bg-[#110e14]/90 p-1 rounded-lg border border-white/5 absolute -top-4 right-4 shadow-lg z-10">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveSegment(idx, 'left');
                        }}
                        disabled={idx === 0}
                        className="p-1 hover:bg-white/10 rounded disabled:opacity-30"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMoveSegment(idx, 'right');
                        }}
                        disabled={idx === piece.segments.length - 1}
                        className="p-1 hover:bg-white/10 rounded disabled:opacity-30"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSegment(idx);
                        }}
                        className="p-1 hover:bg-rose-500/20 text-rose-400 rounded"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Middle representation */}
                  <span className="text-[10px] text-white/50 truncate">
                    {seg.type === 'transition'
                      ? `Easing: ${seg.config.easing || 'linear'}`
                      : seg.type === 'arc'
                        ? `Arc: ${seg.config.arcId || 'bell'}`
                        : seg.type === 'meta-arc'
                          ? `Kind: ${seg.config.kind || 'random-walk'}`
                          : 'Overrides Active'}
                  </span>

                  {/* Bottom: Resize handles & durations */}
                  <div className="flex items-center justify-between text-[10px] text-white/40 font-mono">
                    <span>
                      {seg.type === 'open' ? 'Hold Open' : `${durationSec}s`}
                    </span>

                    {/* Drag handle for duration resizing */}
                    {seg.type !== 'open' && (
                      <div
                        onMouseDown={(e) => handleMouseDownResize(e, idx)}
                        className="w-1.5 h-8 bg-white/20 group-hover:bg-white/40 hover:bg-teal-400 absolute right-1.5 top-8 rounded cursor-ew-resize transition-all"
                      />
                    )}
                  </div>

                  {/* Playhead progress overlay */}
                  {isActive && seg.type !== 'open' && (
                    <div
                      style={{ width: `${playheadProgress * 100}%` }}
                      className="absolute bottom-0 left-0 h-1 bg-teal-400 rounded-b-2xl transition-all duration-75"
                    />
                  )}
                </div>
              );
            })}

            {/* Quick add affine box */}
            <div className="flex flex-wrap items-center gap-2 pl-4">
              <button
                onClick={() => handleAddSegment('fixed')}
                className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/5 text-[10px] font-bold uppercase tracking-wider rounded-xl text-white/70 transition"
              >
                <Plus className="w-3.5 h-3.5 text-teal-400" />
                Add Fixed
              </button>
              <button
                onClick={() => handleAddSegment('arc')}
                className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/5 text-[10px] font-bold uppercase tracking-wider rounded-xl text-white/70 transition"
              >
                <Plus className="w-3.5 h-3.5 text-violet-400" />
                Add Arc
              </button>
              <button
                onClick={() => handleAddSegment('meta-arc')}
                className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/5 text-[10px] font-bold uppercase tracking-wider rounded-xl text-white/70 transition"
              >
                <Plus className="w-3.5 h-3.5 text-fuchsia-400" />
                Add Meta-Arc
              </button>
              <button
                onClick={() => handleAddSegment('transition')}
                className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/5 text-[10px] font-bold uppercase tracking-wider rounded-xl text-white/70 transition"
              >
                <Plus className="w-3.5 h-3.5 text-amber-400" />
                Add Transition
              </button>
              {!piece.hasOpenSegment && (
                <button
                  onClick={() => handleAddSegment('open')}
                  className="flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/5 text-[10px] font-bold uppercase tracking-wider rounded-xl text-white/70 transition"
                >
                  <Plus className="w-3.5 h-3.5 text-rose-400" />
                  Add Open
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Procedural Variation Space Panel */}
      <VariationEditorPanel
        piece={piece}
        onUpdate={(updatedPiece) => {
          setPiece(updatedPiece);
          if (playerRef.current) {
            playerRef.current.updatePiece(updatedPiece);
          }
        }}
        onEditPoint={handleEditPoint}
      />

      {/* Selected Segment Properties Panel */}
      {selectedIdx !== null && piece.segments[selectedIdx] && (
        <SegmentProperties
          segment={piece.segments[selectedIdx]!}
          onChange={handleSegmentChange}
        />
      )}

      {/* Notation Editor Canvas Overlay */}
      {showNotation && (
        <NotationEditor
          piece={piece}
          onChange={handleNotationChange}
          isPlaying={isPlaying}
          globalPlayheadMs={globalPlayheadMs}
        />
      )}

      {/* Simple load modal for pieces persistence */}
      {showLoadModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-[#18151f] border border-white/10 w-full max-w-lg p-6 rounded-3xl shadow-2xl space-y-6 text-white">
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
              <h3 className="text-lg font-bold">Load Saved Piece</h3>
              <button
                onClick={() => setShowLoadModal(false)}
                className="text-white/40 hover:text-white/80 transition text-sm"
              >
                Close
              </button>
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
              {savedPieces.length === 0 ? (
                <p className="text-sm text-white/40 text-center py-6">
                  No pieces saved yet.
                </p>
              ) : (
                savedPieces.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleLoadPiece(item)}
                    className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl cursor-pointer hover:bg-white/10 hover:border-white/10 transition"
                  >
                    <div>
                      <h4 className="text-sm font-bold text-white/95">
                        {item.title || 'Untitled Piece'}
                      </h4>
                      <p className="text-xs text-white/40">
                        {item.segments.length} segments •{' '}
                        {item.total_duration_ms
                          ? `${item.total_duration_ms / 1000}s`
                          : 'Indefinite duration'}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-white/40" />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {activeVpEdit && (
        <VariationDialog
          isOpen={true}
          onClose={() => setActiveVpEdit(null)}
          paramKey={activeVpEdit.paramKey}
          paramLabel={activeVpEdit.paramLabel}
          initialPoint={activeVpEdit.initialPoint}
          minVal={activeVpEdit.minVal}
          maxVal={activeVpEdit.maxVal}
          stepVal={activeVpEdit.stepVal}
          onSave={handleSavePieceVariation}
          onDelete={handleDeletePieceVariation}
        />
      )}
    </div>
  );
};
