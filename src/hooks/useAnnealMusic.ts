import { useAudioEngine } from '@/hooks/useAudioEngine';
import {
  useParamStore,
  type AnnealMusicParams,
  type ParamKey,
} from '@/state/params';
import type { EngineId, EngineParams } from '@/audio/engines/types';

export interface AnnealMusicApi {
  params: AnnealMusicParams;
  setParam: (key: ParamKey, value: number) => void;
  engineId: EngineId;
  engineParams: Partial<Record<EngineId, EngineParams>>;
  setEngine: (id: EngineId) => void;
  setEngineParam: (id: EngineId, key: string, value: number) => void;
  isPlaying: boolean;
  toggle: () => void;
  engineRef: ReturnType<typeof useAudioEngine>['engineRef'];
}

/** Top-level orchestration hook: param store + audio engine. */
export function useAnnealMusic(): AnnealMusicApi {
  const params = useParamStore((s) => s.params);
  const setParam = useParamStore((s) => s.setParam);
  const engineId = useParamStore((s) => s.engineId);
  const engineParams = useParamStore((s) => s.engineParams);
  const setEngine = useParamStore((s) => s.setEngine);
  const setEngineParam = useParamStore((s) => s.setEngineParam);
  const { isPlaying, toggle, engineRef } = useAudioEngine();

  return {
    params,
    setParam,
    engineId,
    engineParams,
    setEngine,
    setEngineParam,
    isPlaying,
    toggle,
    engineRef,
  };
}
