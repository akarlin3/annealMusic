import type { Orchestrator } from '@/audio/orchestrator';
import { SLOT_IDS } from '@/loop/types';
import type { SlotId } from '@/loop/types';

export type StemId =
  | 'engine'
  | 'engine-fx'
  | 'input'
  | 'input-fx'
  | 'loop-A'
  | 'loop-A-fx'
  | 'loop-B'
  | 'loop-B-fx'
  | 'loop-C'
  | 'loop-C-fx'
  | 'master';

export interface StemDef {
  id: StemId | string;
  label: string;
  channels: 1 | 2;
  isFx: boolean;
  type: 'engine' | 'input' | 'loop' | 'master' | 'partial';
  slotId?: SlotId;
  partialIndex?: number;
}

export interface GetActiveStemsOptions {
  includeFx: boolean;
  includePartials: boolean;
}

/**
 * Computes the active set of stems available for the current session state.
 * Filters out empty loop slots and disconnected input devices.
 */
export function getActiveStems(
  orchestrator: Orchestrator,
  options: GetActiveStemsOptions,
): StemDef[] {
  const stems: StemDef[] = [];

  // 1. Engine stems
  stems.push({
    id: 'engine',
    label: 'Engine Output (Raw)',
    channels: 2,
    isFx: false,
    type: 'engine',
  });

  if (options.includeFx) {
    stems.push({
      id: 'engine-fx',
      label: 'Engine Output (Post-FX)',
      channels: 2,
      isFx: true,
      type: 'engine',
    });
  }

  // 2. Per-partial stems (opt-in)
  if (options.includePartials) {
    const partialCount = orchestrator.getPartialCount();
    for (let i = 0; i < partialCount; i++) {
      stems.push({
        id: `partial-${i}`,
        label: `Engine Partial ${i + 1}`,
        channels: 1,
        isFx: false,
        type: 'partial',
        partialIndex: i,
      });
    }
  }

  // 3. Input voice stems
  const inputVoice = orchestrator.getInputVoice();
  if (inputVoice && inputVoice.isConnected()) {
    stems.push({
      id: 'input',
      label: 'Input Voice (Raw)',
      channels: 1,
      isFx: false,
      type: 'input',
    });

    if (options.includeFx) {
      stems.push({
        id: 'input-fx',
        label: 'Input Voice (Post-FX)',
        channels: 2,
        isFx: true,
        type: 'input',
      });
    }
  }

  // 4. Loop slot stems
  for (const slotId of SLOT_IDS) {
    const slot = orchestrator.getLoopSlot(slotId);
    if (slot && slot.hasBuffer()) {
      stems.push({
        id: `loop-${slotId}` as StemId,
        label: `Loop Slot ${slotId} (Raw)`,
        channels: 1,
        isFx: false,
        type: 'loop',
        slotId,
      });

      if (options.includeFx) {
        stems.push({
          id: `loop-${slotId}-fx` as StemId,
          label: `Loop Slot ${slotId} (Post-FX)`,
          channels: 2,
          isFx: true,
          type: 'loop',
          slotId,
        });
      }
    }
  }

  // 5. Master stem
  stems.push({
    id: 'master',
    label: 'Master Mix (Full)',
    channels: 2,
    isFx: true,
    type: 'master',
  });

  return stems;
}
