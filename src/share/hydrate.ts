import { useParamStore } from '@/state/params';
import { SLOT_IDS, type SlotId } from '@/loop/types';
import type { DecodedState } from '@/share/encode';
import type { EngineId } from '@/audio/engines/types';

/**
 * Apply a decoded share/patch state into the param store. Shared by the URL
 * boot path (`#s=` inline links) and the backend load path (`/p/<slug>` short
 * links) so the two can never drift in how they hydrate the store.
 */
export function applyDecodedToStore(decoded: DecodedState): void {
  const store = useParamStore.getState();

  if (Object.keys(decoded.params).length > 0) store.setMany(decoded.params);
  store.setEngine(decoded.engineId);

  const engineEntries = Object.entries(decoded.engineParams) as [
    EngineId,
    Record<string, number>,
  ][];
  for (const [id, bag] of engineEntries) {
    for (const [key, value] of Object.entries(bag)) {
      store.setEngineParam(id, key, value);
    }
  }

  store.setSessionMode(decoded.mode);
  if (decoded.arcId) store.setArcId(decoded.arcId);
  if (decoded.durationSec !== undefined) {
    store.setArcDurationSec(decoded.durationSec);
  }
  for (const id of SLOT_IDS) {
    store.setLoopConfig(id, decoded.loops[id]);
  }
}

/**
 * Read which slots ship with a server-stored capture from a patch payload, in
 * slot order. The capture_refs array is ordered to match (slot A's capture
 * first, then B, then C — for the slots flagged `L<id>.cap=1`).
 */
export function captureSlotsFromPayload(payload: string): SlotId[] {
  const out: SlotId[] = [];
  for (const id of SLOT_IDS) {
    if (payload.includes(`L${id}.cap=1`)) out.push(id);
  }
  return out;
}
