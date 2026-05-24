import { useCallback, useEffect, useRef, useState } from 'react';
import { Orchestrator } from '@/audio/orchestrator';
import { useParamStore } from '@/state/params';

export interface AudioEngineApi {
  isPlaying: boolean;
  toggle: () => void;
  engineRef: React.MutableRefObject<Orchestrator | null>;
}

/**
 * Owns the orchestrator lifecycle and bridges the param store to it. The
 * orchestrator is created on first play (user gesture) and torn down on
 * stop/unmount.
 */
export function useAudioEngine(): AudioEngineApi {
  const engineRef = useRef<Orchestrator | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const params = useParamStore((s) => s.params);
  const engineId = useParamStore((s) => s.engineId);
  const engineParams = useParamStore((s) => s.engineParams);

  // Push live shared-param updates to the running orchestrator.
  useEffect(() => {
    engineRef.current?.setSharedParams(params);
  }, [params]);

  // Crossfade to the selected engine when it changes mid-session.
  useEffect(() => {
    engineRef.current?.setEngine(engineId);
  }, [engineId]);

  // Push engine-specific param updates for the active engine.
  useEffect(() => {
    const active = engineParams[engineId];
    if (active) engineRef.current?.setEngineParams(active);
  }, [engineParams, engineId]);

  const toggle = useCallback(() => {
    if (engineRef.current?.isRunning()) {
      void engineRef.current.stop();
      setIsPlaying(false);
    } else {
      const state = useParamStore.getState();
      const engine = new Orchestrator(
        state.params,
        state.engineId,
        state.engineParams,
      );
      engineRef.current = engine;
      engine.start();
      setIsPlaying(true);
    }
  }, []);

  // Tear down on unmount.
  useEffect(
    () => () => {
      void engineRef.current?.stop();
    },
    [],
  );

  return { isPlaying, toggle, engineRef };
}
