import * as Y from 'yjs';
import { useParamStore } from '@/state/params';
import type { ParamKey, ParamStore } from '@/state/params';
import type { EngineId } from '@/audio/engines/types';
import type { SlotId, SlotConfig } from '@/loop/types';
import type { SessionMode } from '@/session/types';

export const doc = new Y.Doc();

export const sculptParamsMap = doc.getMap<number>('sculpt_params');
export const engineIdText = doc.getText('engine_id');
export const engineParamsMap =
  doc.getMap<Y.Map<number | string>>('engine_params');
export const sessionConfigMap = doc.getMap<string | number>('session_config');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const loopSlotsMap = doc.getMap<Y.Map<any>>('loop_slots');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const metadataMap = doc.getMap<any>('metadata');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const presenceMap = doc.getMap<any>('presence');

let isApplyingRemote = false;

export function setApplyingRemote(val: boolean) {
  isApplyingRemote = val;
}

export function getApplyingRemote() {
  return isApplyingRemote;
}

// Bind Zustand store mutations to Yjs CRDT
useParamStore.subscribe((state: ParamStore, prevState: ParamStore) => {
  if (isApplyingRemote) return;

  doc.transact(() => {
    // 1. Sync standard parameters
    for (const [k, val] of Object.entries(state.params) as [
      ParamKey,
      number,
    ][]) {
      const prevVal = prevState.params[k];
      if (val !== prevVal) {
        sculptParamsMap.set(k, val);
      }
    }

    // 2. Sync engine selection
    if (state.engineId !== prevState.engineId) {
      if (engineIdText.toString() !== state.engineId) {
        engineIdText.delete(0, engineIdText.length);
        engineIdText.insert(0, state.engineId);
      }
    }

    // 3. Sync engine specific params
    for (const [engId, engParams] of Object.entries(state.engineParams) as [
      EngineId,
      Record<string, number | string>,
    ][]) {
      if (!engParams) continue;
      const prevEngParams = prevState.engineParams[engId] || {};

      let engMap = engineParamsMap.get(engId);
      if (!engMap) {
        engMap = new Y.Map<number | string>();
        engineParamsMap.set(engId, engMap);
      }

      for (const [paramKey, val] of Object.entries(engParams) as [
        string,
        number | string,
      ][]) {
        if (val !== prevEngParams[paramKey]) {
          engMap.set(paramKey, val);
        }
      }
    }

    // 4. Sync session config
    if (state.sessionMode !== prevState.sessionMode) {
      sessionConfigMap.set('sessionMode', state.sessionMode);
    }
    if (state.arcId !== prevState.arcId) {
      sessionConfigMap.set('arcId', state.arcId);
    }
    if (state.arcDurationSec !== prevState.arcDurationSec) {
      sessionConfigMap.set('arcDurationSec', state.arcDurationSec);
    }

    // 5. Sync loop configurations
    for (const [slotId, slotConfig] of Object.entries(state.loops) as [
      SlotId,
      SlotConfig,
    ][]) {
      const prevSlotConfig = prevState.loops[slotId];
      if (slotConfig !== prevSlotConfig) {
        let slotMap = loopSlotsMap.get(slotId);
        if (!slotMap) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          slotMap = new Y.Map<any>();
          loopSlotsMap.set(slotId, slotMap);
        }

        if (!prevSlotConfig || slotConfig.muted !== prevSlotConfig.muted) {
          slotMap.set('muted', slotConfig.muted);
        }
        if (!prevSlotConfig || slotConfig.frozen !== prevSlotConfig.frozen) {
          slotMap.set('frozen', slotConfig.frozen);
        }
        if (
          !prevSlotConfig ||
          slotConfig.driftCoupled !== prevSlotConfig.driftCoupled
        ) {
          slotMap.set('driftCoupled', slotConfig.driftCoupled);
        }

        // Sync grain params if changed
        if (!prevSlotConfig || slotConfig.grain !== prevSlotConfig.grain) {
          let grainMap = slotMap.get('grain') as Y.Map<number> | undefined;
          if (!grainMap) {
            grainMap = new Y.Map<number>();
            slotMap.set('grain', grainMap);
          }
          for (const [gKey, gVal] of Object.entries(slotConfig.grain) as [
            string,
            number,
          ][]) {
            if (
              !prevSlotConfig ||
              gVal !==
                prevSlotConfig.grain[gKey as keyof typeof slotConfig.grain]
            ) {
              grainMap.set(gKey, gVal);
            }
          }
        }
      }
    }
  });
});

export function initializeCrdtSync() {
  const initial = useParamStore.getState();

  // Seed initial Y.Doc values from the current Zustand state
  doc.transact(() => {
    for (const [k, val] of Object.entries(initial.params) as [
      ParamKey,
      number,
    ][]) {
      sculptParamsMap.set(k, val);
    }

    if (engineIdText.toString() !== initial.engineId) {
      engineIdText.delete(0, engineIdText.length);
      engineIdText.insert(0, initial.engineId);
    }

    for (const [engId, engParams] of Object.entries(initial.engineParams) as [
      EngineId,
      Record<string, number | string>,
    ][]) {
      if (!engParams) continue;
      const engMap = new Y.Map<number | string>();
      for (const [paramKey, val] of Object.entries(engParams) as [
        string,
        number | string,
      ][]) {
        engMap.set(paramKey, val);
      }
      engineParamsMap.set(engId, engMap);
    }

    sessionConfigMap.set('sessionMode', initial.sessionMode);
    sessionConfigMap.set('arcId', initial.arcId);
    sessionConfigMap.set('arcDurationSec', initial.arcDurationSec);

    for (const [slotId, slotConfig] of Object.entries(initial.loops) as [
      SlotId,
      SlotConfig,
    ][]) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const slotMap = new Y.Map<any>();
      slotMap.set('muted', slotConfig.muted);
      slotMap.set('frozen', slotConfig.frozen);
      slotMap.set('driftCoupled', slotConfig.driftCoupled);

      const grainMap = new Y.Map<number>();
      for (const [gKey, gVal] of Object.entries(slotConfig.grain) as [
        string,
        number,
      ][]) {
        grainMap.set(gKey, gVal);
      }
      slotMap.set('grain', grainMap);
      loopSlotsMap.set(slotId, slotMap);
    }
  });

  // Observe and apply remote updates to Zustand
  doc.on('update', () => {
    if (isApplyingRemote) return;

    isApplyingRemote = true;
    try {
      const store = useParamStore.getState();

      // 1. Standard parameters
      const nextParams = { ...store.params };
      let paramsChanged = false;
      sculptParamsMap.forEach((val: number, key: string) => {
        if (nextParams[key as ParamKey] !== val) {
          nextParams[key as ParamKey] = val;
          paramsChanged = true;
        }
      });
      if (paramsChanged) {
        store.setMany(nextParams);
      }

      // 2. Engine ID selection
      const remoteEngineId = engineIdText.toString() as EngineId;
      if (remoteEngineId && store.engineId !== remoteEngineId) {
        store.setEngine(remoteEngineId);
      }

      // 3. Engine specific parameters
      engineParamsMap.forEach(
        (engMap: Y.Map<number | string>, engId: string) => {
          engMap.forEach((val: number | string, paramKey: string) => {
            const currentVal =
              store.engineParams[engId as EngineId]?.[paramKey];
            if (currentVal !== val) {
              store.setEngineParam(engId as EngineId, paramKey, val);
            }
          });
        },
      );

      // 4. Session Configuration
      const remoteSessionMode = sessionConfigMap.get('sessionMode') as
        | SessionMode
        | undefined;
      if (remoteSessionMode && store.sessionMode !== remoteSessionMode) {
        store.setSessionMode(remoteSessionMode);
      }
      const remoteArcId = sessionConfigMap.get('arcId') as string | undefined;
      if (remoteArcId && store.arcId !== remoteArcId) {
        store.setArcId(remoteArcId);
      }
      const remoteArcDurationSec = sessionConfigMap.get('arcDurationSec') as
        | number
        | undefined;
      if (
        remoteArcDurationSec &&
        store.arcDurationSec !== remoteArcDurationSec
      ) {
        store.setArcDurationSec(remoteArcDurationSec);
      }

      // 5. Loops configuration
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      loopSlotsMap.forEach((slotMap: Y.Map<any>, slotId: string) => {
        const currentSlotConfig = store.loops[slotId as SlotId];
        if (!currentSlotConfig) return;

        const nextSlotConfig = { ...currentSlotConfig };
        let slotChanged = false;

        const muted = slotMap.get('muted') as boolean | undefined;
        if (muted !== undefined && muted !== nextSlotConfig.muted) {
          nextSlotConfig.muted = muted;
          slotChanged = true;
        }

        const frozen = slotMap.get('frozen') as boolean | undefined;
        if (frozen !== undefined && frozen !== nextSlotConfig.frozen) {
          nextSlotConfig.frozen = frozen;
          slotChanged = true;
        }

        const driftCoupled = slotMap.get('driftCoupled') as boolean | undefined;
        if (
          driftCoupled !== undefined &&
          driftCoupled !== nextSlotConfig.driftCoupled
        ) {
          nextSlotConfig.driftCoupled = driftCoupled;
          slotChanged = true;
        }

        const grainMap = slotMap.get('grain');
        if (grainMap instanceof Y.Map) {
          const nextGrain = { ...nextSlotConfig.grain };
          let grainChanged = false;
          (grainMap as Y.Map<number>).forEach((val: number, gKey: string) => {
            if (nextGrain[gKey as keyof typeof nextSlotConfig.grain] !== val) {
              nextGrain[gKey as keyof typeof nextSlotConfig.grain] = val;
              grainChanged = true;
            }
          });
          if (grainChanged) {
            nextSlotConfig.grain = nextGrain;
            slotChanged = true;
          }
        }

        if (slotChanged) {
          store.setLoopConfig(slotId as SlotId, nextSlotConfig);
        }
      });
    } finally {
      isApplyingRemote = false;
    }
  });
}
