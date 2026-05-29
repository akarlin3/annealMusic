import { CURVES } from '@/session/curves';
import type { CurveName } from '@/session/types';
import type { AnnealMusicParams } from '@/state/params';
import type { EngineId, EngineParams } from '@/audio/engines/types';

export interface PieceState {
  params: Partial<AnnealMusicParams>;
  engineId: EngineId;
  engineParams: Partial<Record<EngineId, EngineParams>>;
}

/**
 * Interpolate between two piece states over normalized progress t [0..1]
 * using the specified easing curve.
 */
export function interpolateState(
  prev: PieceState,
  next: PieceState,
  t: number,
  easing: CurveName,
): PieceState {
  const curve = CURVES[easing] || CURVES.linear;
  const easedT = curve(t);

  // 1. Interpolate shared params (only numeric ones)
  const params: Partial<AnnealMusicParams> = {};
  const allParamKeys = new Set([
    ...Object.keys(prev.params),
    ...Object.keys(next.params),
  ]) as Set<keyof AnnealMusicParams>;

  for (const key of allParamKeys) {
    const prevVal = prev.params[key];
    const nextVal = next.params[key];
    if (prevVal === undefined) {
      params[key] = nextVal;
    } else if (nextVal === undefined) {
      params[key] = prevVal;
    } else if (typeof prevVal === 'number' && typeof nextVal === 'number') {
      params[key] = prevVal + (nextVal - prevVal) * easedT;
    } else {
      params[key] = easedT < 0.5 ? prevVal : nextVal;
    }
  }

  // 2. Interpolate engine parameters if engine is the same
  const engineId = easedT < 0.5 ? prev.engineId : next.engineId;
  const engineParams: Partial<Record<EngineId, EngineParams>> = {};

  if (prev.engineId === next.engineId) {
    const id = prev.engineId;
    const prevEP = prev.engineParams[id] || {};
    const nextEP = next.engineParams[id] || {};
    const keys = new Set([...Object.keys(prevEP), ...Object.keys(nextEP)]);
    const bag: Record<string, any> = {}; // eslint-disable-line @typescript-eslint/no-explicit-any
    for (const key of keys) {
      const prevVal = prevEP[key];
      const nextVal = nextEP[key];
      if (prevVal === undefined) {
        bag[key] = nextVal;
      } else if (nextVal === undefined) {
        bag[key] = prevVal;
      } else if (typeof prevVal === 'number' && typeof nextVal === 'number') {
        bag[key] = prevVal + (nextVal - prevVal) * easedT;
      } else {
        bag[key] = easedT < 0.5 ? prevVal : nextVal;
      }
    }
    engineParams[id] = bag as any; // eslint-disable-line @typescript-eslint/no-explicit-any
  } else {
    engineParams[prev.engineId] = prev.engineParams[prev.engineId];
    engineParams[next.engineId] = next.engineParams[next.engineId];
  }

  return {
    params,
    engineId,
    engineParams,
  };
}
