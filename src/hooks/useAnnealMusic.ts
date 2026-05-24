import { useSession, type SessionApi } from '@/hooks/useSession';
import {
  useParamStore,
  type AnnealMusicParams,
  type ParamKey,
} from '@/state/params';
import type { EngineId, EngineParams } from '@/audio/engines/types';
import type { SessionMode } from '@/session/types';

export interface AnnealMusicApi {
  params: AnnealMusicParams;
  setParam: (key: ParamKey, value: number) => void;
  engineId: EngineId;
  engineParams: Partial<Record<EngineId, EngineParams>>;
  setEngine: (id: EngineId) => void;
  setEngineParam: (id: EngineId, key: string, value: number) => void;
  sessionMode: SessionMode;
  arcId: string;
  arcDurationSec: number;
  setSessionMode: (mode: SessionMode) => void;
  setArcId: (id: string) => void;
  setArcDurationSec: (sec: number) => void;
  sessionState: SessionApi['sessionState'];
  isPlaying: boolean;
  startSession: SessionApi['startSession'];
  stopSession: SessionApi['stopSession'];
  arcProgress: SessionApi['arcProgress'];
  engineRef: SessionApi['engineRef'];
}

/** Top-level orchestration hook: param store + session/orchestrator. */
export function useAnnealMusic(): AnnealMusicApi {
  const params = useParamStore((s) => s.params);
  const setParam = useParamStore((s) => s.setParam);
  const engineId = useParamStore((s) => s.engineId);
  const engineParams = useParamStore((s) => s.engineParams);
  const setEngine = useParamStore((s) => s.setEngine);
  const setEngineParam = useParamStore((s) => s.setEngineParam);
  const sessionMode = useParamStore((s) => s.sessionMode);
  const arcId = useParamStore((s) => s.arcId);
  const arcDurationSec = useParamStore((s) => s.arcDurationSec);
  const setSessionMode = useParamStore((s) => s.setSessionMode);
  const setArcId = useParamStore((s) => s.setArcId);
  const setArcDurationSec = useParamStore((s) => s.setArcDurationSec);

  const {
    sessionState,
    isPlaying,
    startSession,
    stopSession,
    arcProgress,
    engineRef,
  } = useSession();

  return {
    params,
    setParam,
    engineId,
    engineParams,
    setEngine,
    setEngineParam,
    sessionMode,
    arcId,
    arcDurationSec,
    setSessionMode,
    setArcId,
    setArcDurationSec,
    sessionState,
    isPlaying,
    startSession,
    stopSession,
    arcProgress,
    engineRef,
  };
}
