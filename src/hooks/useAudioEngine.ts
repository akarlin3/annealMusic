import { useCallback, useEffect, useRef, useState } from 'react';
import { AnnealMusicEngine } from '@/audio/AnnealMusicEngine';
import { useParamStore } from '@/state/params';

export interface AudioEngineApi {
  isPlaying: boolean;
  toggle: () => void;
  engineRef: React.MutableRefObject<AnnealMusicEngine | null>;
}

/**
 * Owns the audio engine lifecycle and bridges the param store to it. The
 * engine is created on first play (user gesture) and torn down on stop/unmount.
 */
export function useAudioEngine(): AudioEngineApi {
  const engineRef = useRef<AnnealMusicEngine | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const params = useParamStore((s) => s.params);

  // Push live param updates to the running engine.
  useEffect(() => {
    engineRef.current?.setParams(params);
  }, [params]);

  const toggle = useCallback(() => {
    if (engineRef.current?.isRunning()) {
      void engineRef.current.stop();
      setIsPlaying(false);
    } else {
      const engine = new AnnealMusicEngine(useParamStore.getState().params);
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
