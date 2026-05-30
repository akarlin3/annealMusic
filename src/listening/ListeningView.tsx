import { useEffect, useRef, useState } from 'react';
import type { Orchestrator } from '@/audio/orchestrator';
import { ListeningSessionPlayer } from '@/listening/ListeningSessionPlayer';
import type { ListeningSession } from '@/api/types';
import Visualizer from '@/components/Visualizer';
import { useParamStore } from '@/state/params';
import {
  ArrowLeft,
  Play,
  Pause,
  Square,
  Sliders,
  X,
  Circle,
  HelpCircle,
} from 'lucide-react';
import { LissajousAvatar } from '@/components/LissajousAvatar';
import type { ParamKey } from '@/state/params';
import type { Piece, SegmentType, Movement } from '@/piece/types';
import { resolveBellSchedule } from '@/audio/bells/scheduler';
import type { BellEvent } from '@/audio/bells/scheduler';
import { getBellById } from '@/audio/bells/registry';
import BreathOverlay from '@/breath/BreathOverlay';
import { BREATH, type BreathPattern } from '@/breath/patterns';
import { useBreathPrefs } from '@/breath/useBreathPrefs';

interface ListeningViewProps {
  session: ListeningSession;
  ensureOrchestrator: () => Orchestrator;
  onClose: () => void;
}

function fmtTime(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

export default function ListeningView({
  session,
  ensureOrchestrator,
  onClose,
}: ListeningViewProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [remainingMs, setRemainingMs] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [currentState, setCurrentState] = useState<string>('idle');

  // Escape hatch state: allows showing controls to sculpt parameters during listening session
  const [showEscapeHatch, setShowEscapeHatch] = useState(false);

  const playerRef = useRef<ListeningSessionPlayer | null>(null);
  const orchestratorRef = useRef<Orchestrator | null>(null);

  // Sync parameters for the escape hatch
  const params = useParamStore((s) => s.params);
  const setParam = useParamStore((s) => s.setParam);

  const breathPrefs = useBreathPrefs();

  useEffect(() => {
    const orchestrator = ensureOrchestrator();
    orchestratorRef.current = orchestrator;

    if (session.piece) {
      // Re-hydrate parameter store defaults from the piece being played
      const store = useParamStore.getState();
      if (session.piece.defaults_state) {
        const defaults = session.piece.defaults_state;
        if (defaults.params) {
          Object.entries(defaults.params).forEach(([k, v]) => {
            store.setParam(k as ParamKey, v as number);
          });
        }
      }
    }

    const config = {
      piece: {
        schemaVer: session.schema_ver,
        title: session.title,
        description: session.description || '',
        defaultsState: (session.piece
          ?.defaults_state as unknown as Piece['defaultsState']) || {
          params: {},
          engineId: 'sine',
          engineParams: {},
        },
        totalDurationMs: session.piece?.total_duration_ms || 30000,
        segments:
          session.piece?.segments.map((s) => ({
            position: s.position,
            type: s.type as SegmentType,
            durationMs: s.duration_ms,
            config: s.config,
          })) || [],
        tempoBpm: session.piece?.tempo_bpm || null,
        variationSeed: session.piece?.variation_seed || null,
        visibility: session.piece?.visibility || 'unlisted',
        hasOpenSegment: session.piece?.has_open_segment ?? false,
        bellSchedule: session.piece?.bell_schedule || [],
      },
      settleInMs: session.settle_in_ms,
      integrationMs: session.integration_ms,
      bellSchedule: session.bell_schedule || [],
    };

    const player = new ListeningSessionPlayer(config, orchestrator);
    playerRef.current = player;
    setRemainingMs(player.getTotalDurationMs());

    return () => {
      player.stop();
    };
  }, [session, ensureOrchestrator]);

  const handleStart = () => {
    const player = playerRef.current;
    if (!player) return;

    setIsPlaying(true);
    player.start(
      (_, remainMs) => {
        setRemainingMs(remainMs);
        setElapsedMs(player.getElapsedMs());
        setCurrentState(player.getSessionState());
      },
      () => {
        setIsPlaying(false);
        setRemainingMs(0);
        setCurrentState('ended');
      },
    );
  };

  const handlePause = () => {
    playerRef.current?.pause();
    setIsPlaying(false);
  };

  const handleResume = () => {
    playerRef.current?.resume();
    setIsPlaying(true);
  };

  const handleStop = () => {
    playerRef.current?.stop();
    setIsPlaying(false);
    setElapsedMs(0);
    setRemainingMs(playerRef.current?.getTotalDurationMs() || 0);
    setCurrentState('idle');
  };

  const handleParamChange = (key: string, val: number) => {
    setParam(key as ParamKey, val);
  };

  // Determine current timeline label
  const getStateLabel = () => {
    switch (currentState) {
      case 'opening_bell':
        return 'Opening Bell Chime';
      case 'closing_bell':
        return 'Closing Integration';
      case 'sounding':
        if (elapsedMs < session.settle_in_ms) {
          return 'Settle In';
        }
        if (
          (playerRef.current?.getTotalDurationMs() || 0) - elapsedMs <
          session.integration_ms
        ) {
          return 'Integrating';
        }
        return 'Deep Listening';
      case 'ended':
        return 'Session Complete';
      default:
        return 'Ready';
    }
  };

  // Resolve scheduled bells for rendering markers
  const segmentDurations =
    session.piece?.segments.map((s) => {
      let dur = s.duration_ms ?? 5000;
      if (s.config?.tempoLocked && session.piece?.tempo_bpm) {
        dur = dur * 4 * (60 / session.piece.tempo_bpm) * 1000;
      }
      return dur;
    }) || [];

  const resolvedPieceBells = resolveBellSchedule(
    (session.piece?.bell_schedule as BellEvent[] | undefined) ?? [],
    session.piece?.total_duration_ms || 30000,
    segmentDurations,
    (session.piece?.movements as Movement[] | undefined) ?? [],
  );

  const resolvedSessionBells = resolveBellSchedule(
    (session.bell_schedule as BellEvent[] | undefined) ?? [],
    session.piece?.total_duration_ms || 30000,
    segmentDurations,
    (session.piece?.movements as Movement[] | undefined) ?? [],
  );

  // Merge and sort
  const allResolvedBells = [
    ...resolvedPieceBells,
    ...resolvedSessionBells,
  ].sort((a, b) => a.offsetMs - b.offsetMs);

  const totalDurationMs = remainingMs + elapsedMs;
  const progressPercent =
    totalDurationMs > 0 ? (elapsedMs / totalDurationMs) * 100 : 0;

  // Breath overlay: active during deep listening only — after settle-in and
  // before integration — so it doesn't intrude on the open/close of the session.
  const breathPattern = (session.breath_pattern ??
    null) as BreathPattern | null;
  const pastSettle = elapsedMs >= session.settle_in_ms;
  const beforeIntegration =
    (playerRef.current?.getTotalDurationMs() ?? totalDurationMs) - elapsedMs >=
    session.integration_ms;
  const breathActive =
    !!breathPattern &&
    isPlaying &&
    currentState === 'sounding' &&
    pastSettle &&
    beforeIntegration;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-between bg-stone-950 text-stone-200 transition-opacity duration-700 ease-in-out px-8 py-10"
      style={{ background: '#090807' }}
    >
      {/* Header Attribution Layer */}
      <header className="w-full max-w-4xl flex items-center justify-between border-b border-stone-900 pb-4 z-10">
        <button
          onClick={onClose}
          className="flex items-center gap-2 p-2 rounded-full border border-stone-850 bg-stone-950/20 hover:border-stone-700 text-stone-400 hover:text-white transition-colors"
          title="Exit Session"
        >
          <ArrowLeft size={14} />
        </button>

        <div className="text-center">
          <h1 className="font-mono text-xs uppercase tracking-[0.25em] text-amber-100/90 font-bold">
            {session.title}
          </h1>
          <div className="flex items-center justify-center gap-2.5 mt-1 font-mono text-[8px] uppercase tracking-wider text-stone-500">
            {session.intention && (
              <>
                <span>Intention: {session.intention}</span>
                <span>·</span>
              </>
            )}
            {session.recommended_environment && (
              <>
                <span>Space: {session.recommended_environment}</span>
                <span>·</span>
              </>
            )}
            <span>Category: {session.length_category}</span>
          </div>
        </div>

        {/* Escape Hatch Button */}
        <button
          onClick={() => setShowEscapeHatch(!showEscapeHatch)}
          className={`flex items-center gap-1.5 p-2 rounded-full border transition-all ${
            showEscapeHatch
              ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
              : 'border-stone-850 bg-stone-950/20 hover:border-stone-700 text-stone-400'
          }`}
          title="Escape Hatch Sculpting Controls"
        >
          <Sliders size={14} />
        </button>
      </header>

      {/* Main Fullscreen Visual Field */}
      <main className="relative flex-1 w-full max-w-4xl flex flex-col items-center justify-center py-6">
        {/* Fullscreen visualizer wrap (passes isCalm = true) */}
        <div className="relative w-full h-[360px] rounded-2xl overflow-hidden shadow-2xl border border-stone-900/60 bg-stone-950/20">
          <div
            className="absolute inset-0 transition-[filter] duration-700"
            style={{
              filter: breathActive
                ? `brightness(${BREATH.visualizerDim})`
                : 'none',
            }}
          >
            <Visualizer
              engineRef={orchestratorRef}
              isPlaying={isPlaying}
              isCalm={true}
            />
          </div>
          <BreathOverlay
            pattern={breathPattern}
            active={breathActive}
            getNow={() => orchestratorRef.current?.getAudioTime() ?? 0}
            haptics={breathPrefs.haptics}
            reduceMotion={breathPrefs.reduceMotion}
          />
        </div>

        {/* Dynamic Progress Timeline with Bell Schedule Markers */}
        <div className="w-full mt-6 relative px-1">
          <div className="relative w-full h-1 bg-stone-900 rounded-full">
            {/* Progress fill */}
            <div
              className="absolute left-0 top-0 h-full bg-amber-500 rounded-full shadow-[0_0_8px_rgba(245,158,11,0.6)] transition-all duration-100 ease-out"
              style={{ width: `${progressPercent}%` }}
            />

            {/* Bell Schedule Markers */}
            {allResolvedBells.map((bell, idx) => {
              const totalMs = remainingMs + elapsedMs;
              if (totalMs <= 0) return null;
              const bellPosPercent = (bell.offsetMs / totalMs) * 100;
              const isSounded = elapsedMs >= bell.offsetMs;
              const bellDef = getBellById(bell.bellId);

              return (
                <div
                  key={idx}
                  className="absolute -top-1.5 group/marker cursor-help flex flex-col items-center"
                  style={{
                    left: `${bellPosPercent}%`,
                    transform: 'translateX(-50%)',
                  }}
                >
                  <div
                    className={`h-4 w-4 rounded-full border transition-all duration-300 flex items-center justify-center ${
                      isSounded
                        ? 'border-amber-400 bg-amber-500 shadow-[0_0_6px_rgba(245,158,11,0.5)] scale-110'
                        : 'border-stone-750 bg-stone-950 hover:border-amber-500/50 hover:scale-110'
                    }`}
                  >
                    <div
                      className={`h-1.5 w-1.5 rounded-full ${isSounded ? 'bg-stone-950' : 'bg-stone-500 group-hover/marker:bg-amber-400'}`}
                    />
                  </div>

                  {/* Hover Tooltip */}
                  <div className="absolute bottom-6 scale-95 opacity-0 pointer-events-none group-hover/marker:scale-100 group-hover/marker:opacity-100 transition-all duration-200 z-50 bg-stone-950 border border-stone-850 p-2 rounded-lg shadow-2xl font-mono text-[8px] uppercase tracking-wider text-amber-200 w-44 text-center leading-normal">
                    <span className="font-bold text-stone-200 block mb-0.5">
                      {bellDef?.name || 'Bell'}
                    </span>
                    <span className="text-stone-500 text-[7px] block">
                      Trigger at {fmtTime(bell.offsetMs)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Minimal Timer Dials HUD */}
        <div className="mt-8 flex flex-col items-center">
          <div className="flex items-baseline gap-6 font-mono text-3xl font-light tracking-[0.1em] text-stone-300">
            <span className="text-stone-500 text-lg uppercase tracking-widest mr-1">
              elapsed
            </span>
            <span>{fmtTime(elapsedMs)}</span>
            <span className="text-stone-600 text-2xl font-extralight">/</span>
            <span className="text-amber-200/80">
              {fmtTime(remainingMs + elapsedMs)}
            </span>
          </div>

          <div className="flex items-center gap-2.5 mt-3 font-mono text-[9px] uppercase tracking-[0.2em] text-stone-400">
            <span className="flex items-center gap-1.5">
              <Circle
                size={5}
                fill={isPlaying ? '#f59e0b' : '#44403c'}
                stroke="none"
                className={isPlaying ? 'animate-pulse' : ''}
              />
              {getStateLabel()}
            </span>
          </div>
        </div>

        {/* Double Creator Attributions HUD */}
        <div className="mt-6 flex items-center justify-center gap-8 border-t border-stone-900 pt-5 text-[9px] uppercase tracking-widest font-mono text-stone-500">
          {session.creator_name && (
            <div className="flex items-center gap-2">
              <LissajousAvatar
                seed={session.creator_avatar_seed || 'curator'}
                size={16}
              />
              <span>Curated by {session.creator_name}</span>
            </div>
          )}
          {session.piece_creator_name && (
            <div className="flex items-center gap-2">
              <span className="text-stone-600 font-bold">Composer:</span>
              <span>{session.piece_creator_name}</span>
            </div>
          )}
        </div>
      </main>

      {/* Floating Escape Hatch Control Panel */}
      {showEscapeHatch && (
        <div className="absolute right-8 top-28 rounded-xl border border-stone-850 p-5 font-mono text-[9px] uppercase tracking-wider backdrop-blur-xl shadow-2xl z-30 w-72 bg-stone-950/90">
          <div className="flex items-center justify-between border-b border-stone-900 pb-2.5 mb-4">
            <span className="font-semibold text-amber-200 flex items-center gap-1.5">
              <Sliders size={10} className="text-amber-500" />
              Escape Hatch Controls
            </span>
            <button
              onClick={() => setShowEscapeHatch(false)}
              className="text-stone-500 hover:text-white transition-colors"
            >
              <X size={12} />
            </button>
          </div>

          <div className="space-y-4">
            {/* Density */}
            <div>
              <div className="flex justify-between text-stone-400 mb-1">
                <span>Density</span>
                <span className="text-amber-500">{params.density}</span>
              </div>
              <input
                type="range"
                min="1"
                max="16"
                step="1"
                value={params.density}
                onChange={(e) =>
                  handleParamChange('density', Number(e.target.value))
                }
                className="w-full h-1 bg-stone-900 rounded appearance-none cursor-pointer accent-amber-500"
              />
            </div>

            {/* Root Frequency */}
            <div>
              <div className="flex justify-between text-stone-400 mb-1">
                <span>Root Frequency</span>
                <span className="text-amber-500">
                  {params.rootFreq.toFixed(0)} Hz
                </span>
              </div>
              <input
                type="range"
                min="55"
                max="440"
                value={params.rootFreq}
                onChange={(e) =>
                  handleParamChange('rootFreq', Number(e.target.value))
                }
                className="w-full h-1 bg-stone-900 rounded appearance-none cursor-pointer accent-amber-500"
              />
            </div>

            {/* Brightness */}
            <div>
              <div className="flex justify-between text-stone-400 mb-1">
                <span>Brightness</span>
                <span className="text-amber-500">
                  {(params.brightness * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={params.brightness}
                onChange={(e) =>
                  handleParamChange('brightness', Number(e.target.value))
                }
                className="w-full h-1 bg-stone-900 rounded appearance-none cursor-pointer accent-amber-500"
              />
            </div>

            {/* Space */}
            <div>
              <div className="flex justify-between text-stone-400 mb-1">
                <span>Reverb Space</span>
                <span className="text-amber-500">
                  {(params.space * 100).toFixed(0)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={params.space}
                onChange={(e) =>
                  handleParamChange('space', Number(e.target.value))
                }
                className="w-full h-1 bg-stone-900 rounded appearance-none cursor-pointer accent-amber-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Control Ring */}
      <footer className="w-full max-w-4xl flex flex-col items-center gap-6 z-10">
        <div className="flex items-center gap-4">
          {isPlaying ? (
            <button
              onClick={handlePause}
              className="flex items-center justify-center h-12 w-12 rounded-full border border-stone-800 bg-stone-950/60 text-stone-300 hover:border-amber-500/50 hover:text-amber-400 transition-all shadow-lg"
              title="Pause Session"
            >
              <Pause size={16} strokeWidth={1.5} />
            </button>
          ) : (
            <button
              onClick={
                currentState === 'idle' || currentState === 'ended'
                  ? handleStart
                  : handleResume
              }
              className="flex items-center justify-center h-12 w-12 rounded-full bg-amber-500 text-stone-950 hover:bg-amber-400 transition-all shadow-lg shadow-amber-500/10"
              title="Play Session"
            >
              <Play size={16} strokeWidth={1.5} className="ml-0.5" />
            </button>
          )}

          <button
            onClick={handleStop}
            disabled={currentState === 'idle'}
            className="flex items-center justify-center h-12 w-12 rounded-full border border-stone-800 bg-stone-950/60 text-stone-500 hover:text-stone-300 hover:border-stone-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            title="Stop / Reset Session"
          >
            <Square size={16} strokeWidth={1.5} />
          </button>
        </div>

        {/* Clinical Disclaimer Footprint */}
        <div className="w-full max-w-xl text-center border-t border-stone-900/60 pt-4 pb-2">
          <p className="flex items-center justify-center gap-1.5 font-mono text-[8px] uppercase tracking-wider text-stone-600">
            <HelpCircle size={10} className="text-stone-700" />
            Disclaimer: Ambient listens are calming, but specific tuning
            frequencies or chimes lack clinically validated efficacy.
          </p>
        </div>
      </footer>
    </div>
  );
}
