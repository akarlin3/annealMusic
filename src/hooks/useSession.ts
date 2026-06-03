import { useCallback, useEffect, useRef, useState } from 'react';
import { Orchestrator, type ArcProgress } from '@/audio/orchestrator';
import { useParamStore } from '@/state/params';
import type { SessionState } from '@/session/types';
import { platform } from '@/platform';

export interface SessionApi {
  sessionState: SessionState;
  /** True for any non-idle state (starting/running/stopping). */
  isPlaying: boolean;
  /** Begin a session using the store's current mode/arc/duration selection. */
  startSession: () => void;
  /** Abort the current session (settle out). */
  stopSession: () => void;
  /** Live arc progress while an arc runs or ends; null otherwise. */
  arcProgress: ArcProgress | null;
  engineRef: React.MutableRefObject<Orchestrator | null>;
  /** Create (or get) the orchestrator. Lets input connect before Begin. */
  ensureOrchestrator: () => Orchestrator;
  /** Register a sink for engine errors (e.g. physical worklet unsupported). */
  setEngineErrorHandler: (fn: (error: Error) => void) => void;
}

/**
 * Owns the orchestrator lifecycle and the session-state machine bridge to React.
 * The orchestrator is created lazily on first Begin (a user gesture, so the
 * AudioContext is allowed) and reused for the lifetime of the component; the
 * param store is mirrored into it via effects.
 */
export function useSession(): SessionApi {
  const engineRef = useRef<Orchestrator | null>(null);
  const errorHandlerRef = useRef<((error: Error) => void) | null>(null);
  const [sessionState, setSessionState] = useState<SessionState>('idle');
  const [arcProgress, setArcProgress] = useState<ArcProgress | null>(null);

  const params = useParamStore((s) => s.params);
  const engineId = useParamStore((s) => s.engineId);
  const engineParams = useParamStore((s) => s.engineParams);
  const mode = useParamStore((s) => s.mode);
  const tuning = useParamStore((s) => s.tuning);
  const customScales = useParamStore((s) => s.customScales);

  const ensureOrchestrator = useCallback((): Orchestrator => {
    if (!engineRef.current) {
      const state = useParamStore.getState();
      let customScaleRatios: number[] | undefined;
      let customEqRatio: number | undefined;
      if (state.tuning.system === 'custom' && state.tuning.sclId) {
        const customScale = state.customScales.find(
          (s) => s.id === state.tuning.sclId,
        );
        if (customScale) {
          customScaleRatios = customScale.parsed_scale;
          customEqRatio =
            customScale.parsed_scale[customScale.parsed_scale.length - 1];
        }
      }
      const orch = new Orchestrator(
        {
          ...state.params,
          tuning: state.tuning,
          customScaleRatios,
          customEqRatio,
        },
        state.engineId,
        state.engineParams,
        undefined,
        state.loops,
      );
      orch.setMode(state.mode);
      orch.subscribe(setSessionState);
      orch.setEngineErrorHandler((error) => errorHandlerRef.current?.(error));
      engineRef.current = orch;
    }
    return engineRef.current;
  }, []);

  const setEngineErrorHandler = useCallback((fn: (error: Error) => void) => {
    errorHandlerRef.current = fn;
  }, []);

  // Mirror store → orchestrator (these are no-ops until the orchestrator exists).
  useEffect(() => {
    engineRef.current?.setSharedParams(params);
  }, [params]);
  useEffect(() => {
    engineRef.current?.setEngine(engineId);
  }, [engineId]);
  useEffect(() => {
    const active = engineParams[engineId];
    if (active) engineRef.current?.setEngineParams(active);
  }, [engineParams, engineId]);
  useEffect(() => {
    engineRef.current?.setMode(mode);
  }, [mode]);
  useEffect(() => {
    if (!engineRef.current) return;
    let customScaleRatios: number[] | undefined;
    let customEqRatio: number | undefined;
    if (tuning.system === 'custom' && tuning.sclId) {
      const customScale = customScales.find((s) => s.id === tuning.sclId);
      if (customScale) {
        customScaleRatios = customScale.parsed_scale;
        customEqRatio =
          customScale.parsed_scale[customScale.parsed_scale.length - 1];
      }
    }
    engineRef.current.setSharedParams({
      tuning,
      customScaleRatios,
      customEqRatio,
    });
  }, [tuning, customScales]);

  // Poll arc progress while an arc runs or settles out.
  useEffect(() => {
    if (sessionState !== 'playing-patch' && sessionState !== 'stopping') {
      setArcProgress(null);
      return;
    }

    let raf = 0;
    const tick = () => {
      setArcProgress(engineRef.current?.getArcProgress() ?? null);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [sessionState]);

  const startSession = useCallback(() => {
    const orch = ensureOrchestrator();
    if (orch.getSessionState() !== 'idle') return;
    const state = useParamStore.getState();
    if (state.sessionMode === 'arc') {
      orch.startSession(
        {
          mode: 'arc',
          arcId: state.arcId,
          durationSec: state.arcDurationSec,
        },
        (p) => useParamStore.getState().setMany(p),
      );
    } else {
      orch.startSession({ mode: 'open' });
    }
  }, [ensureOrchestrator]);

  const stopSession = useCallback(() => {
    void engineRef.current?.stopSession();
  }, []);

  // Listen for native platform audio interruptions
  useEffect(() => {
    let pausedBySystem = false;

    const unsubscribe = platform.onAudioInterruption((event) => {
      const orch = engineRef.current;
      if (!orch) return;

      const tap = orch.getRecordingTap();
      if (!tap) return;

      if (event === 'begin') {
        const state = orch.getSessionState();
        if (state === 'playing-patch' || state === 'playing-piece') {
          void tap.ctx.suspend();

          pausedBySystem = true;
        }
      } else if (event === 'end') {
        if (pausedBySystem) {
          if (tap.ctx.state === 'suspended') {
            void tap.ctx.resume();
          }
          pausedBySystem = false;
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Stop active synth session when preview audio starts playing
  useEffect(() => {
    const handlePreviewPlay = () => {
      stopSession();
    };
    window.addEventListener('anneal-preview-play', handlePreviewPlay);
    return () =>
      window.removeEventListener('anneal-preview-play', handlePreviewPlay);
  }, [stopSession]);

  // Tear down on unmount (drops the input and closes the core).
  useEffect(
    () => () => {
      void engineRef.current?.dispose();
    },
    [],
  );

  return {
    sessionState,
    isPlaying: sessionState !== 'idle',
    startSession,
    stopSession,
    arcProgress,
    engineRef,
    ensureOrchestrator,
    setEngineErrorHandler,
  };
}
