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

  // Push live param updates to the running orchestrator.
  useEffect(() => {
    engineRef.current?.setSharedParams(params);
  }, [params]);

  const toggle = useCallback(() => {
    if (engineRef.current?.isRunning()) {
      void engineRef.current.stop();
      setIsPlaying(false);
    } else {
      const engine = new Orchestrator(useParamStore.getState().params);
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
