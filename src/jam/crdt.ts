import * as Y from 'yjs';
import { useParamStore } from '@/state/params';
import type { ParamKey } from '@/state/params';
import type { EngineId } from '@/audio/engines/types';
import type { SlotId } from '@/loop/types';

export const doc = new Y.Doc();

export const sculptParamsMap = doc.getMap<number>('sculpt_params');
export const engineIdText = doc.getText('engine_id');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const engineParamsMap = doc.getMap<Y.Map<any>>('engine_params');
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const sessionConfigMap = doc.getMap<any>('session_config');
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
useParamStore.subscribe((state, prevState) => {
  if (isApplyingRemote) return;

  doc.transact(() => {
    // 1. Sync standard parameters
    for (const [k, val] of Object.entries(state.params)) {
      const prevVal = prevState.params[k as ParamKey];
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
    for (const [engId, engParams] of Object.entries(state.engineParams)) {
      if (!engParams) continue;
      const prevEngParams = prevState.engineParams[engId as EngineId] || {};

      let engMap = engineParamsMap.get(engId);
      if (!engMap) {
        engMap = new Y.Map();
        engineParamsMap.set(engId, engMap);
      }

      for (const [paramKey, val] of Object.entries(engParams)) {
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
    for (const [slotId, slotConfig] of Object.entries(state.loops)) {
      const prevSlotConfig = prevState.loops[slotId as SlotId];
      if (slotConfig !== prevSlotConfig) {
        let slotMap = loopSlotsMap.get(slotId);
        if (!slotMap) {
          slotMap = new Y.Map();
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
          let grainMap = slotMap.get('grain');
          if (!grainMap) {
            grainMap = new Y.Map();
            slotMap.set('grain', grainMap);
          }
          for (const [gKey, gVal] of Object.entries(slotConfig.grain)) {
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
    for (const [k, val] of Object.entries(initial.params)) {
      sculptParamsMap.set(k, val);
    }

    if (engineIdText.toString() !== initial.engineId) {
      engineIdText.delete(0, engineIdText.length);
      engineIdText.insert(0, initial.engineId);
    }

    for (const [engId, engParams] of Object.entries(initial.engineParams)) {
      if (!engParams) continue;
      const engMap = new Y.Map();
      for (const [paramKey, val] of Object.entries(engParams)) {
        engMap.set(paramKey, val);
      }
      engineParamsMap.set(engId, engMap);
    }

    sessionConfigMap.set('sessionMode', initial.sessionMode);
    sessionConfigMap.set('arcId', initial.arcId);
    sessionConfigMap.set('arcDurationSec', initial.arcDurationSec);

    for (const [slotId, slotConfig] of Object.entries(initial.loops)) {
      const slotMap = new Y.Map();
      slotMap.set('muted', slotConfig.muted);
      slotMap.set('frozen', slotConfig.frozen);
      slotMap.set('driftCoupled', slotConfig.driftCoupled);

      const grainMap = new Y.Map();
      for (const [gKey, gVal] of Object.entries(slotConfig.grain)) {
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
      sculptParamsMap.forEach((val, key) => {
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
      engineParamsMap.forEach((engMap, engId) => {
        engMap.forEach((val, paramKey) => {
          const currentVal = store.engineParams[engId as EngineId]?.[paramKey];
          if (currentVal !== val) {
            store.setEngineParam(engId as EngineId, paramKey, val);
          }
        });
      });

      // 4. Session Configuration
      const remoteSessionMode = sessionConfigMap.get('sessionMode');
      if (remoteSessionMode && store.sessionMode !== remoteSessionMode) {
        store.setSessionMode(remoteSessionMode);
      }
      const remoteArcId = sessionConfigMap.get('arcId');
      if (remoteArcId && store.arcId !== remoteArcId) {
        store.setArcId(remoteArcId);
      }
      const remoteArcDurationSec = sessionConfigMap.get('arcDurationSec');
      if (
        remoteArcDurationSec &&
        store.arcDurationSec !== remoteArcDurationSec
      ) {
        store.setArcDurationSec(remoteArcDurationSec);
      }

      // 5. Loops configuration
      loopSlotsMap.forEach((slotMap, slotId) => {
        const currentSlotConfig = store.loops[slotId as SlotId];
        if (!currentSlotConfig) return;

        const nextSlotConfig = { ...currentSlotConfig };
        let slotChanged = false;

        const muted = slotMap.get('muted');
        if (muted !== undefined && muted !== nextSlotConfig.muted) {
          nextSlotConfig.muted = muted;
          slotChanged = true;
        }

        const frozen = slotMap.get('frozen');
        if (frozen !== undefined && frozen !== nextSlotConfig.frozen) {
          nextSlotConfig.frozen = frozen;
          slotChanged = true;
        }

        const driftCoupled = slotMap.get('driftCoupled');
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
          grainMap.forEach((val, gKey) => {
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
