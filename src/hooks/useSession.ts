import { useCallback, useEffect, useRef, useState } from 'react';
import { Orchestrator, type ArcProgress } from '@/audio/orchestrator';
import { useParamStore } from '@/state/params';
import type { SessionState } from '@/session/types';

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
}

/**
 * Owns the orchestrator lifecycle and the session-state machine bridge to React.
 * The orchestrator is created lazily on first Begin (a user gesture, so the
 * AudioContext is allowed) and reused for the lifetime of the component; the
 * param store is mirrored into it via effects.
 */
export function useSession(): SessionApi {
  const engineRef = useRef<Orchestrator | null>(null);
  const [sessionState, setSessionState] = useState<SessionState>('idle');
  const [arcProgress, setArcProgress] = useState<ArcProgress | null>(null);

  const params = useParamStore((s) => s.params);
  const engineId = useParamStore((s) => s.engineId);
  const engineParams = useParamStore((s) => s.engineParams);

  const ensureOrchestrator = useCallback((): Orchestrator => {
    if (!engineRef.current) {
      const state = useParamStore.getState();
      const orch = new Orchestrator(
        state.params,
        state.engineId,
        state.engineParams,
        undefined,
        state.loops,
      );
      orch.subscribe(setSessionState);
      engineRef.current = orch;
    }
    return engineRef.current;
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

  // Poll arc progress while an arc runs or settles out.
  useEffect(() => {
    if (sessionState !== 'running-arc' && sessionState !== 'stopping') {
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
  };
}
