import { useCallback, useEffect, useRef, useState } from 'react';
import type { Orchestrator } from '@/audio/orchestrator';
import { useParamStore } from '@/state/params';
import {
  SLOT_IDS,
  type GrainParams,
  type SlotConfig,
  type SlotId,
  type SlotState,
} from '@/loop/types';
import { useJam } from '@/jam/JamProvider';
import { shareLocalCapture } from '@/jam/bufferSharing';

export interface SlotView {
  state: SlotState;
  hasBuffer: boolean;
  config: SlotConfig;
}

export interface LoopsApi {
  slots: Record<SlotId, SlotView>;
  ready: boolean;
  /** Context-aware primary action (the `1`/`2`/`3` hotkey behavior). */
  primary: (id: SlotId) => void;
  /** Freeze ↔ unfreeze (the `Shift+1/2/3` hotkey behavior). */
  toggleFreeze: (id: SlotId) => void;
  clear: (id: SlotId) => void;
  setGrain: (id: SlotId, grain: GrainParams) => void;
  setDriftCoupled: (id: SlotId, on: boolean) => void;
  getAnalyser: (id: SlotId) => AnalyserNode | null;
  getBuffer: (id: SlotId) => AudioBuffer | null;
}

function emptyView(config: SlotConfig): SlotView {
  return { state: 'empty', hasBuffer: false, config };
}

/**
 * React bridge for the loop pedal. Live slot *state* (empty/armed/capturing/…)
 * lives in the orchestrator's `LoopSlot` instances and is mirrored here on
 * change; slot *config* (muted/frozen/grain) is mirrored into the param store so
 * it rides along in shareable URLs. Buffers stay runtime-only (never persisted).
 */
export function useLoops(
  ensureOrchestrator: () => Orchestrator,
  onToast?: (text: string) => void,
): LoopsApi {
  const loopConfig = useParamStore((s) => s.loops);
  const setLoopConfig = useParamStore((s) => s.setLoopConfig);
  const jam = useJam();

  const [slots, setSlots] = useState<Record<SlotId, SlotView>>({
    A: emptyView(loopConfig.A),
    B: emptyView(loopConfig.B),
    C: emptyView(loopConfig.C),
  });
  const [ready, setReady] = useState(false);

  const orchRef = useRef<Orchestrator | null>(null);
  const wired = useRef(false);
  const unsubs = useRef<(() => void)[]>([]);
  const wasCapturing = useRef<Record<SlotId, boolean>>({
    A: false,
    B: false,
    C: false,
  });

  const syncSlot = useCallback(
    (id: SlotId) => {
      const slot = orchRef.current?.getLoopSlot(id);
      if (!slot) return;
      const config = slot.getConfig();
      const state = slot.getState();

      setSlots((prev) => ({
        ...prev,
        [id]: { state, hasBuffer: slot.hasBuffer(), config },
      }));
      // Keep the shareable URL in sync with mute/freeze/grain changes.
      setLoopConfig(id, config);

      // If we just finished capturing a loop in a jam session, upload and share it!
      if (wasCapturing.current[id] && state === 'playing' && jam?.session) {
        const buffer = slot.getBuffer();
        if (buffer) {
          void shareLocalCapture(id, buffer, onToast);
        }
      }
      wasCapturing.current[id] = state === 'capturing';
    },
    [setLoopConfig, jam?.session, onToast],
  );

  const wire = useCallback((): Orchestrator => {
    const orch = ensureOrchestrator();
    orchRef.current = orch;
    if (!wired.current) {
      orch.ensureLoops();
      for (const id of SLOT_IDS) {
        const slot = orch.getLoopSlot(id);
        if (slot) unsubs.current.push(slot.onStateChange(() => syncSlot(id)));
      }
      wired.current = true;
      setReady(true);
      for (const id of SLOT_IDS) syncSlot(id);
    }
    return orch;
  }, [ensureOrchestrator, syncSlot]);

  useEffect(
    () => () => {
      for (const u of unsubs.current) u();
      unsubs.current = [];
    },
    [],
  );

  const primary = useCallback(
    (id: SlotId) => {
      const orch = wire();
      const state = orch.getLoopState(id);
      const slot = orch.getLoopSlot(id);
      switch (state) {
        case 'empty':
          if (!orch.getInputVoice()?.isConnected()) {
            onToast?.('Connect an input before capturing a loop');
            return;
          }
          orch.armLoop(id);
          break;
        case 'armed':
          slot?.startCapture();
          break;
        case 'capturing':
          slot?.stopCapture();
          break;
        default:
          slot?.toggleMute();
      }
    },
    [wire, onToast],
  );

  const toggleFreeze = useCallback(
    (id: SlotId) => {
      const orch = wire();
      const slot = orch.getLoopSlot(id);
      const state = orch.getLoopState(id);
      if (state === 'playing') slot?.freeze();
      else if (state === 'frozen') slot?.unfreeze();
    },
    [wire],
  );

  const clear = useCallback(
    (id: SlotId) => {
      wire().getLoopSlot(id)?.clear();
    },
    [wire],
  );

  const setGrain = useCallback(
    (id: SlotId, grain: GrainParams) => {
      const orch = wire();
      orch.setLoopGrain(id, grain);
      const slot = orch.getLoopSlot(id);
      if (slot) setLoopConfig(id, slot.getConfig());
    },
    [wire, setLoopConfig],
  );

  const setDriftCoupled = useCallback(
    (id: SlotId, on: boolean) => {
      const orch = wire();
      orch.setLoopDriftCoupled(id, on);
      const slot = orch.getLoopSlot(id);
      if (slot) setLoopConfig(id, slot.getConfig());
    },
    [wire, setLoopConfig],
  );

  const getAnalyser = useCallback(
    (id: SlotId) => orchRef.current?.getLoopSlot(id)?.getAnalyser() ?? null,
    [],
  );

  const getBuffer = useCallback(
    (id: SlotId) => orchRef.current?.getLoopSlot(id)?.getBuffer() ?? null,
    [],
  );

  return {
    slots,
    ready,
    primary,
    toggleFreeze,
    clear,
    setGrain,
    setDriftCoupled,
    getAnalyser,
    getBuffer,
  };
}
