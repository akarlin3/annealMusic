import { useCallback, useState } from 'react';
import type { Orchestrator } from '@/audio/orchestrator';
import { useParamStore } from '@/state/params';
import { SCHEMA_VERSION } from '@/share/schema';
import { decodeState, encodeState } from '@/share/encode';
import { applyDecodedToStore, captureSlotsFromPayload } from '@/share/hydrate';
import { SLOT_IDS, type SlotId } from '@/loop/types';
import { api } from '@/api/client';
import { encodeWav } from '@/api/wav';
import {
  ApiError,
  NetworkError,
  type Patch,
  type Visibility,
} from '@/api/types';
import type { LoopsApi } from '@/hooks/useLoops';

export interface SaveOptions {
  title?: string;
  description?: string;
  visibility: Visibility;
  includeCaptures: boolean;
}

export interface SaveResult {
  slug: string;
  url: string;
}

/** Human-readable message for an API/network failure. */
function describeError(err: unknown): string {
  if (err instanceof NetworkError)
    return "Couldn't reach the server — your link still works";
  if (err instanceof ApiError) {
    switch (err.code) {
      case 'quota_exceeded':
        return 'Storage full — delete a patch and try again';
      case 'rate_limited':
        return 'Too many saves — try again in a bit';
      case 'invalid_state':
        return "This patch couldn't be validated";
      case 'file_too_large':
        return 'Capture too large to upload';
      default:
        return 'Save failed';
    }
  }
  return 'Save failed';
}

export interface PatchPersistence {
  saving: boolean;
  loading: boolean;
  savePatch: (opts: SaveOptions) => Promise<SaveResult | null>;
  loadPatch: (idOrSlug: string) => Promise<boolean>;
  listMine: () => Promise<Patch[]>;
  deletePatch: (id: string) => Promise<boolean>;
}

export function usePatches(
  ensureOrchestrator: () => Orchestrator,
  loops: LoopsApi,
  showToast: (msg: string) => void,
): PatchPersistence {
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const buildPayload = useCallback((): string => {
    const s = useParamStore.getState();
    return encodeState(
      s.params,
      s.engineId,
      s.engineParams[s.engineId] ?? {},
      { mode: s.sessionMode, arcId: s.arcId, durationSec: s.arcDurationSec },
      s.loops,
    );
  }, []);

  const savePatch = useCallback(
    async (opts: SaveOptions): Promise<SaveResult | null> => {
      setSaving(true);
      try {
        let payload = buildPayload();
        const captureRefs: string[] = [];

        if (opts.includeCaptures) {
          for (const id of SLOT_IDS) {
            const buffer = loops.getBuffer(id);
            if (!buffer) continue;
            const capture = await api.uploadCapture(encodeWav(buffer));
            captureRefs.push(capture.id);
            payload += `&L${id}.cap=1`;
          }
        }

        const patch = await api.createPatch({
          state: payload,
          schema_ver: SCHEMA_VERSION,
          title: opts.title,
          description: opts.description,
          visibility: opts.visibility,
          capture_refs: captureRefs,
        });

        const url = `${window.location.origin}/p/${patch.short_slug}`;
        showToast('Patch saved');
        return { slug: patch.short_slug, url };
      } catch (err) {
        showToast(describeError(err));
        return null;
      } finally {
        setSaving(false);
      }
    },
    [buildPayload, loops, showToast],
  );

  const loadPatch = useCallback(
    async (idOrSlug: string): Promise<boolean> => {
      setLoading(true);
      try {
        const patch = await api.getPatch(idOrSlug);

        // Reuse the lenient URL decoder to turn the payload into store state.
        const decoded = decodeState(patch.schema_ver, patch.state);
        applyDecodedToStore(decoded);

        // Hydrate any captures into their slots, in flagged-slot order.
        const slots = captureSlotsFromPayload(patch.state);
        if (slots.length > 0 && patch.capture_refs.length > 0) {
          const orch = ensureOrchestrator();
          for (let i = 0; i < slots.length; i++) {
            const slotId: SlotId = slots[i] as SlotId;
            const refId = patch.capture_refs[i];
            if (!refId) continue;
            const bytes = await api.fetchCaptureBytes(refId);
            const buffer = await orch.decodeAudio(bytes);
            orch.loadLoopBuffer(slotId, buffer);
          }
          showToast('Loaded patch with audio');
        } else {
          showToast('Loaded saved patch');
        }
        return true;
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          showToast('Patch not found');
        } else {
          showToast("Couldn't load patch — backend offline?");
        }
        return false;
      } finally {
        setLoading(false);
      }
    },
    [ensureOrchestrator, showToast],
  );

  const listMine = useCallback(async (): Promise<Patch[]> => {
    try {
      const list = await api.myPatches();
      return list.items;
    } catch {
      showToast("Couldn't load your patches");
      return [];
    }
  }, [showToast]);

  const deletePatch = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        await api.deletePatch(id);
        return true;
      } catch {
        showToast("Couldn't delete patch");
        return false;
      }
    },
    [showToast],
  );

  return { saving, loading, savePatch, loadPatch, listMine, deletePatch };
}
