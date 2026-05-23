import { useAudioEngine } from '@/hooks/useAudioEngine';
import {
  useParamStore,
  type AnnealMusicParams,
  type ParamKey,
} from '@/state/params';

export interface AnnealMusicApi {
  params: AnnealMusicParams;
  setParam: (key: ParamKey, value: number) => void;
  isPlaying: boolean;
  toggle: () => void;
  engineRef: ReturnType<typeof useAudioEngine>['engineRef'];
}

/** Top-level orchestration hook: param store + audio engine. */
export function useAnnealMusic(): AnnealMusicApi {
  const params = useParamStore((s) => s.params);
  const setParam = useParamStore((s) => s.setParam);
  const { isPlaying, toggle, engineRef } = useAudioEngine();

  return { params, setParam, isPlaying, toggle, engineRef };
}
